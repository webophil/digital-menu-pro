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

export type Mode = (typeof MODE_VALUES)[number];
export type HeadingCase = (typeof HEADING_CASE_VALUES)[number];
export type Divider = (typeof DIVIDER_VALUES)[number];
export type CategoryStyle = (typeof CATEGORY_STYLE_VALUES)[number];
export type CardStyle = (typeof CARD_STYLE_VALUES)[number];
export type PriceStyle = (typeof PRICE_STYLE_VALUES)[number];
export type HeaderStyle = (typeof HEADER_STYLE_VALUES)[number];
export type Texture = (typeof TEXTURE_VALUES)[number];
export type PhotoShape = (typeof PHOTO_SHAPE_VALUES)[number];

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
}

export const APPEARANCE_KEYS = [
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

/** Fusionne une config partielle (doc Convex, preset…) sur les défauts. */
export function resolveAppearance(
  input: Partial<AppearanceSettings> | null | undefined,
): AppearanceSettings {
  const out: AppearanceSettings = { ...DEFAULT_APPEARANCE };
  if (!input) return out;
  for (const key of APPEARANCE_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

// ---- Ambiances prêtes à l'emploi (couleurs + polices + décor) ----

export interface Ambiance {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  settings: AppearanceSettings;
}

export const AMBIANCES: Ambiance[] = [
  {
    id: "signature",
    name: "Signature",
    emoji: "⭐",
    blurb: "L'esprit V'la le Menu !",
    settings: { ...DEFAULT_APPEARANCE },
  },
  {
    id: "bistrot",
    name: "Bistrot",
    emoji: "🍷",
    blurb: "Bordeaux, crème & filets",
    settings: {
      ...DEFAULT_APPEARANCE,
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
    },
  },
  {
    id: "maison",
    name: "Maison",
    emoji: "🌿",
    blurb: "Vert potager & terre cuite",
    settings: {
      ...DEFAULT_APPEARANCE,
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
    },
  },
  {
    id: "riviera",
    name: "Riviera",
    emoji: "⛵",
    blurb: "Bleu méditerranéen",
    settings: {
      ...DEFAULT_APPEARANCE,
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
      texture: "none",
    },
  },
  {
    id: "terre",
    name: "Terre cuite",
    emoji: "🏺",
    blurb: "Terracotta & papier",
    settings: {
      ...DEFAULT_APPEARANCE,
      accent: "#BC5F38",
      accent2: "#97462A",
      background: "#FBF3EC",
      surface: "#FFFDFB",
      text: "#472F26",
      headingFont: "playfair",
      bodyFont: "lora",
      divider: "fleuron",
      categoryStyle: "center",
      cardStyle: "flat",
      headerStyle: "gradient",
      texture: "paper",
    },
  },
  {
    id: "ebene",
    name: "Ébène & or",
    emoji: "🖤",
    blurb: "Cocktail & gastronomie",
    settings: {
      ...DEFAULT_APPEARANCE,
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
      texture: "none",
      photoShape: "circle",
    },
  },
  {
    id: "nuit",
    name: "Nuit bleue",
    emoji: "🌙",
    blurb: "Dîner aux chandelles",
    settings: {
      ...DEFAULT_APPEARANCE,
      mode: "dark",
      accent: "#6D7FE8",
      accent2: "#4E5BC4",
      background: "#12141C",
      surface: "#1C1F2B",
      text: "#ECEDF5",
      headingFont: "cormorant",
      bodyFont: "lora",
      divider: "line",
      categoryStyle: "center",
      cardStyle: "flat",
      headerStyle: "gradient",
      texture: "none",
    },
  },
  {
    id: "mono",
    name: "Monochrome",
    emoji: "◻",
    blurb: "Noir & blanc, sans détour",
    settings: {
      ...DEFAULT_APPEARANCE,
      accent: "#1D1D1F",
      accent2: "#000000",
      background: "#F5F5F3",
      surface: "#FFFFFF",
      text: "#1D1D1F",
      headingFont: "poppins",
      bodyFont: "montserrat",
      divider: "line",
      categoryStyle: "left",
      cardStyle: "outline",
      priceStyle: "plain",
      headerStyle: "solid",
      texture: "lines",
      photoShape: "square",
    },
  },
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

/** Ambiance correspondant à une config (surlignage dans l'éditeur), ou null. */
export function findAmbiance(s: AppearanceSettings): Ambiance | null {
  return (
    AMBIANCES.find(
      (a) =>
        a.settings.accent === s.accent &&
        a.settings.background === s.background &&
        a.settings.mode === s.mode,
    ) ?? null
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
  center: "Centré",
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

  const headerBg =
    s.headerStyle === "solid"
      ? accent
      : s.headerStyle === "glow"
        ? `radial-gradient(130% 110% at 25% -25%, ${shade(accent, 0.3)}, rgba(0,0,0,0) 60%), ${accent}`
        : `linear-gradient(145deg, ${shade(accent, 0.16)}, ${accent2})`;

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
