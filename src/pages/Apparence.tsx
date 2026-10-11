import { AmbiancesPanel } from "@/components/appearance/AmbiancesPanel";
import { CategoriesPanel } from "@/components/appearance/CategoriesPanel";
import { ColorsPanel } from "@/components/appearance/ColorsPanel";
import { DishesPanel } from "@/components/appearance/DishesPanel";
import { FixedElementsPanel } from "@/components/appearance/FixedElementsPanel";
import { HeaderPanel } from "@/components/appearance/HeaderPanel";
import {
  zoneDiffers,
  zonePatch,
  type ZoneId,
} from "@/components/appearance/zones";
import { DashboardShell } from "@/components/DashboardShell";
import { MenuPreview } from "@/pages/PublicMenu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isProSubscription } from "@/convex/plans";
import {
  AMBIANCES,
  DEFAULT_APPEARANCE,
  appearanceCssVars,
  defaultsForMode,
  getAmbiance,
  resolveAppearance,
  shade,
  type Ambiance,
  type AppearanceSettings,
  type Mode,
} from "@/lib/theme";
import {
  Crown,
  ExternalLink,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type ScrollZone = Exclude<ZoneId, "ambiances" | "colors">;
type EditableZone = Exclude<ZoneId, "ambiances">;

export default function Apparence() {
  const profile = useQuery(api.account.getMyProfile);
  const sub = useQuery(api.billing.getMySubscription);
  const pro = isProSubscription(sub);
  const restaurant = profile?.restaurant ?? null;
  const saved = useQuery(
    api.appearance.getMyAppearance,
    restaurant ? { restaurantId: restaurant._id } : "skip",
  );
  const menus = useQuery(
    api.publicMenu.getPublicMenus,
    restaurant ? { restaurantId: restaurant._id } : "skip",
  );
  const save = useMutation(api.appearance.saveAppearance);
  const reset = useMutation(api.appearance.resetAppearance);

  const [settings, setSettings] = useState<AppearanceSettings | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  // undefined = logo inchangé, null = retiré, id = nouveau fichier téléversé.
  const [pendingLogo, setPendingLogo] = useState<Id<"_storage"> | null | undefined>(
    undefined,
  );
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewScrollRef = useRef<HTMLDivElement>(null);
  const lastZoneRef = useRef<ScrollZone | null>(null);

  // Première charge : null (aucune ligne en base) = apparence par défaut.
  useEffect(() => {
    if (settings === null && saved !== undefined) {
      setSettings(resolveAppearance(saved));
      setBaseId(saved?.ambianceId ?? null);
    }
  }, [saved, settings]);

  const savedLogoUrl = saved?.logoUrl ?? null;
  const logoUrl = pendingLogo === undefined ? savedLogoUrl : pendingLogoUrl;

  const dirty = useMemo(() => {
    if (!settings || saved === undefined) return false;
    return (
      pendingLogo !== undefined ||
      baseId !== (saved?.ambianceId ?? null) ||
      JSON.stringify(settings) !== JSON.stringify(resolveAppearance(saved))
    );
  }, [settings, saved, baseId, pendingLogo]);

  const hasCustom = useMemo(() => {
    if (saved === undefined) return false;
    return (
      Boolean(saved?.logoUrl) ||
      JSON.stringify(resolveAppearance(saved)) !==
        JSON.stringify(DEFAULT_APPEARANCE)
    );
  }, [saved]);

  // Évite de perdre des réglages non enregistrés en fermant l'onglet.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patch = (p: Partial<AppearanceSettings>) =>
    setSettings((s) => ({ ...(s ?? DEFAULT_APPEARANCE), ...p }));

  const switchMode = (mode: Mode) => {
    const d = defaultsForMode(mode);
    patch({ mode, background: d.background, surface: d.surface, text: d.text });
  };

  const changeAccent = (accent: string) =>
    patch({ accent, accent2: shade(accent, -0.28) });

  const applyAmbiance = (a: Ambiance) => {
    setSettings({ ...a.settings });
    setBaseId(a.id);
  };

  const base = getAmbiance(baseId);

  const resetZone = (zone: EditableZone) => {
    if (!base) return;
    patch(zonePatch(zone, base.settings));
  };

  const zoneReset = (zone: EditableZone) =>
    settings && base && zoneDiffers(zone, settings, base.settings)
      ? () => resetZone(zone)
      : undefined;

  // Fait défiler l'aperçu vers la zone en cours d'édition (une fois par zone).
  const focusZone = (zone: ScrollZone) => {
    if (lastZoneRef.current === zone) return;
    lastZoneRef.current = zone;
    const container = previewScrollRef.current;
    if (!container) return;
    if (zone === "header") {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = container.querySelector<HTMLElement>(`[data-zone="${zone}"]`);
    if (!target) return;
    const top =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      8;
    container.scrollTo({ top, behavior: "smooth" });
  };

  const onLogoChange = (
    storageId: Id<"_storage"> | null,
    previewUrl: string | null,
  ) => {
    setPendingLogo(storageId);
    setPendingLogoUrl(previewUrl);
    // Un logo téléversé est utilisé tout de suite ; le retirer ramène l'icône.
    if (storageId) patch({ headerMark: "logo" });
  };

  const onSave = async () => {
    if (!restaurant || !settings) return;
    setBusy(true);
    try {
      await save({
        restaurantId: restaurant._id,
        ...settings,
        ambianceId: baseId ?? undefined,
        ...(pendingLogo !== undefined ? { logoStorageId: pendingLogo } : {}),
      });
      setPendingLogo(undefined);
      setPendingLogoUrl(null);
      toast.success("Apparence enregistrée ! Vos clients la voient en direct.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    if (!restaurant) return;
    setBusy(true);
    try {
      await reset({ restaurantId: restaurant._id });
      setSettings(resolveAppearance(null));
      setBaseId(null);
      setPendingLogo(undefined);
      setPendingLogoUrl(null);
      toast.success("Apparence réinitialisée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Écrans de chargement / absence d'établissement ----------

  if (profile === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!profile || !restaurant) {
    return (
      <DashboardShell
        title="Apparence"
        subtitle="Personnalisez le menu que voient vos clients."
      >
        <Card className="clay-card clay-flat rounded-3xl border-0 p-8 text-center">
          <p className="font-bold">Aucun établissement pour le moment.</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Créez d&apos;abord votre établissement, puis revenez habiller votre
            menu.
          </p>
          <Button
            asChild
            className="clay-btn clay-teal rounded-2xl font-bold text-white"
          >
            <Link to="/dashboard">Aller au dashboard</Link>
          </Button>
        </Card>
      </DashboardShell>
    );
  }

  if (!settings) {
    return (
      <DashboardShell
        title="Apparence"
        subtitle="Personnalisez le menu que voient vos clients."
      >
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }

  // ---------- Éditeur ----------

  const vars = appearanceCssVars(settings) as CSSProperties;

  return (
    <DashboardShell
      title="Apparence"
      subtitle="Habillez le menu que voient vos clients sur leur téléphone."
      actions={
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="clay-sm rounded-2xl border-0 bg-card font-bold"
                disabled={busy || (!dirty && !hasCustom)}
              >
                <RotateCcw className="size-4" /> Réinitialiser
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="clay-card clay-flat rounded-3xl border-0">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-[Baloo_2]">
                  Réinitialiser l&apos;apparence ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Vos couleurs, polices, votre logo et vos choix de décor
                  repasseront au look d&apos;origine V&apos;la le Menu ! Le menu
                  public est mis à jour dès la réinitialisation.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-2xl border-0 bg-muted font-bold">
                  Annuler
                </AlertDialogCancel>
                <AlertDialogAction
                  className="clay-btn h-10 rounded-2xl bg-destructive font-bold text-white hover:bg-destructive/90"
                  onClick={() => void onReset()}
                >
                  Réinitialiser
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            asChild
            variant="outline"
            className="clay-sm rounded-2xl border-0 bg-card font-bold"
          >
            <a href={`/m/${restaurant.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Voir le menu client
            </a>
          </Button>
          <Button
            className="clay-btn clay-teal rounded-2xl font-bold text-white"
            disabled={!dirty || busy}
            onClick={() => void onSave()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---- Aperçu téléphone ---- */}
        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-28">
            <div className="clay-card clay rounded-[2.25rem] border-0 p-2.5">
              <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-muted" />
              <div className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-background">
                <div
                  ref={previewScrollRef}
                  className="max-h-[70vh] overflow-y-auto lg:max-h-[calc(100vh-14rem)]"
                >
                  <MenuPreview
                    restaurant={restaurant}
                    menus={menus ?? undefined}
                    appearance={{ ...settings, logoUrl }}
                    className="flex w-full flex-col"
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Aperçu en direct — exactement ce que voient vos clients.
            </p>
          </div>
        </div>

        {/* ---- Panneaux de configuration ---- */}
        <div className="order-2 space-y-5 lg:order-1">
          {!pro && (
            <div className="clay-butter clay-flat flex flex-wrap items-center gap-3 rounded-3xl p-4 text-sm">
              <Sparkles className="size-5 shrink-0 text-[oklch(0.5_0.1_70)]" />
              <p className="flex-1 text-[oklch(0.38_0.07_70)]">
                <strong>Plan Gratuit :</strong> 3 ambiances au choix. Passez au
                Pro pour débloquer les {AMBIANCES.length} ambiances et la
                personnalisation complète (en-tête et logo, couleurs, polices,
                décor).
              </p>
              <Button
                asChild
                size="sm"
                className="rounded-2xl bg-white font-bold text-clay-deep hover:bg-white/90"
              >
                <Link to="/subscription">
                  <Crown className="size-4" /> Passer Pro
                </Link>
              </Button>
            </div>
          )}

          <AmbiancesPanel
            pro={pro}
            settings={settings}
            baseId={baseId}
            sampleName={restaurant.name}
            onApply={applyAmbiance}
          />

          <ColorsPanel
            settings={settings}
            pro={pro}
            onSwitchMode={switchMode}
            onAccent={changeAccent}
            onPatch={patch}
            onResetZone={zoneReset("colors")}
          />

          <HeaderPanel
            settings={settings}
            pro={pro}
            vars={vars}
            restaurantName={restaurant.name}
            logoUrl={logoUrl}
            onPatch={patch}
            onLogoChange={onLogoChange}
            onResetZone={zoneReset("header")}
            onActivate={() => focusZone("header")}
          />

          <CategoriesPanel
            settings={settings}
            pro={pro}
            vars={vars}
            onPatch={patch}
            onResetZone={zoneReset("categories")}
            onActivate={() => focusZone("categories")}
          />

          <DishesPanel
            settings={settings}
            pro={pro}
            vars={vars}
            onPatch={patch}
            onResetZone={zoneReset("dishes")}
            onActivate={() => focusZone("dishes")}
          />

          <FixedElementsPanel />
        </div>
      </div>
    </DashboardShell>
  );
}
