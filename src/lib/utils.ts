import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---- Constantes métier MenuMaker (allergènes, types, langues) ----

export const ALLERGENS = [
  { code: "gluten", labelFr: "Gluten", labelEn: "Gluten", labelEs: "Gluten", labelDe: "Gluten", emoji: "🌾" },
  { code: "crustaceans", labelFr: "Crustacés", labelEn: "Crustaceans", labelEs: "Crustáceos", labelDe: "Krebstiere", emoji: "🦐" },
  { code: "eggs", labelFr: "Œufs", labelEn: "Eggs", labelEs: "Huevos", labelDe: "Eier", emoji: "🥚" },
  { code: "fish", labelFr: "Poisson", labelEn: "Fish", labelEs: "Pescado", labelDe: "Fisch", emoji: "🐟" },
  { code: "peanuts", labelFr: "Arachides", labelEn: "Peanuts", labelEs: "Cacahuetes", labelDe: "Erdnüsse", emoji: "🥜" },
  { code: "soy", labelFr: "Soja", labelEn: "Soy", labelEs: "Soja", labelDe: "Soja", emoji: "🫘" },
  { code: "milk", labelFr: "Lait", labelEn: "Milk", labelEs: "Leche", labelDe: "Milch", emoji: "🥛" },
  { code: "nuts", labelFr: "Fruits à coque", labelEn: "Tree nuts", labelEs: "Frutos secos", labelDe: "Schalenfrüchte", emoji: "🌰" },
  { code: "celery", labelFr: "Céleri", labelEn: "Celery", labelEs: "Apio", labelDe: "Sellerie", emoji: "🥬" },
  { code: "mustard", labelFr: "Moutarde", labelEn: "Mustard", labelEs: "Mostaza", labelDe: "Senf", emoji: "🟨" },
  { code: "sesame", labelFr: "Sésame", labelEn: "Sesame", labelEs: "Sésamo", labelDe: "Sesam", emoji: "⚪" },
  { code: "sulphites", labelFr: "Sulfites", labelEn: "Sulphites", labelEs: "Sulfitos", labelDe: "Sulfite", emoji: "🍷" },
  { code: "lupin", labelFr: "Lupin", labelEn: "Lupin", labelEs: "Altramuz", labelDe: "Lupinen", emoji: "🌸" },
  { code: "molluscs", labelFr: "Mollusques", labelEn: "Molluscs", labelEs: "Moluscos", labelDe: "Weichtiere", emoji: "🐚" },
] as const;

export type LangCode = "fr" | "en" | "es" | "de";

export function allergenByCode(code: string) {
  return ALLERGENS.find((a) => a.code === code);
}

export function allergenLabel(code: string, lang: LangCode = "fr") {
  const a = allergenByCode(code);
  if (!a) return code;
  switch (lang) {
    case "en":
      return a.labelEn;
    case "es":
      return a.labelEs;
    case "de":
      return a.labelDe;
    default:
      return a.labelFr;
  }
}

export const MENU_TYPES = [
  { value: "carte", label: "Carte" },
  { value: "menu-du-jour", label: "Menu du jour" },
  { value: "soir", label: "Carte du soir" },
  { value: "enfants", label: "Menu enfants" },
  { value: "boissons", label: "Boissons" },
  { value: "autre", label: "Autre" },
] as const;

export const ESTABLISHMENT_TYPES = [
  { value: "restaurant", label: "Restaurant", emoji: "🍽️" },
  { value: "brasserie", label: "Brasserie", emoji: "🍺" },
  { value: "foodtruck", label: "Food truck", emoji: "🚚" },
  { value: "cafe", label: "Café", emoji: "☕" },
  { value: "pizzeria", label: "Pizzeria", emoji: "🍕" },
  { value: "bar", label: "Bar", emoji: "🍸" },
  { value: "traiteur", label: "Traiteur", emoji: "🧺" },
  { value: "glacier", label: "Glacier", emoji: "🍦" },
  { value: "autre", label: "Autre", emoji: "🍴" },
] as const;

export const LANGS = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
] as const;

export function establishmentTypeLabel(value: string) {
  return ESTABLISHMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function menuTypeLabel(value: string) {
  return MENU_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function formatPrice(price: number) {
  return `${price.toFixed(2).replace(".", ",").replace(/,00$/, "")} €`;
}
