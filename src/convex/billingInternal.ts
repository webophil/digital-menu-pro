import { internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { isProSubscription } from "./plans";

/**
 * Durée de réservation d'un événement Stripe. Une tentative qui dépasse ce
 * délai est considérée morte : la suivante peut reprendre l'événement.
 * Large devant le temps d'un traitement normal, court devant la fenêtre de
 * redelivery de Stripe (~3 jours).
 */
const STRIPE_EVENT_LEASE_MS = 60_000;

/**
 * Ordre d'application d'un événement Stripe par rapport à l'état du compte.
 *
 * - "fresh"     : strictement plus récent, ou ordre indéterminable de façon
 *                 inoffensive (première écriture, source de force).
 * - "stale"     : strictement plus ancien → à ne pas appliquer.
 * - "ambiguous" : même seconde que le dernier événement appliqué. Stripe
 *                 précise que `event.created` est à la seconde : deux
 *                 événements distincts peuvent la partager, l'ordre réel est
 *                 alors indéterminable. On ne tranche pas dans un sens ou dans
 *                 l'autre : l'appelant réconcilie avec Stripe.
 */
function eventOrder(
  createdAtStripe: number | undefined,
  sub: { lastStripeEventCreatedAt?: number } | null,
  force: boolean | undefined,
): "fresh" | "stale" | "ambiguous" {
  if (force) return "fresh";
  if (createdAtStripe === undefined) return "fresh";
  const applied = sub?.lastStripeEventCreatedAt;
  if (typeof applied !== "number") return "fresh";
  if (createdAtStripe < applied) return "stale";
  if (createdAtStripe === applied) return "ambiguous";
  return "fresh";
}

/** Charge les textes à traduire et vérifie le plan Pro (server-side). */
export const loadTranslateJob = internalQuery({
  args: {
    restaurantId: v.id("restaurants"),
    dishId: v.optional(v.id("dishes")),
  },
  handler: async (ctx, { restaurantId, dishId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const restaurant = await ctx.db.get(restaurantId);
    if (!restaurant || restaurant.ownerId !== userId)
      throw new Error("Not found");

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!isProSubscription(sub)) {
      throw new Error(
        "La traduction automatique est réservée au plan Pro. Passez au plan Pro pour l'activer.",
      );
    }

    if (dishId) {
      const dish = await ctx.db.get(dishId);
      if (!dish || dish.restaurantId !== restaurantId)
        throw new Error("Not found");
      return { name: dish.name, description: dish.description ?? "" };
    }
    return {
      name: restaurant.name,
      description: restaurant.tagline ?? "",
    };
  },
});

/**
 * Liste les textes à traduire : la vitrine + jusqu'à `limit` plats.
 * Utilisé par l'action translateAll (plan Pro).
 */
export const loadAllTranslateJobs = internalQuery({
  args: {
    restaurantId: v.id("restaurants"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { restaurantId, limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const restaurant = await ctx.db.get(restaurantId);
    if (!restaurant || restaurant.ownerId !== userId)
      throw new Error("Not found");

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!isProSubscription(sub)) {
      throw new Error(
        "La traduction automatique est réservée au plan Pro. Passez au plan Pro pour l'activer.",
      );
    }

    const max = Math.min(Math.max(limit ?? 30, 1), 50);
    const dishes = await ctx.db
      .query("dishes")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .take(max);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .collect();

    const jobs: Array<{
      dishId: Id<"dishes"> | null;
      categoryId: Id<"categories"> | null;
      name: string;
      description: string;
    }> = [
      {
        dishId: null,
        categoryId: null,
        name: restaurant.name,
        description: restaurant.tagline ?? "",
      },
      // Titres de catégories (Entrées → Starters / Vorspeise…)
      ...categories
        .filter((c) => c.active !== false)
        .map((c) => ({
          dishId: null,
          categoryId: c._id as Id<"categories">,
          name: c.name,
          description: "",
        })),
      ...dishes
        .filter((d) => d.published !== false)
        .map((d) => ({
          dishId: d._id as Id<"dishes">,
          categoryId: null,
          name: d.name,
          description: d.description ?? "",
        })),
    ];
    return jobs;
  },
});

export const applyDishTranslations = internalMutation({
  args: {
    dishId: v.id("dishes"),
    patch: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { dishId, patch }) => {
    const allowed = [
      "nameEn",
      "nameEs",
      "nameDe",
      "descriptionEn",
      "descriptionEs",
      "descriptionDe",
    ];
    const clean: Record<string, string> = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) clean[key] = patch[key];
    }
    await ctx.db.patch(dishId, clean);
  },
});

export const applyCategoryTranslations = internalMutation({
  args: {
    categoryId: v.id("categories"),
    patch: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { categoryId, patch }) => {
    const allowed = ["nameEn", "nameEs", "nameDe"];
    const clean: Record<string, string> = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) clean[key] = patch[key];
    }
    await ctx.db.patch(categoryId, clean);
  },
});

export const applyRestaurantTranslations = internalMutation({
  args: {
    restaurantId: v.id("restaurants"),
    patch: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { restaurantId, patch }) => {
    const mapped: Record<string, string> = {};
    for (const [key, val] of Object.entries(patch)) {
      if (key.startsWith("name")) {
        mapped[key] = val; // nameEn / nameEs / nameDe
      } else if (key.startsWith("description")) {
        mapped[key.replace("description", "tagline")] = val;
      }
    }
    await ctx.db.patch(restaurantId, mapped);
  },
});

export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    return user?._id ?? null;
  },
});

/** Email de l'utilisateur (pour retrouver son client Stripe en secours). */
export const getUserEmail = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user?.email ?? null;
  },
});

export const setPlanPro = internalMutation({
  args: {
    userId: v.id("users"),
    periodEnd: v.optional(v.number()),
    cycle: v.optional(v.string()), // "monthly" | "annual"
    // Identifiants Stripe : sans eux, la résiliation ne saurait pas
    // quel abonnement arrêter → on les enregistre dès la première facture.
    externalCustomerId: v.optional(v.string()),
    externalSubscriptionId: v.optional(v.string()),
    source: v.optional(v.string()), // "checkout" | "admin"
    // Date de création de l'événement Stripe (secondes). Une ré-application
    // plus ancienne que `lastStripeEventCreatedAt` est ignorée.
    createdAtStripe: v.optional(v.number()),
    // Force l'écriture malgré l'ancienneté : réservé aux chemins de
    // réconciliation, où l'état vient d'être lu chez Stripe.
    force: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    {
      userId,
      periodEnd,
      cycle,
      externalCustomerId,
      externalSubscriptionId,
      source,
      createdAtStripe,
      force,
    },
  ) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Garde d'ancienneté : un rejeu d'événement ancien ne doit pas rallumer
    // un abonnement résilié depuis. Exemple : un paiement active le Pro, son
    // traitement échoue, une résiliation intervient, puis Stripe rejoue le
    // paiement — sans cette garde, le compte repassait Pro actif.
    const order = eventOrder(createdAtStripe, sub, force);
    if (order !== "fresh") {
      return {
        skipped: true,
        reason: order === "stale" ? ("stale_event" as const) : ("ambiguous" as const),
        lastStripeEventCreatedAt:
          typeof sub?.lastStripeEventCreatedAt === "number"
            ? sub.lastStripeEventCreatedAt
            : undefined,
      };
    }

    const ids: Record<string, string | number> = {};
    if (createdAtStripe !== undefined)
      ids.lastStripeEventCreatedAt = createdAtStripe;
    if (externalCustomerId !== undefined)
      ids.externalCustomerId = externalCustomerId;
    if (externalSubscriptionId !== undefined)
      ids.externalSubscriptionId = externalSubscriptionId;
    if (source !== undefined) ids.source = source;
    if (sub) {
      await ctx.db.patch(sub._id, {
        plan: "pro",
        status: "active",
        currentPeriodEnd: periodEnd,
        updatedAt: Date.now(),
        ...ids,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        plan: "pro",
        status: "active",
        currentPeriodEnd: periodEnd,
        updatedAt: Date.now(),
        ...ids,
      });
    }
  },
});

/**
 * Enregistre (ou complète) les identifiants Stripe d'un abonnement.
 * Utilisé par les événements subscription.* du webhook et par la
 * résiliation, pour que le champ externalSubscriptionId ne reste jamais vide.
 */
export const recordExternalIds = internalMutation({
  args: {
    userId: v.id("users"),
    externalCustomerId: v.optional(v.string()),
    externalSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, { userId, externalCustomerId, externalSubscriptionId }) => {
    if (externalCustomerId === undefined && externalSubscriptionId === undefined)
      return;
    const patch: Record<string, string | number> = { updatedAt: Date.now() };
    if (externalCustomerId !== undefined)
      patch.externalCustomerId = externalCustomerId;
    if (externalSubscriptionId !== undefined)
      patch.externalSubscriptionId = externalSubscriptionId;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, patch);
    } else {
      // Aucune ligne encore (événement reçu avant l'activation) : on crée
      // une base neutre que setPlanPro / setPlanFree mettront à jour.
      await ctx.db.insert("subscriptions", {
        userId,
        plan: "free",
        status: "active",
        updatedAt: Date.now(),
        externalCustomerId: patch.externalCustomerId as string | undefined,
        externalSubscriptionId: patch.externalSubscriptionId as string | undefined,
      });
    }
  },
});

/**
 * Résiliation programmée (fin de période payée) : le compte reste Pro
 * jusqu'à currentPeriodEnd, mais est marqué "cancelling" pour l'affichage.
 * Le webhook customer.subscription.deleted fera ensuite le passage en Gratuit.
 */
/**
 * Identité de facturation d'un compte : email + identifiants Stripe gravés.
 * Sert à la réconciliation, qui doit retrouver l'abonnement de CE compte avec
 * les mêmes garanties d'attribution que la résiliation (jamais « le premier
 * trouvé », jamais un abonnement d'un autre utilisateur).
 */
export const getBillingIdentity = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return {
      email: user?.email ?? null,
      externalCustomerId: sub?.externalCustomerId ?? null,
      externalSubscriptionId: sub?.externalSubscriptionId ?? null,
      plan: sub?.plan ?? "free",
      status: sub?.status ?? null,
    };
  },
});

export const markCancelling = internalMutation({
  args: {
    userId: v.id("users"),
    createdAtStripe: v.optional(v.number()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, createdAtStripe, force }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      // Symétrique de setPlanPro : une résiliation livrée APRÈS un paiement
      // plus récent ne doit pas déclasser le compte. L'ancienneté est donc
      // testée dans les deux sens, pas seulement pour l'activation.
      const order = eventOrder(createdAtStripe, sub, force);
      if (order !== "fresh") {
        return {
          skipped: true,
          reason: order === "stale" ? ("stale_event" as const) : ("ambiguous" as const),
        };
      }
      const patch: Record<string, string | number> = {
        status: "cancelling",
        updatedAt: Date.now(),
      };
      if (createdAtStripe !== undefined)
        patch.lastStripeEventCreatedAt = createdAtStripe;
      await ctx.db.patch(sub._id, patch);
    }
    return { skipped: false };
  },
});

export const setPlanFree = internalMutation({
  args: {
    userId: v.id("users"),
    createdAtStripe: v.optional(v.number()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, createdAtStripe, force }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      // Garde symétrique : un retour en Gratuit plus ancien qu'un paiement
      // déjà appliqué est écarté, comme l'activation.
      const order = eventOrder(createdAtStripe, sub, force);
      if (order !== "fresh") {
        return {
          skipped: true,
          reason: order === "stale" ? ("stale_event" as const) : ("ambiguous" as const),
        };
      }
      const patch: Record<string, string | number> = {
        plan: "free",
        status: "cancelled",
        updatedAt: Date.now(),
      };
      if (createdAtStripe !== undefined)
        patch.lastStripeEventCreatedAt = createdAtStripe;
      await ctx.db.patch(sub._id, patch);
    }
    return { skipped: false };
  },
});

export const recordInvoice = internalMutation({
  args: {
    userId: v.id("users"),
    number: v.string(),
    amountEurCents: v.number(),
    plan: v.string(),
    description: v.string(),
    cycle: v.optional(v.string()),
    // Clé d'idempotence : identifiant de facture Stripe. Le même paiement
    // arrive via plusieurs événements (checkout.session.completed et
    // invoice.paid) ; sans cette clé, chaque livraison insérait une facture
    // locale supplémentaire.
    stripeInvoiceId: v.optional(v.string()),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Déjà enregistrée (livraison répétée du même paiement) : on ne duplique pas.
    if (args.stripeInvoiceId) {
      const existing = await ctx.db
        .query("invoices")
        .withIndex("by_stripe_invoice", (q) =>
          q.eq("stripeInvoiceId", args.stripeInvoiceId),
        )
        .unique();
      if (existing) return { created: false, invoiceId: existing._id };
    }

    const invoiceId = await ctx.db.insert("invoices", {
      userId: args.userId,
      number: args.number,
      amountEurCents: args.amountEurCents,
      plan: args.plan,
      status: "paid",
      issuedAt: Date.now(),
      description: args.description,
      cycle: args.cycle,
      stripeInvoiceId: args.stripeInvoiceId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    });
    return { created: true, invoiceId };
  },
});

/**
 * Dédoublonnage des livraisons Stripe.
 *
 * Renvoie `duplicate: true` si l'événement a déjà été traité avec succès :
 * le webhook répond alors 200 sans rien refaire. Un événement en échec ou
 * interrompu est réessayé (Stripe réémet pendant ~3 jours), ce qui est sans
 * danger car `recordInvoice` est lui-même idempotent.
 */
export const beginStripeEvent = internalMutation({
  args: {
    eventId: v.string(),
    type: v.string(),
    createdAtStripe: v.optional(v.number()),
  },
  handler: async (ctx, { eventId, type, createdAtStripe }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("stripeEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
      .unique();

    const duplicate = { duplicate: true as const, leaseToken: null, attempts: 0 };
    const denied = {
      duplicate: true as const,
      inFlight: true as const,
      leaseToken: null,
      attempts: 0,
    };

    if (existing) {
      // Déjà soldé : rien à refaire, quelle que soit la tentative.
      if (existing.status === "processed") {
        return { ...duplicate, attempts: existing.attempts };
      }

      // Réservation encore valide : une autre tentative traite l'événement.
      // On refuse, sinon deux treatments concurrents s'exécuteraient.
      const leaseAlive =
        existing.status === "processing" &&
        typeof existing.leaseExpiresAt === "number" &&
        existing.leaseExpiresAt > now;
      if (leaseAlive) {
        return { ...denied, attempts: existing.attempts };
      }

      // Réservation expirée (tentative interrompue) ou tentative précédente
      // en échec : on reprend la main avec un nouveau jeton.
      const leaseToken = crypto.randomUUID();
      await ctx.db.patch(existing._id, {
        status: "processing",
        attempts: existing.attempts + 1,
        lastError: undefined,
        receivedAt: now,
        leaseToken,
        leaseExpiresAt: now + STRIPE_EVENT_LEASE_MS,
        createdAtStripe: createdAtStripe ?? existing.createdAtStripe,
      });
      return { duplicate: false, leaseToken, attempts: existing.attempts + 1 };
    }

    const leaseToken = crypto.randomUUID();
    await ctx.db.insert("stripeEvents", {
      eventId,
      type,
      status: "processing",
      attempts: 1,
      receivedAt: now,
      leaseToken,
      leaseExpiresAt: now + STRIPE_EVENT_LEASE_MS,
      createdAtStripe,
    });
    return { duplicate: false, leaseToken, attempts: 1 };
  },
});

/**
 * Marque l'événement comme traité. Seul le détenteur du jeton peut clore
 * l'événement : une livraison concurrente (ou une tentative expirée) est
 * ignorée au lieu d'écraser le résultat d'une autre.
 */
export const completeStripeEvent = internalMutation({
  args: { eventId: v.string(), leaseToken: v.string() },
  handler: async (ctx, { eventId, leaseToken }) => {
    const existing = await ctx.db
      .query("stripeEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
      .unique();
    if (!existing) return { found: false, owned: false };
    // Déjà soldé par une tentative plus récente : on ne touche à rien.
    if (existing.status === "processed") return { found: true, owned: false };
    if (existing.leaseToken !== leaseToken)
      return { found: true, owned: false };

    await ctx.db.patch(existing._id, {
      status: "processed",
      processedAt: Date.now(),
      lastError: undefined,
      leaseToken: undefined,
      leaseExpiresAt: undefined,
    });
    return { found: true, owned: true };
  },
});

/**
 * Marque l'événement en échec. Le webhook répond alors 5xx : Stripe réémet
 * l'événement, qui sera retenté jusqu'à `maxAttempts`.
 *
 * Le jeton est exigé : sans lui, un traitement lent qui échoue tardivement
 * pourrait faire repasser en `failed` un événement déjà `processed` par une
 * tentative plus récente.
 */
export const failStripeEvent = internalMutation({
  args: { eventId: v.string(), error: v.string(), leaseToken: v.string() },
  handler: async (ctx, { eventId, error, leaseToken }) => {
    const existing = await ctx.db
      .query("stripeEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
      .unique();
    if (!existing) return { found: false, owned: false };
    if (existing.status === "processed")
      return { found: true, owned: false };
    if (existing.leaseToken !== leaseToken)
      return { found: true, owned: false };

    await ctx.db.patch(existing._id, {
      status: "failed",
      lastError: error.slice(0, 500),
      leaseToken: undefined,
      leaseExpiresAt: undefined,
    });
    return { found: true, owned: true };
  },
});
