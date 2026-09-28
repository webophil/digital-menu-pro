import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Webhook de paiement (Lemon Squeezy / passerelle d'intégration).
 * Vérifie la signature HMAC avec LEMONSQUEEZY_WEBHOOK_SECRET puis met à jour
 * le plan de l'abonné et enregistre la facture.
 */
export const paymentWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const raw = await request.text();

  if (secret) {
    const signature = request.headers.get("x-signature") ?? "";
    const valid = await verifySignature(raw, secret, signature);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventName: string | undefined =
    payload?.meta?.event_name ?? payload?.event ?? undefined;
  const custom = payload?.meta?.custom_data ?? payload?.custom_data ?? {};
  const userId: string | undefined = custom.user_id ?? undefined;
  const email: string | undefined = custom.email ?? undefined;

  if (!userId && !email) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const attrs = payload?.data?.attributes ?? {};
  const status: string | undefined = attrs.status;

  const resolvedUserId: string | null = userId ?? null;
  if (!resolvedUserId && email) {
    const found = await ctx.runQuery(
      internal.billingInternal.findUserByEmail,
      { email },
    );
    if (found) {
      await applyPlanChange(ctx, found, status, eventName, attrs, custom);
    }
  } else if (resolvedUserId) {
    await applyPlanChange(ctx, resolvedUserId, status, eventName, attrs, custom);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function applyPlanChange(
  ctx: any,
  resolvedUserId: string,
  status: string | undefined,
  eventName: string | undefined,
  attrs: any,
  custom: any = {},
) {
  const paidStatuses: string[] = ["active", "paid", "on_trial"];
  const paidEvents: string[] = [
    "subscription_created",
    "subscription_updated",
    "order_created",
  ];
  const isPaid =
    (status !== undefined && paidStatuses.includes(status)) ||
    (eventName !== undefined && paidEvents.includes(eventName)) ||
    (eventName === "subscription_payment_success" && status !== "cancelled");

  if (isPaid) {
    // Cycle détecté depuis le montant payé (centimes) ou le custom_data.
    const customCycle: string | undefined = custom?.cycle ?? undefined;
    const rawTotal = Number(
      attrs?.first_order_item?.total ?? attrs?.total ?? 0,
    );
    const cycle: "monthly" | "annual" =
      customCycle === "annual" || rawTotal >= 19000
        ? "annual"
        : "monthly";

    const periodEnd = attrs?.renews_at
      ? new Date(attrs.renews_at).getTime()
      : Date.now() +
        (cycle === "annual" ? 365 : 30) * 24 * 3600 * 1000;
    await ctx.runMutation(internal.billingInternal.setPlanPro, {
      userId: resolvedUserId,
      periodEnd,
      cycle,
    });

    // Colis cadeau (5 porte-cartes QR) offert avec l'abonnement annuel.
    if (cycle === "annual") {
      await ctx.runMutation(internal.billingInternal.markShipmentPaid, {
        userId: resolvedUserId,
        quantity: 5,
      });
    }

    const amountEurCents =
      Number.isFinite(rawTotal) && rawTotal > 0
        ? rawTotal
        : cycle === "annual"
          ? 19000
          : 1900;
    await ctx.runMutation(internal.billingInternal.recordInvoice, {
      userId: resolvedUserId,
      number: String(attrs?.order_number ?? attrs?.id ?? `INV-${Date.now()}`),
      amountEurCents,
      plan: "pro",
      cycle,
      description:
        cycle === "annual"
          ? "Abonnement V'la le Menu ! Pro — annuel (5 porte-cartes QR inclus)"
          : "Abonnement V'la le Menu ! Pro (mensuel)",
    });
  } else if (status === "cancelled" || status === "expired") {
    await ctx.runMutation(internal.billingInternal.setPlanFree, {
      userId: resolvedUserId,
    });
  }
}

async function verifySignature(
  raw: string,
  secret: string,
  signature: string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
    const digest = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return digest === signature;
  } catch {
    return false;
  }
}
