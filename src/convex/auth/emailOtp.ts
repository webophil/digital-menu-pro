import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const resendKey = process.env.RESEND_API_KEY;

    if (resendKey) {
      try {
        // Expéditeur personnalisé « V'la le Menu ! » (domaine vérifié chez
        // Resend — sinon onboarding@resend.dev pour les tests).
        await axios.post(
          "https://api.resend.com/emails",
          {
            from:
              process.env.RESEND_FROM ??
              "V'la le Menu ! <onboarding@resend.dev>",
            to: email,
            reply_to: "contact@vlalemenu.fr",
            subject: "Votre code de connexion — V'la le Menu !",
            html: otpEmailHtml(token),
            text: otpEmailText(token),
          },
          {
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
          },
        );
        return;
      } catch (error) {
        console.error(
          "[auth] Envoi Resend impossible, repli sur le service interne :",
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Repli : service email Freebuff (template non personnalisable) —
    // garantit que les connexions continuent de fonctionner.
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        },
        {
          headers: {
            "x-api-key": "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
          },
        },
      );
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});

const EMAIL_BG = "#f4f8fa";
const TEAL = "#0f7f96";
const TEAL_LIGHT = "#e2f2f5";
const INK = "#2b3547";

function otpEmailText(token: string) {
  return [
    "Bonjour,",
    "",
    "Voici votre code de connexion à V'la le Menu ! :",
    "",
    `${token}`,
    "",
    "Ce code est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.",
    "",
    "À tout de suite sur V'la le Menu ! — vos menus digitaux, magnifiques et traduits.",
    "",
    "L'équipe V'la le Menu !",
  ].join("\n");
}

function otpEmailHtml(token: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:${EMAIL_BG};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BG};padding:32px 16px;">
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
                <h1 style="margin:0 0 12px;color:${INK};font-size:22px;font-weight:800;">Bonjour 👋</h1>
                <p style="margin:0 0 24px;color:${INK};font-size:15px;line-height:1.6;">
                  Voici votre code de connexion à <strong>V'la le Menu&nbsp;!</strong>.
                  Saisissez-le dans la fenêtre de connexion pour accéder à votre espace :
                </p>
                <div style="background:${TEAL_LIGHT};border-radius:18px;padding:20px;margin:0 0 8px;" align="center">
                  <span style="font-size:38px;font-weight:800;letter-spacing:10px;color:${TEAL};">${token}</span>
                </div>
                <p style="margin:12px 0 24px;color:#6b7688;font-size:12.5px;" align="center">
                  Ce code est valable <strong>15 minutes</strong>.<br />
                  Il n'a été envoyé qu'à votre adresse, ne le partagez pas.
                </p>
                <p style="margin:0;color:${INK};font-size:14px;line-height:1.6;">
                  Si vous n'êtes pas à l'origine de cette demande, ignorez cet
                  email — aucun compte ne sera créé ni modifié.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 4px;" align="center">
                <p style="margin:0;color:#8a93a5;font-size:11.5px;line-height:1.6;">
                  Vous recevez cet email parce qu'une connexion a été demandée sur V'la le Menu&nbsp;!<br />
                  L'équipe V'la le Menu&nbsp;! — menus digitaux pour restaurants, brasseries et food trucks
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
