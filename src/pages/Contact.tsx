import { BrandLogo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Send,
  Store,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useAction } from "convex/react";
import { toast } from "sonner";

const EMPTY_FORM = {
  fullName: "",
  establishment: "",
  email: "",
  subject: "",
  message: "",
};

export default function Contact() {
  const sendMessage = useAction(api.contact.sendMessage);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const filled =
    form.fullName.trim() &&
    form.email.trim() &&
    form.subject.trim() &&
    form.message.trim();

  const submit = async () => {
    if (!filled) {
      toast.error("Merci de remplir tous les champs obligatoires.");
      return;
    }
    setBusy(true);
    try {
      await sendMessage({
        fullName: form.fullName,
        establishment: form.establishment || undefined,
        email: form.email,
        subject: form.subject,
        message: form.message,
      });
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'envoi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <nav className="clay-card clay-ring mx-auto flex w-full max-w-6xl items-center justify-between rounded-3xl px-5 py-3 shadow-[0_10px_30px_rgba(96,110,140,0.15)]">
          <Link to="/" aria-label="Retour à l'accueil">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <Button
            asChild
            variant="ghost"
            className="rounded-2xl font-bold text-muted-foreground"
          >
            <Link to="/">
              <ArrowLeft className="size-4" /> Retour au site
            </Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        {sent ? (
          <Card className="clay-card clay-flat rounded-3xl border-0 text-center">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="clay-teal flex size-16 items-center justify-center rounded-3xl">
                <CheckCircle2 className="size-8 text-white" />
              </div>
              <h1 className="font-[Baloo_2] text-2xl font-extrabold">
                Merci de votre message !
              </h1>
              <p className="max-w-md text-muted-foreground">
                L'équipe V'la le Menu ! répond en général en moins de 24 h
                (jours ouvrés).
              </p>
              <Button asChild className="clay-btn clay-teal mt-2 rounded-2xl font-bold text-white">
                <Link to="/">
                  <ArrowLeft className="size-4" /> Retour à l'accueil
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div className="clay-teal mx-auto mb-4 flex size-14 items-center justify-center rounded-3xl">
                <Mail className="size-7 text-white" />
              </div>
              <h1 className="font-[Baloo_2] text-3xl font-extrabold sm:text-4xl">
                Contactez-nous
              </h1>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                Une question, une suggestion, un souci technique ? Écrivez-nous,
                on vous répond vite.
              </p>
            </div>

            <Card className="clay-card clay-flat rounded-3xl border-0">
              <CardHeader>
                <CardTitle className="font-[Baloo_2] text-xl">
                  Votre message
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  Réponse en général en moins de 24 h (jours ouvrés).
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="c-name">Nom et prénom *</Label>
                    <Input
                      id="c-name"
                      className="clay-in h-11 rounded-2xl border-0 bg-muted"
                      placeholder="Marie Dupont"
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="c-estab">
                      Nom de l'établissement{" "}
                      <span className="font-normal text-muted-foreground">
                        (facultatif)
                      </span>
                    </Label>
                    <Input
                      id="c-estab"
                      className="clay-in h-11 rounded-2xl border-0 bg-muted"
                      placeholder="Chez Marcel"
                      value={form.establishment}
                      onChange={(e) =>
                        setForm({ ...form, establishment: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-email">Email *</Label>
                  <Input
                    id="c-email"
                    type="email"
                    className="clay-in h-11 rounded-2xl border-0 bg-muted"
                    placeholder="marie@chezmarcel.fr"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-subject">Sujet *</Label>
                  <Input
                    id="c-subject"
                    className="clay-in h-11 rounded-2xl border-0 bg-muted"
                    placeholder="Question sur le plan Pro"
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="c-message">Votre demande *</Label>
                  <Textarea
                    id="c-message"
                    className="clay-in min-h-36 rounded-2xl border-0 bg-muted"
                    placeholder="Décrivez votre demande…"
                    value={form.message}
                    onChange={(e) =>
                      setForm({ ...form, message: e.target.value })
                    }
                  />
                </div>
                <Button
                  className="clay-btn clay-teal h-12 rounded-2xl font-bold text-white"
                  disabled={busy || !filled}
                  onClick={submit}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Envoyer mon message
                </Button>
              </CardContent>
            </Card>

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Store className="size-4" />
              Vous êtes restaurateur ? Créez votre menu digital en quelques
              minutes.
            </p>
          </>
        )}
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} V'la le Menu ! — Menus digitaux pour
        restaurateurs ·{" "}
        <Link to="/mentions-legales" className="font-semibold hover:text-foreground">
          Mentions légales
        </Link>
      </footer>
    </div>
  );
}
