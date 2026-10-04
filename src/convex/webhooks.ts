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

  // ---- Dédoublonnage ----
  // Stripe réémet un événement en cas de non-réponse 2xx et peut livrer le
  // même événement en double : on ne traite chaque `event.id` qu'une fois.
  let claim: { duplicate: boolean };
  try {
    claim = await ctx.runMutation(internal.billingInternal.beginStripeEvent, {
      eventId,
      type,
    });
  } catch (err) {
    console.error("[webhook stripe] journalisation impossible", eventId, err);
    return new Response(
      JSON.stringify({ error: "Impossible de journaliser l'événement" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  if (claim.duplicate) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  /** Réponse finale : succès ou échec durable (Stripe retentera). */
  const finish = async (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await ctx.runMutation(internal.billingInternal.failStripeEvent, {
        eventId,
        error: message,
      });
    } catch (logErr) {
      console.error("[webhook stripe] échec du journal", eventId, logErr);
    }
    console.error("[webhook stripe]", type, eventId, err);
    // 5xx : Stripe réémet l'événement (réessais automatiques ~3 jours).
    // Le traitement étant idempotent (recordInvoice + guards dedup), un rejeu
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
          });
        }
        if (object?.status === "canceled") {
          // Abonnement stoppé immédiatement côté Stripe : on aligne le compte.
          await ctx.runMutation(internal.billingInternal.setPlanFree, {
            userId,
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
        await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
        break;
      }

      default:
        break;
    }

    await ctx.runMutation(internal.billingInternal.completeStripeEvent, {
      eventId,
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
  opts: { periodStart?: number; stripeInvoiceId?: string } = {},
) {
  // Enregistre les identifiants Stripe : sans eux, aucune résiliation
  // côté serveur n'est possible (cf. checkout.cancelSubscription).
  await ctx.runMutation(internal.billingInternal.setPlanPro, {
    userId,
    periodEnd,
    cycle,
    externalCustomerId: idOf(object?.customer),
    externalSubscriptionId:
      idOf(object?.subscription) ??
      idOf(object?.parent?.subscription_details?.subscription) ??
      idOf(object?.subscription_details?.subscription),
    source: "checkout",
  });

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
