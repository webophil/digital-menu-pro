"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { isProSubscription } from "./plans";

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
 * depuis Mes Infos).
 *
 * Sécurité — aucun succès annoncé à tort :
 * 1. on retrouve l'abonnement Stripe (identifiant enregistré au paiement,
 *    sinon customer, sinon recherche par email chez Stripe) ;
 * 2. on demande l'arrêt du renouvellement (cancel_at_period_end) ;
 * 3. le statut local n'est modifié QUE si Stripe a répondu avec succès —
 *    sinon l'erreur est propagée et Convex reste inchangé.
 * Retourne { ok, mode } :
 *  - "period_end" : résiliation confirmée par Stripe (Pro jusqu'à l'échéance) ;
 *  - "immediate"  : Stripe confirme qu'aucun abonnement actif n'existe
 *    (statut offert par l'admin ou déjà résilié) → passage en Gratuit.
 */
export const cancelSubscription = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const sub = await ctx.runQuery(api.billing.getMySubscription, {});
    if (!sub) throw new Error("Aucun abonnement actif.");
    if (!isProSubscription(sub))
      throw new Error("Aucun abonnement Pro actif à résilier.");

    const stripe = stripeClient();
    const storedId = sub.externalSubscriptionId ?? null;
    const storedCustomer = sub.externalCustomerId ?? null;
    const email = await ctx.runQuery(internal.billingInternal.getUserEmail, {
      userId,
    });

    // ---- 1. Retrouver l'abonnement Stripe ----
    let target: StripeSubRef | null = null;
    try {
      if (storedId) {
        try {
          const existing = await stripe.subscriptions.retrieve(storedId);
          if (isLiveStripeSub(existing)) {
            target = { id: existing.id, customer: storedCustomer };
          }
        } catch (err: any) {
          // Identifiant expiré / abonnement supprimé : on cherche plus bas.
          if (err?.code !== "resource_missing" && err?.statusCode !== 404)
            throw err;
        }
      }
      if (!target) {
        target = await findActiveStripeSubscription(
          stripe,
          storedCustomer,
          email,
          userId,
        );
      }
    } catch (err) {
      throw new Error(
        `Impossible de contacter le prestataire de paiement (${errMessage(err)}). ` +
          "Aucun changement n'a été appliqué : réessayez plus tard.",
      );
    }

    // ---- 2. Confirmer la résiliation auprès de Stripe ----
    if (target) {
      let updated: Stripe.Subscription;
      try {
        updated = await stripe.subscriptions.update(target.id, {
          cancel_at_period_end: true,
        });
      } catch (err) {
        // Échec Stripe → on n'annonce RIEN : pas de markCancelling ni de
        // passage en Gratuit, l'utilisateur voit l'erreur réelle.
        throw new Error(
          `La résiliation a échoué auprès du prestataire de paiement (${errMessage(err)}). ` +
            "Votre abonnement est inchangé : réessayez plus tard ou contactez le support.",
        );
      }
      if (
        !updated.cancel_at_period_end &&
        updated.status !== "canceled" &&
        !updated.canceled_at
      ) {
        throw new Error(
          "Stripe n'a pas confirmé la résiliation. Aucun changement n'a été appliqué : réessayez.",
        );
      }

      // Stripe a confirmé : on enregistre les identifiants (rattrapage des
      // comptes antérieurs) puis le statut local "cancelling".
      await ctx.runMutation(internal.billingInternal.recordExternalIds, {
        userId,
        externalCustomerId: target.customer ?? undefined,
        externalSubscriptionId: target.id,
      });
      await ctx.runMutation(internal.billingInternal.markCancelling, {
        userId,
      });
      return { ok: true, mode: "period_end" as const };
    }

    // ---- 3. Stripe confirme qu'aucun abonnement actif n'existe ----
    // (aucun prélèvement en cours : statut offert par l'admin ou
    // abonnement déjà résilié) → passage local en Gratuit assumé.
    await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
    return { ok: true, mode: "immediate" as const };
  },
});

type StripeSubRef = { id: string; customer: string | null };

function errMessage(err: unknown): string {
  const msg = (err as any)?.message;
  return typeof msg === "string" && msg.length > 0 ? msg : "erreur inconnue";
}

/** Abonnement Stripe encore « vivant » (non résilié). */
function isLiveStripeSub(s: Stripe.Subscription): boolean {
  return s.status !== "canceled" && s.status !== "incomplete_expired";
}

function toSubRef(s: Stripe.Subscription, fallback: string | null): StripeSubRef {
  const customer =
    typeof s.customer === "string" ? s.customer : (s.customer?.id ?? fallback);
  return { id: s.id, customer: customer ?? fallback };
}

/**
 * Retrouve l'abonnement Stripe actif du compte :
 * d'abord via le customer enregistré, sinon via les customers portant son
 * email (rattrapage des comptes créés avant l'enregistrement des identifiants).
 * Préférence pour l'abonnement portant la metadata user_id du compte.
 */
async function findActiveStripeSubscription(
  stripe: Stripe,
  customerId: string | null,
  email: string | null,
  userId: string,
): Promise<StripeSubRef | null> {
  const pick = (subs: Stripe.Subscription[]): StripeSubRef | null => {
    const live = subs.filter(isLiveStripeSub);
    if (live.length === 0) return null;
    const mine = live.find((s) => s.metadata?.user_id === userId);
    return toSubRef(mine ?? live[0], customerId);
  };

  if (customerId) {
    const res = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    const found = pick(res.data);
    if (found) return found;
  }
  if (email) {
    const customers = await stripe.customers.list({ email, limit: 5 });
    for (const customer of customers.data) {
      const res = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 100,
      });
      const found = pick(res.data);
      if (found) return found;
    }
  }
  return null;
}
