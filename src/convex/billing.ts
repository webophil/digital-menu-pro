import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { PLANS, isProPlan } from "./plans";

/** Retourne le plan courant du restaurateur (null si aucun enregistrement). */
export const getMySubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return sub ?? null;
  },
});

/** Factures de l'utilisateur connecté, de la plus récente à la plus ancienne. */
export const listMyInvoices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const all = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return all.sort((a, b) => b.issuedAt - a.issuedAt);
  },
});

/** Données de comparaison des plans, côté client. */
export const planCatalog = query({
  args: {},
  handler: async () => {
    return PLANS;
  },
});
