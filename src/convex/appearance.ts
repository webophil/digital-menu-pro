import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  CATEGORY_STYLE_VALUES,
  CARD_STYLE_VALUES,
  DIVIDER_VALUES,
  HEADER_ALIGN_VALUES,
  HEADER_MARK_VALUES,
  HEADER_STYLE_VALUES,
  HEADING_CASE_VALUES,
  HEADING_FONT_VALUES,
  BODY_FONT_VALUES,
  HEX_RE,
  MODE_VALUES,
  PHOTO_SHAPE_VALUES,
  PRICE_STYLE_VALUES,
  TEXTURE_VALUES,
  getAmbiance,
  isAllowedFreeAppearance,
  oneOf,
  resolveAppearance,
} from "../lib/theme";
import { isProSubscription } from "./plans";
import {
  findDishReferencing,
  findPhotoFile,
  purgePhotoFiles,
} from "./photos";

const LOGO_MAX_BYTES = 512 * 1024;

/** Champs d'apparence (hors restaurantId / updatedAt), validés à l'écriture. */
const appearanceArgs = {
  mode: oneOf(MODE_VALUES),
  accent: v.string(),
  accent2: v.string(),
  background: v.string(),
  surface: v.string(),
  text: v.string(),
  headingFont: oneOf(HEADING_FONT_VALUES),
  bodyFont: oneOf(BODY_FONT_VALUES),
  headingCase: oneOf(HEADING_CASE_VALUES),
  divider: oneOf(DIVIDER_VALUES),
  categoryStyle: oneOf(CATEGORY_STYLE_VALUES),
  cardStyle: oneOf(CARD_STYLE_VALUES),
  priceStyle: oneOf(PRICE_STYLE_VALUES),
  headerStyle: oneOf(HEADER_STYLE_VALUES),
  texture: oneOf(TEXTURE_VALUES),
  photoShape: oneOf(PHOTO_SHAPE_VALUES),
  // En-tête : optionnels, un ancien client ne les envoie pas.
  headerFont: v.optional(oneOf(HEADING_FONT_VALUES)),
  headerCase: v.optional(oneOf(HEADING_CASE_VALUES)),
  headerFollowAccent: v.optional(v.boolean()),
  headerColor: v.optional(v.string()),
  headerColor2: v.optional(v.string()),
  headerAlign: v.optional(oneOf(HEADER_ALIGN_VALUES)),
  headerDivider: v.optional(oneOf(DIVIDER_VALUES)),
  headerMark: v.optional(oneOf(HEADER_MARK_VALUES)),
  showTagline: v.optional(v.boolean()),
  showCity: v.optional(v.boolean()),
  showPhone: v.optional(v.boolean()),
  ambianceId: v.optional(v.string()),
};

const COLOR_KEYS = [
  "accent",
  "accent2",
  "background",
  "surface",
  "text",
  "headerColor",
  "headerColor2",
] as const;

async function findAppearance(ctx: any, restaurantId: any) {
  return await ctx.db
    .query("appearances")
    .withIndex("by_restaurant", (q: any) => q.eq("restaurantId", restaurantId))
    .first();
}

async function isProUser(ctx: any, userId: Id<"users">) {
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  return isProSubscription(sub);
}

/**
 * Ajoute l'URL du logo à la ligne d'apparence. Le logo est une option Pro :
 * si l'abonnement du propriétaire est terminé, le menu retombe sur l'icône.
 */
async function withLogoUrl(ctx: any, row: any, ownerId: Id<"users">) {
  if (!row) return null;
  let logoUrl: string | null = null;
  if (row.logoStorageId && (await isProUser(ctx, ownerId))) {
    logoUrl = await ctx.storage.getUrl(row.logoStorageId);
  }
  return { ...row, logoUrl };
}

/**
 * Le fichier est-il bien un logo valide, et appartient-il à ce compte ?
 * Les identifiants de stockage sont publics (URL /api/storage/...) : sans
 * cette vérification, on pourrait référencer, puis faire supprimer, le fichier
 * d'un autre restaurant.
 */
async function claimLogoFile(
  ctx: any,
  storageId: Id<"_storage">,
  userId: Id<"users">,
) {
  const meta = await ctx.db.system.get(storageId);
  if (!meta || meta.contentType !== "image/webp") {
    throw new Error("Format de logo inattendu (WebP attendu).");
  }
  if (meta.size > LOGO_MAX_BYTES) {
    throw new Error("Le logo est trop lourd (512 Ko maximum).");
  }

  const file = await findPhotoFile(ctx, storageId);
  if (file) {
    if (file.ownerId !== userId) throw new Error("Not found");
    return;
  }
  const referencedBy = await findDishReferencing(ctx, storageId);
  if (referencedBy) {
    const rest = await ctx.db.get(referencedBy.restaurantId);
    if (!rest || rest.ownerId !== userId) throw new Error("Not found");
  }
  await ctx.db.insert("photoFiles", {
    storageId,
    ownerId: userId,
    createdAt: Date.now(),
  });
}

/** Apparence enregistrée du restaurant connecté (null = défauts). */
export const getMyAppearance = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rest = await ctx.db.get(restaurantId);
    if (!rest || rest.ownerId !== userId) return null;
    return await withLogoUrl(
      ctx,
      await findAppearance(ctx, restaurantId),
      userId,
    );
  },
});

/** Apparence publique affichée sur /m/:slug (aucune authentification). */
export const getPublicAppearance = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const rest = await ctx.db.get(restaurantId);
    if (!rest) return null;
    return await withLogoUrl(
      ctx,
      await findAppearance(ctx, restaurantId),
      rest.ownerId,
    );
  },
});

/**
 * Enregistre l'apparence complète du menu client (upsert).
 * `logoStorageId` : absent = conserver le logo actuel, null = le retirer.
 */
export const saveAppearance = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    ...appearanceArgs,
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const rest = await ctx.db.get(args.restaurantId);
    if (!rest || rest.ownerId !== userId) throw new Error("Not found");

    const { restaurantId, logoStorageId, ambianceId, ...input } = args;
    const settings = resolveAppearance(input);

    for (const key of COLOR_KEYS) {
      if (!HEX_RE.test(settings[key as keyof typeof settings] as string)) {
        throw new Error("Couleur invalide (format attendu : #RRGGBB).");
      }
    }

    const existing = await findAppearance(ctx, restaurantId);
    const pro = await isProUser(ctx, userId);

    // Droit Pro vérifié côté SERVEUR, pas seulement dans l'éditeur : le
    // verrou de l'interface ne protège rien si la mutation accepte n'importe
    // quelle configuration. Un client non Pro ne peut enregistrer que l'une
    // des 3 ambiances offertes, sans logo.
    if (!pro && (!isAllowedFreeAppearance(settings) || logoStorageId)) {
      throw new Error(
        "Le plan Gratuit permet de choisir parmi 3 ambiances. Passez au plan Pro pour personnaliser les couleurs, polices, l'en-tête et le logo.",
      );
    }

    // Un compte gratuit ne conserve pas de logo (ex. abonnement terminé).
    const nextLogo: Id<"_storage"> | null = !pro
      ? null
      : logoStorageId === undefined
        ? (existing?.logoStorageId ?? null)
        : logoStorageId;
    const previousLogo: Id<"_storage"> | null = existing?.logoStorageId ?? null;

    if (settings.headerMark === "logo" && !nextLogo) {
      throw new Error("Ajoutez un logo, ou choisissez une autre marque d'en-tête.");
    }
    if (nextLogo && nextLogo !== previousLogo) {
      await claimLogoFile(ctx, nextLogo, userId);
    }

    const row = {
      ...settings,
      ambianceId: ambianceId && getAmbiance(ambianceId) ? ambianceId : undefined,
      logoStorageId: nextLogo ?? undefined,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("appearances", { restaurantId, ...row });
    }

    // L'ancien logo n'est supprimé qu'une fois le nouveau état enregistré, et
    // seulement s'il n'est pas utilisé ailleurs (photo de plat identique).
    if (previousLogo && previousLogo !== nextLogo) {
      await purgePhotoFiles(ctx, userId, [previousLogo]);
    }
    return { ok: true };
  },
});

/** Remet l'apparence du restaurant à sa valeur par défaut (logo compris). */
export const resetAppearance = mutation({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const rest = await ctx.db.get(restaurantId);
    if (!rest || rest.ownerId !== userId) throw new Error("Not found");
    const existing = await findAppearance(ctx, restaurantId);
    if (existing) {
      await ctx.db.delete(existing._id);
      if (existing.logoStorageId) {
        await purgePhotoFiles(ctx, userId, [existing.logoStorageId]);
      }
    }
    return { ok: true };
  },
});
