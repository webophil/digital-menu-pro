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
 *  - "immediate"  : absence de prélèvement JUSTIFIÉE — chaîne de
 *    facturation gravée pour le compte parcourue intégralement et vide,
 *    ou statut offert par l'admin (aucun paiement attendu).
 */
export const cancelSubscription = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const sub = await ctx.runQuery(api.billing.getMySubscription, {});
    if (!sub) throw new Error("Aucun abonnement actif.");
    // Pas de blocage sur le statut Pro local : une période localement
    // expirée (webhook manqué) ne prouve rien sur la facturation réelle.
    // C'est Stripe qui décide — vérification faite plus bas.

    const stripe = stripeClient();
    const storedId = sub.externalSubscriptionId ?? null;
    const storedCustomer = sub.externalCustomerId ?? null;
    const email = await ctx.runQuery(internal.billingInternal.getUserEmail, {
      userId,
    });

    // ---- 1. Retrouver l'abonnement Stripe (association fiable exigée) ----
    let resolution: Resolution;
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
    if (resolution.kind === "found") {
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

    // ---- 3. Conclusion d'absence du résolveur (justifiée ou non) ----
    // Seule une chaîne de facturation gravée pour CE compte, parcourue
    // intégralement sans abonnement vivant, prouve l'absence de prélèvement.
    // Un ancien identifiant mort (404) ne prouve rien et n'autorise aucun
    // succès ; le statut local (plan Gratuit) n'est PAS une preuve non plus :
    // d'anciens comptes ont été basculés en Gratuit sans que Stripe soit
    // arrêté. Rapprochement incertain → recours au support.
    if (resolution.verified || sub.source === "admin") {
      await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
      return { ok: true, mode: "immediate" as const, warning: undefined };
    }
    throw supportError(
      "Votre compte n'a aucune chaîne de facturation Stripe exploitable " +
        "(identifiant enregistré expiré ou introuvable) et aucun abonnement " +
        "n'a pu être rapproché de vous avec certitude " +
        "(ancien compte ou email modifié).",
    );
  },
});

type StripeSubRef = { id: string; customer: string | null };

/**
 * Verdict du résolveur :
 *  - "found"  : cible prouvée à résilier + nombre d'autres abonnements
 *    présents mais non attribuables à ce compte ;
 *  - "absent" : aucun abonnement vivant trouvé. verified = les chaînes de
 *    facturation gravées pour CE compte ont été parcourues intégralement
 *    (toutes pages, tous statuts) et sont vides → absence justifiée.
 *    verified = false → rien de concluant (identifiant mort/404, scan email
 *    seul) : l'absence de prélèvement n'est PAS prouvée.
 */
type Resolution =
  | { kind: "found"; ref: StripeSubRef; unattributable: number }
  | { kind: "absent"; verified: boolean };

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
 *     clients Stripe portant l'email du compte et toutes leurs pages
 *     (auto-pagination Stripe), jamais le premier trouvé.
 * L'email seul n'établit jamais la propriété (changement d'email non
 * vérifié) : tout abonnement non attribuable rend le résultat ambigu →
 * SupportError, sans aucune modification appliquée.
 * La cible enregistrée (étape 1) n'est qu'un candidat : la recherche se
 * termine toujours (étapes 2 à 4) pour que deux abonnements du même compte
 * déclenchent le blocage « plusieurs abonnements » (le second resterait
 * facturé sinon).
 * Verdict d'absence explicite : { kind: "absent", verified } — verified est
 * true seulement si une chaîne de facturation gravée pour CE compte a été
 * parcourue intégralement sans abonnement vivant. Un identifiant mort (404)
 * ne prouve rien : il ne fournit aucune chaîne exploitable.
 */
async function resolveAccountStripeSubscription(
  stripe: Stripe,
  args: {
    storedId: string | null;
    storedCustomer: string | null;
    email: string | null;
    userId: string;
  },
): Promise<Resolution> {
  const { storedId, storedCustomer, email, userId } = args;

  // ---- 1. Identifiant enregistré pour CE compte → candidat, PAS de décision
  // anticipée : les étapes 2 à 4 s'exécutent toujours, pour que deux
  // abonnements du même compte déclenchent le blocage doublon ----
  // Chaînes de facturation attribuables au compte : le customer gravé et,
  // si l'identifiant est récupérable (même expiré), celui de l'abonnement.
  // Un 404 / resource_missing ne prouve rien : il ne fournit aucune chaîne.
  const accountCustomers = new Set<string>();
  if (storedCustomer) accountCustomers.add(storedCustomer);
  const recordedIdSubs: Stripe.Subscription[] = [];
  if (storedId) {
    let existing: Stripe.Subscription | null = null;
    try {
      existing = await stripe.subscriptions.retrieve(storedId);
    } catch (err: any) {
      // Identifiant expiré / abonnement supprimé : on cherche plus bas.
      if (err?.code !== "resource_missing" && err?.statusCode !== 404) throw err;
      existing = null;
    }
    if (existing) {
      const linked = toSubRef(existing, null).customer;
      if (linked) accountCustomers.add(linked);
    }
    if (existing && isLiveStripeSub(existing)) {
      const owner = ownerOf(existing);
      if (owner !== null && owner !== userId)
        throw supportError(
          `L'abonnement enregistré sur votre compte (${storedId}) appartient ` +
            `explicitement à un autre compte.`,
        );
      recordedIdSubs.push(existing);
    }
  }

  // ---- 2. Chaînes de facturation gravées pour CE compte (auto-pagination :
  // toutes les pages, tous les statuts ; limit: 100 = taille de page max) ----
  const recorded: Stripe.Subscription[] = [];
  for (const customer of accountCustomers) {
    await stripe.subscriptions
      .list({ customer, status: "all", limit: 100 })
      .autoPagingEach((s) => {
        if (isLiveStripeSub(s)) recorded.push(s);
      });
  }

  // ---- 3. Email : TOUS les clients (auto-pagination) et TOUS leurs
  // abonnements — jamais de s'arrêter au premier client ni à la première page ----
  const viaEmail: Stripe.Subscription[] = [];
  if (email) {
    await stripe.customers
      .list({ email, limit: 100 })
      .autoPagingEach(async (customer) => {
        await stripe.subscriptions
          .list({ customer: customer.id, status: "all", limit: 100 })
          .autoPagingEach((s) => {
            if (isLiveStripeSub(s)) viaEmail.push(s);
          });
      });
  }

  // ---- 4. Classement : association prouvée vs non attribuable ----
  // Fiables : identifiant ou customer gravés pour ce compte, ou metadata
  // user_id qui le désigne explicitement.
  const trustedIds = new Set<string>([
    ...recorded.map((s) => s.id),
    ...recordedIdSubs.map((s) => s.id),
  ]);
  const seen = new Set<string>();
  const proven: Stripe.Subscription[] = [];
  const unattributable: Stripe.Subscription[] = [];
  for (const s of [...recordedIdSubs, ...recorded, ...viaEmail]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const owner = ownerOf(s);
    if (owner === userId) {
      proven.push(s); // la metadata désigne explicitement ce compte
    } else if (owner === null && trustedIds.has(s.id)) {
      proven.push(s); // identifiant ou customer gravés pour ce compte
    } else {
      unattributable.push(s); // un autre compte, ou aucune preuve
    }
  }

  if (proven.length === 1)
    return {
      kind: "found",
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
  // Aucun abonnement vivant : l'absence n'est justifiée que si au moins une
  // chaîne de facturation gravée pour CE compte a été parcourue intégralement
  // (elles sont toutes vides, sinon on serait tombé sur un blocage ci-dessus).
  return { kind: "absent", verified: accountCustomers.size > 0 };
}
