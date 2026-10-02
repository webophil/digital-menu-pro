import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { isProSubscription } from "@/convex/plans";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Building2,
  Crown,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Save,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

/** Phrase exacte à recopier pour valider la suppression du compte. */
const CONFIRM_DELETE_PHRASE = "SUPPRIMEZ MON COMPTE";

function formatSiret(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 14)];
  return parts.filter(Boolean).join(" ");
}

function fmtDate(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface RestaurantForm {
  name: string;
  tagline: string;
  addressNumber: string;
  addressStreet: string;
  postalCode: string;
  city: string;
  phone: string;
  siret: string;
}

const emptyForm: RestaurantForm = {
  name: "",
  tagline: "",
  addressNumber: "",
  addressStreet: "",
  postalCode: "",
  city: "",
  phone: "",
  siret: "",
};

export default function MesInfos() {
  const profile = useQuery(api.account.getMyProfile);
  const sub = useQuery(api.billing.getMySubscription);
  const pro = isProSubscription(sub);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const updateEmail = useMutation(api.account.updateMyEmail);
  const updateEstablishment = useMutation(api.account.updateEstablishment);
  const cancelSubscription = useAction(api.checkout.cancelSubscription);
  const deleteMyAccount = useMutation(api.account.deleteMyAccount);

  const [email, setEmail] = useState("");
  const [form, setForm] = useState<RestaurantForm>(emptyForm);
  const [initialized, setInitialized] = useState(false);
  const [busyEmail, setBusyEmail] = useState(false);
  const [busyForm, setBusyForm] = useState(false);
  const [busyCancel, setBusyCancel] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  const restaurant = profile?.restaurant;

  // Pré-remplissage une seule fois, à la réception du profil
  useEffect(() => {
    if (profile && !initialized) {
      setEmail(profile.email);
      if (restaurant) {
        setForm({
          name: restaurant.name ?? "",
          tagline: restaurant.tagline ?? "",
          addressNumber: restaurant.addressNumber ?? "",
          addressStreet: restaurant.addressStreet ?? "",
          postalCode: restaurant.postalCode ?? "",
          city: restaurant.city ?? "",
          phone: restaurant.phone ?? "",
          siret: restaurant.siret ?? "",
        });
      }
      setInitialized(true);
    }
  }, [profile, restaurant, initialized]);

  if (profile === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const set = <K extends keyof RestaurantForm>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submitEmail = async () => {
    if (!email.trim() || email.trim() === profile?.email) return;
    setBusyEmail(true);
    try {
      await updateEmail({ email: email.trim() });
      toast.success("Email mis à jour ! Il servira à votre prochaine connexion.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyEmail(false);
    }
  };

  const submitForm = async () => {
    if (!restaurant) return;
    if (!form.name.trim()) {
      toast.error("Le nom de l'établissement est obligatoire.");
      return;
    }
    setBusyForm(true);
    try {
      await updateEstablishment({
        restaurantId: restaurant._id,
        name: form.name.trim(),
        tagline: form.tagline.trim() || undefined,
        addressNumber: form.addressNumber.trim() || undefined,
        addressStreet: form.addressStreet.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim() || undefined,
        phone: form.phone.trim() || undefined,
        siret: form.siret.trim() || undefined,
      });
      toast.success("Informations enregistrées !");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyForm(false);
    }
  };

  const doCancel = async () => {
    if (
      !confirm(
        "Résilier votre abonnement Pro ?\n\nVous conservez tous vos avantages Pro jusqu'à la fin de la période déjà payée. À cette date, votre compte repassera automatiquement au plan Gratuit.",
      )
    )
      return;
    setBusyCancel(true);
    try {
      await cancelSubscription({});
      toast.success(
        "Abonnement résilié — vos avantages Pro restent actifs jusqu'à la fin de la période déjà payée.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyCancel(false);
    }
  };

  const doDeleteAccount = async () => {
    if (confirmPhrase !== CONFIRM_DELETE_PHRASE) return;
    setBusyDelete(true);
    try {
      await deleteMyAccount({});
      toast.success("Votre compte a été supprimé. Merci et à bientôt !");
      try {
        await signOut();
      } catch {
        // session déjà supprimée côté serveur : ignorer
      }
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      setBusyDelete(false);
    }
  };

  return (
    <DashboardShell
      title="Mes infos"
      subtitle="Votre compte, votre établissement et votre abonnement"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Compte / email ---- */}
        <Card className="clay-card clay-flat rounded-3xl border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-[Baloo_2] text-xl">
              <span className="clay-teal clay-sm flex size-9 items-center justify-center rounded-2xl">
                <Mail className="size-4 text-white" />
              </span>
              Mon compte
            </CardTitle>
            <CardDescription>
              Votre email de connexion. Le modifier ne change rien à la
              sécurité d'accès : vous restez connecté sur cet appareil.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="clay-in h-11 rounded-2xl border-0 bg-muted"
                placeholder="vous@mon-restaurant.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              className="clay-btn clay-teal w-fit rounded-2xl font-bold text-white"
              onClick={submitEmail}
              disabled={
                busyEmail || !email.trim() || email.trim() === profile?.email
              }
            >
              {busyEmail ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Mettre à jour l'email
            </Button>
          </CardContent>
        </Card>

        {/* ---- Abonnement ---- */}
        <Card className="clay-card clay-flat rounded-3xl border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-[Baloo_2] text-xl">
              <span
                className={cn(
                  "clay-sm flex size-9 items-center justify-center rounded-2xl",
                  pro ? "clay-teal" : "clay-in bg-muted",
                )}
              >
                <Receipt className={cn("size-4", pro ? "text-white" : "text-muted-foreground")} />
              </span>
              Mon abonnement
            </CardTitle>
            <CardDescription>
              {pro
                ? "Plan Pro — menus illimités, photos illimitées, traduction auto."
                : "Plan Gratuit — 1 menu, 1 photo par plat. Passez Pro à tout moment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "rounded-full border-0 px-3 py-1 font-bold",
                  pro
                    ? "clay-teal text-white"
                    : "clay-in bg-muted text-muted-foreground",
                )}
              >
                {pro && <Crown className="mr-1 size-3.5" />}
                {pro ? "Plan Pro" : "Plan Gratuit"}
              </Badge>
              {pro && sub?.currentPeriodEnd && (
                <span className="text-sm text-muted-foreground">
                  Renouvellement le {fmtDate(sub.currentPeriodEnd)}
                </span>
              )}
            </div>
            {sub?.status === "past_due" && (
              <p className="clay-butter flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold text-[oklch(0.42_0.07_70)]">
                <AlertTriangle className="size-4 shrink-0" />
                Dernier paiement en échec — mettez à jour votre moyen de
                paiement chez notre prestataire.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {pro ? (
                <>
                  <Button
                    variant="outline"
                    className="clay-sm rounded-2xl border-0 bg-card font-bold"
                    disabled={busyCancel}
                    onClick={doCancel}
                  >
                    {busyCancel ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Annuler mon abonnement
                  </Button>
                  <Button asChild variant="ghost" className="rounded-2xl font-bold text-muted-foreground">
                    <Link to="/subscription">Gérer mon offre et mes factures</Link>
                  </Button>
                </>
              ) : (
                <Button asChild className="clay-btn clay-teal rounded-2xl font-bold text-white">
                  <Link to="/subscription">
                    <Crown className="size-4" /> Passer Pro
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ---- Établissement ---- */}
        <Card className="clay-card clay-flat rounded-3xl border-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-[Baloo_2] text-xl">
              <span className="clay-teal clay-sm flex size-9 items-center justify-center rounded-2xl">
                <Building2 className="size-4 text-white" />
              </span>
              Mon établissement
            </CardTitle>
            <CardDescription>
              Ces informations apparaissent sur votre menu client et vos
              factures.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="f-name">Nom de l'établissement *</Label>
              <Input
                id="f-name"
                className="clay-in h-11 rounded-2xl border-0 bg-muted"
                placeholder="Chez Marcel"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="f-tagline">Slogan</Label>
              <Input
                id="f-tagline"
                className="clay-in h-11 rounded-2xl border-0 bg-muted"
                placeholder="Cuisine maison & produits frais"
                value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                <MapPin className="size-4" /> Adresse
              </p>
              <div className="grid gap-3 sm:grid-cols-[110px_1fr_120px_1fr]">
                <Input
                  className="clay-in h-11 rounded-2xl border-0 bg-muted"
                  placeholder="N°"
                  title="Numéro"
                  value={form.addressNumber}
                  onChange={(e) => set("addressNumber", e.target.value)}
                />
                <Input
                  className="clay-in h-11 rounded-2xl border-0 bg-muted sm:col-span-1"
                  placeholder="Nom de la voie (rue, avenue…)"
                  value={form.addressStreet}
                  onChange={(e) => set("addressStreet", e.target.value)}
                />
                <Input
                  className="clay-in h-11 rounded-2xl border-0 bg-muted"
                  placeholder="Code postal"
                  inputMode="numeric"
                  value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value)}
                />
                <Input
                  className="clay-in h-11 rounded-2xl border-0 bg-muted"
                  placeholder="Ville"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="f-phone">
                <Phone className="mr-1 inline size-3.5" /> Téléphone de
                l'établissement
              </Label>
              <Input
                id="f-phone"
                type="tel"
                className="clay-in h-11 rounded-2xl border-0 bg-muted"
                placeholder="02 40 12 34 56"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="f-siret">SIRET (14 chiffres)</Label>
              <Input
                id="f-siret"
                className="clay-in h-11 rounded-2xl border-0 bg-muted"
                placeholder="123 456 789 00012"
                inputMode="numeric"
                value={form.siret}
                onChange={(e) => set("siret", formatSiret(e.target.value))}
              />
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Optionnel en Gratuit —{" "}
                <span className={cn("font-bold", pro && "text-foreground")}>
                  obligatoire pour les membres Pro
                </span>{" "}
                (facturation électronique).
              </p>
            </div>

            {pro && !form.siret.trim() && (
              <p className="clay-butter flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold text-[oklch(0.42_0.07_70)] md:col-span-2">
                <AlertTriangle className="size-4 shrink-0" />
                En tant que membre Pro, renseignez votre SIRET : il sera
                obligatoire sur vos factures (facturation électronique).
              </p>
            )}

            <div className="md:col-span-2">
              <Button
                className="clay-btn clay-teal rounded-2xl font-bold text-white"
                onClick={submitForm}
                disabled={busyForm || !restaurant}
              >
                {busyForm ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Enregistrer les informations
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ---- Danger zone : suppression du compte ---- */}
        <Card className="clay-card clay-flat rounded-3xl border-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-[Baloo_2] text-xl text-destructive">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-destructive/10">
                <Trash2 className="size-4 text-destructive" />
              </span>
              Supprimer mon compte
            </CardTitle>
            <CardDescription>
              Action irréversible : votre établissement, vos menus, vos plats,
              vos photos et vos données personnelles seront définitivement
              supprimés (RGPD). Les factures restent archivées 10 ans
              (obligation comptable).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog
              open={dangerOpen}
              onOpenChange={(open) => {
                setDangerOpen(open);
                if (!open) setConfirmPhrase("");
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-2xl border-0 bg-destructive/10 font-bold text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="size-4" /> Supprimer définitivement mon compte
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="clay-card clay-flat rounded-3xl border-0">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-[Baloo_2]">
                    Supprimer définitivement votre compte ?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        Cette action est <strong>irréversible</strong> :
                        établissement, menus, catégories, plats, photos et
                        données personnelles seront supprimés immédiatement.
                      </p>
                      <p>
                        Pour confirmer, recopiez exactement :{" "}
                        <strong className="text-destructive">
                          SUPPRIMEZ MON COMPTE
                        </strong>
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  className="clay-in h-11 rounded-2xl border-0 bg-muted"
                  placeholder="SUPPRIMEZ MON COMPTE"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  autoComplete="off"
                />
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-2xl border-0 bg-muted font-bold">
                    Annuler
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="h-10 rounded-2xl bg-destructive font-bold text-white hover:bg-destructive/90"
                    disabled={
                      confirmPhrase !== CONFIRM_DELETE_PHRASE || busyDelete
                    }
                    onClick={(e) => {
                      e.preventDefault(); // la fermeture est gérée côté action
                      doDeleteAccount();
                    }}
                  >
                    {busyDelete ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Supprimer mon compte
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
