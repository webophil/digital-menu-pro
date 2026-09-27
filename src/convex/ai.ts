"use node";

import { vly } from "../lib/vly-integrations";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { PRO_TRANSLATION_LANGS } from "./plans";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish (Spain)",
  de: "German",
};

const SYSTEM_PROMPT = `You are a professional translator for French restaurant menus.
Translate the given text into the requested language, keeping culinary terms natural and appetizing.
Reply ONLY with a JSON object with the keys: "name" and "description".
If the description text is empty, return an empty string for "description".`;

const MAX_DISHES = 30;

async function translateOne(
  name: string,
  description: string,
): Promise<Record<string, string>> {
  const patch: Record<string, string> = {};
  for (const lang of PRO_TRANSLATION_LANGS) {
    const userPrompt = `Language: ${LANG_NAMES[lang]}\n[name] ${name}\n[description] ${description}`;
    const res = await vly.ai.completion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 300,
    });
    if (!res.success || !res.data) {
      throw new Error(
        "Le service de traduction est indisponible. Réessayez dans un instant.",
      );
    }
    const raw = res.data.choices?.[0]?.message?.content ?? "{}";
    let parsed: { name?: string; description?: string };
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      throw new Error("Réponse de traduction illisible. Réessayez.");
    }
    const tName = (parsed.name ?? "").trim();
    const tDesc = (parsed.description ?? "").trim();
    if (tName) patch[`name${SUFFIX[lang]}`] = tName;
    if (tDesc) patch[`description${SUFFIX[lang]}`] = tDesc;
  }
  return patch;
}

/**
 * Traduit un élément : un plat précis (dishId) ou la vitrine du restaurant.
 * Réservé au plan Pro (vérifié côté serveur).
 */
export const translateContent = action({
  args: {
    restaurantId: v.id("restaurants"),
    dishId: v.optional(v.id("dishes")),
  },
  handler: async (ctx, { restaurantId, dishId }) => {
    const job = await ctx.runQuery(internal.billingInternal.loadTranslateJob, {
      restaurantId,
      dishId,
    });

    const patch = await translateOne(job.name, job.description);

    if (dishId) {
      await ctx.runMutation(internal.billingInternal.applyDishTranslations, {
        dishId,
        patch,
      });
    } else {
      await ctx.runMutation(
        internal.billingInternal.applyRestaurantTranslations,
        { restaurantId, patch },
      );
    }
    return { ok: true, langs: [...PRO_TRANSLATION_LANGS] };
  },
});

/**
 * Traduit tous les plats du restaurant (+ la vitrine). Réservé au plan Pro.
 */
export const translateAll = action({
  args: { restaurantId: v.id("restaurants") },
  handler: async (ctx, { restaurantId }) => {
    const jobs = await ctx.runQuery(internal.billingInternal.loadAllTranslateJobs, {
      restaurantId,
      limit: MAX_DISHES,
    });

    let count = 0;
    for (const item of jobs) {
      const patch = await translateOne(item.name, item.description);
      if (Object.keys(patch).length === 0) continue;
      if (item.dishId) {
        await ctx.runMutation(internal.billingInternal.applyDishTranslations, {
          dishId: item.dishId,
          patch,
        });
      } else {
        await ctx.runMutation(
          internal.billingInternal.applyRestaurantTranslations,
          { restaurantId, patch },
        );
      }
      count++;
    }
    return { ok: true, items: count, langs: [...PRO_TRANSLATION_LANGS] };
  },
});

const SUFFIX: Record<string, string> = { en: "En", es: "Es", de: "De" };

function extractJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return "{}";
  return raw.slice(start, end + 1);
}
