import { internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

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
    if (!sub || sub.plan !== "pro") {
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
    if (!sub || sub.plan !== "pro") {
      throw new Error(
        "La traduction automatique est réservée au plan Pro. Passez au plan Pro pour l'activer.",
      );
    }

    const max = Math.min(Math.max(limit ?? 30, 1), 50);
    const dishes = await ctx.db
      .query("dishes")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .take(max);

    const jobs: Array<{
      dishId: Id<"dishes"> | null;
      name: string;
      description: string;
    }> = [
      {
        dishId: null,
        name: restaurant.name,
        description: restaurant.tagline ?? "",
      },
      ...dishes
        .filter((d) => d.published !== false)
        .map((d) => ({
          dishId: d._id as Id<"dishes">,
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

export const setPlanPro = internalMutation({
  args: { userId: v.id("users"), periodEnd: v.optional(v.number()) },
  handler: async (ctx, { userId, periodEnd }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, {
        plan: "pro",
        status: "active",
        currentPeriodEnd: periodEnd,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        plan: "pro",
        status: "active",
        currentPeriodEnd: periodEnd,
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
    });
  },
});
