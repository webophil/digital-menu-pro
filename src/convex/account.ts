import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

/**
 * Suppression définitive du compte (RGPD, art. 17 — droit à l'effacement) :
 * - établissement, menus, catégories, plats et photos : supprimés
 * - abonnement : supprimé
 * - sessions et moyens de connexion : supprimés (plus aucune connexion possible)
 * - factures : conservées 10 ans (obligation comptable, voir politique de
 *   confidentialité) ; la fiche utilisateur est anonymisée (email retiré).
 */
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub && sub.plan === "pro" && sub.status !== "cancelled") {
      throw new Error(
        sub.source === "admin"
          ? "Un statut Pro vous a été offert. Contactez le support avant de supprimer votre compte."
          : "Votre abonnement Pro est actif. Annulez-le depuis « Mes infos » avant de supprimer votre compte.",
      );
    }

    const restaurants = await ctx.db
      .query("restaurants")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    for (const rest of restaurants) {
      const menus = await ctx.db
        .query("menus")
        .withIndex("by_restaurant", (q) => q.eq("restaurantId", rest._id))
        .collect();
      for (const menu of menus) {
        const cats = await ctx.db
          .query("categories")
          .withIndex("by_menu", (q) => q.eq("menuId", menu._id))
          .collect();
        for (const cat of cats) {
          const dishes = await ctx.db
            .query("dishes")
            .withIndex("by_category", (q) => q.eq("categoryId", cat._id))
            .collect();
          for (const d of dishes) {
            await ctx.db.delete(d._id);
            for (const photoId of d.photos ?? []) {
              try {
                await ctx.storage.delete(photoId);
              } catch {
                // déjà supprimée : ignorer
              }
            }
          }
          await ctx.db.delete(cat._id);
        }
        await ctx.db.delete(menu._id);
      }
      await ctx.db.delete(rest._id);
    }

    // Abonnement (déjà bloqué si Pro actif, voir plus haut)
    if (sub) await ctx.db.delete(sub._id);

    // Sessions : déconnexion immédiate sur tous les appareils
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    // Moyens de connexion : plus aucun login possible
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const a of accounts) await ctx.db.delete(a._id);

    // Factures conservées (obligation comptable) — la fiche utilisateur est
    // anonymisée : l'email (donnée identifiante) est effacé.
    await ctx.db.patch(userId, { email: undefined, name: "Compte supprimé" });

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
