"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import axios from "axios";

/**
 * Envoi du code de confirmation du changement d'email (étape 1).
 *
 * Isolé dans un fichier « use node » : l'envoi HTTP exige le runtime Node,
 * alors que les mutations qui préparent et appliquent le changement vivent
 * dans `accountEmail.ts`.
 *
 * Le code en clair ne transite qu'entre la mutation interne
 * `beginEmailChange` et cet envoi : il n'est jamais renvoyé au navigateur.
 */
export const requestEmailChange = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    // Authentification vérifiée avant tout : sans cette garde, l'action
    // enverrait un email à une adresse choisie par n'importe quel visiteur.
    if ((await getAuthUserId(ctx)) === null) {
      throw new Error("Not authenticated");
    }

    // La mutation interne refait les contrôles (admin, unicité, format) et
    // mémorise l'empreinte du code.
    const prepared: { email: string; code: string } = await ctx.runMutation(
      internal.accountEmail.beginEmailChange,
      { email },
    );

    await sendCodeEmail(prepared.email, prepared.code);

    return { ok: true, email: prepared.email };
  },
});

/**
 * Envoi du code via Resend, comme pour la connexion. En cas d'échec on le dit
 * explicitement plutôt que de laisser croire que le code est parti.
 */
async function sendCodeEmail(to: string, code: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error(
      "Aucun service d'envoi d'email n'est configuré. Contactez le support (contact@vlalemenu.fr).",
    );
  }

  try {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from: process.env.RESEND_FROM ?? "V'la le Menu ! <menu@vlalemenu.fr>",
        to,
        reply_to: "contact@vlalemenu.fr",
        subject: "Confirmez votre nouvelle adresse — V'la le Menu !",
        html: codeHtml(code),
        text: codeText(code),
      },
      { headers: { Authorization: `Bearer ${resendKey}` } },
    );
  } catch (error) {
    const detail = axios.isAxiosError(error)
      ? JSON.stringify(error.response?.data ?? error.message)
      : error instanceof Error
        ? error.message
        : String(error);
    console.error("[email] Envoi Resend impossible :", detail);
    throw new Error(
      "Impossible d'envoyer le code de confirmation. Réessayez dans un instant.",
    );
  }
}

function codeText(code: string) {
  return [
    "Bonjour,",
    "",
    "Vous avez demandé le changement d'adresse de votre compte V'la le Menu !.",
    "",
    `Votre code de confirmation : ${code}`,
    "",
    "Ce code est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre adresse actuelle reste inchangée.",
    "",
    "L'équipe V'la le Menu !",
  ].join("\n");
}

function codeHtml(code: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f8fa;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
            <tr>
              <td style="padding-bottom:20px;" align="center">
                <img src="https://vlalemenu.fr/vlalemenu-logo.webp" alt="V'la le Menu !" width="180" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:24px;padding:36px 32px;box-shadow:0 10px 30px rgba(96,110,140,0.12);">
                <h1 style="margin:0 0 12px;color:#2b3547;font-size:22px;font-weight:800;">Confirmez votre adresse</h1>
                <p style="margin:0 0 24px;color:#2b3547;font-size:15px;line-height:1.6;">
                  Vous avez demandé à changer l'adresse de votre compte
                  <strong>V'la le Menu&nbsp;!</strong>. Saisissez ce code pour
                  confirmer que vous contrôlez bien la nouvelle adresse :
                </p>
                <div style="background:#e2f2f5;border-radius:18px;padding:20px;margin:0 0 8px;" align="center">
                  <span style="font-size:38px;font-weight:800;letter-spacing:10px;color:#0f7f96;">${code}</span>
                </div>
                <p style="margin:12px 0 24px;color:#6b7688;font-size:12.5px;" align="center">
                  Valable <strong>15 minutes</strong>. Sans ce code, votre adresse
                  actuelle reste inchangée.
                </p>
                <p style="margin:0;color:#2b3547;font-size:14px;line-height:1.6;">
                  Si vous n'êtes pas à l'origine de cette demande, ignorez cet
                  email — aucune modification ne sera effectuée.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
