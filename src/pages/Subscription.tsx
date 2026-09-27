import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardShell } from "@/components/DashboardShell";
import { api } from "@/convex/_generated/api";
import { isProPlan, isProSubscription, PLANS, PRO_PRICE_EUR } from "@/convex/plans";
import { useAuth } from "@/hooks/use-auth";
import {
  Check,
  Crown,
  Download,
  Languages,
  Loader2,
  Receipt,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Subscription() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const sub = useQuery(api.billing.getMySubscription);
  const invoices = useQuery(api.billing.listMyInvoices);
  const checkout = useAction(api.checkout.createCheckoutSession);
  const [busy, setBusy] = useState(false);

  const checkoutStatus = searchParams.get("checkout");
  const pro = isProSubscription(sub);
  const proExpired = !pro && isProPlan(sub?.plan);

  const startCheckout = async () => {
    if (!user?.email) {
      toast.error("Votre email de compte est requis pour payer.");
      return;
    }
    setBusy(true);
    try {
      const { url } = await checkout({ email: user.email });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de paiement");
      setBusy(false);
    }
  };

  if (sub === undefined) {
    // Chargement
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <DashboardShell
      title="Abonnement"
      subtitle="Gérez votre plan et retrouvez vos factures"
    >
      {checkoutStatus === "success" && (
        <div className="clay-teal clay-flat mb-6 flex items-center gap-3 rounded-3xl p-4 text-white">
          <Check className="size-5 shrink-0" />
          <p className="text-sm font-semibold">
            Paiement confirmé ! Votre plan Pro sera actif dans quelques instants
            (dès réception de la confirmation de paiement).
          </p>
        </div>
      )}
      {checkoutStatus === "cancel" && (
        <div className="clay-butter clay-flat mb-6 flex items-center gap-3 rounded-3xl p-4">
          <p className="text-sm font-semibold text-[oklch(0.4_0.08_70)]">
            Paiement annulé — aucun prélèvement n'a été effectué.
          </p>
        </div>
      )}

      <Card className="clay-card clay-flat mb-8 rounded-3xl border-0">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 font-[Baloo_2] text-xl">
                Statut actuel
                {pro ? (
                  <Badge className="clay-teal rounded-full border-0 px-3 py-1 font-bold text-white">
                    <Crown className="mr-1 size-3.5" /> Pro
                  </Badge>
                ) : (
                  <Badge className="clay-in rounded-full border-0 bg-muted px-3 py-1 font-bold text-muted-foreground">
                    Gratuit
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {pro
                  ? sub?.currentPeriodEnd
                    ? `${sub.source === "admin" ? "Statut offert" : "Renouvellement"} jusqu'au ${formatDate(sub.currentPeriodEnd)}`
                    : sub?.source === "admin"
                      ? "Statut PRO accordé par l'administration, sans limite de durée."
                      : "Abonnement Pro actif, sans limite de durée."
                  : proExpired
                    ? `Votre période Pro a expiré${sub?.currentPeriodEnd ? ` le ${formatDate(sub.currentPeriodEnd)}` : ""} — renouvelez pour retrouver menus illimités et traduction.`
                    : "Vous êtes sur le plan gratuit — 1 menu, sans traduction automatique."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="mb-10 grid gap-6 md:grid-cols-2">
        <Card className="clay-card clay-flat rounded-[2rem] border-0">
          <CardContent className="flex h-full flex-col gap-4 p-7">
            <div>
              <h3 className="text-lg font-bold">Gratuit</h3>
              <p className="font-[Baloo_2] text-4xl font-extrabold">
                0 €<span className="text-sm font-bold text-muted-foreground"> /mois</span>
              </p>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {PLANS.FREE.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  {f.startsWith("Aucune") ? (
                    <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  )}
                  <span className={f.startsWith("Aucune") ? "text-muted-foreground" : ""}>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              disabled
              variant="outline"
              className="clay-sm h-11 rounded-2xl border-0 bg-muted font-bold"
            >
              {pro ? "Plan précédent" : "Plan actuel"}
            </Button>
          </CardContent>
        </Card>

        <Card className="clay-teal clay-btn relative overflow-hidden rounded-[2rem] border-0">
          <Badge className="absolute top-5 right-5 rounded-full border-0 bg-white/90 px-3 py-1 font-extrabold text-clay-deep">
            Le plus populaire
          </Badge>
          <CardContent className="flex h-full flex-col gap-4 p-7">
            <div>
              <h3 className="text-lg font-bold text-white">Pro</h3>
              <p className="font-[Baloo_2] text-4xl font-extrabold text-white">
                {PRO_PRICE_EUR} €
                <span className="text-sm font-bold text-white/80"> /mois</span>
              </p>
            </div>
            <ul className="flex-1 space-y-2 text-sm text-white">
              {PLANS.PRO.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {pro && sub?.source === "admin" ? (
              <Button
                disabled
                className="h-11 rounded-2xl border-0 bg-white/40 font-bold text-white"
              >
                <Crown className="mr-1 size-4" /> Statut actif (offert)
              </Button>
            ) : pro ? (
              <Button
                disabled
                className="h-11 rounded-2xl border-0 bg-white/40 font-bold text-white"
              >
                <Crown className="mr-1 size-4" /> Plan actuel
              </Button>
            ) : (
              <Button
                className="h-11 rounded-2xl border-0 bg-white font-bold text-clay-deep hover:bg-white/90"
                onClick={startCheckout}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Crown className="mr-1 size-4" /> Passer au plan Pro
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-[Baloo_2] text-xl font-extrabold">
          <Receipt className="size-5 text-primary" /> Factures
        </h2>
        {invoices === undefined ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="clay-flat rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground">
            Aucune facture pour l'instant. Vos factures d'abonnement Pro
            apparaîtront ici (TVA incluse, payable par carte).
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div
                key={inv._id}
                className="clay-flat flex flex-wrap items-center gap-3 rounded-3xl bg-card p-4"
              >
                <div className="clay-in flex size-10 items-center justify-center rounded-2xl bg-muted">
                  <Languages className="hidden" />
                  <Receipt className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{inv.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Facture {inv.number} · {formatDate(inv.issuedAt)}
                  </p>
                </div>
                <Badge
                  className={
                    inv.status === "paid"
                      ? "rounded-full border-0 bg-[oklch(0.9_0.08_150)] px-2.5 py-1 text-xs font-bold text-[oklch(0.4_0.1_150)]"
                      : "clay-in rounded-full border-0 bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground"
                  }
                >
                  {inv.status === "paid" ? "Payée" : inv.status}
                </Badge>
                <span className="font-[Baloo_2] text-lg font-extrabold">
                  {(inv.amountEurCents / 100).toFixed(2).replace(".", ",")} €
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-2xl"
                  title="Télécharger (bientôt disponible)"
                  disabled
                >
                  <Download className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
