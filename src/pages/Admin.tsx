import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isProSubscription } from "@/convex/plans";
import { establishmentTypeLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Clock,
  Crown,
  Infinity as InfinityIcon,
  Loader2,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Restaurateur = {
  restaurantId: Id<"restaurants">;
  name: string;
  establishmentType: string;
  city: string | null;
  slug: string;
  ownerId: Id<"users">;
  ownerEmail: string | null;
  menuCount: number;
  plan: string;
  planStatus: string | null;
  planSource: string | null;
  currentPeriodEnd: number | null;
  createdAt: number;
};

function GrantProDialog({
  target,
  onClose,
}: {
  target: Restaurateur;
  onClose: () => void;
}) {
  const grant = useMutation(api.admin.grantPro);
  const [duration, setDuration] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const presets: Array<{ label: string; days: number | null }> = [
    { label: "Illimité", days: null },
    { label: "1 mois", days: 31 },
    { label: "3 mois", days: 92 },
    { label: "1 an", days: 365 },
  ];
  const [presetIdx, setPresetIdx] = useState(0);

  const submit = async () => {
    setBusy(true);
    try {
      const days = presetIdx === null ? undefined : presets[presetIdx].days ?? undefined;
      const customDays = duration.trim()
        ? Number(duration)
        : days === undefined && presetIdx !== 0
          ? undefined
          : days;
      await grant({
        userId: target.ownerId,
        durationDays:
          duration.trim() && !Number.isNaN(Number(duration))
            ? Number(duration)
            : presetIdx === 0
              ? undefined
              : (customDays ?? undefined),
      });
      toast.success(
        presetIdx === 0 && !duration.trim()
          ? `${target.name} est maintenant PRO (illimité).`
          : `${target.name} est maintenant PRO (durée limitée).`,
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="clay-card rounded-3xl border-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-[Baloo_2]">
            <Crown className="size-5 text-primary" /> Attribuer le statut PRO
          </DialogTitle>
          <DialogDescription>
            {target.name} · {target.ownerEmail ?? "email inconnu"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Durée du statut PRO</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => setPresetIdx(i)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all",
                    presetIdx === i && !duration
                      ? "clay-btn clay-teal text-white"
                      : "clay-in bg-muted text-muted-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dur">Ou durée personnalisée (jours)</Label>
            <Input
              id="dur"
              inputMode="numeric"
              placeholder="ex : 14"
              className="clay-in h-11 rounded-2xl border-0 bg-muted"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Laissez vide et choisissez « Illimité » pour un PRO sans
              expiration. Une durée limitée retombera automatiquement en Gratuit
              à l'échéance.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="clay-btn clay-teal h-11 w-full rounded-2xl font-bold text-white"
            onClick={submit}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminSetup({ isAdmin }: { isAdmin: boolean }) {
  const adminExists = useQuery(api.admin.adminExists);
  const myEmail = useQuery(api.admin.myEmail);
  const claim = useMutation(api.admin.claimAdmin);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="clay-card clay mx-auto max-w-lg rounded-3xl border-0 shadow-none">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-3xl bg-[oklch(0.91_0.06_200)]">
          <ShieldCheck className="size-7 text-clay-deep" />
        </div>
        <CardTitle className="font-[Baloo_2] text-2xl">
          Accès administrateur
        </CardTitle>
        <CardDescription>
          Espace réservé à la gestion des restaurateurs et des abonnements.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isAdmin ? (
          <p className="rounded-2xl bg-[oklch(0.93_0.05_150)] p-3 text-center text-sm font-semibold text-[oklch(0.4_0.09_150)]">
            Vous êtes administrateur ✓
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connecté en tant que{" "}
              <strong>{myEmail ?? "…"}</strong>.{" "}
              {adminExists
                ? "Un administrateur existe déjà : votre email doit figurer dans la variable ADMIN_EMAILS pour obtenir l'accès."
                : "Aucun administrateur n'existe encore : le premier compte à se déclarer devient admin."}
            </p>
            <Button
              className="clay-btn clay-teal h-11 rounded-2xl font-bold text-white"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await claim({});
                  toast.success("Vous êtes maintenant administrateur !");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erreur");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : (
                <ShieldCheck className="size-4" />
              )}
              Devenir administrateur
            </Button>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Configuration serveur : ajoutez les emails autorisés (séparés par des
          virgules) dans la variable d'environnement{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">ADMIN_EMAILS</code>{" "}
          pour prolonger l'accès au-delà du premier administrateur.
        </p>
        <Link
          to="/dashboard"
          className="text-center text-sm font-semibold text-primary hover:underline"
        >
          ← Retour à mon espace
        </Link>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const role = useQuery(api.admin.myRole);
  const restaurateurs = useQuery(api.admin.listRestaurateurs);
  const revoke = useMutation(api.admin.revokeToFree);
  const [search, setSearch] = useState("");
  const [grantTarget, setGrantTarget] = useState<Restaurateur | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restaurateurs ?? [];
    return (restaurateurs ?? []).filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.ownerEmail ?? "").toLowerCase().includes(q) ||
        (r.city ?? "").toLowerCase().includes(q),
    );
  }, [restaurateurs, search]);

  if (role === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (role !== "admin") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10">
        <Button
          variant="outline"
          className="clay-sm mb-6 rounded-2xl border-0 bg-card font-bold"
          onClick={() => navigate("/dashboard")}
        >
          <ChevronLeft className="size-4" /> Mon espace
        </Button>
        <AdminSetup isAdmin={false} />
      </main>
    );
  }

  const proCount = (restaurateurs ?? []).filter((r) =>
    isProSubscription(r),
  ).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge className="clay-in mb-2 rounded-full border-0 bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
            <ShieldCheck className="mr-1 size-3.5 text-primary" /> Administration
          </Badge>
          <h1 className="font-[Baloo_2] text-3xl font-extrabold">
            Gestion des restaurateurs
          </h1>
          <p className="mt-1 text-muted-foreground">
            {restaurateurs?.length ?? 0} établissement(s) · {proCount} PRO
            actif(s)
          </p>
        </div>
        <Button
          variant="outline"
          className="clay-sm rounded-2xl border-0 bg-card font-bold"
          onClick={() => navigate("/dashboard")}
        >
          <ChevronLeft className="size-4" /> Mon espace
        </Button>
      </div>

      {/* Recherche */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
        <Input
          className="clay-in h-11 rounded-2xl border-0 bg-muted pl-9"
          placeholder="Rechercher par nom, email ou ville…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {restaurateurs === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="clay-card clay-flat rounded-3xl border-0">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="clay-in flex size-14 items-center justify-center rounded-3xl bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <p className="font-bold">Aucun restaurateur</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Les comptes qui créent un établissement apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const pro = isProSubscription(r);
            return (
              <Card key={r.restaurantId} className="clay-card clay-flat rounded-3xl border-0 py-4">
                <CardContent className="flex flex-wrap items-center gap-4 px-5">
                  <div className="clay-in flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <Store className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {r.name}
                      <Badge
                        className={cn(
                          "rounded-full border-0 px-2.5 py-0.5 text-xs font-bold",
                          pro
                            ? "clay-teal text-white"
                            : "clay-in bg-muted text-muted-foreground",
                        )}
                      >
                        {pro ? (
                          <>
                            <Crown className="mr-1 size-3" />
                            Pro
                          </>
                        ) : (
                          "Gratuit"
                        )}
                      </Badge>
                      {pro &&
                        (r.currentPeriodEnd ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                            <Clock className="size-3" /> jusqu'au{" "}
                            {fmtDate(r.currentPeriodEnd)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                            <InfinityIcon className="size-3" /> illimité
                          </span>
                        ))}
                      {pro && r.planSource === "admin" && (
                        <span className="text-xs text-muted-foreground">
                          (octroyé par admin)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {establishmentTypeLabel(r.establishmentType)}
                      {r.city ? ` · ${r.city}` : ""} · {r.ownerEmail ?? "email inconnu"}{" "}
                      · {r.menuCount} menu(s) · inscrit le {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="clay-sm rounded-2xl border-0 bg-card font-bold"
                      onClick={() => window.open(`/m/${r.slug}`, "_blank")}
                    >
                      Voir le menu
                    </Button>
                    {pro ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="clay-sm rounded-2xl border-0 bg-muted font-bold text-destructive"
                        disabled={busyId === r.ownerId}
                        onClick={async () => {
                          if (
                            !confirm(
                              `Retirer le plan Pro de « ${r.name} » et revenir au Gratuit ?`,
                            )
                          )
                            return;
                          setBusyId(r.ownerId);
                          try {
                            await revoke({ userId: r.ownerId });
                            toast.success(`${r.name} est repassé en Gratuit.`);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erreur");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        {busyId === r.ownerId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Retirer Pro"
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="clay-btn clay-teal rounded-2xl font-bold text-white"
                        onClick={() => setGrantTarget(r)}
                      >
                        <Crown className="size-3.5" /> Attribuer PRO
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {grantTarget && (
        <GrantProDialog target={grantTarget} onClose={() => setGrantTarget(null)} />
      )}
    </main>
  );
}
