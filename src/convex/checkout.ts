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
 * 1. l'abonnement Stripe doit être associé de façon FIABLE au compte :
 *    identifiant/customer gravés par le webhook pour ce compte, ou metadata
 *    user_id de l'abonnement qui le désigne explicitement. L'email seul
 *    n'établit jamais la propriété (changement d'email non vérifié) ;
 * 2. on demande l'arrêt du renouvellement (cancel_at_period_end) ;
 * 3. le statut local n'est modifié QUE si Stripe a répondu avec succès —
 *    sinon l'erreur est propagée et Convex reste inchangé.
 * Association absente ou ambiguë (plusieurs candidats, abonnements non
 * attribuables) → aucune modification, erreur explicite vers le support.
 * Retourne { ok, mode, warning? } :
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

    // ---- 1. Retrouver l'abonnement Stripe (association fiable exigée) ----
    let resolution: Resolution | null = null;
    try {
      resolution = await resolveAccountStripeSubscription(stripe, {
        storedId,
        storedCustomer,
        email,
        userId,
      });
    } catch (err) {
      // Association ambiguë ou non prouvée : le message destine déjà le
      // support, on ne l'enveloppe pas dans une erreur générique.
      if (err instanceof SupportError) throw err;
      throw new Error(
        `Impossible de contacter le prestataire de paiement (${errMessage(err)}). ` +
          "Aucun changement n'a été appliqué : réessayez plus tard.",
      );
    }

    // ---- 2. Confirmer la résiliation auprès de Stripe ----
    if (resolution) {
      let updated: Stripe.Subscription;
      try {
        updated = await stripe.subscriptions.update(resolution.ref.id, {
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
        externalCustomerId: resolution.ref.customer ?? undefined,
        externalSubscriptionId: resolution.ref.id,
      });
      await ctx.runMutation(internal.billingInternal.markCancelling, {
        userId,
      });
      // Autres abonnements vus via l'email mais non attribués : intouchés,
      // on prévient l'utilisateur au lieu de les taire.
      const warning =
        resolution.unattributable > 0
          ? `${resolution.unattributable} autre(s) abonnement(s) trouvé(s) via ` +
            `votre email n'ont pas pu être attribués à votre compte : ils ` +
            `restent inchangés. En cas de doute, contactez le support.`
          : undefined;
      return { ok: true, mode: "period_end" as const, warning };
    }

    // ---- 3. Aucun abonnement vivant trouvé ----
    // On ne passe en Gratuit que si l'absence de prélèvement est vérifiable :
    // identifiants Stripe enregistrés (customer inspecté) ou statut offert
    // par l'admin. Sinon (compte payant sans identifiant fiable, email
    // modifié…), on bloque plutôt que d'annoncer une résiliation non prouvée.
    if (storedId || storedCustomer || sub.source === "admin") {
      await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
      return { ok: true, mode: "immediate" as const, warning: undefined };
    }
    throw supportError(
      "Votre compte ne comporte aucun identifiant Stripe fiable et aucun " +
        "abonnement n'a pu être rapproché de vous avec certitude " +
        "(ancien compte ou email modifié).",
    );
  },
});

type StripeSubRef = { id: string; customer: string | null };

/** Abonnement retenu + nombre d'autres abonnements non attribuables. */
type Resolution = { ref: StripeSubRef; unattributable: number };

/**
 * Blocage volontaire : association abonnement/compte absente ou ambiguë.
 * Le message est déjà destiné à l'utilisateur : rien n'a été modifié, le
 * support tranche (contact@vlalemenu.fr).
 */
class SupportError extends Error {}

function supportError(reason: string): SupportError {
  return new SupportError(
    `${reason} Par sécurité, aucun changement n'a été appliqué : ` +
      "contactez le support à contact@vlalemenu.fr pour résolution.",
  );
}

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

/** Compte propriétaire déclaré par la metadata de l'abonnement (null si absente). */
function ownerOf(s: Stripe.Subscription): string | null {
  const owner = s.metadata?.user_id;
  return typeof owner === "string" && owner.length > 0 ? owner : null;
}

/**
 * Retrouve l'abonnement Stripe du compte en exigeant une association FIABLE :
 *  1. l'identifiant gravé par le webhook pour ce compte (opposable) ;
 *  2. sinon le customer gravé par le webhook (chaîne de confiance établie) ;
 *  3. sinon la metadata user_id de l'abonnement, examinée sur TOUS les
 *     clients Stripe portant l'email du compte — jamais le premier trouvé.
 * L'email seul n'établit jamais la propriété (changement d'email non
 * vérifié) : tout abonnement non attribuable rend le résultat ambigu →
 * SupportError, sans aucune modification appliquée.
 * Retourne null uniquement quand aucun abonnement vivant n'apparaît nulle part.
 */
async function resolveAccountStripeSubscription(
  stripe: Stripe,
  args: {
    storedId: string | null;
    storedCustomer: string | null;
    email: string | null;
    userId: string;
  },
): Promise<Resolution | null> {
  const { storedId, storedCustomer, email, userId } = args;

  // ---- 1. Identifiant enregistré pour CE compte ----
  if (storedId) {
    let existing: Stripe.Subscription | null = null;
    try {
      existing = await stripe.subscriptions.retrieve(storedId);
    } catch (err: any) {
      // Identifiant expiré / abonnement supprimé : on cherche plus bas.
      if (err?.code !== "resource_missing" && err?.statusCode !== 404) throw err;
      existing = null;
    }
    if (existing && isLiveStripeSub(existing)) {
      const owner = ownerOf(existing);
      if (owner !== null && owner !== userId)
        throw supportError(
          `L'abonnement enregistré sur votre compte (${storedId}) appartient ` +
            `explicitement à un autre compte.`,
        );
      return { ref: toSubRef(existing, storedCustomer), unattributable: 0 };
    }
  }

  // ---- 2. Customer enregistré (inspecté intégralement) ----
  const recorded: Stripe.Subscription[] = [];
  if (storedCustomer) {
    const res = await stripe.subscriptions.list({
      customer: storedCustomer,
      status: "all",
      limit: 100,
    });
    recorded.push(...res.data.filter(isLiveStripeSub));
  }

  // ---- 3. Email : TOUS les clients (pas de s'arrêter au premier) ----
  const viaEmail: Stripe.Subscription[] = [];
  if (email) {
    const customers = await stripe.customers.list({ email, limit: 10 });
    for (const customer of customers.data) {
      const res = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 100,
      });
      viaEmail.push(...res.data.filter(isLiveStripeSub));
    }
  }

  // ---- 4. Classement : association prouvée vs non attribuable ----
  const recordedIds = new Set(recorded.map((s) => s.id));
  const seen = new Set<string>();
  const proven: Stripe.Subscription[] = [];
  const unattributable: Stripe.Subscription[] = [];
  for (const s of [...recorded, ...viaEmail]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const owner = ownerOf(s);
    if (owner === userId) {
      proven.push(s); // la metadata désigne explicitement ce compte
    } else if (owner === null && recordedIds.has(s.id)) {
      proven.push(s); // sous le customer que ce compte a enregistré
    } else {
      unattributable.push(s); // un autre compte, ou aucune preuve
    }
  }

  if (proven.length === 1)
    return {
      ref: toSubRef(proven[0], storedCustomer),
      unattributable: unattributable.length,
    };
  if (proven.length > 1)
    throw supportError(
      `Plusieurs abonnements Stripe correspondent à votre compte ` +
        `(${proven.map((s) => s.id).join(", ")}).`,
    );
  if (unattributable.length > 0)
    throw supportError(
      `Nous avons trouvé ${unattributable.length} abonnement(s) via votre ` +
        `email qui ne peuvent pas être attribués avec certitude à votre compte.`,
    );
  return null;
}
