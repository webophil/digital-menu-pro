import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { PLANS } from "./plans";

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const SLUG_LENGTH = 6;

function randomSlug() {
  const bytes = new Uint8Array(SLUG_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  return out;
}

const establishmentTypes = [
  "restaurant",
  "brasserie",
  "foodtruck",
  "cafe",
  "pizzeria",
  "bar",
  "traiteur",
  "glacier",
  "autre",
] as const;

const establishmentTypeV = v.union(
  ...establishmentTypes.map((t) => v.literal(t)),
);

async function requireOwnedRestaurant(
  ctx: { db: any },
  restaurantId: any,
  userId: any,
) {
  const rest = await ctx.db.get(restaurantId);
  if (!rest || rest.ownerId !== userId) return null;
  return rest;
}

async function requireOwnedMenu(ctx: { db: any }, menuId: any, userId: any) {
  const menu = await ctx.db.get(menuId);
  if (!menu) return null;
  const rest = await ctx.db.get(menu.restaurantId);
  if (!rest || rest.ownerId !== userId) return null;
  return { menu, rest };
}

async function requireOwnedCategory(
  ctx: { db: any },
  categoryId: any,
  userId: any,
) {
  const cat = await ctx.db.get(categoryId);
  if (!cat) return null;
  const rest = await ctx.db.get(cat.restaurantId);
  if (!rest || rest.ownerId !== userId) return null;
  return cat;
}

async function requireOwnedDish(ctx: { db: any }, dishId: any, userId: any) {
  const dish = await ctx.db.get(dishId);
  if (!dish) return null;
  const rest = await ctx.db.get(dish.restaurantId);
  if (!rest || rest.ownerId !== userId) return null;
  return dish;
}

// ---------- Lectures ----------

export const listMyRestaurants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("restaurants")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
  },
});

export const getRestaurant = query({
  args: { id: v.id("restaurants") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await requireOwnedRestaurant(ctx, id, userId);
  },
});

export const listMenus = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rest = await requireOwnedRestaurant(ctx, restaurantId, userId);
    if (!rest) return null;
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .collect();
    return menus.sort((a: any, b: any) => a.position - b.position);
  },
});

export const getMenu = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const owned = await requireOwnedMenu(ctx, menuId, userId);
    return owned?.menu ?? null;
  },
});

export const listCategories = query({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const owned = await requireOwnedMenu(ctx, menuId, userId);
    if (!owned) return null;
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_menu", (q) => q.eq("menuId", menuId))
      .collect();
    return cats.sort((a: any, b: any) => a.position - b.position);
  },
});

export const listDishes = query({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rest = await requireOwnedRestaurant(ctx, restaurantId, userId);
    if (!rest) return null;
    return await ctx.db
      .query("dishes")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .collect();
  },
});

// ---------- Onboarding ----------

export const createRestaurant = mutation({
  args: {
    name: v.string(),
    establishmentType: establishmentTypeV,
    city: v.optional(v.string()),
    tagline: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("restaurants")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    if (existing.length > 0) {
      throw new Error("Un seul restaurant par compte en v1.");
    }
    let slug = randomSlug();
    for (let i = 0; i < 5; i++) {
      const taken = await ctx.db
        .query("restaurants")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!taken) break;
      slug = randomSlug();
    }
    const id = await ctx.db.insert("restaurants", {
      ownerId: userId,
      name: args.name,
      slug,
      establishmentType: args.establishmentType,
      city: args.city,
      tagline: args.tagline,
      currency: "€",
    });

    // Abonnement Gratuit par défaut
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!sub) {
      await ctx.db.insert("subscriptions", {
        userId,
        plan: "free",
        status: "active",
        updatedAt: Date.now(),
      });
    }

    // Menu de démarrage "Carte" avec catégories
    const menuId = await ctx.db.insert("menus", {
      restaurantId: id,
      name: "Carte",
      menuType: "carte",
      position: 0,
    });
    const startCats = [
      { name: "Entrées", emoji: "🥗" },
      { name: "Plats", emoji: "🍽️" },
      { name: "Desserts", emoji: "🍰" },
    ];
    for (let i = 0; i < startCats.length; i++) {
      await ctx.db.insert("categories", {
        menuId,
        restaurantId: id,
        name: startCats[i].name,
        emoji: startCats[i].emoji,
        position: i,
      });
    }
    return { restaurantId: id, menuId, slug };
  },
});

export const updateRestaurant = mutation({
  args: {
    id: v.id("restaurants"),
    name: v.optional(v.string()),
    establishmentType: v.optional(establishmentTypeV),
    city: v.optional(v.string()),
    tagline: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const rest = await requireOwnedRestaurant(ctx, id, userId);
    if (!rest) throw new Error("Not found");
    await ctx.db.patch(id, patch);
  },
});

// ---------- Menus ----------

export const createMenu = mutation({
  args: {
    restaurantId: v.id("restaurants"),
    name: v.string(),
    menuType: v.string(),
  },
  handler: async (ctx, { restaurantId, name, menuType }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const rest = await requireOwnedRestaurant(ctx, restaurantId, userId);
    if (!rest) throw new Error("Not found");
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .collect();
    if (menus.length >= PLANS.FREE.maxMenus) {
      throw new Error(
        `Le plan Gratuit est limité à ${PLANS.FREE.maxMenus} menu. Passez au plan Pro pour créer des menus illimités.`,
      );
    }
    const id = await ctx.db.insert("menus", {
      restaurantId,
      name,
      menuType,
      position: menus.length,
    });
    return id;
  },
});

export const renameMenu = mutation({
  args: { menuId: v.id("menus"), name: v.string() },
  handler: async (ctx, { menuId, name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const owned = await requireOwnedMenu(ctx, menuId, userId);
    if (!owned) throw new Error("Not found");
    await ctx.db.patch(menuId, { name });
  },
});

export const setMenuType = mutation({
  args: { menuId: v.id("menus"), menuType: v.string() },
  handler: async (ctx, { menuId, menuType }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const owned = await requireOwnedMenu(ctx, menuId, userId);
    if (!owned) throw new Error("Not found");
    await ctx.db.patch(menuId, { menuType });
  },
});

export const archiveMenu = mutation({
  args: { menuId: v.id("menus"), archived: v.boolean() },
  handler: async (ctx, { menuId, archived }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const owned = await requireOwnedMenu(ctx, menuId, userId);
    if (!owned) throw new Error("Not found");
    await ctx.db.patch(menuId, { archived });
  },
});

export const deleteMenu = mutation({
  args: { menuId: v.id("menus") },
  handler: async (ctx, { menuId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const owned = await requireOwnedMenu(ctx, menuId, userId);
    if (!owned) throw new Error("Not found");
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_menu", (q) => q.eq("menuId", menuId))
      .collect();
    for (const cat of cats) {
      const dishes = await ctx.db
        .query("dishes")
        .withIndex("by_category", (q) => q.eq("categoryId", cat._id))
        .collect();
      for (const d of dishes) await ctx.db.delete(d._id);
      await ctx.db.delete(cat._id);
    }
    await ctx.db.delete(menuId);
  },
});

// ---------- Catégories ----------

export const createCategory = mutation({
  args: {
    menuId: v.id("menus"),
    name: v.string(),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, { menuId, name, emoji }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const owned = await requireOwnedMenu(ctx, menuId, userId);
    if (!owned) throw new Error("Not found");
    const cats = await ctx.db
      .query("categories")
      .withIndex("by_menu", (q) => q.eq("menuId", menuId))
      .collect();
    const id = await ctx.db.insert("categories", {
      menuId,
      restaurantId: owned.menu.restaurantId,
      name,
      emoji,
      position: cats.length,
    });
    return id;
  },
});

export const renameCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, { categoryId, name, emoji }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const cat = await requireOwnedCategory(ctx, categoryId, userId);
    if (!cat) throw new Error("Not found");
    await ctx.db.patch(categoryId, { name, emoji });
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const cat = await requireOwnedCategory(ctx, categoryId, userId);
    if (!cat) throw new Error("Not found");
    const dishes = await ctx.db
      .query("dishes")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .collect();
    for (const d of dishes) await ctx.db.delete(d._id);
    await ctx.db.delete(categoryId);
  },
});

// ---------- Plats ----------

export const createDish = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    imageUrl: v.optional(v.string()),
    allergens: v.array(v.string()),
  },
  handler: async (ctx, { categoryId, ...rest }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const cat = await requireOwnedCategory(ctx, categoryId, userId);
    if (!cat) throw new Error("Not found");
    const dishes = await ctx.db
      .query("dishes")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .collect();
    const id = await ctx.db.insert("dishes", {
      restaurantId: cat.restaurantId,
      categoryId,
      name: rest.name,
      description: rest.description,
      price: rest.price,
      imageUrl: rest.imageUrl,
      allergens: rest.allergens ?? [],
      published: true,
      position: dishes.length,
    });
    return id;
  },
});

export const updateDish = mutation({
  args: {
    dishId: v.id("dishes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    allergens: v.optional(v.array(v.string())),
    published: v.optional(v.boolean()),
  },
  handler: async (ctx, { dishId, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const dish = await requireOwnedDish(ctx, dishId, userId);
    if (!dish) throw new Error("Not found");
    await ctx.db.patch(dishId, patch);
  },
});

export const deleteDish = mutation({
  args: { dishId: v.id("dishes") },
  handler: async (ctx, { dishId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const dish = await requireOwnedDish(ctx, dishId, userId);
    if (!dish) throw new Error("Not found");
    await ctx.db.delete(dishId);
  },
});

// ---------- Démo ----------

export const seedDemoMenu = mutation({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const rest = await requireOwnedRestaurant(ctx, restaurantId, userId);
    if (!rest) throw new Error("Not found");
    const existing = await ctx.db
      .query("dishes")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .collect();
    if (existing.length > 0) return { ok: true };

    const menus = await ctx.db
      .query("menus")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurantId))
      .collect();
    const menuId =
      menus.sort((a: any, b: any) => a.position - b.position)[0]?._id ??
      (await ctx.db.insert("menus", {
        restaurantId,
        name: "Carte",
        menuType: "carte",
        position: 0,
      }));

    const defs: Array<{
      name: string;
      emoji: string;
      dishes: Array<[string, string, number, string[], string | undefined]>;
    }> = [
      {
        name: "Entrées",
        emoji: "🥗",
        dishes: [
          [
            "Burrata, tomates anciennes",
            "Burrata crémeuse, tomates anciennes, basilic frais et huile d'olive",
            12.5,
            ["milk"],
            undefined,
          ],
          [
            "Velouté de saison",
            "Velouté de courge butternut, crème légère et graines torréfiées",
            8.5,
            ["milk"],
            undefined,
          ],
        ],
      },
      {
        name: "Plats",
        emoji: "🍽️",
        dishes: [
          [
            "Burger maison",
            "Bœuf Angus, cheddar affiné, oignons confits, frites fraîches",
            18,
            ["gluten", "milk", "egg", "mustard"],
            "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=70",
          ],
          [
            "Risotto aux champignons",
            "Risotto crémeux, cèpes et parmesan",
            17,
            ["milk"],
            "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&q=70",
          ],
        ],
      },
      {
        name: "Desserts",
        emoji: "🍰",
        dishes: [
          [
            "Tarte citron meringuée",
            "Citron de Menton, meringue légère",
            8,
            ["gluten", "egg", "milk"],
            "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=600&q=70",
          ],
        ],
      },
    ];
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const catId = await ctx.db.insert("categories", {
        menuId,
        restaurantId,
        name: def.name,
        emoji: def.emoji,
        position: i,
      });
      for (let j = 0; j < def.dishes.length; j++) {
        const [name, description, price, allergens, imageUrl] = def.dishes[j];
        await ctx.db.insert("dishes", {
          restaurantId,
          categoryId: catId,
          name,
          description,
          price,
          allergens,
          imageUrl,
          published: true,
          position: j,
        });
      }
    }
    return { ok: true };
  },
});

// ---------- Admin ----------

export const adminListRestaurants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return null;
    const all = await ctx.db.query("restaurants").collect();
    const subs = await ctx.db.query("subscriptions").collect();
    const byUser = new Map(subs.map((s) => [s.userId, s]));
    return all
      .map((r) => ({
        ...r,
        plan: byUser.get(r.ownerId)?.plan ?? "free",
      }))
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const adminSetPlan = mutation({
  args: { userId: v.id("users"), plan: v.string() },
  handler: async (ctx, { userId, plan }) => {
    const adminId = await getAuthUserId(ctx);
    if (adminId === null) throw new Error("Not authenticated");
    const admin = await ctx.db.get(adminId);
    if (admin?.role !== "admin") throw new Error("Forbidden");
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, {
        plan,
        status: "active",
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        plan,
        status: "active",
        updatedAt: Date.now(),
      });
    }
  },
});

// ---------- Internes (webhook paiement) ----------

export const internalSetPlan = internalMutation({
  args: {
    userId: v.id("users"),
    plan: v.string(),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, { userId, plan, periodEnd }) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, {
        plan,
        status: "active",
        currentPeriodEnd: periodEnd,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        plan,
        status: "active",
        currentPeriodEnd: periodEnd,
        updatedAt: Date.now(),
      });
    }
  },
});

export const internalRecordInvoice = internalMutation({
  args: {
    userId: v.id("users"),
    number: v.string(),
    amountEurCents: v.number(),
    plan: v.string(),
    description: v.string(),
    issuedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("invoices", {
      userId: args.userId,
      number: args.number,
      amountEurCents: args.amountEurCents,
      plan: args.plan,
      status: "paid",
      issuedAt: args.issuedAt ?? Date.now(),
      description: args.description,
    });
  },
});
