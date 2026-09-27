"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import axios from "axios";

/**
 * Crée une session de checkout Lemon Squeezy pour le plan Pro.
 * L'utilisateur et son email sont passés en custom_data pour que le
 * webhook puisse attribuer le plan après paiement.
 */
export const createCheckoutSession = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Le paiement n'est pas encore configuré (clé Lemon Squeezy manquante). Contactez le support.",
      );
    }
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;
    if (!storeId || !variantId) {
      throw new Error(
        "Le paiement n'est pas encore configuré (boutique/variante Lemon Squeezy manquantes). Contactez le support.",
      );
    }

    const siteUrl = process.env.CONVEX_SITE_URL || "https://localhost:5173";

    try {
      const res = await axios.post(
        "https://api.lemonsqueezy.com/v1/checkouts",
        {
          data: {
            type: "checkouts",
            attributes: {
              custom_price: false,
              product_options: {
                name: "MenuMaker Pro",
                description: "Abonnement Pro mensuel — menus illimités + traduction automatique",
                redirect_url: `${siteUrl}/subscription?checkout=success`,
                receipt_button_text: "Retour à mon espace",
              },
              checkout_options: { embed: false, dark: false },
              checkout_data: {
                email,
                custom: { user_id: userId, email },
              },
              expires_at: null,
            },
            relationships: {
              store: { data: { type: "stores", id: String(storeId) } },
              variant: { data: { type: "variants", id: String(variantId) } },
            },
          },
        },
        {
          headers: {
            Accept: "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 15000,
        },
      );

      const url: string | undefined = res.data?.data?.attributes?.url;
      if (!url) {
        throw new Error("Lien de paiement indisponible. Réessayez.");
      }
      return { url };
    } catch (err: any) {
      const detail =
        err?.response?.data?.errors?.[0]?.detail ||
        err?.response?.data?.message ||
        err?.message;
      throw new Error(
        `Impossible de créer la session de paiement. ${detail ?? ""}`.trim(),
      );
    }
  },
});
