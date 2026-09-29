"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const EMAIL_BG = "#f4f8fa";
const TEAL = "#0f7f96";
const TEAL_LIGHT = "#e2f2f5";
const INK = "#2b3547";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Envoi via Resend (domaine vlalemenu.fr vérifié). Échec = non bloquant :
 *  le message est de toute façon enregistré en base. */
async function notifyTeam(msg: {
  fullName: string;
  establishment?: string;
  email: string;
  subject: string;
  message: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    const estab = msg.establishment ? ` (${msg.establishment})` : "";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "V'la le Menu ! <menu@vlalemenu.fr>",
        to: ["contact@vlalemenu.fr"],
        reply_to: msg.email,
        subject: `Contact — ${msg.subject}`,
        text: [
          `Nouveau message depuis le formulaire de contact :`,
          ``,
          `De : ${msg.fullName}${estab}`,
          `Email : ${msg.email}`,
          `Sujet : ${msg.subject}`,
          ``,
          msg.message,
        ].join("\n"),
        html: `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:${EMAIL_BG};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BG};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr><td style="background:#ffffff;border-radius:24px;padding:32px;box-shadow:0 10px 30px rgba(96,110,140,0.12);">
            <h1 style="margin:0 0 16px;color:${INK};font-size:20px;font-weight:800;">
              💬 Nouveau message — formulaire de contact
            </h1>
            <p style="margin:0 0 4px;color:#6b7688;font-size:13px;">De</p>
            <p style="margin:0 0 14px;color:${INK};font-size:15px;font-weight:700;">${escapeHtml(msg.fullName)}${escapeHtml(estab)}</p>
            <p style="margin:0 0 4px;color:#6b7688;font-size:13px;">Email (répondre directement)</p>
            <p style="margin:0 0 14px;color:${TEAL};font-size:15px;font-weight:700;">${escapeHtml(msg.email)}</p>
            <p style="margin:0 0 4px;color:#6b7688;font-size:13px;">Sujet</p>
            <p style="margin:0 0 14px;color:${INK};font-size:15px;font-weight:700;">${escapeHtml(msg.subject)}</p>
            <p style="margin:0 0 4px;color:#6b7688;font-size:13px;">Message</p>
            <div style="background:${TEAL_LIGHT};border-radius:16px;padding:16px;margin:0;">
              <p style="margin:0;color:${INK};font-size:14px;line-height:1.65;white-space:pre-wrap;">${escapeHtml(msg.message)}</p>
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
      }),
    });
  } catch (err) {
    console.error(
      "[contact] Notification email impossible (message conservé en base) :",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Réception publique d'un message du formulaire /contact.
 * Rate limit maison : 3 messages max par email toutes les 10 minutes.
 */
export const sendMessage = action({
  args: {
    fullName: v.string(),
    establishment: v.optional(v.string()),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim();
    const email = args.email.trim();
    const subject = args.subject.trim();
    const message = args.message.trim();
    const establishment = args.establishment?.trim() || undefined;

    if (!fullName || !email || !subject || !message) {
      throw new Error("Merci de remplir tous les champs obligatoires.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Adresse email invalide.");
    }
    if (message.length > 5000 || subject.length > 200) {
      throw new Error("Message trop long.");
    }

    // Anti-spam simple : 3 messages max par email sur les 10 dernières minutes.
    const since = Date.now() - 10 * 60 * 1000;
    const recent = await ctx.runQuery(internal.contactInternal.countRecent, {
      email,
      since,
    });
    if (recent >= 3) {
      throw new Error(
        "Vous avez déjà envoyé plusieurs messages récemment. Merci de patienter un peu.",
      );
    }

    await ctx.runMutation(internal.contactInternal.insert, {
      fullName,
      establishment,
      email,
      subject,
      message,
    });

    await notifyTeam({
      fullName,
      establishment,
      email,
      subject,
      message,
    });

    return { ok: true as const };
  },
});
