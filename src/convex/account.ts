import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { listAdminIds, logAdminAction } from "./admin";
import { purgePhotoFiles } from "./photos";

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
 * Le changement d'email du compte n'est PLUS accessible ici.
 *
 * Il est désormais traité par `accountEmail.ts` en deux étapes
 * (`requestEmailChange` puis `confirmEmailChange`) : la nouvelle adresse
 * n'est écrite qu'après validation d'un code envoyé à cette adresse.
 *
 * L'ancienne version écrivait l'adresse immédiatement, et cherchait le
 * compte de connexion avec le provider "email" alors que la base contient
 * "email-otp" : le patch ne touchait jamais sa cible, si bien que l'email du
 * profil changeait sans que l'identifiant de connexion suive — l'utilisateur
 * perdait l'accès à son compte.
 */

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

    // Le dernier administrateur ne peut pas supprimer son compte :
    // l'application resterait sans admin (les autres ne peuvent pas non plus
    // être révoqués, cf. demoteAdmin).
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Not found");
    if (user.role === "admin") {
      const admins = await listAdminIds(ctx);
      if (admins.length <= 1)
        throw new Error(
          "Impossible : vous êtes le dernier administrateur. Créez d'abord un second admin depuis l'espace d'administration.",
        );
    }

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
            await purgePhotoFiles(ctx, userId, d.photos ?? []);
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
    // anonymisée : l'email (donnée identifiante) est effacé. Le rôle admin
    // est retiré DANS LA MÊME transaction (le contrôle du dernier admin a
    // déjà été fait plus haut) : un compte anonymisé ne doit plus compter
    // comme administrateur, sinon tous les admins peuvent disparaître en
    // cascade sans que la protection ne réagisse.
    await ctx.db.patch(userId, {
      email: undefined,
      name: "Compte supprimé",
      role: user.role === "admin" ? undefined : user.role,
    });
    if (user.role === "admin") {
      await logAdminAction(ctx, {
        action: "demote",
        actorId: userId,
        targetId: userId,
        note: "Compte admin supprimé (RGPD) — rôle retiré automatiquement",
      });
    }

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
