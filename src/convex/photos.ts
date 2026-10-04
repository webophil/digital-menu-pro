import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
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
 * Renvoie la fiche de propriété d'un fichier photo, si elle existe.
 * Index `by_storage` : une seule fiche par fichier.
 */
async function findPhotoFile(ctx: any, storageId: Id<"_storage">) {
  return await ctx.db
    .query("photoFiles")
    .withIndex("by_storage", (q: any) => q.eq("storageId", storageId))
    .unique();
}

/**
 * Le fichier appartient-il à cet utilisateur ?
 *
 * Les identifiants de stockage ne sont pas secrets : ils apparaissent dans
 * les URL `/api/storage/...` renvoyées publiquement par `getPhotoUrls` /
 * `getPhotosBatch`. Sans cette vérification, un restaurateur pourrait attacher
 * la photo d'un autre restaurant à son propre plat, puis la supprimer
 * définitivement du stockage via `removePhoto`.
 *
 * Une photo sans fiche est un fichier antérieur à cette table (déjà en ligne)
 * : on lui attribue le propriétaire du plat qui la référence, sinon elle
 * resterait invincible.
 */
async function assertOwnedPhotoFile(
  ctx: any,
  storageId: Id<"_storage">,
  userId: Id<"users">,
  dish: any,
) {
  const file = await findPhotoFile(ctx, storageId);
  if (file) {
    if (file.ownerId !== userId) throw new Error("Not found");
    return file;
  }

  // Pas de fiche : le fichier n'est référencé par aucun plat et n'appartient
  // à personne -> on l'attribue à l'utilisateur qui l'upload (upload en cours).
  const referencedBy = await findDishReferencing(ctx, storageId);
  if (!referencedBy) {
    await ctx.db.insert("photoFiles", {
      storageId,
      ownerId: userId,
      createdAt: Date.now(),
    });
    return null;
  }

  // Photo historique déjà en ligne sans fiche : elle appartient au
  // propriétaire du plat qui la référence. On refuse tout autre rattachement.
  const rest = await ctx.db.get(referencedBy.restaurantId);
  if (!rest || rest.ownerId !== userId) throw new Error("Not found");
  await ctx.db.insert("photoFiles", {
    storageId,
    ownerId: rest.ownerId,
    createdAt: Date.now(),
  });
  return null;
}

/** Premier plat référençant ce fichier (hors plat exclu), ou null. */
async function findDishReferencing(
  ctx: any,
  storageId: Id<"_storage">,
  excludeDishId?: Id<"dishes">,
) {
  let cursor: any = null;
  do {
    const page = await ctx.db.query("dishes").paginate({
      numItems: 64,
      cursor,
    });
    for (const dish of page.page) {
      if (dish._id === excludeDishId) continue;
      if ((dish.photos ?? []).includes(storageId)) return dish;
    }
    if (page.isDone) return null;
    cursor = page.continueCursor;
  } while (true);
}

/**
 * Supprime du stockage les fichiers d'un plat et leurs fiches de propriété.
 * Utilisé par les autres modules (restaurants.ts, account.ts).
 *
 * Cette fonction est atteinte par les suppressions en cascade (plat,
 * catégorie, menu, compte) : elle vérifie donc elle aussi la propriété de
 * chaque fichier avant `storage.delete`. Sans ce contrôle, un identifiant de
 * stockage public aurait suffi à supprimer la photo d'un autre restaurant.
 *
 * Un fichier encore référencé par un autre plat n'est jamais effacé : le
 * stockage est partagé entre plats, on ne purge que ce que plus rien ne
 * référence (une photo mutualisée survit à la suppression d'un seul plat).
 *
 * Renvoie les fichiers réellement effacés et ceux préservés.
 */
export async function purgePhotoFiles(
  ctx: { db: any; storage: any },
  userId: Id<"users">,
  photos?: Id<"_storage">[],
) {
  const purged: Id<"_storage">[] = [];
  const kept: Id<"_storage">[] = [];

  for (const id of photos ?? []) {
    // 1) Propriété : jamais le fichier d'un autre compte.
    const file = await findPhotoFile(ctx, id);
    if (file && file.ownerId !== userId) {
      kept.push(id);
      continue;
    }

    // 2) Partage : si un autre plat référence encore ce fichier (même resto ou
    //    pas), on conserve le fichier et sa fiche de propriété.
    const otherRef = await findDishReferencing(ctx, id);
    if (otherRef) {
      kept.push(id);
      continue;
    }

    // 3) Purge : plus rien ne référence le fichier.
    //    Fiche existante -> supprimée avec le fichier ; fichier legacy sans
    //    fiche -> on efface directement, inutile d'en créer une pour un
    //    fichier qui disparaît.
    if (file) await ctx.db.delete(file._id);
    try {
      await ctx.storage.delete(id);
      purged.push(id);
    } catch {
      // déjà supprimé : ignorer
    }
  }

  return { purged, kept };
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

    // Sécurité : le fichier doit être à nous (sinon on pourrait voler puis
    // supprimer la photo d'un autre restaurant).
    await assertOwnedPhotoFile(ctx, storageId, userId, owned.dish);

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

    // Sécurité : on ne supprime du stockage que nos propres fichiers.
    await assertOwnedPhotoFile(ctx, storageId, userId, owned.dish);

    // La photo peut encore servir un autre plat du même restaurant
    // (mêmes photos mutualisées) : on ne purge le stockage que si plus rien
    // ne la référence.
    const otherRef = await findDishReferencing(ctx, storageId, dishId);
    await ctx.db.patch(dishId, {
      photos: current.filter((id) => id !== storageId),
    });
    if (otherRef) return { ok: true, stillReferenced: true };

    const file = await findPhotoFile(ctx, storageId);
    if (file) await ctx.db.delete(file._id);
    await ctx.storage.delete(storageId);
    return { ok: true };
  },
});

/**
 * Rattache les photos historiques (déjà en ligne, sans fiche de propriété)
 * à leur propriétaire réel, déduit du restaurant qui les référence.
 *
 * `internalMutation` : inaccessible depuis le navigateur, à lancer une seule
 * fois via le CLI. Idempotent.
 */
export const internalBackfillPhotoFiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    let skipped = 0;
    let orphans = 0;
    let cursor: any = null;
    do {
      const page = await ctx.db.query("dishes").paginate({
        numItems: 64,
        cursor,
      });
      for (const dish of page.page) {
        const rest = await ctx.db.get(dish.restaurantId);
        if (!rest) {
          orphans += (dish.photos ?? []).length;
          continue;
        }
        for (const storageId of dish.photos ?? []) {
          const existing = await findPhotoFile(ctx, storageId);
          if (existing) {
            skipped++;
            continue;
          }
          await ctx.db.insert("photoFiles", {
            storageId,
            ownerId: rest.ownerId,
            createdAt: Date.now(),
          });
          created++;
        }
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    } while (true);
    return { created, skipped, orphans };
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