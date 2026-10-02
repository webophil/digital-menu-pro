"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Le paiement n'est pas encore configuré (clé Stripe manquante). Contactez le support.",
    );
  }
  return new Stripe(key);
}

/**
 * Crée une session de paiement Stripe standard (l'exploitant est le vendeur ;
 * Stripe n'est que l'outil d'encaissement). L'utilisateur et le cycle sont
 * passés en metadata pour que le webhook puisse attribuer le plan.
 * - cycle "monthly" : prix STRIPE_PRICE_MONTHLY (19 €/mois)
 * - cycle "annual"  : prix STRIPE_PRICE_ANNUAL  (190 €/an, 2 mois offerts)
 *
 * TVA : micro-entrepreneur non assujetti (art. 293 B du CGI) — les prix sont
 * nets, aucune TVA n'est ajoutée (pas de merchant of record).
 */
export const createCheckoutSession = action({
  args: {
    email: v.string(),
    cycle: v.optional(v.string()),
    // Origine du frontend (window.location.origin) : les URLs de retour
    // Stripe doivent pointer vers le site React, pas vers le domaine Convex.
    origin: v.optional(v.string()),
  },
  handler: async (ctx, { email, cycle, origin }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const annual = cycle === "annual";
    const stripe = stripeClient();
    const priceId = annual
      ? process.env.STRIPE_PRICE_ANNUAL
      : process.env.STRIPE_PRICE_MONTHLY;
    if (!priceId) {
      throw new Error(
        "Le paiement n'est pas encore configuré (tarif Stripe manquant). Contactez le support.",
      );
    }

    const siteUrl =
      origin && /^https?:\/\//.test(origin)
        ? origin
        : process.env.CONVEX_SITE_URL || "http://localhost:5173";
    const metadata = {
      user_id: userId,
      email,
      cycle: annual ? "annual" : "monthly",
    };

    try {
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        // Vendeur = l'exploitant (micro-entrepreneur non assujetti) :
        // pas de Managed Payments, le client paie exactement le prix affiché.
        customer_email: email,
        locale: "fr",
        success_url: `${siteUrl}/subscription?checkout=success`,
        cancel_url: `${siteUrl}/subscription?checkout=cancel`,
        metadata,
        subscription_data: { metadata },
      });
      if (!session.url) {
        throw new Error("Lien de paiement indisponible. Réessayez.");
      }
      return { url: session.url };
    } catch (err: any) {
      const detail = err?.message ?? "";
      if (String(detail).includes("configuré")) throw err;
      throw new Error(
        `Impossible de créer la session de paiement. ${detail}`.trim(),
      );
    }
  },
});

/**
 * Résilie l'abonnement Stripe à la fin de la période déjà payée (un clic
 * depuis Mes Infos) : les avantages Pro restent actifs jusqu'à l'échéance
 * en cours ; à cette date, Stripe enverra customer.subscription.deleted et
 * le webhook fera repasser le compte en Gratuit. Si aucun identifiant
 * Stripe n'est connu (statut offert par l'admin), bascule immédiate.
 */
export const cancelSubscription = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const sub = await ctx.runQuery(api.billing.getMySubscription, {});
    if (!sub) throw new Error("Aucun abonnement actif.");

    const externalId = sub.externalSubscriptionId;
    if (externalId) {
      const stripe = stripeClient();
      try {
        await stripe.subscriptions.update(externalId, {
          cancel_at_period_end: true,
        });
        // Statut local "cancelling" : affiché comme résilié jusqu'à
        // l'échéance, sans retirer les avantages Pro tout de suite.
        await ctx.runMutation(internal.billingInternal.markCancelling, {
          userId,
        });
        return { ok: true };
      } catch {
        // déjà annulé côté Stripe (ou erreur) : bascule locale immédiate
      }
    }
    await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
    return { ok: true };
  },
});
