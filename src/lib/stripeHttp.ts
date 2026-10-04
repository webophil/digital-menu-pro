/**
 * Client HTTP Stripe minimal, sans dépendance au runtime Convex.
 *
 * Isolé ici pour deux raisons :
 *  1. être exécutable localement avec des réponses simulées (tests) ;
 *  2. rendre explicite la distinction entre « liste vide reçue avec succès »
 *     et « recherche impossible » — les deux ne doivent pas avoir le même
 *     effet sur l'état d'un compte.
 */

export class StripeHttpError extends Error {
  status: number;
  path: string;
  constructor(status: number, path: string) {
    super(`Stripe ${status} sur ${path}`);
    this.name = "StripeHttpError";
    this.status = status;
    this.path = path;
  }
}

/**
 * GET JSON authentifié.
 *
 * `allow404` est réservé à la récupération d'un identifiant CONNU
 * (`/subscriptions/sub_xxx`) : un identifiant mort ne prouve rien, on
 * neutralise. Il ne doit JAMAIS être utilisé pour une liste : un 404 sur
 * `/subscriptions?customer=...` signifie que Stripe n'a pas pu répondre,
 * pas que le client n'a aucun abonnement. Confondre les deux fit passer une
 * panne (ou un customer erroné) pour une absence vérifiée.
 */
export async function stripeGetJson(
  secret: string,
  path: string,
  opts: { allow404?: boolean } = {},
): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (res.status === 404 && opts.allow404) return null;
  if (!res.ok) throw new StripeHttpError(res.status, path);
  return await res.json();
}

/**
 * Tous les abonnements d'un client, TOUTES les pages.
 * Lève si Stripe ne répond pas : une recherche impossible ne doit jamais
 * être rendue comme une liste vide.
 */
export async function listAllSubscriptions(
  secret: string,
  customer: string,
): Promise<any[]> {
  const out: any[] = [];
  let startingAfter: string | undefined;
  do {
    const qs = new URLSearchParams({
      customer,
      status: "all",
      limit: "100",
    });
    if (startingAfter) qs.set("starting_after", startingAfter);
    // Pas de allow404 ici : un 404 est une recherche impossible → erreur.
    const body: any = await stripeGetJson(secret, `/subscriptions?${qs}`);
    const page: any[] = Array.isArray(body?.data) ? body.data : [];
    out.push(...page);
    if (!body?.has_more || page.length === 0) break;
    startingAfter = page[page.length - 1]?.id;
  } while (startingAfter);
  return out;
}

function firstItem(sub: any): any {
  return Array.isArray(sub?.items?.data) ? sub.items.data[0] : undefined;
}

/**
 * Fin de période d'un abonnement, en millisecondes.
 * Depuis l'API Stripe Basil, la période vit sur les ÉLÉMENTS ; l'ancien champ
 * niveau objet reste lu en repli. AUCUNE valeur n'est calculée : une période
 * inventée accordait une échéance que Stripe n'a jamais décidée.
 */
export function subscriptionPeriodEndMs(sub: any): number | undefined {
  const item = firstItem(sub);
  const sec =
    typeof item?.current_period_end === "number"
      ? item.current_period_end
      : typeof sub?.current_period_end === "number"
        ? sub.current_period_end
        : undefined;
  return typeof sec === "number" ? sec * 1000 : undefined;
}

/** Cycle déduit de l'abonnement (metadata, puis prix unitaire). */
export function subscriptionCycle(sub: any): "monthly" | "annual" {
  return sub?.metadata?.cycle === "annual" ||
    Number(firstItem(sub)?.price?.unit_amount ?? 0) >= 19000
    ? "annual"
    : "monthly";
}

/** Fin de période d'un objet Checkout (metadata inline, si fournie). */
export function checkoutSessionPeriodEndMs(object: any): number | undefined {
  const details = object?.subscription_details;
  return (
    subscriptionPeriodEndMs(details) ??
    (typeof details?.current_period_end === "number"
      ? details.current_period_end * 1000
      : undefined)
  );
}

/** Début de période d'un objet Checkout (metadata inline, si fournie). */
export function checkoutSessionPeriodStartMs(object: any): number | undefined {
  const details = object?.subscription_details;
  const item = firstItem(details);
  const sec =
    typeof item?.current_period_start === "number"
      ? item.current_period_start
      : typeof details?.current_period_start === "number"
        ? details.current_period_start
        : undefined;
  return typeof sec === "number" ? sec * 1000 : undefined;
}

/**
 * Fin de période d'une session Checkout standard.
 *
 * Une session Checkout standard porte `subscription: "sub_..."` SANS les
 * périodes : chercher uniquement dans `subscription_details` échouait donc
 * systématiquement sur toute inscription nouvelle. On va alors lire
 * l'abonnement chez Stripe, qui est la source de vérité.
 *
 * Lève si la date reste introuvable : aucune période n'est inventée.
 */
export async function resolveCheckoutPeriodEndMs(
  secret: string,
  object: any,
): Promise<number> {
  const inline = checkoutSessionPeriodEndMs(object);
  if (typeof inline === "number") return inline;

  const subId =
    typeof object?.subscription === "string"
      ? object.subscription
      : (object?.subscription?.id ?? object?.subscription_details?.subscription);
  if (typeof subId !== "string" || subId.length === 0) {
    throw new Error(
      `période introuvable : ni subscription_details ni subscription dans la session Checkout`,
    );
  }

  // 404 sur un identifiant inconnu : on ne peut rien conclure.
  const sub: any = await stripeGetJson(
    secret,
    `/subscriptions/${encodeURIComponent(subId)}`,
    { allow404: true },
  );
  if (!sub) {
    throw new Error(`abonnement ${subId} introuvable chez Stripe`);
  }
  const periodEnd = subscriptionPeriodEndMs(sub);
  if (typeof periodEnd !== "number") {
    throw new Error(
      `fin de période absente de l'abonnement ${subId} (ni élément ni objet)`,
    );
  }
  return periodEnd;
}

/** Fin/début de période portés par une facture. */
export function invoicePeriodEndMs(object: any): number | undefined {
  const line = object?.lines?.data?.[0];
  const item = firstItem(line);
  const sec =
    typeof line?.period?.end === "number"
      ? line.period.end
      : typeof item?.current_period_end === "number"
        ? item.current_period_end
        : typeof object?.subscription_details?.items?.data?.[0]
            ?.current_period_end === "number"
          ? object.subscription_details.items.data[0].current_period_end
          : typeof object?.subscription_details?.current_period_end === "number"
            ? object.subscription_details.current_period_end
            : undefined;
  return typeof sec === "number" ? sec * 1000 : undefined;
}

export function invoicePeriodStartMs(object: any): number | undefined {
  const line = object?.lines?.data?.[0];
  const item = firstItem(line);
  const sec =
    typeof line?.period?.start === "number"
      ? line.period.start
      : typeof item?.current_period_start === "number"
        ? item.current_period_start
        : undefined;
  return typeof sec === "number" ? sec * 1000 : undefined;
}