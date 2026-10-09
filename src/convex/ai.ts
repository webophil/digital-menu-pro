"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

/**
 * Taille d'un lot de plats traduits par appel.
 *
 * L'action Convex a une durée maximale : traduire toute la carte d'un grand
 * restaurant en un seul appel la dépasserait. On avance donc par lots, et
 * l'appelant relance tant que `nextCursor` n'est pas nul.
 */
const DISHES_PER_BATCH = 20;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TRANSLATION_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

async function completeWithOpenRouter(userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY manquante dans les variables Convex");
    throw new Error(
      "Le service de traduction est indisponible. Réessayez dans un instant.",
    );
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://vlalemenu.fr",
      "X-Title": "VlaLeMenu",
    },
    body: JSON.stringify({
      model: TRANSLATION_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("OpenRouter a répondu", res.status, detail.slice(0, 500));
    throw new Error(
      "Le service de traduction est indisponible. Réessayez dans un instant.",
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "{}";
}

async function translateOne(
  name: string,
  description: string,
): Promise<Record<string, string>> {
  const patch: Record<string, string> = {};
  for (const lang of PRO_TRANSLATION_LANGS) {
    const userPrompt = `Language: ${LANG_NAMES[lang]}\n[name] ${name}\n[description] ${description}`;
    const raw = await completeWithOpenRouter(userPrompt);
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
 * Traduit TOUS les contenus du restaurant : vitrine, titres de catégories
 * et plats. Réservé au plan Pro.
 *
 * L'ancienne version s'arrêtait à 30 plats : les suivants restaient
 * silencieusement non traduits. Les plats sont désormais parcourus par LOTS
 * (pagination par curseur côté serveur) et l'appel renvoie `nextCursor`
 * tant qu'il reste des plats : l'interface rappelle l'action en passant ce
 * curseur jusqu'à `null`. Aucun plat n'est omis, et chaque appel reste
 * borné — une action Convex a une durée maximale, que la traduction de
 * toute une carte dépasserait en un seul appel.
 *
 * `cursor` absent = premier lot : la vitrine et les titres de catégories sont
 * traités au passage (ils tiennent en mémoire, pas de pagination).
 */
export const translateAll = action({
  args: {
    restaurantId: v.id("restaurants"),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { restaurantId, cursor }) => {
    let count = 0;

    // 1. Premier lot : vitrine + titres de catégories, puis un lot de plats.
    if (cursor === undefined) {
      const header: {
        jobs: Array<{
          dishId: Id<"dishes"> | null;
          categoryId: Id<"categories"> | null;
          name: string;
          description: string;
        }>;
      } = await ctx.runQuery(internal.billingInternal.loadAllTranslateJobs, {
        restaurantId,
        phase: "header",
      });

      for (const item of header.jobs) {
        const patch = await translateOne(item.name, item.description);
        if (Object.keys(patch).length === 0) continue;
        if (item.categoryId) {
          await ctx.runMutation(
            internal.billingInternal.applyCategoryTranslations,
            { categoryId: item.categoryId, patch },
          );
        } else {
          await ctx.runMutation(
            internal.billingInternal.applyRestaurantTranslations,
            { restaurantId, patch },
          );
        }
        count++;
      }
    }

    // 2. Un lot de plats. Le curseur est rendu tel quel à l'appelant : il
    // n'est nul que lorsque TOUS les plats ont été parcourus.
    const batch: {
      jobs: Array<{
        dishId: Id<"dishes"> | null;
        categoryId: Id<"categories"> | null;
        name: string;
        description: string;
      }>;
      cursor: string | null;
      isDone: boolean;
    } = await ctx.runQuery(internal.billingInternal.loadAllTranslateJobs, {
      restaurantId,
      phase: "dishes",
      cursor,
      numItems: DISHES_PER_BATCH,
    });

    for (const item of batch.jobs) {
      if (!item.dishId) continue;
      const patch = await translateOne(item.name, item.description);
      if (Object.keys(patch).length === 0) continue;
      await ctx.runMutation(internal.billingInternal.applyDishTranslations, {
        dishId: item.dishId,
        patch,
      });
      count++;
    }

    return {
      ok: true,
      items: count,
      // null = terminé. L'interface s'arrête sur cette valeur.
      nextCursor: batch.cursor,
      done: batch.isDone,
      langs: [...PRO_TRANSLATION_LANGS],
    };
  },
});

const SUFFIX: Record<string, string> = { en: "En", es: "Es", de: "De" };

function extractJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return "{}";
  return raw.slice(start, end + 1);
}
