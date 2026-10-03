import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericQueryCtx, GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Règle d'accès admin (renforcée) :
 *  - AUCUNE auto-attribution depuis le navigateur (claimAdmin supprimé) ;
 *  - AUCUNE liste ADMIN_EMAILS (email non vérifié ≠ preuve de propriété) ;
 *  - le premier admin est créé via le CLI (internalAdminBootstrap,
 *    inaccessible depuis le navigateur) ;
 *  - ensuite, seul un admin peut promouvoir un compte DÉJÀ INSCRIT dont
 *    l'email est VÉRIFIÉ (users.emailVerificationTime renseigné), en ciblant
 *    son identifiant de compte — jamais son email.
 */

async function requireAdmin(ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Accès réservé aux administrateurs.");
  return userId;
}

// ---------- Accès administrateur ----------

/** Liste des admins triés par ancienneté (pour l'UI et la protection du dernier). */
export async function listAdminIds(
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
) {
  const admins = await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("role"), "admin"))
    .collect();
  return admins.sort((a, b) => a._creationTime - b._creationTime);
}

/** Journalisation des actions d'administration (promotion, retrait, bootstrap). */
export async function logAdminAction(
  ctx: GenericMutationCtx<DataModel>,
  entry: {
    action: string;
    actorId?: Id<"users">;
    actorLabel?: string;
    targetId: Id<"users">;
    targetEmail?: string | undefined;
    note?: string | undefined;
  },
) {
  await ctx.db.insert("adminAuditLog", {
    action: entry.action,
    actorId: entry.actorId,
    actorLabel: entry.actorLabel,
    targetId: entry.targetId,
    targetEmail: entry.targetEmail,
    note: entry.note,
    createdAt: Date.now(),
  });
}

/** Un admin existe-t-il déjà ? (pour afficher l'UI) */
export const adminExists = query({
  args: {},
  handler: async (ctx) => {
    const admins = await listAdminIds(ctx);
    return admins.length > 0;
  },
});

/** Email de l'utilisateur connecté (affichage sur l'écran d'accès admin). */
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
 * Bootstrap : crée le premier admin depuis le CLI (npx convex run).
 * internalMutation = inaccessible depuis le navigateur, aucune session
 * requise. À utiliser : voir commentaire de internalAdminLookup.
 */
export const internalAdminLookup = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    if (!user) return { found: false as const };
    return {
      found: true as const,
      userId: user._id,
      role: user.role ?? null,
      emailVerified: user.emailVerificationTime !== undefined,
    };
  },
});

export const internalAdminBootstrap = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    if (!user) {
      throw new Error(
        `Aucun compte inscrit avec l'email ${normalized}. Inscrivez-vous d'abord sur le site, puis relancez.`,
      );
    }
    if (user.emailVerificationTime === undefined) {
      throw new Error(
        `L'email ${normalized} n'est pas vérifié (connectez-vous au moins une fois via le code reçu par email),`,
      );
    }
    if (user.role === "admin") {
      return { ok: true, already: true };
    }
    await ctx.db.patch(user._id, { role: "admin" });
    await logAdminAction(ctx, {
      action: "bootstrap",
      actorLabel: "CLI",
      targetId: user._id,
      targetEmail: normalized,
    });
    return { ok: true, already: false };
  },
});

/**
 * Promouvoit un compte DÉJÀ INSCRIT, en ciblant son identifiant de compte
 * (users._id — l'email seul ne prouve pas la propriété de l'adresse).
 * L'email du compte doit être VÉRIFIÉ (emailVerificationTime renseigné) :
 * un utilisateur qui a changé son email doit d'abord le faire vérifier
 * (se reconnecter avec le code reçu) avant toute promotion.
 */
/**
 * Promouvoit un compte DÉJÀ INSCRIT, identifié par son adresse email.
 * L'adresse doit être VÉRIFIÉE (users.emailVerificationTime renseigné) :
 * la résolution email → identifiant de compte ne s'appuie que sur une
 * adresse prouvée, jamais sur une saisie non validée.
 */
export const promoteToAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const adminId = await requireAdmin(ctx);
    const normalized = email.trim().toLowerCase();
    const target = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    if (!target)
      throw new Error(
        "Aucun compte inscrit avec cet email (la personne doit d'abord créer son compte et valider le code reçu).",
      );
    if (target.isAnonymous)
      throw new Error("Ce compte est anonyme : il doit d'abord s'inscrire.");
    if (target.emailVerificationTime === undefined)
      throw new Error(
        "L'email de ce compte n'est pas vérifié : demandez-lui de se reconnecter (code par email) avant la promotion.",
      );
    if (target.role === "admin") return { ok: true, already: true };
    await ctx.db.patch(target._id, { role: "admin" });
    await logAdminAction(ctx, {
      action: "promote",
      actorId: adminId,
      targetId: target._id,
      targetEmail: target.email,
    });
    return { ok: true, already: false };
  },
});

/**
 * Retire le rôle admin d'un autre admin. Le DERNIER administrateur est
 * protégé : impossible de laisser l'application sans admin.
 */
export const demoteAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const adminId = await requireAdmin(ctx);
    if (adminId === userId)
      throw new Error(
        "Retirez le rôle depuis un autre compte admin : le dernier administrateur ne peut pas se retirer lui-même.",
      );
    const target = await ctx.db.get(userId);
    if (!target || target.role !== "admin")
      throw new Error("Ce compte n'est pas administrateur.");
    const admins = await listAdminIds(ctx);
    if (admins.length <= 1)
      throw new Error(
        "Impossible : c'est le dernier administrateur. Créez d'abord un second admin (promotion d'un compte vérifié) ou via le CLI.",
      );
    await ctx.db.patch(userId, { role: undefined });
    await logAdminAction(ctx, {
      action: "demote",
      actorId: adminId,
      targetId: userId,
      targetEmail: target.email,
    });
    return { ok: true };
  },
});

/** Journal d'audit des actions admin (réservé aux admins). */
export const listAuditLog = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const entries = await ctx.db
      .query("adminAuditLog")
      .withIndex("by_created_at")
      .order("desc")
      .take(100);
    return entries;
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

/** Liste des administrateurs (réservée aux admins) : email + ancienneté. */
export const listAdmins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const admins = await listAdminIds(ctx);
    return admins.map((a) => ({
      userId: a._id,
      email: a.email ?? null,
      createdAt: a._creationTime,
    }));
  },
});

// ---------- Gestion des restaurateurs ----------

/** Liste des restaurateurs avec leur établissement, email et statut d'abonnement. */
export const listRestaurateurs = query({
  args: {},
  handler: async (ctx) => {
    // Sûr : une query ne doit jamais throw vers le client pour un non-admin
    // (la page /admin la souscrit avant de connaître le rôle). On renvoie []
    // et l'UI affiche l'écran de configuration d'accès.
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return [];

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
