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
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
          <p className="text-sm text-muted-foreground">
            Connecté en tant que <strong>{myEmail ?? "…"}</strong>.{" "}
            {adminExists
              ? " Aucune auto-attribution n'est possible : un administrateur existant peut vous promouvoir (compte inscrit avec email vérifié requis)."
              : " Aucun administrateur n'existe encore : le premier admin est créé par l'exploitant via le CLI."}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Rappel exploitant — premier admin via le CLI (compte déjà inscrit,
          email vérifié) :
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono">
            npx convex run admin:internalAdminBootstrap '{'{"email":"contact@vlalemenu.fr"}'}'
          </code>
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

type AuditEntry = Doc<"adminAuditLog">;

const ACTION_LABEL: Record<string, string> = {
  bootstrap: "Premier admin (CLI)",
  promote: "Promotion admin",
  demote: "Retrait du rôle admin",
  email_change: "Email admin modifié (CLI)",
};

function AdminsPanel({ myUserId }: { myUserId: Id<"users"> | null }) {
  const promote = useMutation(api.admin.promoteToAdmin);
  const demote = useMutation(api.admin.demoteAdmin);
  const audit = useQuery(api.admin.listAuditLog);
  const admins = useQuery(api.admin.listAdmins);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submitDemotion = async (target: { userId: string; email: string | null }) => {
    if (
      !confirm(
        `Retirer le rôle administrateur à « ${target.email ?? target.userId} » ?`,
      )
    )
      return;
    setBusyId(target.userId);
    try {
      await demote({ userId: target.userId as Id<"users"> });
      toast.success(
        `Rôle administrateur retiré à ${target.email ?? target.userId}.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  const submitPromotion = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      toast.error("Adresse email invalide.");
      return;
    }
    setBusy(true);
    try {
      const res = await promote({ email: normalized });
      toast.success(
        res?.already
          ? "Ce compte est déjà administrateur."
          : `« ${normalized} » est maintenant administrateur.`,
      );
      setEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="clay-card clay-flat mb-8 rounded-3xl border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-[Baloo_2] text-xl">
          <span className="clay-teal clay-sm flex size-9 items-center justify-center rounded-2xl">
            <ShieldCheck className="size-4 text-white" />
          </span>
          Administrateurs
        </CardTitle>
        <CardDescription>
          Promotion d'un compte déjà inscrit dont l'email est vérifié (le
          propriétaire doit avoir validé son code de connexion après tout
          changement d'adresse). Le dernier administrateur est protégé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            className="clay-in h-11 min-w-56 flex-1 rounded-2xl border-0 bg-muted"
            placeholder="email du compte à promouvoir"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            className="clay-btn clay-teal h-11 rounded-2xl font-bold text-white"
            disabled={busy || !email.trim()}
            onClick={submitPromotion}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : (
              <ShieldCheck className="size-4" />
            )}
            Promouvoir admin
          </Button>
        </div>

        {/* Liste des administrateurs — retrait possible tant qu'il en reste
            plus d'un (protection du dernier admin appliquée côté serveur). */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Administrateurs en place
          </p>
          {admins === undefined ? null : admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun.</p>
          ) : (
            <ul className="space-y-1.5">
              {admins.map((a) => {
                const isMe = myUserId !== null && a.userId === myUserId;
                const isLast = admins.length <= 1;
                return (
                  <li
                    key={a.userId}
                    className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-sm"
                  >
                    <ShieldCheck className="size-4 text-primary" />
                    <span className="font-bold">{a.email ?? a.userId}</span>
                    {isMe && (
                      <Badge className="clay-in rounded-full border-0 bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                        vous
                      </Badge>
                    )}
                    {isLast && (
                      <span className="text-xs text-muted-foreground">
                        dernier admin — retrait impossible
                      </span>
                    )}
                    {!isMe && !isLast && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="clay-sm ml-auto rounded-2xl border-0 bg-muted font-bold text-destructive"
                        disabled={busyId === a.userId}
                        onClick={() =>
                          submitDemotion({ userId: a.userId, email: a.email })
                        }
                      >
                        {busyId === a.userId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        Retirer le rôle
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Journal des actions
          </p>
          {audit === undefined ? null : audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune action enregistrée.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {audit.map((e) => (
                <li
                  key={e._id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/60 px-3 py-1.5 text-xs"
                >
                  <span className="font-bold">{ACTION_LABEL[e.action] ?? e.action}</span>
                  <span className="text-muted-foreground">
                    {e.targetEmail ?? e.targetId}
                  </span>
                  <span className="text-muted-foreground">
                    par {e.actorLabel ?? "admin"} · {fmtDate(e.createdAt)}
                  </span>
                  {e.note && <span className="text-muted-foreground">— {e.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const role = useQuery(api.admin.myRole);
  // Identifiant du compte connecté : permet au panneau de repérer "vous"
  // (l'auto-retrait est refusé côté serveur, on masque donc le bouton).
  const me = useQuery(api.users.currentUser);
  // On ne souscrit la liste que si l'utilisateur est bien admin : sinon la
  // requête tournerait pour tout visiteur et lèverait une erreur côté serveur.
  const restaurateurs = useQuery(
    api.admin.listRestaurateurs,
    role === "admin" ? {} : "skip",
  );
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
      <AdminsPanel myUserId={me?._id ?? null} />

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
