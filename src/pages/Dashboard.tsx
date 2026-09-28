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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardShell } from "@/components/DashboardShell";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { isProSubscription, PLANS } from "@/convex/plans";
import { establishmentTypeLabel, menuTypeLabel } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { api as apiRoot } from "@/convex/_generated/api";
import {
  BookOpen,
  Copy,
  Crown,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  Sparkles,
  Store,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

function Onboarding() {
  const create = useMutation(api.restaurants.createRestaurant);
  const [name, setName] = useState("");
  const [type, setType] = useState("restaurant");
  const [city, setCity] = useState("");
  const [tagline, setTagline] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Donnez un nom à votre établissement.");
      return;
    }
    setBusy(true);
    try {
      await create({
        name: name.trim(),
        establishmentType: type as any,
        city: city.trim() || undefined,
        tagline: tagline.trim() || undefined,
      });
      toast.success("Bon appétit ! Votre espace est prêt 🎉");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <Card className="clay-card clay rounded-3xl border-0 shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-3xl bg-[oklch(0.91_0.09_95)]">
            <Store className="size-7 text-[oklch(0.45_0.09_70)]" />
          </div>
          <CardTitle className="font-[Baloo_2] text-2xl">
            Créez votre établissement
          </CardTitle>
          <CardDescription>
            Bienvenue ! Quelques infos et votre menu digital prend vie.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="r-name">Nom de l'établissement *</Label>
            <Input
              id="r-name"
              className="clay-in h-11 rounded-2xl border-0 bg-muted"
              placeholder="Chez Marcel"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Type d'établissement</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="clay-in h-11 w-full rounded-2xl border-0 bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-0">
                {[
                  { value: "restaurant", label: "🍽️ Restaurant" },
                  { value: "brasserie", label: "🍺 Brasserie" },
                  { value: "foodtruck", label: "🚚 Food truck" },
                  { value: "cafe", label: "☕ Café" },
                  { value: "pizzeria", label: "🍕 Pizzeria" },
                  { value: "bar", label: "🍸 Bar" },
                  { value: "traiteur", label: "🧺 Traiteur" },
                  { value: "glacier", label: "🍦 Glacier" },
                  { value: "autre", label: "🍴 Autre" },
                ].map((t) => (
                  <SelectItem key={t.value} value={t.value} className="rounded-xl">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="r-city">Ville</Label>
            <Input
              id="r-city"
              className="clay-in h-11 rounded-2xl border-0 bg-muted"
              placeholder="Paris"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="r-tagline">Petite phrase d'accroche</Label>
            <Input
              id="r-tagline"
              className="clay-in h-11 rounded-2xl border-0 bg-muted"
              placeholder="Cuisine maison & produits frais"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>
          <Button
            className="clay-btn clay-teal h-12 rounded-2xl font-bold text-white"
            disabled={busy}
            onClick={submit}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Créer mon espace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NewMenuDialog({ restaurantId, disabled }: { restaurantId: Id<"restaurants">; disabled?: boolean }) {
  const create = useMutation(api.restaurants.createMenu);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [menuType, setMenuType] = useState("carte");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await create({ restaurantId, name: name.trim(), menuType });
      toast.success("Menu créé !");
      setOpen(false);
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="clay-btn clay-teal rounded-2xl font-bold text-white" disabled={disabled}>
          <Plus className="size-4" /> Nouveau menu
        </Button>
      </DialogTrigger>
      <DialogContent className="clay-card rounded-3xl border-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-[Baloo_2]">Nouveau menu</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="m-name">Nom du menu</Label>
            <Input
              id="m-name"
              className="clay-in h-11 rounded-2xl border-0 bg-muted"
              placeholder="Menu du jour"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={menuType} onValueChange={setMenuType}>
              <SelectTrigger className="clay-in h-11 w-full rounded-2xl border-0 bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-0">
                {[
                  { value: "carte", label: "Carte" },
                  { value: "menu-du-jour", label: "Menu du jour" },
                  { value: "soir", label: "Carte du soir" },
                  { value: "enfants", label: "Menu enfants" },
                  { value: "boissons", label: "Boissons" },
                  { value: "autre", label: "Autre" },
                ].map((t) => (
                  <SelectItem key={t.value} value={t.value} className="rounded-xl">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="clay-btn clay-teal w-full rounded-2xl font-bold text-white"
            onClick={submit}
            disabled={busy || !name.trim()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Créer le menu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { isLoading } = useAuth();
  const navigate = useNavigate();
  const restaurants = useQuery(api.restaurants.listMyRestaurants, isLoading ? "skip" : {});
  const restaurant = restaurants?.[0] as Doc<"restaurants"> | undefined;
  const menus = useQuery(
    api.restaurants.listMenus,
    restaurant ? { restaurantId: restaurant._id } : "skip",
  );
  const visibleMenus = menus ?? [];
  const seed = useMutation(api.restaurants.seedDemoMenu);
  const sub = useQuery(api.billing.getMySubscription);
  const pro = isProSubscription(sub);

  useEffect(() => {
    if (!isLoading && restaurants !== undefined && restaurants.length === 0) {
      // l'onboarding s'affiche à la place
    }
  }, [isLoading, restaurants]);

  if (restaurants === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (restaurants.length === 0) {
    return (
      <DashboardShell title="Bienvenue sur V'la le Menu !" subtitle="Configurons votre établissement en 30 secondes.">
        <Onboarding />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={restaurant!.name}
      subtitle={`${establishmentTypeLabel(restaurant!.establishmentType)}${restaurant!.city ? ` · ${restaurant!.city}` : ""} · Lien public : /m/${restaurant!.slug}`}
      actions={
        <>
          <Button
            variant="outline"
            className="clay-sm rounded-2xl border-0 bg-card font-bold"
            onClick={() => {
              const url = `${window.location.origin}/m/${restaurant!.slug}`;
              navigator.clipboard
                .writeText(url)
                .then(() => toast.success("Lien public copié !"))
                .catch(() => toast.error("Copie impossible"));
            }}
          >
            <Copy className="size-4" /> Copier le lien client
          </Button>
          <Button
            variant="outline"
            className="clay-sm rounded-2xl border-0 bg-card font-bold"
            onClick={() => navigate(`/m/${restaurant!.slug}`)}
          >
            <ExternalLink className="size-4" /> Voir le menu client
          </Button>
          <NewMenuDialog restaurantId={restaurant!._id} />
        </>
      }
    >
      {visibleMenus === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : visibleMenus.length === 0 ? (
        <Card className="clay-card clay-flat rounded-3xl border-0">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="clay-in flex size-14 items-center justify-center rounded-3xl bg-muted">
              <BookOpen className="size-6 text-muted-foreground" />
            </div>
            <p className="font-bold">Aucun menu pour l'instant</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Créez votre premier menu, ou chargez un menu de démonstration pour
              voir à quoi ressemblera le menu de vos clients.
            </p>
            <Button
              variant="outline"
              className="clay-sm rounded-2xl border-0 bg-muted font-bold"
              onClick={async () => {
                try {
                  await seed({ restaurantId: restaurant!._id });
                  toast.success("Menu de démonstration ajouté !");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erreur");
                }
              }}
            >
              <Sparkles className="size-4" /> Charger un menu de démo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMenus.map((m) => (
            <Card key={m._id} className="clay-card clay-flat gap-3 rounded-3xl border-0 py-5">
              <CardHeader className="px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-[Baloo_2] text-xl">{m.name}</CardTitle>
                  <Badge className="clay-in rounded-full border-0 bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                    {menuTypeLabel(m.menuType)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 px-5">
                <div className="flex-1" />
                <div className="flex gap-2">
                  <Button asChild className="clay-btn clay-teal h-9 flex-1 rounded-2xl text-sm font-bold text-white">
                    <Link to={`/menu/${m._id}`}>
                      <Pencil className="size-3.5" /> Éditer
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="clay-sm h-9 flex-1 rounded-2xl border-0 bg-card text-sm font-bold">
                    <Link to={`/qr/${m._id}`}>
                      <QrCode className="size-3.5" /> QR code
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!pro && visibleMenus.length >= PLANS.FREE.maxMenus && (
            <Card className="clay-butter clay-flat flex items-center justify-center rounded-3xl border-0 p-6">
              <div className="text-center">
                <Crown className="mx-auto mb-2 size-6 text-[oklch(0.5_0.1_70)]" />
                <p className="font-bold">Limite du plan Gratuit atteinte</p>
                <p className="mt-1 mb-3 text-sm text-[oklch(0.42_0.07_70)]">
                  Menus illimités et traduction auto avec le plan Pro.
                </p>
                <Button asChild size="sm" className="rounded-2xl bg-white font-bold text-clay-deep hover:bg-white/90">
                  <Link to="/subscription">Découvrir le plan Pro</Link>
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
