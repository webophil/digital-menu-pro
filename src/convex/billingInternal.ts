import { internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { isProSubscription } from "./plans";

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
  },
  handler: async (
    ctx,
    { userId, periodEnd, cycle, externalCustomerId, externalSubscriptionId, source },
  ) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const ids: Record<string, string> = {};
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
export const markCancelling = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, {
        status: "cancelling",
        updatedAt: Date.now(),
      });
    }
  },
});

export const setPlanFree = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, {
        plan: "free",
        status: "cancelled",
        updatedAt: Date.now(),
      });
    }
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("invoices", {
      userId: args.userId,
      number: args.number,
      amountEurCents: args.amountEurCents,
      plan: args.plan,
      status: "paid",
      issuedAt: Date.now(),
      description: args.description,
      cycle: args.cycle,
    });
  },
});
