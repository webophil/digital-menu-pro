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
 * - customer.subscription.deleted : résiliation
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
        await activate(ctx, userId, cycle, periodEnd, object);
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
        await activate(ctx, userId, cycle, periodEnd, object);
        break;
      }

      case "invoice.payment_failed": {
        await ctx.runMutation(internal.billingInternal.setPlanPro, {
          userId,
          periodEnd: undefined,
          cycle: undefined,
        });
        break;
      }

      case "customer.subscription.deleted": {
        await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[webhook stripe]", type, err);
    // 200 quand même : Stripe retenterait inutilement une erreur de nos données.
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function activate(
  ctx: any,
  userId: string,
  cycle: "monthly" | "annual",
  periodEnd: number,
  object: any,
) {
  await ctx.runMutation(internal.billingInternal.setPlanPro, {
    userId,
    periodEnd,
    cycle,
  });

  const amountEurCents =
    Number(object?.amount_paid ?? object?.amount_total ?? 0) > 0
      ? Number(object.amount_paid ?? object.amount_total)
      : cycle === "annual"
        ? 19000
        : 1900;
  await ctx.runMutation(internal.billingInternal.recordInvoice, {
    userId,
    number: String(object?.number ?? object?.id ?? `INV-${Date.now()}`),
    amountEurCents,
    plan: "pro",
    cycle,
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
