import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isProSubscription } from "./plans";
import { internal } from "./_generated/api";

/** Profil du compte connecté : email, rôle, restaurant (s'il existe). */
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const restaurant = (
      await ctx.db
        .query("restaurants")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect()
    )[0];

    return {
      email: user.email ?? "",
      userId,
      restaurant: restaurant ?? null,
    };
  },
});

/**
 * Change l'email du compte. L'authentification reste valable (session
 * courante inchangée) ; on met à jour authAccounts + table users pour que
 * la prochaine connexion se fasse avec le nouvel email.
 */
export const updateMyEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("Adresse email invalide.");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Not found");

    // Unicité : ni chez les users, ni dans les authAccounts.
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    if (existing && existing._id !== userId) {
      throw new Error("Cet email est déjà utilisé par un autre compte.");
    }

    // authAccounts (Convex Auth email OTP) : provider "email"
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "email"),
      )
      .first();
    if (account) {
      await ctx.db.patch(account._id, {
        providerAccountId: normalized,
        secret: undefined,
      });
    }

    await ctx.db.patch(userId, { email: normalized });
    return { ok: true };
  },
});

/** Met à jour le nom de l'établissement (identité affichée aux clients). */
export const updateEstablishment = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    name: v.optional(v.string()),
    tagline: v.optional(v.string()),
    addressNumber: v.optional(v.string()),
    addressStreet: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    phone: v.optional(v.string()),
    siret: v.optional(v.string()),
  },
  handler: async (ctx, { restaurantId, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const rest = await ctx.db.get(restaurantId);
    if (!rest || rest.ownerId !== userId) throw new Error("Not found");

    // Nettoyage : les champs vides deviennent undefined
    const clean: Record<string, string | undefined> = {};
    for (const [k, val] of Object.entries(patch)) {
      clean[k] = typeof val === "string" ? val.trim() || undefined : undefined;
    }

    if (clean.siret) {
      const digits = clean.siret.replace(/\s/g, "");
      if (!/^\d{14}$/.test(digits)) {
        throw new Error(
          "Le SIRET doit contenir 14 chiffres (ex : 123 456 789 00012).",
        );
      }
      clean.siret = digits;
    }

    if (clean.name !== undefined && clean.name.length < 2) {
      throw new Error("Le nom de l'établissement est trop court.");
    }

    await ctx.db.patch(restaurantId, clean as any);
    return { ok: true };
  },
});

/**
 * Annule l'abonnement Pro en un clic : repasse immédiatement en Gratuit.
 * (La résiliation côté Lemon Squeezy, quand les clés sont configurées,
 * sera déclenchée par le webhook de souscription.)
 */
export const cancelSubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!sub || !isProSubscription(sub)) {
      throw new Error("Aucun abonnement Pro actif.");
    }
    await ctx.runMutation(internal.billingInternal.setPlanFree, { userId });
    return { ok: true };
  },
});
