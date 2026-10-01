// Plans d'abonnement — partagé client / serveur (pas de "use node")

export const PRO_PRICE_EUR = 19;
export const PRO_PRICE_CENTS = PRO_PRICE_EUR * 100;

/** Abonnement Pro annuel : 190 € (soit 2 mois offerts par rapport au mensuel). */
export const PRO_PRICE_ANNUAL_EUR = 190;
/** Cadeau inclus avec l'abonnement annuel (porte-cartes QR, envoyés par colis). */
export const PRO_ANNUAL_GIFT_QTY = 5;
// TVA : l'exploitant est micro-entrepreneur non assujetti (art. 293 B du CGI).
// Avec Stripe Managed Payments (merchant of record), c'est Stripe qui vend au
// client final et collecte la TVA en son propre nom : le SaaS n'encaisse ni
// ne facture aucune TVA. Les prix affichés sont les prix nets perçus.

export type BillingCycle = "monthly" | "annual";

export const PLANS = {
  FREE: {
    id: "free",
    label: "Gratuit",
    maxMenus: 1,
    translation: false,
    features: [
      "1 menu",
      "Photos des plats incluses",
      "Les 14 allergènes réglementaires",
      "QR code imprimable",
      "Menu client mobile",
      "Aucune traduction automatique",
    ],
  },
  PRO: {
    id: "pro",
    label: "Plan PRO",
    maxMenus: Infinity,
    translation: true,
    features: [
      "Menus illimités",
      "Photos des plats illimitées",
      "Traduction automatique EN / ES / DE",
      "Les 14 allergènes réglementaires",
      "QR code imprimable",
      "Menu client mobile multilingue",
      "Support prioritaire",
    ],
  },
} as const;

export type PlanId = (typeof PLANS.FREE.id) | (typeof PLANS.PRO.id);

export const PRO_TRANSLATION_LANGS = ["en", "es", "de"] as const;

export function isProPlan(plan: string | undefined | null) {
  return plan === "pro";
}

/** Doc d'abonnement minimal requis par le helper d'expiration. */
export type SubscriptionLike = {
  plan?: string | null;
  currentPeriodEnd?: number | null;
} | null | undefined;

/**
 * Le plan est-il effectivement PRO ?
 * Un PRO avec une date d'expiration passée retombe en Gratuit.
 */
export function isProSubscription(sub: SubscriptionLike, now: number = Date.now()) {
  if (!isProPlan(sub?.plan)) return false;
  const end = sub?.currentPeriodEnd;
  if (end !== undefined && end !== null && end <= now) return false;
  return true;
}
