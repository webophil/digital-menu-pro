import type { AppearanceSettings } from "@/lib/theme";

export type ZoneId = "ambiances" | "colors" | "header" | "categories" | "dishes";

/**
 * Réglages propres à chaque zone. Un bouton « Revenir à l'ambiance » ne
 * touche que les clés de sa zone, jamais celles des autres.
 */
export const ZONE_KEYS: Record<
  Exclude<ZoneId, "ambiances">,
  readonly (keyof AppearanceSettings)[]
> = {
  colors: ["mode", "accent", "accent2", "background", "surface", "text", "texture"],
  header: [
    "headerStyle",
    "headerFont",
    "headerCase",
    "headerFollowAccent",
    "headerColor",
    "headerColor2",
    "headerAlign",
    "headerDivider",
    "headerMark",
    "headerIcon",
    "showName",
    "showTagline",
    "showCity",
    "showPhone",
  ],
  categories: ["headingFont", "headingCase", "categoryStyle", "cardStyle", "divider"],
  dishes: ["bodyFont", "priceStyle", "photoShape"],
};

export function zoneDiffers(
  zone: Exclude<ZoneId, "ambiances">,
  a: AppearanceSettings,
  b: AppearanceSettings,
): boolean {
  return ZONE_KEYS[zone].some((key) => a[key] !== b[key]);
}

export function zonePatch(
  zone: Exclude<ZoneId, "ambiances">,
  base: AppearanceSettings,
): Partial<AppearanceSettings> {
  const patch: Record<string, unknown> = {};
  for (const key of ZONE_KEYS[zone]) patch[key] = base[key];
  return patch as Partial<AppearanceSettings>;
}
