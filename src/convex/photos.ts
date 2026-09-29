import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { isProSubscription } from "./plans";

const FREE_PHOTOS_PER_DISH = 1;

/** Vérifie la propriété d'un plat et renvoie (restaurant, plat). */
async function requireOwnedDish(ctx: any, dishId: any, userId: any) {
  const dish = await ctx.db.get(dishId);
  if (!dish) return null;
  const rest = await ctx.db.get(dish.restaurantId);
  if (!rest || rest.ownerId !== userId) return null;
  return { dish, rest };
}

/**
 * URL d'upload éphémère : le navigateur envoie directement le WebP au
 * stockage Convex (image déjà convertie et compressée côté client).
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Ajoute un storageId (déjà uploadé en WebP) aux photos d'un plat, avec quota. */
export const attachPhoto = mutation({
  args: { dishId: v.id("dishes"), storageId: v.id("_storage") },
  handler: async (ctx, { dishId, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const owned = await requireOwnedDish(ctx, dishId, userId);
    if (!owned) throw new Error("Not found");

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const current = owned.dish.photos ?? [];
    if (!isProSubscription(sub) && current.length >= FREE_PHOTOS_PER_DISH) {
      throw new Error(
        "Le plan Gratuit est limité à 1 photo par plat. Passez au plan Pro pour des photos illimitées.",
      );
    }

    // Sécurité : on n'attache que du WebP (converti côté client).
    const meta = await ctx.db.system.get(storageId);
    if (!meta || meta.contentType !== "image/webp") {
      throw new Error("Format d'image inattendu (WebP attendu).");
    }

    await ctx.db.patch(dishId, { photos: [...current, storageId] });
    return { ok: true, count: current.length + 1 };
  },
});

/** Retire une photo d'un plat et supprime le fichier du stockage. */
export const removePhoto = mutation({
  args: { dishId: v.id("dishes"), storageId: v.id("_storage") },
  handler: async (ctx, { dishId, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const owned = await requireOwnedDish(ctx, dishId, userId);
    if (!owned) throw new Error("Not found");

    const current: Id<"_storage">[] = owned.dish.photos ?? [];
    if (!current.includes(storageId)) return { ok: true };
    await ctx.db.patch(dishId, {
      photos: current.filter((id) => id !== storageId),
    });
    await ctx.storage.delete(storageId);
    return { ok: true };
  },
});

/**
 * Photos de plusieurs plats en une requête (menu client) :
 * Record<dishId, {storageId, url}[]> dans l'ordre d'affichage.
 */
export const getPhotosBatch = query({
  args: { dishIds: v.array(v.id("dishes")) },
  handler: async (ctx, { dishIds }) => {
    const out: Record<
      string,
      { storageId: Id<"_storage">; url: string }[]
    > = {};
    for (const dishId of dishIds) {
      const dish = await ctx.db.get(dishId);
      if (!dish?.photos || dish.photos.length === 0) continue;
      const pairs = await Promise.all(
        dish.photos.map(async (storageId) => ({
          storageId,
          url: await ctx.storage.getUrl(storageId),
        })),
      );
      const ok = pairs.filter(
        (p): p is { storageId: Id<"_storage">; url: string } => p.url !== null,
      );
      if (ok.length > 0) out[dish._id] = ok;
    }
    return out;
  },
});

/** Le restaurant est-il en plan Pro ? (public : pilote le carrousel) */
export const isProRestaurant = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const rest = await ctx.db.get(restaurantId);
    if (!rest) return false;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", rest.ownerId))
      .first();
    return isProSubscription(sub);
  },
});

/**
 * Photos publiques d'un plat : paires {storageId, url} dans l'ordre
 * d'affichage (menu client + éditeur). Pas d'authentification : les
 * menus sont publics.
 */
export const getPhotoUrls = query({
  args: { dishId: v.id("dishes") },
  handler: async (ctx, { dishId }) => {
    const dish = await ctx.db.get(dishId);
    if (!dish?.photos || dish.photos.length === 0) return [];
    const pairs = await Promise.all(
      dish.photos.map(async (storageId) => ({
        storageId,
        url: await ctx.storage.getUrl(storageId),
      })),
    );
    return pairs.filter((p): p is { storageId: Id<"_storage">; url: string } =>
      p.url !== null,
    );
  },
});
