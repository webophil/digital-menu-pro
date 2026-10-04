import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Visibilité côté client d'un menu et d'une catégorie.
 *
 * Un contenu public n'est servi que si TOUS ses maillons sont visibles : un
 * plat publié dans une catégorie masquée, ou dans un menu archivé, ne doit
 * pas être récupérable. Sans cette vérification, connaître un identifiant
 * suffisait à lire un contenu volontairement retiré de la carte — les
 * requêtes publiques acceptent des Id sans authentification.
 */

/** Le menu est-il visible publiquement ? (null s'il n'existe pas) */
async function isMenuPublic(
  ctx: any,
  menuId: any,
): Promise<boolean> {
  const menu = await ctx.db.get(menuId);
  if (!menu) return false;
  return !menu.archived && menu.active !== false;
}

/** La catégorie et son menu parent sont-ils visibles publiquement ? */
async function isCategoryPublic(
  ctx: any,
  categoryId: any,
): Promise<boolean> {
  const category = await ctx.db.get(categoryId);
  if (!category) return false;
  if (category.active === false) return false;
  return await isMenuPublic(ctx, category.menuId);
}

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
      .filter((m) => !m.archived && m.active !== false)
      .sort((a, b) => a.position - b.position);
  },
});

/** Catégories publiques d'un menu, triées par position. */
export const getPublicCategories = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    // Un menu masqué ou archivé ne renvoie pas ses catégories.
    if (!(await isMenuPublic(ctx, menuId))) return [];
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_menu", (q) => q.eq("menuId", menuId))
      .collect();
    return cats
      .filter((c) => c.active !== false)
      .sort((a, b) => a.position - b.position);
  },
});

/**
 * Plats publics de plusieurs catégories, triés par position.
 *
 * Chaque catégorie est contrôlée avant d'être lue : une catégorie masquée ou
 * appartenant à un menu masqué est ignorée, ses plats ne sont pas renvoyés.
 */
export const getPublicDishesBatch = query({
  args: { categoryIds: v.array(v.id("categories")) },
  handler: async (ctx, { categoryIds }) => {
    const out = [];
    for (const categoryId of categoryIds) {
      if (!(await isCategoryPublic(ctx, categoryId))) continue;
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

/**
 * Plats publics d'une catégorie, triés par position.
 *
 * La hiérarchie complète est vérifiée : catégorie visible ET menu parent
 * visible. Un plat publié sous une catégorie masquée n'est donc plus
 * récupérable par son identifiant.
 */
export const getPublicDishes = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    if (!(await isCategoryPublic(ctx, categoryId))) return [];
    const dishes = await ctx.db
      .query("dishes")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .collect();
    return dishes
      .filter((d) => d.published !== false)
      .sort((a, b) => a.position - b.position);
  },
});