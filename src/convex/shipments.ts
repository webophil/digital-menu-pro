import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { PRO_ANNUAL_GIFT_QTY } from "./plans";

/**
 * Colis cadeau de l'utilisateur courant (5 porte-cartes QR de l'abonnement
 * annuel). null = aucun colis (offre mensuelle ou pas encore abonné).
 */
export const getMyShipment = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return (
      (await ctx.db
        .query("giftShipments")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first()) ?? null
    );
  },
});

/** Enregistre (ou corrige) l'adresse d'expédition du colis cadeau. */
export const setAddress = mutation({
  args: {
    fullName: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    postalCode: v.string(),
    city: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { fullName, addressLine1, addressLine2, postalCode, city, phone }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const shipment = await ctx.db
      .query("giftShipments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!shipment) throw new Error("Aucun colis cadeau à expédier.");
    if (shipment.status === "shipped") {
      throw new Error("Le colis a déjà été expédié.");
    }

    await ctx.db.patch(shipment._id, {
      fullName: fullName.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2?.trim() || undefined,
      postalCode: postalCode.trim(),
      city: city.trim(),
      phone: phone?.trim() || undefined,
      status: "ready",
    });
    return { ok: true };
  },
});

/** Quantité de porte-cartes offerte avec l'abonnement annuel (affichage). */
export const giftQuantity = query({
  args: {},
  handler: async () => PRO_ANNUAL_GIFT_QTY,
});
