import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";

/**
 * Changement d'email de connexion — logique en base.
 *
 * AVANT : `updateMyEmail` écrivait la nouvelle adresse immédiatement, sans
 * aucune preuve de possession. Deux défauts :
 *  1. il cherchait le compte de connexion avec le provider `"email"` alors
 *     que la base contient le provider `"email-otp"` (cf. `Email()` de
 *     @convex-dev/auth, dont l'id est surchargé par `options.id`). Le patch
 *     ne trouvait donc jamais sa cible : l'adresse de profil changeait mais
 *     l'identifiant de connexion restait l'ancien, et l'utilisateur ne
 *     pouvait plus se reconnecter du tout ;
 *  2. l'adresse était enregistrée avant toute vérification : il suffisait
 *     d'être connecté pour rediriger les accès d'un compte.
 *
 * MAINTENANT : la nouvelle adresse n'est écrite qu'après validation d'un code
 * envoyé À CETTE ADRESSE (`confirmEmailChange`). Tant que le code n'est pas
 * validé, le profil garde l'ancienne adresse et le compte reste connecté
 * normalement.
 *
 * Le provider visé est `"email-otp"`, vérifié dans le code : si l'identité de
 * connexion est absente, le changement est REFUSÉ plutôt que de laisser le
 * compte sans moyen de se reconnecter.
 *
 * Ce fichier ne contient QUE des mutations : l'envoi du code, qui exige le
 * runtime Node, vit dans `accountEmailSend.ts`.
 */

/** Identifiant du provider de connexion (doit correspondre à `auth.ts`). */
const EMAIL_PROVIDER = "email-otp";

/** Durée de validité du code (15 minutes). */
const CODE_TTL_MS = 15 * 60 * 1000;

/** Nombre de tentatives avant d'abandonner la demande en cours. */
const MAX_ATTEMPTS = 5;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Code à 6 chiffres, tiré de `crypto` (jamais `Math.random`). */
export function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value = new DataView(bytes.buffer).getUint32(0);
  return String(value % 1_000_000).padStart(6, "0");
}

export function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Empreinte du code, salée. Un code à 6 chiffres a une entropie faible : le
 * stocker en clair autoriserait sa lecture par quiconque a accès à la base.
 * Le sel, tiré au hasard et propre à chaque demande, empêche aussi de
 * comparer deux empreintes entre elles.
 */
export async function hashCode(
  code: string,
  salt: string,
): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(`${salt}:${code}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparaison à temps constant des empreintes. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérifie les conditions communes aux deux étapes.
 * Les admins sont exclus : l'email d'un compte à hauts privilèges ne doit
 * pas pouvoir être redirigé depuis le site (support uniquement).
 */
async function requireChangeableUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Not found");
  if (user.role === "admin") {
    throw new Error(
      "L'email d'un compte administrateur ne peut pas être modifié depuis le site. Contactez le support (contact@vlalemenu.fr).",
    );
  }
  return { userId, user };
}

/** L'adresse est-elle déjà prise par un autre compte (profil ou connexion) ? */
async function assertEmailFree(ctx: any, email: string, userId: any) {
  const inUsers = await ctx.db
    .query("users")
    .withIndex("email", (q: any) => q.eq("email", email))
    .first();
  if (inUsers && inUsers._id !== userId) {
    throw new Error("Cet email est déjà utilisé par un autre compte.");
  }

  const inAccounts = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q: any) =>
      q.eq("provider", EMAIL_PROVIDER).eq("providerAccountId", email),
    )
    .first();
  if (inAccounts && inAccounts.userId !== userId) {
    throw new Error("Cet email est déjà utilisé par un autre compte.");
  }
}

/** Oublie la demande en cours (échec, expiration, abandon). */
async function clearPending(ctx: any, userId: any) {
  await ctx.db.patch(userId, {
    pendingEmail: undefined,
    pendingEmailSalt: undefined,
    pendingEmailHash: undefined,
    pendingEmailExpiresAt: undefined,
    pendingEmailAttempts: undefined,
  });
}

/**
 * Prépare la demande : contrôles, génération du code, mémorisation de son
 * empreinte. Mutation INTERNE car son résultat contient le code en clair,
 * destiné à l'envoi d'email : il ne doit jamais atteindre le navigateur.
 * Le profil n'est pas modifié — `users.email` reste l'ancienne adresse.
 */
export const beginEmailChange = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const { userId, user } = await requireChangeableUser(ctx);
    const normalized = normalizeEmail(email);

    if (!isValidEmail(normalized)) throw new Error("Adresse email invalide.");
    if (normalized === (user.email ?? "").toLowerCase()) {
      throw new Error("Cette adresse est déjà celle de votre compte.");
    }
    await assertEmailFree(ctx, normalized, userId);

    const code = generateCode();
    const salt = randomHex(16);

    await ctx.db.patch(userId, {
      pendingEmail: normalized,
      pendingEmailSalt: salt,
      pendingEmailHash: await hashCode(code, salt),
      pendingEmailExpiresAt: Date.now() + CODE_TTL_MS,
      pendingEmailAttempts: 0,
    });

    return { email: normalized, code };
  },
});

/** Annule une demande en cours (bouton « Annuler » de l'interface). */
export const cancelEmailChange = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    await clearPending(ctx, userId);
    return { ok: true };
  },
});

/**
 * Étape 2 : valide le code et n'ALORS seulement applique le changement.
 *
 * Le profil (`users`) et l'identité de connexion (`authAccounts`) sont mis à
 * jour dans la même transaction : les deux doivent rester cohérents, sinon la
 * prochaine connexion chercherait l'ancien email alors que le profil affiche
 * le nouveau.
 */
export const confirmEmailChange = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { userId, user } = await requireChangeableUser(ctx);

    const pendingEmail = user.pendingEmail as string | undefined;
    const salt = user.pendingEmailSalt as string | undefined;
    const expected = user.pendingEmailHash as string | undefined;
    const expiresAt = user.pendingEmailExpiresAt as number | undefined;
    const attempts = (user.pendingEmailAttempts as number | undefined) ?? 0;

    if (!pendingEmail || !salt || !expected) {
      throw new Error(
        "Aucune demande de changement en cours. Relancez la demande pour recevoir un nouveau code.",
      );
    }

    if (typeof expiresAt === "number" && expiresAt < Date.now()) {
      await clearPending(ctx, userId);
      throw new Error("Le code a expiré. Relancez la demande.");
    }

    if (!safeEqual(expected, await hashCode(code.trim(), salt))) {
      // Un code à 6 chiffres se devine : on borne les tentatives ET on
      // invalide la demande, faute de quoi elle permettrait de tester des codes
      // à l'infini.
      if (attempts + 1 >= MAX_ATTEMPTS) {
        await clearPending(ctx, userId);
        throw new Error(
          "Trop de tentatives incorrectes. Relancez la demande pour obtenir un nouveau code.",
        );
      }
      await ctx.db.patch(userId, { pendingEmailAttempts: attempts + 1 });
      throw new Error("Code incorrect.");
    }

    // Code correct : preuve de possession de la nouvelle adresse. Unicité
    // revérifiée à l'instant — une inscription a pu prendre l'adresse entre
    // la demande et la validation.
    await assertEmailFree(ctx, pendingEmail, userId);

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q: any) =>
        q.eq("userId", userId).eq("provider", EMAIL_PROVIDER),
      )
      .first();

    if (!account) {
      // Sans identité de connexion, changer l'email du profil rendrait le
      // compte irrécupérable. On refuse plutôt que d'écrire une adresse
      // orpheline.
      throw new Error(
        "Aucun moyen de connexion email n'est associé à ce compte. Contactez le support (contact@vlalemenu.fr).",
      );
    }

    await ctx.db.patch(account._id, {
      providerAccountId: pendingEmail,
      secret: undefined,
    });
    await ctx.db.patch(userId, {
      email: pendingEmail,
      // L'adresse vient d'être prouvée : elle est bien à son détenteur.
      emailVerificationTime: Date.now(),
      pendingEmail: undefined,
      pendingEmailSalt: undefined,
      pendingEmailHash: undefined,
      pendingEmailExpiresAt: undefined,
      pendingEmailAttempts: undefined,
    });

    return { ok: true, email: pendingEmail };
  },
});