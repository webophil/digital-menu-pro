import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";
import {
  CATEGORY_STYLE_VALUES,
  CARD_STYLE_VALUES,
  DIVIDER_VALUES,
  HEADER_STYLE_VALUES,
  HEADING_CASE_VALUES,
  HEADING_FONT_VALUES,
  BODY_FONT_VALUES,
  MODE_VALUES,
  PHOTO_SHAPE_VALUES,
  PRICE_STYLE_VALUES,
  TEXTURE_VALUES,
  oneOf,
} from "../lib/theme";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ---- V'la le Menu ! (SaaS menus digitaux) ----

    // Établissement d'un restaurateur (v1 : 1 restaurant par compte)
    restaurants: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      slug: v.string(),
      establishmentType: v.string(), // "restaurant" | "brasserie" | "foodtruck" | ...
      city: v.optional(v.string()),
      // Adresse physique détaillée (infos établissement + facturation)
      addressNumber: v.optional(v.string()),
      addressStreet: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      phone: v.optional(v.string()),
      siret: v.optional(v.string()), // 14 chiffres — requis en Pro (facturation électronique)
      tagline: v.optional(v.string()),
      currency: v.string(), // ex "€"
      // Traductions de la vitrine (auto, via AI, plan Pro)
      nameEn: v.optional(v.string()),
      nameEs: v.optional(v.string()),
      nameDe: v.optional(v.string()),
      taglineEn: v.optional(v.string()),
      taglineEs: v.optional(v.string()),
      taglineDe: v.optional(v.string()),
    })
      .index("by_owner", ["ownerId"])
      .index("by_slug", ["slug"]),

    // Un menu (Carte, Menu du jour, Ardoise…)
    menus: defineTable({
      restaurantId: v.id("restaurants"),
      name: v.string(),
      menuType: v.string(), // "carte" | "menu-du-jour" | "soir" | "enfants" | "boissons" | "autre"
      position: v.number(),
      archived: v.optional(v.boolean()),
      active: v.optional(v.boolean()), // false = menu masqué au client
    }).index("by_restaurant", ["restaurantId"]),

    // Catégorie dans un menu (Entrées, Plats, Desserts…)
    categories: defineTable({
      menuId: v.id("menus"),
      restaurantId: v.id("restaurants"),
      name: v.string(),
      emoji: v.optional(v.string()),
      position: v.number(),
      active: v.optional(v.boolean()), // false = catégorie masquée au client
    }).index("by_menu", ["menuId"]),

    // Un plat
    dishes: defineTable({
      restaurantId: v.id("restaurants"),
      categoryId: v.id("categories"),
      name: v.string(),
      description: v.optional(v.string()),
      price: v.number(), // en euros
      imageUrl: v.optional(v.string()),
      allergens: v.array(v.string()), // codes des 14 allergènes FR
      photos: v.optional(v.array(v.id("_storage"))), // WebP optimisés, ordre = affichage
      published: v.optional(v.boolean()),
      position: v.number(),
      // Traductions automatiques (plan Pro)
      nameEn: v.optional(v.string()),
      nameEs: v.optional(v.string()),
      nameDe: v.optional(v.string()),
      descriptionEn: v.optional(v.string()),
      descriptionEs: v.optional(v.string()),
      descriptionDe: v.optional(v.string()),
    })
      .index("by_category", ["categoryId"])
      .index("by_restaurant", ["restaurantId"]),

    // État d'abonnement du restaurateur
    subscriptions: defineTable({
      userId: v.id("users"),
      plan: v.string(), // "free" | "pro"
      status: v.optional(v.string()), // active | on_trial | past_due | cancelled
      provider: v.optional(v.string()), // "lemonsqueezy" | "admin"
      source: v.optional(v.string()), // "checkout" | "admin"
      grantedByUserId: v.optional(v.id("users")), // si octroyé par un admin
      externalCustomerId: v.optional(v.string()),
      externalSubscriptionId: v.optional(v.string()),
      currentPeriodEnd: v.optional(v.number()), // absent = illimité
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_external_subscription", ["externalSubscriptionId"]),

    // Factures d'abonnement
    invoices: defineTable({
      userId: v.id("users"),
      number: v.string(),
      amountEurCents: v.number(),
      plan: v.string(),
      status: v.string(), // "paid" | "refunded" | "open"
      issuedAt: v.number(),
      periodStart: v.optional(v.number()),
      periodEnd: v.optional(v.number()),
      description: v.string(),
      cycle: v.optional(v.string()), // "monthly" | "annual"
    }).index("by_user", ["userId"]),

    // Messages du formulaire de contact (page /contact)
    contactMessages: defineTable({
      fullName: v.string(),
      establishment: v.optional(v.string()),
      email: v.string(),
      subject: v.string(),
      message: v.string(),
      createdAt: v.number(),
    }).index("by_created_at", ["createdAt"]),

    // Apparence du menu client (thème : couleurs, polices, décor) —
    // page /apparence, rendu sur /m/:slug
    appearances: defineTable({
      restaurantId: v.id("restaurants"),
      mode: oneOf(MODE_VALUES), // "light" | "dark"
      accent: v.string(), // #RRGGBB — couleur principale
      accent2: v.string(), // fin du dégradé
      background: v.string(),
      surface: v.string(), // cartes / panneaux
      text: v.string(),
      headingFont: oneOf(HEADING_FONT_VALUES),
      bodyFont: oneOf(BODY_FONT_VALUES),
      headingCase: oneOf(HEADING_CASE_VALUES),
      divider: oneOf(DIVIDER_VALUES), // fioritures entre les blocs
      categoryStyle: oneOf(CATEGORY_STYLE_VALUES),
      cardStyle: oneOf(CARD_STYLE_VALUES),
      priceStyle: oneOf(PRICE_STYLE_VALUES),
      headerStyle: oneOf(HEADER_STYLE_VALUES),
      texture: oneOf(TEXTURE_VALUES),
      photoShape: oneOf(PHOTO_SHAPE_VALUES),
      updatedAt: v.number(),
    }).index("by_restaurant", ["restaurantId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
