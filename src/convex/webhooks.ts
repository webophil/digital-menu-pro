import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  checkoutSessionPeriodStartMs,
  invoicePeriodEndMs,
  invoicePeriodStartMs,
  listAllSubscriptions,
  resolveCheckoutPeriodEndMs,
  stripeGetJson,
  subscriptionCycle,
  subscriptionPeriodEndMs,
} from "../lib/stripeHttp";

/**
 * Webhook de paiement Stripe (encaissement standard : l'exploitant est le
 * vendeur, micro-entrepreneur non assujetti à la TVA).
 * Vérifie la signature Stripe avec STRIPE_WEBHOOK_SECRET, puis met à jour
 * le plan de l'abonné et enregistre la facture.
 *
 * Événements traités :
 * - checkout.session.completed : premier paiement (metadata user_id/cycle)
 * - invoice.paid / invoice.payment_failed : renouvellements et échecs
 * - customer.subscription.created / .updated : identifiants Stripe enregistrés
 *   (externalCustomerId / externalSubscriptionId) + résiliation programmée
 * - customer.subscription.deleted : fin effective (passage en Gratuit)
 */
export const paymentWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await request.text();

  const sig = request.headers.get("stripe-signature") ?? "";
  let event: any;
  try {
    if (secret) {
      // Implémentation minimale de stripe.webhooks.constructEvent
      // (le SDK n'est pas importable dans un httpAction sans "use node").
      const parts = sig.split(",").map((p) => p.split("="));
      const timestamp = parts.find((p) => p[0] === "t")?.[1];
      const v1 = parts.find((p) => p[0] === "v1")?.[1];
      if (!timestamp || !v1) throw new Error("Signature absente");

      const expected = await hmacHex(`${timestamp}.${raw}`, secret);
      const ok =
        timingSafeEqual(expected, v1) &&
        Math.abs(Date.now() / 1000 - Number(timestamp)) < 300;
      if (!ok) throw new Error("Signature invalide");
    }
    event = JSON.parse(raw);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Invalid payload" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const type: string = event?.type ?? "";
  const object = event?.data?.object ?? {};
  const eventId: string =
    typeof event?.id === "string" ? event.id : `no-id:${type}:${Date.now()}`;
  // event.created : horodatage Stripe de l'événement (secondes). Sert de
  // garde d'ancienneté pour ne pas laisser un rejeu ancien écraser un
  // changement plus récent.
  const createdAtStripe: number | undefined =
    typeof event?.created === "number" ? event.created : undefined;

  // ---- Dédoublonnage ----
  // Stripe réémet un événement en cas de non-réponse 2xx et peut livrer le
  // même événement en double : on ne traite chaque `event.id` qu'une fois,
  // et une seule tentative à la fois (réservation à expiration).
  let claim: {
    duplicate: boolean;
    inFlight?: boolean;
    leaseToken: string | null;
    attempts: number;
  };
  try {
    claim = await ctx.runMutation(internal.billingInternal.beginStripeEvent, {
      eventId,
      type,
      createdAtStripe,
    });
  } catch (err) {
    console.error("[webhook stripe] journalisation impossible", eventId, err);
    return new Response(
      JSON.stringify({ error: "Impossible de journaliser l'événement" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  if (claim.duplicate) {
    // Événement déjà soldé : 200, rien à refaire.
    if (!claim.inFlight) {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Réservation encore vivante : une autre tentative traite l'événement.
    // Répondre 200 LAISSERAIT l'événement sans reprise si le traitement
    // propriétaire s'interrompt (l'expiration du verrou autorise une reprise
    // mais ne la déclenche pas). On répond donc 503 : Stripe réémet, et la
    // redelivery tombera après expiration du verrou, donc la reprise aura
    // lieu d'elle-même. Le jeton garantit que la tentative orpheline ne
    // pourra pas clore l'événement ensuite.
    return new Response(
      JSON.stringify({ received: false, inFlight: true, retry: true }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "30" },
      },
    );
  }

  const leaseToken = claim.leaseToken as string;

  /** Réponse finale : succès ou échec durable (Stripe retentera). */
  const finish = async (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await ctx.runMutation(internal.billingInternal.failStripeEvent, {
        eventId,
        error: message,
        leaseToken,
      });
    } catch (logErr) {
      console.error("[webhook stripe] échec du journal", eventId, logErr);
    }
    console.error("[webhook stripe]", type, eventId, err);
    // 5xx : Stripe réémet l'événement (réessais automatiques ~3 jours).
    // Le traitement étant idempotent (recordInvoice + gardes dedup), un rejeu
    // ne duplique ni facture ni abonnement.
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  };

  /** Succès : l'événement est marqué traité, les reprises seront ignorées. */
  const done = async (extra?: Record<string, unknown>) =>
    new Response(JSON.stringify({ received: true, ...(extra ?? {}) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  // ---- Attribution de l'utilisateur ----
  // (payload JSON : typé any, casté en Id<"users"> aux points d'appel)
  let userId: any =
    object?.metadata?.user_id ?? object?.subscription_details?.metadata?.user_id;
  const email: string | undefined =
    object?.customer_email ?? object?.customer_details?.email ?? object?.customer_email;

  // invoice.* : la metadata user_id est copiée sur l'abonnement Stripe,
  // donc remontée automatiquement par Stripe sur les factures suivantes.
  // Si absente (ancien abonnement), on retombe sur l'email.

  if (!userId && email) {
    const found = await ctx.runQuery(internal.billingInternal.findUserByEmail, {
      email,
    });
    if (found) userId = found;
  }

  if (!userId) {
    // Événement sans abonné identifiable : rien à faire, on le solde pour
    // éviter que Stripe le réémette indéfiniment.
    await ctx.runMutation(internal.billingInternal.completeStripeEvent, {
      eventId,
      leaseToken,
    });
    return new Response(JSON.stringify({ ok: true, ignored: type }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (type) {
      case "checkout.session.completed": {
        if (object?.status === "expired") break;
        const cycle = object?.metadata?.cycle === "annual" ? "annual" : "monthly";
        // Session Checkout STANDARD : `subscription_details` est souvent
        // absent, la période n'est disponible qu'en lisant l'abonnement chez
        // Stripe. On va donc le chercher avant de conclure.
        const periodEnd = requireStripePeriodEnd(
          await resolveCheckoutPeriodEndMs(stripeSecret(), object),
          type,
        );
        const periodStart = checkoutSessionPeriodStartMs(object);
        await activate(ctx, userId, cycle, periodEnd, object, {
          periodStart,
          stripeInvoiceId: idOf(object?.invoice),
          createdAtStripe,
        });
        break;
      }

      case "invoice.paid": {
        // Renouvellement (1er paiement inclus) : on recalcule la période.
        const cycle =
          object?.subscription_details?.metadata?.cycle === "annual"
            ? "annual"
            : object?.amount_paid >= 19000
              ? "annual"
              : "monthly";
        const periodEnd = requireStripePeriodEnd(invoicePeriodEndMs(object), type);
        const periodStart = invoicePeriodStartMs(object);
        await activate(ctx, userId, cycle, periodEnd, object, {
          periodStart,
          // invoice.paid : l'objet EST la facture, son id est la clé.
          stripeInvoiceId: idOf(object?.id),
          createdAtStripe,
        });
        break;
      }

      case "invoice.payment_failed": {
        // Un paiement ÉCHOUÉ ne donne aucun droit au Pro : on n'active
        // surtout pas le plan. On note les identifiants et on relit le
        // statut réel chez Stripe, qui décide (past_due/unpaid/canceled).
        await ctx.runMutation(internal.billingInternal.recordExternalIds, {
          userId,
          externalCustomerId: idOf(object?.customer),
          externalSubscriptionId: idOf(object?.subscription),
        });
        await reconcileFromStripe(ctx, userId, idOf(object?.customer));
        break;
      }

      case "customer.subscription.created": {
        // Enregistre les identifiants Stripe (customer + subscription) :
        // indispensables à la résiliation depuis le tableau de bord.
        await ctx.runMutation(internal.billingInternal.recordExternalIds, {
          userId,
          externalCustomerId: idOf(object?.customer),
          externalSubscriptionId: idOf(object?.id),
        });
        break;
      }

      case "customer.subscription.updated": {
        // Identifiants toujours rejoués (rattrapage des comptes antérieurs).
        await ctx.runMutation(internal.billingInternal.recordExternalIds, {
          userId,
          externalCustomerId: idOf(object?.customer),
          externalSubscriptionId: idOf(object?.id),
        });
        // Résiliation programmée depuis le tableau de bord Stripe :
        // les avantages Pro durent jusqu'à la fin de la période payée.
        if (object?.cancel_at_period_end === true) {
          await applySubscriptionState(
            ctx,
            userId,
            idOf(object?.customer),
            internal.billingInternal.markCancelling,
            { userId, createdAtStripe },
          );
        }
        if (object?.status === "canceled") {
          // Abonnement stoppé immédiatement côté Stripe : on aligne le compte.
          await applySubscriptionState(
            ctx,
            userId,
            idOf(object?.customer),
            internal.billingInternal.setPlanFree,
            { userId, createdAtStripe },
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        await ctx.runMutation(internal.billingInternal.recordExternalIds, {
          userId,
          externalCustomerId: idOf(object?.customer),
          externalSubscriptionId: idOf(object?.id),
        });
        await applySubscriptionState(
          ctx,
          userId,
          idOf(object?.customer),
          internal.billingInternal.setPlanFree,
          { userId, createdAtStripe },
        );
        break;
      }

      default:
        break;
    }

    await ctx.runMutation(internal.billingInternal.completeStripeEvent, {
      eventId,
      leaseToken,
    });
    return await done();
  } catch (err) {
    return await finish(err);
  }
});

/**
 * Identifiant Stripe d'un champ qui peut être une chaîne ("sub_123") ou un
 * objet dé-normalisé ({ id: "sub_123" }) selon la version de l'API Stripe.
 */
function idOf(value: any): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && typeof value.id === "string")
    return value.id;
  return undefined;
}

async function activate(
  ctx: any,
  userId: string,
  cycle: "monthly" | "annual",
  periodEnd: number,
  object: any,
  opts: {
    periodStart?: number;
    stripeInvoiceId?: string;
    createdAtStripe?: number;
  } = {},
) {
  // Enregistre les identifiants Stripe : sans eux, aucune résiliation
  // côté serveur n'est possible (cf. checkout.cancelSubscription).
  //
  // Garde d'ancienneté : si un événement plus récent a déjà été appliqué à ce
  // compte (typiquement une résiliation), on n'écrase pas son état avec ce
  // paiement rejoué. L'état courant est alors réconcilié depuis Stripe.
  const applied = await ctx.runMutation(
    internal.billingInternal.setPlanPro,
    {
      userId,
      periodEnd,
      cycle,
      externalCustomerId: idOf(object?.customer),
      externalSubscriptionId:
        idOf(object?.subscription) ??
        idOf(object?.parent?.subscription_details?.subscription) ??
        idOf(object?.subscription_details?.subscription),
      source: "checkout",
      createdAtStripe: opts.createdAtStripe,
    },
  );

  if (applied && (applied as any).skipped === true) {
    // Rejeu obsolète (ou ordre indéterminable, même seconde) : l'abonnement a
    // changé depuis cet événement. On relit l'état chez Stripe (source de
    // vérité) au lieu d'appliquer ce vieux paiement.
    //
    // On ne retourne PAS ici : l'enregistrement de la facture locale doit
    // rester indépendant de l'actualisation du plan. Si l'échec initial avait
    // empêché l'insertion, le rejeu doit pouvoir la réparer, puis l'événement
    // est marqué traité.
    await reconcileFromStripe(ctx, userId, idOf(object?.customer));
  }

  const amountEurCents =
    Number(object?.amount_paid ?? object?.amount_total ?? 0) > 0
      ? Number(object.amount_paid ?? object.amount_total)
      : cycle === "annual"
        ? 19000
        : 1900;

  // Clé d'idempotence de la facture : l'identifiant de facture Stripe
  // lui-même. `checkout.session.completed` (première facture) et
  // `invoice.paid` désignent la même facture `in_...` : la clé fait converger
  // les deux événements vers une seule facture locale.
  const stripeInvoiceId =
    opts.stripeInvoiceId ??
    idOf(object?.invoice) ??
    (String(object?.object ?? "") === "invoice" ? idOf(object?.id) : undefined);

  await ctx.runMutation(internal.billingInternal.recordInvoice, {
    userId,
    // Numéro lisible : la référence Stripe si elle existe, sinon l'identifiant
    // (plus jamais un horodatage, qui changeait à chaque livraison).
    number: String(object?.number ?? object?.id ?? stripeInvoiceId ?? "—"),
    amountEurCents,
    plan: "pro",
    cycle,
    stripeInvoiceId,
    periodStart: opts.periodStart,
    periodEnd,
    description:
      cycle === "annual"
        ? "Abonnement V'la le Menu ! Pro — annuel — TVA non applicable, art. 293 B du CGI / art. L. 223-3 du CIBS"
        : "Abonnement V'la le Menu ! Pro (mensuel) — TVA non applicable, art. 293 B du CGI / art. L. 223-3 du CIBS",
  });
}

/**
 * Date manquante = gestion EXPLICITE : on lève. Le webhook répond alors 5xx,
 * Stripe réémet, et l'événement n'est jamais soldé sur une période
 * inventée. Mieux vaut un échec visible qu'un accès Pro accordé jusqu'à une
 * échéance fausse.
 */
function requireStripePeriodEnd(
  periodEnd: number | undefined,
  type: string,
): number {
  if (typeof periodEnd !== "number") {
    throw new Error(
      `webhook: fin de période absente du payload Stripe (${type}) — ` +
        `aucune période n'est inventée, l'événement sera repris`,
    );
  }
  return periodEnd;
}

/** Secret Stripe de l'API (pas celui de la signature webhook). */
function stripeSecret(): string {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "webhook: STRIPE_SECRET_KEY absent — impossible de lire l'abonnement chez Stripe",
    );
  }
  return secret;
}

/**
 * Applique une mutation d'état d'abonnement et surveille son verdict.
 *
 * `setPlanFree` / `markCancelling` peuvent refuser l'événement (`skipped` :
 * plus ancien, ou même seconde que le dernier appliqué — donc ordre
 * indéterminable). Ignorer ce refus solderait l'événement sans rien
 * appliquer : la résiliation serait perdue. On réconcilie alors avec Stripe,
 * qui fait foi. Toute impossibilité de conclure remonte en erreur, donc en
 * 5xx, donc en reprise par Stripe.
 */
async function applySubscriptionState(
  ctx: any,
  userId: string,
  hintCustomerId: string | undefined,
  mutation: any,
  args: Record<string, unknown>,
) {
  const result: any = await ctx.runMutation(mutation, args);
  if (result && result.skipped === true) {
    console.error(
      "[webhook stripe] changement d'état écarté, réconciliation",
      userId,
      result.reason,
    );
    // Lève si la réconciliation ne peut pas conclure : l'événement ne doit
    // pas être marqué traité sur un état inchangé.
    await reconcileFromStripe(ctx, userId, hintCustomerId);
  }
  return result;
}

/**
 * Réconciliation : relit l'abonnement de CE compte chez Stripe et aligne
 * l'état local. Utilisée quand un événement a été écarté (rejeu obsolète,
 * ordre indéterminable) ou quand un paiement a échoué.
 *
 * Mêmes garanties d'attribution que le résolveur de résiliation
 * (cf. checkout.resolveAccountStripeSubscription) :
 *  1. l'identifiant d'abonnement gravé pour ce compte est la cible ;
 *  2. sinon le customer gravé, en parcourant TOUTES les pages ;
 *  3. la metadata `user_id` de l'abonnement prime : un abonnement portant
 *     l'identifiant d'un AUTRE utilisateur n'est jamais retenu.
 * Un abonnement ambigu (plusieurs prouvés, ou aucun attribuable) laisse
 * l'état local intact et journalise : on n'écrase rien sur une supposition.
 *
 * En cas d'impossibilité de conclure — panne Stripe, configuration absente,
 * abonnements tous attribuables à autrui, période manquante — la fonction
 * LÈVE une erreur au lieu de renvoyer un verdict : l'appelant la propage
 * jusqu'au chemin d'échec du webhook, qui répond 5xx et laisse Stripe
 * réémettre. Renvoyer « rien à faire » transformerait une panne en succès.
 */
async function reconcileFromStripe(
  ctx: any,
  userId: string,
  hintCustomerId?: string,
) {
  const secret = process.env.STRIPE_SECRET_KEY;
  // Configuration absente : impossible de conclure. On lève pour que le
  // webhook échoue et reçoive une nouvelle livraison, au lieu de solder
  // l'événement sur un statut inventé.
  if (!secret) throw new Error("reconciliation: STRIPE_SECRET_KEY absent");

  const identity: any = await ctx.runQuery(
    internal.billingInternal.getBillingIdentity,
    { userId },
  );
  const storedSubId: string | null = identity?.externalSubscriptionId ?? null;
  const storedCustomer: string | null =
    identity?.externalCustomerId ?? hintCustomerId ?? null;

  try {
    // ---- Cible 1 : l'identifiant gravé pour ce compte (opposable) ----
    let storedSub: any = null;
    if (storedSubId) {
      // Pas de `.catch` ici : une panne Stripe doit remonter, pas se
      // déguiser en « aucun abonnement enregistré ». Seul un 404 (identifiant
      // mort) est neutralisé, et il ne prouve rien.
      const retrieved: any = await stripeGetJson(
        secret,
        `/subscriptions/${encodeURIComponent(storedSubId)}`,
        { allow404: true },
      );
      if (retrieved) {
        const owner = retrieved?.metadata?.user_id;
        // La metadata désigne explicitement un AUTRE compte : on n'y touche
        // surtout pas (c'était précisément le défaut : on retenait un
        // abonnement appartenant à quelqu'un d'autre avec force: true).
        if (typeof owner === "string" && owner.length > 0 && owner !== userId) {
          throw new Error(
            `reconciliation: abonnement enregistré ${storedSubId} appartient à un autre compte`,
          );
        }
        storedSub = retrieved;
      }
    }

    // ---- Cible 2 : les customers attribuables à ce compte, toutes pages ----
    const customers = new Set<string>();
    if (storedCustomer) customers.add(storedCustomer);
    if (idOf(storedSub?.customer)) customers.add(idOf(storedSub!.customer)!);

    const found = new Map<string, any>();
    let foreignCount = 0;
    if (storedSub) found.set(storedSub.id, storedSub);
    for (const customer of customers) {
      for (const s of await listAllSubscriptions(secret, customer)) {
        const owner = s?.metadata?.user_id;
        // Filtre d'attribution : un abonnement qui déclare un autre compte
        // est écarté avant tout classement — et compté, car son absence
        // ne prouve pas que CE compte n'a pas d'abonnement.
        if (typeof owner === "string" && owner.length > 0 && owner !== userId) {
          foreignCount++;
          continue;
        }
        if (!found.has(s.id)) found.set(s.id, s);
      }
    }

    const live = [...found.values()].filter(
      (s) => s?.status !== "canceled" && s?.status !== "incomplete_expired",
    );

    if (live.length === 0) {
      // DISTINCTION ESSENTIELLE : « absence vérifiée » ≠ « impossible
      // d'attribuer ». On ne peut aligner sur Gratuit que si une chaîne de
      // facturation gravée pour CE compte a été parcourue INTÉGRALEMENT et
      // n'a rien donné. Si les seuls abonnements trouvés appartiennent
      // explicitement à d'autres comptes, ou si aucune chaîne n'est
      // attribuable, on ne prouve RIEN : aucune écriture, et l'erreur
      // remonte pour que l'événement soit repris.
      const chainScanned = customers.size > 0;
      if (!chainScanned || foreignCount > 0) {
        throw new Error(
          `reconciliation: absence non vérifiée pour ce compte ` +
            `(chaînes=${customers.size}, abonnements d'autres comptes=${foreignCount})`,
        );
      }
      await ctx.runMutation(internal.billingInternal.setPlanFree, {
        userId,
        force: true,
      });
      return { reconciled: true, plan: "free" };
    }

    if (live.length > 1) {
      // Ambigu : plusieurs abonnements prouvés. Rien n'est écrit, et
      // l'erreur remonte (l'événement ne doit pas être soldé).
      throw new Error(
        `reconciliation: plusieurs abonnements attribuables (${live
          .map((s) => s.id)
          .join(", ")})`,
      );
    }

    const sub = live[0];
    const status: string = sub?.status ?? "";

    if (
      status === "canceled" ||
      status === "unpaid" ||
      status === "incomplete_expired"
    ) {
      await ctx.runMutation(internal.billingInternal.setPlanFree, {
        userId,
        force: true,
      });
      return { reconciled: true, plan: "free" };
    }

    const active =
      status === "active" || status === "trialing" || status === "past_due";
    if (!active)
      throw new Error(`reconciliation: statut Stripe non concluant (${status})`);

    const cycle = subscriptionCycle(sub);

    // Fin de période : lue chez Stripe, jamais calculée. Depuis l'API Stripe
    // Basil, la période vit sur les ÉLÉMENTS de l'abonnement ; on lit donc
    // `items.data[0].current_period_end` en priorité, puis l'ancien champ
    // niveau abonnement. Aucune date n'est inventée : si Stripe ne la donne
    // pas, on n'accorde pas de Pro « sans fin » (currentPeriodEnd absent =
    // illimité selon le schéma) et l'erreur remonte.
    const periodEnd = subscriptionPeriodEndMs(sub);
    if (typeof periodEnd !== "number") {
      throw new Error(
        `reconciliation: fin de période absente de la réponse Stripe ` +
          `(abonnement ${sub?.id})`,
      );
    }

    // `force` : l'état vient d'être lu chez Stripe à l'instant, il prime sur
    // l'ancienneté de l'événement ayant déclenché la réconciliation.
    await ctx.runMutation(internal.billingInternal.setPlanPro, {
      userId,
      periodEnd,
      cycle,
      externalCustomerId: idOf(sub.customer) ?? storedCustomer ?? undefined,
      externalSubscriptionId: idOf(sub.id),
      source: "checkout",
      force: true,
    });
    if (sub?.cancel_at_period_end === true) {
      await ctx.runMutation(internal.billingInternal.markCancelling, {
        userId,
        force: true,
      });
    }
    return { reconciled: true, plan: "pro", subscriptionId: sub.id };
  } catch (err) {
    // On ne transforme PLUS une panne en succès : l'erreur est journalisée
    // puis relancée. Le `catch` du webhook la convertira en échec d'événement
    // (5xx + `failStripeEvent`), donc Stripe réémettra.
    console.error("[webhook stripe] réconciliation impossible", err);
    throw err;
  }
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparaison à temps constant des signatures. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
