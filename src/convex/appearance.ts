import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  CATEGORY_STYLE_VALUES,
  CARD_STYLE_VALUES,
  DIVIDER_VALUES,
  HEADER_STYLE_VALUES,
  HEADING_CASE_VALUES,
  HEADING_FONT_VALUES,
  BODY_FONT_VALUES,
  HEX_RE,
  MODE_VALUES,
  PHOTO_SHAPE_VALUES,
  PRICE_STYLE_VALUES,
  TEXTURE_VALUES,
  oneOf,
} from "../lib/theme";

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
};

const COLOR_KEYS = ["accent", "accent2", "background", "surface", "text"] as const;

async function findAppearance(ctx: any, restaurantId: any) {
  return await ctx.db
    .query("appearances")
    .withIndex("by_restaurant", (q: any) => q.eq("restaurantId", restaurantId))
    .first();
}

/** Apparence enregistrée du restaurant connecté (null = défauts). */
export const getMyAppearance = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rest = await ctx.db.get(restaurantId);
    if (!rest || rest.ownerId !== userId) return null;
    return await findAppearance(ctx, restaurantId);
  },
});

/** Apparence publique affichée sur /m/:slug (aucune authentification). */
export const getPublicAppearance = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    return await findAppearance(ctx, restaurantId);
  },
});

/** Enregistre l'apparence complète du menu client (upsert). */
export const saveAppearance = mutation({
  args: { restaurantId: v.id("restaurants"), ...appearanceArgs },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const rest = await ctx.db.get(args.restaurantId);
    if (!rest || rest.ownerId !== userId) throw new Error("Not found");

    for (const key of COLOR_KEYS) {
      if (!HEX_RE.test(args[key])) {
        throw new Error("Couleur invalide (format attendu : #RRGGBB).");
      }
    }

    const { restaurantId, ...settings } = args;
    const existing = await findAppearance(ctx, restaurantId);
    if (existing) {
      await ctx.db.patch(existing._id, { ...settings, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("appearances", {
        restaurantId,
        ...settings,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/** Remet l'apparence du restaurant à sa valeur par défaut. */
export const resetAppearance = mutation({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const rest = await ctx.db.get(restaurantId);
    if (!rest || rest.ownerId !== userId) throw new Error("Not found");
    const existing = await findAppearance(ctx, restaurantId);
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  },
});
