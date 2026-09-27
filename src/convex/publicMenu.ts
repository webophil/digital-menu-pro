import { query } from "./_generated/server";
import { v } from "convex/values";

/** Récupère un restaurant par son slug public (sans authentification). */
export const getPublicRestaurant = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("restaurants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

/** Menus publics d'un restaurant, triés par position. */
export const getPublicMenus = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .collect();
    return menus
      .filter((m) => !m.archived)
      .sort((a, b) => a.position - b.position);
  },
});

/** Catégories publiques d'un menu, triées par position. */
export const getPublicCategories = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_menu", (q) => q.eq("menuId", menuId))
      .collect();
    return cats.sort((a, b) => a.position - b.position);
  },
});

/** Plats publics de toutes les catégories d'un menu, triés. */
export const getPublicDishesBatch = query({
  args: { categoryIds: v.array(v.id("categories")) },
  handler: async (ctx, { categoryIds }) => {
    const out = [];
    for (const categoryId of categoryIds) {
      const dishes = await ctx.db
        .query("dishes")
        .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
        .collect();
      for (const d of dishes) {
        if (d.published !== false) out.push(d);
      }
    }
    return out.sort((a, b) => a.position - b.position);
  },
});

/** Plats publics d'une catégorie, triés par position. */
export const getPublicDishes = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    const dishes = await ctx.db
      .query("dishes")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .collect();
    return dishes
      .filter((d) => d.published !== false)
      .sort((a, b) => a.position - b.position);
  },
});
