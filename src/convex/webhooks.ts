import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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
    // Événement déjà soldé, ou déjà en cours de traitement par une autre
    // livraison : on répond 200 sans rien refaire. Pour une réservation
    // encore vivante, on répond 200 (et non 5xx) : le travail est déjà en
    // cours, le faire réémettre immédiatement créerait une boucle.
    return new Response(
      JSON.stringify({
        received: true,
        duplicate: true,
        ...(claim.inFlight ? { inFlight: true } : {}),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
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
        const periodEnd =
          object?.subscription_details?.current_period_end
            ? object.subscription_details.current_period_end * 1000
            : Date.now() + (cycle === "annual" ? 365 : 30) * 24 * 3600 * 1000;
        const periodStart = object?.subscription_details?.current_period_start
          ? object.subscription_details.current_period_start * 1000
          : undefined;
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
        const periodEnd = object?.lines?.data?.[0]?.period?.end
          ? object.lines.data[0].period.end * 1000
          : Date.now() + (cycle === "annual" ? 365 : 30) * 24 * 3600 * 1000;
        const periodStart = object?.lines?.data?.[0]?.period?.start
          ? object.lines.data[0].period.start * 1000
          : undefined;
        await activate(ctx, userId, cycle, periodEnd, object, {
          periodStart,
          // invoice.paid : l'objet EST la facture, son id est la clé.
          stripeInvoiceId: idOf(object?.id),
          createdAtStripe,
        });
        break;
      }

      case "invoice.payment_failed": {
        await ctx.runMutation(internal.billingInternal.setPlanPro, {
          userId,
          periodEnd: undefined,
          cycle: undefined,
          externalCustomerId: idOf(object?.customer),
          externalSubscriptionId: idOf(object?.subscription),
          source: "checkout",
        });
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
          await ctx.runMutation(internal.billingInternal.markCancelling, {
            userId,
            createdAtStripe,
          });
        }
        if (object?.status === "canceled") {
          // Abonnement stoppé immédiatement côté Stripe : on aligne le compte.
          await ctx.runMutation(internal.billingInternal.setPlanFree, {
            userId,
            createdAtStripe,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        await ctx.runMutation(internal.billingInternal.recordExternalIds, {
          userId,
          externalCustomerId: idOf(object?.customer),
          externalSubscriptionId: idOf(object?.id),
        });
        await ctx.runMutation(internal.billingInternal.setPlanFree, {
          userId,
          createdAtStripe,
        });
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
    // Rejeu obsolice : l'abonnement a changé depuis cet événement. On relit
    // l'état chez Stripe (source de vérité) au lieu d'appliquer le vieux
    // paiement.
    await reconcileFromStripe(ctx, userId, idOf(object?.customer));
    return { reconciled: true };
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
 * Réconciliation : relit l'abonnement chez Stripe et aligne l'état local.
 * Utilisée quand un rejeu ancien a été écarté — Stripe fait foi.
 * Silencieuse en cas d'échec réseau/API : l'état local reste inchangé plutôt
 * que d'être dégradé par une information partielle.
 */
async function reconcileFromStripe(
  ctx: any,
  userId: string,
  customerId?: string,
) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { reconciled: false, reason: "no_secret" };
  if (!customerId) return { reconciled: false, reason: "no_customer" };

  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  if (!res.ok) return { reconciled: false, reason: `http_${res.status}` };

  const body: any = await res.json();
  const subs: any[] = Array.isArray(body?.data) ? body.data : [];
  if (subs.length === 0) {
    // Abonnement introuvable ou résilié : on aligne sur Gratuit.
    await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
    return { reconciled: true, plan: "free" };
  }

  // Le plus récemment modifié fait foi.
  subs.sort(
    (a, b) => (b?.created ?? 0) - (a?.created ?? 0),
  );
  const sub = subs[0];
  const status: string = sub?.status ?? "";

  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
    return { reconciled: true, plan: "free" };
  }

  const active =
    status === "active" || status === "trialing" || status === "past_due";
  if (!active) return { reconciled: false, reason: `status_${status}` };

  const cycle =
    (idOf(sub?.metadata?.cycle) === "annual") ||
    (Array.isArray(sub?.items?.data) &&
      Number(sub.items.data[0]?.price?.unit_amount ?? 0) >= 19000)
      ? "annual"
      : "monthly";
  const periodEnd = sub?.current_period_end
    ? sub.current_period_end * 1000
    : Date.now() + (cycle === "annual" ? 365 : 30) * 24 * 3600 * 1000;

  // `force` : ici l'état vient d'être lu chez Stripe à l'instant, il prime
  // sur l'ancienneté de l'événement qui a déclenché la réconciliation.
  await ctx.runMutation(internal.billingInternal.setPlanPro, {
    userId,
    periodEnd,
    cycle,
    externalCustomerId: customerId,
    externalSubscriptionId: idOf(sub?.id),
    source: "checkout",
    force: true,
  });
  if (sub?.cancel_at_period_end === true) {
    await ctx.runMutation(internal.billingInternal.markCancelling, { userId });
  }
  return { reconciled: true, plan: "pro" };
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
