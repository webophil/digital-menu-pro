/**
 * Thème du menu client — « Apparence ».
 *
 * Partagé par l'éditeur (page /apparence), le rendu public (/m/:slug) et les
 * validations Convex (table `appearances`). Aucune dépendance DOM ni React :
 * utilisable tels quels côté serveur Convex.
 */

import { v, type Validator } from "convex/values";

/**
 * v.union à partir d'un tableau `as const` — les types littéraux sont
 * préservés (inference des arguments Convex et du type Doc<"appearances">).
 */
export function oneOf<const T extends readonly string[]>(values: T) {
  const validators = values.map((value) => v.literal(value)) as unknown as [
    Validator<T[number], "required">,
    Validator<T[number], "required">,
    ...Validator<T[number], "required">[],
  ];
  return v.union(...validators);
}

// ---- Valeurs autorisées (validées à l'écriture Convex) ----

export const MODE_VALUES = ["light", "dark"] as const;
export const HEADING_CASE_VALUES = ["normal", "uppercase"] as const;
export const DIVIDER_VALUES = [
  "none",
  "line",
  "dots",
  "diamond",
  "fleuron",
  "stars",
] as const;
export const CATEGORY_STYLE_VALUES = ["left", "center", "framed"] as const;
export const CARD_STYLE_VALUES = ["clay", "flat", "outline", "plain"] as const;
export const PRICE_STYLE_VALUES = ["accent", "plain", "pill"] as const;
export const HEADER_STYLE_VALUES = ["gradient", "solid", "glow"] as const;
export const TEXTURE_VALUES = ["none", "paper", "dots", "grid", "lines"] as const;
export const PHOTO_SHAPE_VALUES = ["rounded", "circle", "square"] as const;
export const HEADER_ALIGN_VALUES = ["center", "left"] as const;
export const HEADER_MARK_VALUES = ["icon", "logo", "none"] as const;
export const HEADER_ICON_VALUES = [
  "utensils",
  "couverts",
  "chef",
  "wine",
  "beer",
  "coffee",
  "pizza",
  "fish",
  "salad",
  "croissant",
  "cake",
  "icecream",
  "soup",
] as const;

export type Mode = (typeof MODE_VALUES)[number];
export type HeadingCase = (typeof HEADING_CASE_VALUES)[number];
export type Divider = (typeof DIVIDER_VALUES)[number];
export type CategoryStyle = (typeof CATEGORY_STYLE_VALUES)[number];
export type CardStyle = (typeof CARD_STYLE_VALUES)[number];
export type PriceStyle = (typeof PRICE_STYLE_VALUES)[number];
export type HeaderStyle = (typeof HEADER_STYLE_VALUES)[number];
export type Texture = (typeof TEXTURE_VALUES)[number];
export type PhotoShape = (typeof PHOTO_SHAPE_VALUES)[number];
export type HeaderAlign = (typeof HEADER_ALIGN_VALUES)[number];
export type HeaderMark = (typeof HEADER_MARK_VALUES)[number];
export type HeaderIcon = (typeof HEADER_ICON_VALUES)[number];

// ---- Polices (auto-hébergées dans /public/fonts, aucune donnée à Google) ----

export const HEADING_FONT_VALUES = [
  "baloo",
  "playfair",
  "cormorant",
  "poppins",
  "parisienne",
] as const;
export type HeadingFontId = (typeof HEADING_FONT_VALUES)[number];

const HEADING_FONT_META: Record<
  HeadingFontId,
  { name: string; stack: string; headWeight: number; blurb: string }
> = {
  baloo: {
    name: "Baloo 2",
    stack: '"Baloo 2", "Quicksand", ui-sans-serif, system-ui, sans-serif',
    headWeight: 800,
    blurb: "Rond & gourmand",
  },
  playfair: {
    name: "Playfair Display",
    stack: '"Playfair Display", "Baloo 2", Georgia, serif',
    headWeight: 800,
    blurb: "Classique gastronomie",
  },
  cormorant: {
    name: "Cormorant Garamond",
    stack: '"Cormorant Garamond", "Baloo 2", Georgia, serif',
    headWeight: 700,
    blurb: "Fin & élégant",
  },
  poppins: {
    name: "Poppins",
    stack: '"Poppins", "Quicksand", ui-sans-serif, system-ui, sans-serif',
    headWeight: 700,
    blurb: "Moderne & net",
  },
  parisienne: {
    name: "Parisienne",
    stack: '"Parisienne", "Playfair Display", cursive',
    headWeight: 400,
    blurb: "Signature manuscrite",
  },
};

export function headingFont(id: string) {
  return HEADING_FONT_META[id as HeadingFontId] ?? HEADING_FONT_META.baloo;
}

/**
 * Polices proposées pour les catégories et les prix : uniquement des polices
 * lisibles. La signature manuscrite reste réservée au nom de l'établissement
 * (les menus déjà enregistrés avec elle continuent de s'afficher).
 */
export const CATEGORY_FONT_VALUES = [
  "baloo",
  "playfair",
  "cormorant",
  "poppins",
] as const satisfies readonly HeadingFontId[];

export const BODY_FONT_VALUES = [
  "quicksand",
  "lato",
  "montserrat",
  "lora",
] as const;
export type BodyFontId = (typeof BODY_FONT_VALUES)[number];

const BODY_FONT_META: Record<
  BodyFontId,
  { name: string; stack: string; blurb: string }
> = {
  quicksand: {
    name: "Quicksand",
    stack: '"Quicksand", ui-sans-serif, system-ui, sans-serif',
    blurb: "Doux & lisible",
  },
  lato: {
    name: "Lato",
    stack: '"Lato", "Quicksand", ui-sans-serif, system-ui, sans-serif',
    blurb: "Classique & net",
  },
  montserrat: {
    name: "Montserrat",
    stack: '"Montserrat", "Quicksand", ui-sans-serif, system-ui, sans-serif',
    blurb: "Moderne",
  },
  lora: {
    name: "Lora",
    stack: '"Lora", "Baloo 2", Georgia, serif',
    blurb: "Chaleureux (serif)",
  },
};

export function bodyFont(id: string) {
  return BODY_FONT_META[id as BodyFontId] ?? BODY_FONT_META.quicksand;
}

// ---- Modèle complet d'apparence ----

/**
 * Chaque zone du menu a ses propres réglages :
 *  - couleurs & fond : mode, accent, background, surface, text, texture
 *  - en-tête : header*, show*  (nom, slogan, ville, téléphone, logo)
 *  - catégories : headingFont (aussi les prix), headingCase, categoryStyle,
 *    cardStyle, divider
 *  - plats : bodyFont, priceStyle, photoShape
 * La barre de langues et les étiquettes d'allergènes restent hors thème.
 */
export interface AppearanceSettings {
  mode: Mode;
  accent: string;
  accent2: string;
  background: string;
  surface: string;
  text: string;
  headingFont: HeadingFontId;
  bodyFont: BodyFontId;
  headingCase: HeadingCase;
  divider: Divider;
  categoryStyle: CategoryStyle;
  cardStyle: CardStyle;
  priceStyle: PriceStyle;
  headerStyle: HeaderStyle;
  texture: Texture;
  photoShape: PhotoShape;
  // ---- En-tête (ajouts : absents des anciennes lignes) ----
  headerFont: HeadingFontId;
  headerCase: HeadingCase;
  headerFollowAccent: boolean;
  headerColor: string;
  headerColor2: string;
  headerAlign: HeaderAlign;
  headerDivider: Divider;
  headerMark: HeaderMark;
  headerIcon: HeaderIcon;
  showTagline: boolean;
  showCity: boolean;
  showPhone: boolean;
}

/** Champs historiques : toujours présents dans les lignes enregistrées. */
export const CORE_KEYS = [
  "mode",
  "accent",
  "accent2",
  "background",
  "surface",
  "text",
  "headingFont",
  "bodyFont",
  "headingCase",
  "divider",
  "categoryStyle",
  "cardStyle",
  "priceStyle",
  "headerStyle",
  "texture",
  "photoShape",
] as const satisfies readonly (keyof AppearanceSettings)[];

/** Champs de l'en-tête, optionnels en base (repli : voir resolveAppearance). */
export const HEADER_KEYS = [
  "headerFont",
  "headerCase",
  "headerFollowAccent",
  "headerColor",
  "headerColor2",
  "headerAlign",
  "headerDivider",
  "headerMark",
  "headerIcon",
  "showTagline",
  "showCity",
  "showPhone",
] as const satisfies readonly (keyof AppearanceSettings)[];

export const APPEARANCE_KEYS = [
  ...CORE_KEYS,
  ...HEADER_KEYS,
] as const satisfies readonly (keyof AppearanceSettings)[];

/** Look actuel du produit = référence « Signature » (claymorphism teal). */
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  mode: "light",
  accent: "#4DB3C7",
  accent2: "#2E93AE",
  background: "#F3F6FB",
  surface: "#FCFCFE",
  text: "#414A63",
  headingFont: "baloo",
  bodyFont: "quicksand",
  headingCase: "normal",
  divider: "line",
  categoryStyle: "left",
  cardStyle: "clay",
  priceStyle: "accent",
  headerStyle: "gradient",
  texture: "none",
  photoShape: "rounded",
  headerFont: "baloo",
  headerCase: "normal",
  headerFollowAccent: true,
  headerColor: "#4DB3C7",
  headerColor2: "#2E93AE",
  headerAlign: "center",
  headerDivider: "line",
  headerMark: "icon",
  headerIcon: "utensils",
  showTagline: true,
  showCity: true,
  showPhone: true,
};

/** Couleurs standard d'un mode (utilisé lors du basculement Clair/Sombre). */
export function defaultsForMode(mode: Mode): AppearanceSettings {
  if (mode === "dark") {
    return {
      ...DEFAULT_APPEARANCE,
      mode,
      background: "#14161E",
      surface: "#1D202B",
      text: "#ECEEF5",
    };
  }
  return { ...DEFAULT_APPEARANCE, mode };
}

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Fusionne une config partielle (doc Convex, preset…) sur les défauts.
 *
 * Les lignes enregistr��es avant l'apparition des réglages d'en-tête n'ont
 * aucun champ `header*` : chacun retombe sur la valeur historique qui pilotait
 * déjà l'en-tête (police et casse des titres, fioriture, accent), pour que le
 * menu s'affiche exactement comme avant.
 */
export function resolveAppearance(
  input: Partial<AppearanceSettings> | null | undefined,
): AppearanceSettings {
  const out: Record<string, unknown> = { ...DEFAULT_APPEARANCE };
  if (!input) return out as unknown as AppearanceSettings;
  const raw = input as Record<string, unknown>;

  for (const key of CORE_KEYS) {
    const value = raw[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  const core = out as unknown as AppearanceSettings;

  const legacy: Pick<AppearanceSettings, (typeof HEADER_KEYS)[number]> = {
    headerFont: core.headingFont,
    headerCase: core.headingCase,
    headerFollowAccent: true,
    headerColor: core.accent,
    headerColor2: core.accent2,
    headerAlign: "center",
    headerDivider: core.divider,
    headerMark: "icon",
    headerIcon: "utensils",
    showTagline: true,
    showCity: true,
    showPhone: true,
  };
  for (const key of HEADER_KEYS) {
    const value = raw[key];
    out[key] = value !== undefined && value !== null ? value : legacy[key];
  }

  // « Suivre l'accent » : la couleur d'en-tête est toujours dérivée de
  // l'accent, ce qui rend la config comparable d'un appareil à l'autre.
  if (out.headerFollowAccent) {
    out.headerColor = core.accent;
    out.headerColor2 = core.accent2;
  }
  return out as unknown as AppearanceSettings;
}

// ---- Ambiances prêtes à l'emploi (point de départ, pas un état verrouillé) ----

export interface Ambiance {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  settings: AppearanceSettings;
}

/**
 * Une ambiance précise toutes les zones. Ce qui n'est pas indiqué pour
 * l'en-tête reprend la valeur des catégories (même police, même fioriture,
 * mêmes couleurs) : seules les ambiances qui veulent un nom distinct des
 * catégories le précisent.
 */
function makeAmbiance(
  id: string,
  name: string,
  emoji: string,
  blurb: string,
  s: Partial<AppearanceSettings>,
): Ambiance {
  const merged = { ...DEFAULT_APPEARANCE, ...s };
  return {
    id,
    name,
    emoji,
    blurb,
    settings: resolveAppearance({
      ...merged,
      headerFont: s.headerFont ?? merged.headingFont,
      headerCase: s.headerCase ?? merged.headingCase,
      headerDivider: s.headerDivider ?? merged.divider,
      headerFollowAccent: s.headerFollowAccent ?? true,
    }),
  };
}

export const AMBIANCES: Ambiance[] = [
  makeAmbiance("signature", "Signature", "⭐", "L'esprit V'la le Menu !", {}),
  makeAmbiance("bistrot", "Bistrot", "🍷", "Bordeaux, crème & filets", {
    accent: "#8E2F3E",
    accent2: "#6A1F2D",
    background: "#FAF5EE",
    surface: "#FFFFFF",
    text: "#38262B",
    headingFont: "playfair",
    bodyFont: "lato",
    divider: "diamond",
    categoryStyle: "center",
    cardStyle: "flat",
    headerStyle: "gradient",
    texture: "paper",
  }),
  makeAmbiance("maison", "Maison", "🌿", "Vert potager & fleurons", {
    accent: "#5F7F3A",
    accent2: "#46612A",
    background: "#F5F6EE",
    surface: "#FEFEFA",
    text: "#363A26",
    headingFont: "cormorant",
    bodyFont: "lora",
    divider: "fleuron",
    categoryStyle: "center",
    cardStyle: "flat",
    texture: "none",
  }),
  makeAmbiance("riviera", "Riviera", "⛵", "Bleu méditerranéen, en-tête à gauche", {
    accent: "#2E6FB7",
    accent2: "#1D4E8F",
    background: "#F1F5FB",
    surface: "#FFFFFF",
    text: "#22314A",
    headingFont: "poppins",
    bodyFont: "montserrat",
    divider: "dots",
    categoryStyle: "left",
    cardStyle: "clay",
    headerStyle: "glow",
    headerAlign: "left",
    texture: "none",
  }),
  makeAmbiance("terre", "Terre cuite", "🏺", "Nom manuscrit, titres lisibles", {
    accent: "#BC5F38",
    accent2: "#97462A",
    background: "#FBF3EC",
    surface: "#FFFDFB",
    text: "#472F26",
    headerFont: "parisienne",
    headingFont: "playfair",
    bodyFont: "lora",
    divider: "dots",
    headerDivider: "fleuron",
    categoryStyle: "left",
    cardStyle: "outline",
    priceStyle: "pill",
    headerStyle: "solid",
    texture: "paper",
    photoShape: "circle",
  }),
  makeAmbiance("ebene", "Ébène & or", "🖤", "Cocktail & gastronomie", {
    mode: "dark",
    accent: "#BE8F2E",
    accent2: "#8F6620",
    background: "#131110",
    surface: "#1E1B17",
    text: "#F2EDE4",
    headingFont: "playfair",
    bodyFont: "lato",
    divider: "stars",
    categoryStyle: "framed",
    cardStyle: "outline",
    priceStyle: "accent",
    headerStyle: "solid",
    headerCase: "uppercase",
    texture: "none",
    photoShape: "circle",
  }),
  makeAmbiance("nuit", "Nuit bleue", "🌙", "Dîner aux chandelles", {
    mode: "dark",
    accent: "#6D7FE8",
    accent2: "#4E5BC4",
    background: "#12141C",
    surface: "#1C1F2B",
    text: "#ECEDF5",
    headerFont: "cormorant",
    headerCase: "uppercase",
    headingFont: "playfair",
    bodyFont: "montserrat",
    divider: "line",
    headerDivider: "dots",
    categoryStyle: "left",
    cardStyle: "outline",
    priceStyle: "pill",
    headerStyle: "glow",
    texture: "none",
  }),
  makeAmbiance("mono", "Monochrome", "◻", "Noir & blanc, sans détour", {
    accent: "#1D1D1F",
    accent2: "#000000",
    background: "#F5F5F3",
    surface: "#FFFFFF",
    text: "#1D1D1F",
    headingFont: "poppins",
    bodyFont: "montserrat",
    divider: "line",
    headerDivider: "none",
    categoryStyle: "left",
    cardStyle: "outline",
    priceStyle: "plain",
    headerStyle: "solid",
    headerCase: "uppercase",
    headerAlign: "left",
    headerMark: "none",
    texture: "lines",
    photoShape: "square",
  }),
];

/**
 * Ambiances offertes au plan Gratuit (éditeur /apparence) :
 * les 5 autres sont visibles mais réservées au plan Pro.
 */
export const FREE_AMBIANCE_IDS: readonly string[] = [
  "signature",
  "bistrot",
  "maison",
];

/** Deux configs sont-elles identiques (tous les réglages visuels) ? */
export function sameAppearance(
  a: AppearanceSettings,
  b: AppearanceSettings,
): boolean {
  return APPEARANCE_KEYS.every((key) => a[key] === b[key]);
}

export function getAmbiance(id: string | null | undefined): Ambiance | null {
  return AMBIANCES.find((a) => a.id === id) ?? null;
}

/** Ambiance dont la config est strictement identique (sinon null). */
export function findAmbiance(s: AppearanceSettings): Ambiance | null {
  return AMBIANCES.find((a) => sameAppearance(a.settings, s)) ?? null;
}

/**
 * Une config est-elle autorisée pour le plan Gratuit ?
 *
 * Le plan gratuit donne accès aux 3 ambiances de `FREE_AMBIANCE_IDS`, et à
 * rien d'autre : la comparaison porte sur TOUS les réglages (en-tête compris,
 * `ambianceId` et logo exclus), après `resolveAppearance`. Retenir seulement
 * l'accent et le fond laisserait passer n'importe quelle police, texture ou
 * forme de photo sur un compte gratuit.
 *
 * Cette règle est la version serveur de ce que fait l'éditeur : le verrou
 * n'est plus seulement visuel, il est appliqué à l'écriture.
 */
export function isAllowedFreeAppearance(s: AppearanceSettings): boolean {
  return AMBIANCES.some(
    (a) => FREE_AMBIANCE_IDS.includes(a.id) && sameAppearance(a.settings, s),
  );
}

// ---- Couleurs ----

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim();
  if (!HEX_RE.test(h)) {
    if (/^#[0-9a-fA-F]{3}$/.test(h)) {
      h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    } else {
      return [128, 128, 128];
    }
  }
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Mélange : `t` = poids de `a` (1 = a pur, 0 = b pur). */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 * t + r2 * (1 - t), g1 * t + g2 * (1 - t), b1 * t + b2 * (1 - t));
}

/** t > 0 : éclaircit vers le blanc — t < 0 : assombrit vers le noir. */
export function shade(color: string, t: number): string {
  return t >= 0 ? mix(color, "#ffffff", t) : mix(color, "#000000", -t);
}

/** Luminance relative (WCAG). */
export function luminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Texte lisible sur ce fond (blanc sous 0,42 de luminance, sinon encre). */
export function contrastOn(hex: string): string {
  return luminance(hex) <= 0.42 ? "#ffffff" : "#17130F";
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---- Textures de fond (aucune requête : dégradés + SVG inline) ----

export interface TextureStyle {
  backgroundImage: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
}

const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0.1'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.14'/%3E%3C/svg%3E\")";

export const TEXTURE_STYLES: Record<Texture, TextureStyle | null> = {
  none: null,
  paper: { backgroundImage: PAPER_NOISE },
  dots: {
    backgroundImage: "radial-gradient(var(--m-border) 1px, transparent 1.5px)",
    backgroundSize: "22px 22px",
  },
  grid: {
    backgroundImage:
      "linear-gradient(var(--m-border) 1px, transparent 1px), linear-gradient(90deg, var(--m-border) 1px, transparent 1px)",
    backgroundSize: "30px 30px, 30px 30px",
  },
  lines: {
    backgroundImage:
      "repeating-linear-gradient(45deg, var(--m-border) 0, var(--m-border) 1px, transparent 1px, transparent 13px)",
  },
};

// ---- Libellés des options (éditeur) ----

export const DIVIDER_META: Record<Divider, { label: string; glyph: string }> = {
  none: { label: "Aucun", glyph: "—" },
  line: { label: "Filet fin", glyph: "───" },
  dots: { label: "Trois points", glyph: "• • •" },
  diamond: { label: "Losange", glyph: "── ◆ ──" },
  fleuron: { label: "Fleuron", glyph: "❦" },
  stars: { label: "Étoiles", glyph: "✦ ✦ ✦" },
};

export const CATEGORY_STYLE_META: Record<CategoryStyle, string> = {
  left: "Aligné à gauche",
  center: "Centr��",
  framed: "Encadré",
};

export const CARD_STYLE_META: Record<CardStyle, string> = {
  clay: "Volume",
  flat: "Doux",
  outline: "Filet",
  plain: "Sans cadre",
};

export const PRICE_STYLE_META: Record<PriceStyle, string> = {
  accent: "En couleur",
  plain: "Simple",
  pill: "Pastille",
};

export const HEADER_STYLE_META: Record<HeaderStyle, string> = {
  gradient: "Dégradé",
  solid: "Uni",
  glow: "Lueur",
};

export const TEXTURE_META: Record<Texture, string> = {
  none: "Aucune",
  paper: "Papier",
  dots: "Pointillés",
  grid: "Grille",
  lines: "Diagonales",
};

export const HEADER_ALIGN_META: Record<HeaderAlign, string> = {
  center: "Centré",
  left: "À gauche",
};

export const HEADER_MARK_META: Record<HeaderMark, string> = {
  icon: "Icône",
  logo: "Logo",
  none: "Aucun",
};

export const HEADER_ICON_META: Record<HeaderIcon, string> = {
  utensils: "Couverts croisés",
  couverts: "Fourchette et couteau",
  chef: "Toque",
  wine: "Verre de vin",
  beer: "Bière",
  coffee: "Café",
  pizza: "Pizza",
  fish: "Poisson",
  salad: "Salade",
  croissant: "Croissant",
  cake: "Pâtisserie",
  icecream: "Glace",
  soup: "Soupe",
};

export const PHOTO_SHAPE_META: Record<PhotoShape, string> = {
  rounded: "Arrondies",
  circle: "Rondes",
  square: "Carrées",
};

/** Classes Tailwind du style de carte (posées à côté des variables CSS). */
export const CARD_STYLE_CLASS: Record<CardStyle, string> = {
  clay: "clay-flat",
  flat: "m-card-flat",
  outline: "m-card-outline",
  plain: "m-card-plain",
};

/** Forme des vignettes photo. */
export const PHOTO_SHAPE_CLASS: Record<PhotoShape, string> = {
  rounded: "rounded-2xl",
  circle: "rounded-full",
  square: "rounded-lg",
};

// ---- Calcul des variables CSS du menu client ----

export function appearanceCssVars(
  s: AppearanceSettings,
): Record<string, string> {
  const accent = s.accent;
  const accent2 = s.accent2;
  const mid = mix(accent, accent2, 0.5);
  const onAccent = contrastOn(mid);
  const surfaceLum = luminance(s.surface);
  const lightSurface = surfaceLum > 0.45;

  // L'en-tête a sa propre couleur ; « suivre l'accent » la dérive de l'accent.
  const hColor = s.headerFollowAccent ? accent : s.headerColor;
  const hColor2 = s.headerFollowAccent ? accent2 : s.headerColor2;
  const onHeader = contrastOn(mix(hColor, hColor2, 0.5));

  const headerBg =
    s.headerStyle === "solid"
      ? hColor
      : s.headerStyle === "glow"
        ? `radial-gradient(130% 110% at 25% -25%, ${shade(hColor, 0.3)}, rgba(0,0,0,0) 60%), ${hColor}`
        : `linear-gradient(145deg, ${shade(hColor, 0.16)}, ${hColor2})`;
  const brand = headingFont(s.headerFont);

  return {
    "--m-bg": s.background,
    "--m-surface": s.surface,
    "--m-text": s.text,
    "--m-muted": mix(s.text, s.background, 0.55),
    "--m-border": mix(s.text, s.background, 0.16),
    "--m-chip-bg": mix(s.surface, s.text, 0.07),
    "--m-accent": accent,
    "--m-accent2": accent2,
    "--m-accent-grad": `linear-gradient(145deg, ${shade(accent, 0.14)}, ${shade(accent2, -0.06)})`,
    "--m-accent-soft": mix(accent, s.surface, 0.14),
    "--m-header-bg": headerBg,
    "--m-on-header": onHeader,
    "--m-on-header-soft": rgba(onHeader, 0.16),
    "--m-font-brand": brand.stack,
    "--m-brand-weight": String(brand.headWeight),
    "--m-brand-transform": s.headerCase === "uppercase" ? "uppercase" : "none",
    "--m-on-accent": onAccent,
    "--m-on-accent-soft": rgba(onAccent, 0.16),
    "--m-price": lightSurface ? shade(accent, -0.18) : shade(accent, 0.25),
    "--m-pill-bg": mix(accent, s.surface, 0.14),
    "--m-pill-text": lightSurface ? shade(accent, -0.15) : shade(accent, 0.35),
    "--m-font-head": headingFont(s.headingFont).stack,
    "--m-head-weight": String(headingFont(s.headingFont).headWeight),
    "--m-head-transform": s.headingCase === "uppercase" ? "uppercase" : "none",
    "--m-font-body": bodyFont(s.bodyFont).stack,
  };
}
