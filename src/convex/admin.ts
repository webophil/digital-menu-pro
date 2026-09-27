import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Emails autorisés à devenir admin (variable d'environnement, séparés par des virgules). */
function allowedAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

async function requireAdmin(ctx: GenericQueryCtx<DataModel>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Accès réservé aux administrateurs.");
  return userId;
}

// ---------- Accès administrateur ----------

/** Un admin existe-t-il déjà ? (pour la page de configuration d'accès) */
export const adminExists = query({
  args: {},
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();
    return admin !== null;
  },
});

/** Email de l'utilisateur connecté (pour la page de configuration d'accès). */
export const myEmail = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    return user?.email ?? null;
  },
});

/**
 * Bootstrap de l'accès admin :
 * - si aucun admin n'existe : le premier utilisateur connecté peut se nommer admin ;
 * - sinon : réservé aux emails listés dans ADMIN_EMAILS (env).
 */
export const claimAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Not found");
    if (user.role === "admin") return { ok: true, already: true };

    const anyAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();

    if (anyAdmin) {
      const email = (user.email ?? "").toLowerCase();
      if (!email || !allowedAdminEmails().includes(email)) {
        throw new Error(
          "Un administrateur existe déjà. Ajoutez votre email à ADMIN_EMAILS pour obtenir l'accès.",
        );
      }
    }
    // Premier admin, ou email sur liste blanche
    await ctx.db.patch(userId, { role: "admin" });
    return { ok: true, already: false };
  },
});

/** Rôle de l'utilisateur courant (pour afficher/masquer l'accès admin). */
export const myRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    return user?.role ?? null;
  },
});

// ---------- Gestion des restaurateurs ----------

/** Liste des restaurateurs avec leur établissement, email et statut d'abonnement. */
export const listRestaurateurs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const restaurants = await ctx.db.query("restaurants").collect();
    const subs = await ctx.db.query("subscriptions").collect();
    const byUser = new Map(subs.map((s) => [s.userId, s]));

    const rows = await Promise.all(
      restaurants.map(async (r) => {
        const owner = await ctx.db.get(r.ownerId);
        const sub = byUser.get(r.ownerId);
        const menus = await ctx.db
          .query("menus")
          .withIndex("by_restaurant", (q) => q.eq("restaurantId", r._id))
          .collect();
        return {
          restaurantId: r._id,
          name: r.name,
          establishmentType: r.establishmentType,
          city: r.city ?? null,
          slug: r.slug,
          ownerId: r.ownerId,
          ownerEmail: owner?.email ?? null,
          menuCount: menus.length,
          plan: sub?.plan ?? "free",
          planStatus: sub?.status ?? null,
          planSource: sub?.source ?? null,
          currentPeriodEnd: sub?.currentPeriodEnd ?? null,
          createdAt: r._creationTime,
        };
      }),
    );
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Attribue le statut PRO à un restaurateur, avec ou sans durée limitée.
 * - durationDays fourni  -> PRO jusqu'à maintenant + durationDays
 * - durationDays omis    -> PRO illimité (jusqu'à retrait manuel)
 */
export const grantPro = mutation({
  args: {
    userId: v.id("users"),
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx, { userId, durationDays }) => {
    const adminId = await requireAdmin(ctx);

    let currentPeriodEnd: number | undefined = undefined;
    if (durationDays !== undefined) {
      if (durationDays < 0) throw new Error("Durée invalide.");
      currentPeriodEnd = Date.now() + durationDays * 24 * 3600 * 1000;
    }

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, {
        plan: "pro",
        status: "active",
        source: "admin",
        currentPeriodEnd,
        grantedByUserId: adminId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        plan: "pro",
        status: "active",
        source: "admin",
        currentPeriodEnd,
        grantedByUserId: adminId,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/** Ramène un restaurateur au plan Gratuit. */
export const revokeToFree = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, {
        plan: "free",
        status: "cancelled",
        source: "admin",
        currentPeriodEnd: undefined,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        plan: "free",
        status: "active",
        source: "admin",
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
