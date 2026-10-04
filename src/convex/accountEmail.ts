import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";

/**
 * Changement d'email de connexion — logique en base.
 *
 * L'adresse n'est écrite qu'après validation d'un code envoyé À CETTE
 * ADRESSE (`confirmEmailChange`). Tant que le code n'est pas validé, le
 * profil garde l'ancienne adresse et le compte reste connecté normalement.
 *
 * Deux contraintes dictent la structure de ce fichier.
 *
 * 1) AUCUNE donnée de confirmation dans la table `users`.
 *    `users.currentUser` renvoie le document utilisateur ENTIER, et
 *    `useAuth()` l'expose dans toute l'application. Or un code à 6 chiffres
 *    n'offre qu'un million de possibilités : avec l'empreinte et le sel
 *    lisibles, on retrouve le code par recherche locale, sans recevoir
 *    l'email et sans épuiser les tentatives côté serveur. Ces données
 *    vivent donc dans `emailChangeRequests`, lisible uniquement par ce code.
 *
 * 2) AUCUN `throw` après une écriture.
 *    Une mutation Convex est transactionnelle : lever annule tout ce qu'elle
 *    a écrit. Incrémenter un compteur puis lever ne compterait donc jamais —
 *    la demande resterait ouverte indéfiniment. Après avoir enregistré
 *    l'échec, on RENVOIE un résultat d'erreur que l'interface affiche.
 *
 * L'envoi du code, qui exige le runtime Node, vit dans
 * `accountEmailSend.ts`.
 */

/** Identifiant du provider de connexion (doit correspondre à `auth.ts`). */
const EMAIL_PROVIDER = "email-otp";

/** Durée de validité du code (15 minutes). */
const CODE_TTL_MS = 15 * 60 * 1000;

/** Nombre de tentatives avant d'abandonner la demande en cours. */
const MAX_ATTEMPTS = 5;

/** Intervalle minimal entre deux demandes de code (anti-abus). */
const RESEND_COOLDOWN_MS = 60 * 1000;

/** Résultat d'échec : jamais une exception, pour ne pas annuler l'écriture. */
function failure(error: string) {
  return { ok: false as const, error };
}

/** Résultat de succès. */
function success(email: string) {
  return { ok: true as const, email };
}

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
 *
 * Ne fait AUCUNE écriture : un `throw` ici est sans conséquence.
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
async function emailTakenByOther(ctx: any, email: string, userId: any) {
  const inUsers = await ctx.db
    .query("users")
    .withIndex("email", (q: any) => q.eq("email", email))
    .first();
  if (inUsers && inUsers._id !== userId) return true;

  const inAccounts = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q: any) =>
      q.eq("provider", EMAIL_PROVIDER).eq("providerAccountId", email),
    )
    .first();
  return Boolean(inAccounts && inAccounts.userId !== userId);
}

/** Demande en cours pour ce compte, s'il y en a une. */
async function findPending(ctx: any, userId: any) {
  return await ctx.db
    .query("emailChangeRequests")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

/**
 * Prépare la demande : contrôles, génération du code, mémorisation de son
 * empreinte dans la table dédiée. Mutation INTERNE car son résultat contient
 * le code en clair, destiné à l'envoi d'email : il ne doit jamais atteindre
 * le navigateur. Le profil n'est pas modifié — `users.email` reste l'ancienne
 * adresse.
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
    if (await emailTakenByOther(ctx, normalized, userId)) {
      throw new Error("Cet email est déjà utilisé par un autre compte.");
    }

    const now = Date.now();

    // Une seule demande en cours par compte : la précédente est remplacée.
    const previous = await findPending(ctx, userId);
    if (previous) {
      // Anti-abus : sans délai, la demande est ignorée (l'ancienne reste
      // valable jusqu'à son expiration).
      if (now - previous.createdAt < RESEND_COOLDOWN_MS) {
        throw new Error(
          "Un code vient d'être envoyé. Patientez une minute avant d'en demander un nouveau.",
        );
      }
      await ctx.db.delete(previous._id);
    }

    const code = generateCode();
    const salt = randomHex(16);
    await ctx.db.insert("emailChangeRequests", {
      userId,
      email: normalized,
      codeHash: await hashCode(code, salt),
      salt,
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      createdAt: now,
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
    const request = await findPending(ctx, userId);
    if (request) await ctx.db.delete(request._id);
    return { ok: true };
  },
});

/**
 * Étape 2 : valide le code et n'ALORS seulement applique le changement.
 *
 * NE LÈVE JAMAIS après avoir écrit quoi que ce soit : la mutation étant
 * transactionnelle, une exception annulerait l'écriture et l'échec ne serait
 * jamais compté. Chaque issue est donc RENVOYÉE (`{ ok: false, error }`),
 * y compris celle qui incrémente le compteur.
 *
 * Le profil (`users`) et l'identité de connexion (`authAccounts`) sont mis à
 * jour dans la même transaction : les deux doivent rester cohérents, sinon la
 * prochaine connexion chercherait l'ancien email alors que le profil affiche
 * le nouveau.
 */
export const confirmEmailChange = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { userId } = await requireChangeableUser(ctx);

    const request = await findPending(ctx, userId);
    if (!request) {
      return failure(
        "Aucune demande de changement en cours. Relancez la demande pour recevoir un nouveau code.",
      );
    }

    // ---- Échecs qui n'écrivent rien : une exception serait sans effet ----
    if (request.expiresAt < Date.now()) {
      await ctx.db.delete(request._id);
      return failure("Le code a expiré. Relancez la demande.");
    }

    const matches = safeEqual(
      request.codeHash,
      await hashCode(code.trim(), request.salt),
    );

    if (!matches) {
      // Un code à 6 chiffres se devine : on borne les tentatives ET on
      // invalide la demande au-delà, faute de quoi elle permettrait de tester
      // des codes à l'infini. L'écriture ci-dessous DOIT être suivie d'un
      // `return`, jamais d'un `throw` : ce serait annulé avec la mutation.
      const attempts = request.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await ctx.db.delete(request._id);
        return failure(
          "Trop de tentatives incorrectes. Relancez la demande pour obtenir un nouveau code.",
        );
      }
      await ctx.db.patch(request._id, { attempts });
      const remaining = MAX_ATTEMPTS - attempts;
      return failure(
        `Code incorrect. Il vous reste ${remaining} tentative${remaining > 1 ? "s" : ""}.`,
      );
    }

    // ---- Code correct : preuve de possession de la nouvelle adresse ----
    // Unicité revérifiée à l'instant — une inscription a pu prendre
    // l'adresse entre la demande et la validation.
    if (await emailTakenByOther(ctx, request.email, userId)) {
      return failure(
        "Cet email est désormais utilisé par un autre compte. Relancez la demande.",
      );
    }

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
      return failure(
        "Aucun moyen de connexion email n'est associé à ce compte. Contactez le support (contact@vlalemenu.fr).",
      );
    }

    await ctx.db.patch(account._id, {
      providerAccountId: request.email,
      secret: undefined,
    });
    await ctx.db.patch(userId, {
      email: request.email,
      // L'adresse vient d'être prouvée : elle est bien à son détenteur.
      emailVerificationTime: Date.now(),
    });
    await ctx.db.delete(request._id);

    return success(request.email);
  },
});