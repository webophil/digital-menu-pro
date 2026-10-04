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
  Check,
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
  // La vérification Stripe doit rester accessible : Pro actif, plan Pro même
  // période expirée (webhook manqué), ou ancien compte basculé en Gratuit
  // par une résiliation antérieure incomplète mais qui conserve encore des
  // identifiants Stripe — c'est là que Stripe peut facturer encore.
  const canVerifyBilling =
    pro ||
    sub?.plan === "pro" ||
    Boolean(sub?.externalSubscriptionId) ||
    Boolean(sub?.externalCustomerId);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const requestEmailChange = useAction(api.accountEmailSend.requestEmailChange);
  const confirmEmailChange = useMutation(api.accountEmail.confirmEmailChange);
  const cancelEmailChange = useMutation(api.accountEmail.cancelEmailChange);
  const updateEstablishment = useMutation(api.account.updateEstablishment);
  const cancelSubscription = useAction(api.checkout.cancelSubscription);
  const deleteMyAccount = useMutation(api.account.deleteMyAccount);

  const [email, setEmail] = useState("");
  // Changement d'email en deux étapes : demande d'un code, puis saisie.
  const [emailCode, setEmailCode] = useState("");
  const [emailPending, setEmailPending] = useState<string | null>(null);
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
      // Étape 1 : un code part à la nouvelle adresse. Le compte n'est pas
      // encore modifié — l'adresse reste l'ancienne tant qu'il n'est pas saisi.
      const res = await requestEmailChange({ email: email.trim() });
      setEmailPending(res.email);
      setEmailCode("");
      toast.success(`Code envoyé à ${res.email}. Saisissez-le pour confirmer.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyEmail(false);
    }
  };

  const submitEmailCode = async () => {
    if (!emailCode.trim()) return;
    setBusyEmail(true);
    try {
      // Étape 2 : l'adresse n'est écrite qu'ici, une fois le code validé.
      const res = await confirmEmailChange({ code: emailCode.trim() });
      toast.success(
        `Email mis à jour ! ${res.email} servira à votre prochaine connexion.`,
      );
      setEmailPending(null);
      setEmailCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyEmail(false);
    }
  };

  const abortEmailChange = async () => {
    setBusyEmail(true);
    try {
      await cancelEmailChange({});
      setEmailPending(null);
      setEmailCode("");
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
    const granted = sub?.source === "admin";
    const confirmText = granted
      ? "Retirer votre statut Pro offert ?\n\nAucun prélèvement n'est en cours : votre compte repassera immédiatement en plan Gratuit."
      : pro
        ? "Résilier votre abonnement Pro ?\n\nVous conservez tous vos avantages Pro jusqu'à la fin de la période déjà payée. À cette date, votre compte repassera automatiquement au plan Gratuit."
        : sub?.plan === "pro"
          ? "Résilier votre abonnement ?\n\nVotre période affichée est terminée, mais un prélèvement est peut-être encore en cours : Stripe va être vérifié et tout renouvellement sera stoppé."
          : "Vérifier et résilier mon abonnement ?\n\nVotre compte est marqué Gratuit, mais un prélèvement Stripe pourrait subsister : Stripe va être vérifié et, s'il reste un abonnement actif, il sera résilié.";
    if (!confirm(confirmText)) return;
    setBusyCancel(true);
    try {
      const res = await cancelSubscription({});
      if (res?.mode === "immediate") {
        toast.success(
          "Statut retiré — aucun prélèvement n'était en cours, votre compte est repassé en plan Gratuit.",
        );
      } else if (pro) {
        toast.success(
          "Abonnement résilié — vos avantages Pro restent actifs jusqu'à la fin de la période déjà payée.",
        );
      } else {
        // Période locale expirée (webhook manqué) : Stripe confirme l'arrêt,
        // sans promettre d'avantages Pro qui ne s'affichent pas localement.
        toast.success("Abonnement résilié — aucun renouvellement n'aura lieu.");
      }
      if (res?.warning) toast.info(res.warning);
    } catch (e) {
      // Résiliation refusée par Stripe (ou service injoignable) : le serveur
      // n'a rien changé, on affiche l'erreur réelle sans annoncer de succès.
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
              sécurité d'accès : vous restez connecté sur cet appareil. Un code
              de confirmation vous est envoyé à la nouvelle adresse avant tout
              changement.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {emailPending === null ? (
              <>
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
                  Recevoir un code de confirmation
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Code envoyé à{" "}
                  <span className="font-bold break-all text-foreground">
                    {emailPending}
                  </span>
                  . Saisissez-le pour confirmer votre nouvelle adresse.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="email-code">Code de confirmation</Label>
                  <Input
                    id="email-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="clay-in h-11 rounded-2xl border-0 bg-muted text-center text-lg font-bold tracking-[0.4em]"
                    placeholder="000000"
                    value={emailCode}
                    onChange={(e) =>
                      setEmailCode(e.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="clay-btn clay-teal w-fit rounded-2xl font-bold text-white"
                    onClick={submitEmailCode}
                    disabled={busyEmail || emailCode.length !== 6}
                  >
                    {busyEmail ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Confirmer
                  </Button>
                  <Button
                    variant="outline"
                    className="clay-sm rounded-2xl border-0 bg-card font-bold"
                    onClick={abortEmailChange}
                    disabled={busyEmail}
                  >
                    Annuler
                  </Button>
                </div>
              </>
            )}
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
                  {sub.status === "cancelling"
                    ? "Avantages Pro jusqu'au "
                    : "Renouvellement le "}
                  {fmtDate(sub.currentPeriodEnd)}
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
              {/* Résiliation / vérification proposée dès que Stripe peut
                  encore facturer (ou que le plan est Pro), même si la période
                  locale est expirée ou le compte marqué Gratuit. */}
              {canVerifyBilling ? (
                <>
                  <Button
                    variant="outline"
                    className="clay-sm rounded-2xl border-0 bg-card font-bold"
                    disabled={busyCancel || sub?.status === "cancelling"}
                    onClick={doCancel}
                  >
                    {busyCancel ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {sub?.status === "cancelling"
                      ? "Résiliation en cours…"
                      : "Annuler mon abonnement"}
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
