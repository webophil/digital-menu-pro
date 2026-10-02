import { DashboardShell } from "@/components/DashboardShell";
import { MenuPreview } from "@/pages/PublicMenu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { isProSubscription } from "@/convex/plans";
import { cn } from "@/lib/utils";
import {
  AMBIANCES,
  CARD_STYLE_META,
  CARD_STYLE_VALUES,
  CATEGORY_STYLE_META,
  CATEGORY_STYLE_VALUES,
  DEFAULT_APPEARANCE,
  DIVIDER_META,
  DIVIDER_VALUES,
  FREE_AMBIANCE_IDS,
  HEADER_STYLE_META,
  HEADER_STYLE_VALUES,
  HEADING_FONT_VALUES,
  PHOTO_SHAPE_META,
  PHOTO_SHAPE_VALUES,
  PRICE_STYLE_META,
  PRICE_STYLE_VALUES,
  TEXTURE_META,
  TEXTURE_STYLES,
  TEXTURE_VALUES,
  BODY_FONT_VALUES,
  appearanceCssVars,
  bodyFont,
  defaultsForMode,
  findAmbiance,
  headingFont,
  resolveAppearance,
  shade,
  type AppearanceSettings,
  type CardStyle,
  type CategoryStyle,
  type Divider,
  type HeaderStyle,
  type Mode,
  type PhotoShape,
  type PriceStyle,
  type Texture,
} from "@/lib/theme";
import {
  Crown,
  ExternalLink,
  Flower2,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Type as TypeIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

// ---------- Briques d'interface ----------

/** Sceau « réservé aux Pro » affiché sur les options verrouillées du plan gratuit. */
function ProSeal({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-clay-deep px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-md",
        className,
      )}
    >
      <Crown className="size-3" /> Réservé aux Pro
    </span>
  );
}

function Panel({
  title,
  hint,
  icon,
  locked = false,
  children,
}: {
  title: string;
  hint?: string;
  icon: ReactNode;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="clay-card clay-flat gap-4 rounded-3xl border-0 p-5">
      <div className="flex items-center gap-3">
        <div className="clay-in flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-[Baloo_2] text-lg leading-tight font-extrabold">
            {title}
          </h2>
          {hint && (
            <p className="text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        {locked && <ProSeal />}
      </div>
      <CardContent className="p-0">
        {locked ? (
          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none select-none opacity-40 grayscale">
              {children}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/55 px-4 text-center">
              <ProSeal />
              <span className="text-[11px] font-semibold text-muted-foreground">
                Ambiances, couleurs et décor personnalisés
              </span>
            </div>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function OptionGrid<T extends string>({
  value,
  options,
  onChange,
  cols = 3,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; preview?: ReactNode }>;
  onChange: (next: T) => void;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        cols === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-col items-center justify-start gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold transition-all",
            value === o.value
              ? "clay-btn clay-teal text-white"
              : "clay-sm bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {o.preview && <span className="w-full">{o.preview}</span>}
          <span className="text-center leading-tight">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="clay-sm flex cursor-pointer items-center gap-3 rounded-2xl bg-card p-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-11 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0"
        aria-label={label}
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-[11px] tracking-wide text-muted-foreground uppercase">
          {value}
        </span>
        {hint && (
          <span className="block text-[11px] text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

// ---------- Page ----------

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
  const [accent2Manual, setAccent2Manual] = useState(false);
  const [busy, setBusy] = useState(false);

  // Première charge : null (aucune ligne en base) = apparence par défaut.
  useEffect(() => {
    if (settings === null && saved !== undefined) {
      setSettings(resolveAppearance(saved));
    }
  }, [saved, settings]);

  const dirty = useMemo(() => {
    if (!settings || saved === undefined) return false;
    return (
      JSON.stringify(settings) !== JSON.stringify(resolveAppearance(saved))
    );
  }, [settings, saved]);

  const hasCustom = useMemo(() => {
    if (saved === undefined) return false;
    return (
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

  const changeAccent = (accent: string) => {
    setSettings((s) => {
      const cur = s ?? DEFAULT_APPEARANCE;
      return {
        ...cur,
        accent,
        // La couleur secondaire suit l'accent tant qu'elle n'a pas été
        // choisie manuellement : le dégradé reste harmonieux.
        accent2: accent2Manual ? cur.accent2 : shade(accent, -0.28),
      };
    });
  };

  const applyAmbiance = (settings2: AppearanceSettings) => {
    setSettings({ ...settings2 });
    setAccent2Manual(false);
  };

  const onSave = async () => {
    if (!restaurant || !settings) return;
    setBusy(true);
    try {
      await save({ restaurantId: restaurant._id, ...settings });
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
      setAccent2Manual(false);
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
            Créez d'abord votre établissement, puis revenez habiller votre
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
  const varsRecord = appearanceCssVars(settings);
  const ambiance = findAmbiance(settings);

  const headerBgFor = (hs: HeaderStyle) =>
    appearanceCssVars({ ...settings, headerStyle: hs })["--m-header-bg"];

  const dividerOptions = DIVIDER_VALUES.map((d: Divider) => ({
    value: d,
    label: DIVIDER_META[d].label,
    preview: (
      <span className="flex h-5 items-center justify-center text-sm">
        {DIVIDER_META[d].glyph}
      </span>
    ),
  }));

  const categoryPreviews: Record<CategoryStyle, ReactNode> = {
    left: (
      <span className="flex w-full flex-col gap-1 rounded-lg bg-muted/70 px-2 py-2">
        <span className="h-1.5 w-3/4 rounded-full bg-current" />
        <span className="h-1 w-1/2 rounded-full bg-current" />
      </span>
    ),
    center: (
      <span className="flex w-full flex-col items-center gap-1 rounded-lg bg-muted/70 px-2 py-2">
        <span className="h-1.5 w-2/3 rounded-full bg-current" />
        <span className="h-1 w-1/3 rounded-full bg-current" />
      </span>
    ),
    framed: (
      <span className="m-frame flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2">
        <span className="h-1.5 w-2/3 rounded-full bg-current" />
        <span className="h-1 w-1/3 rounded-full bg-current" />
      </span>
    ),
  };

  const cardPreviews: Record<CardStyle, ReactNode> = {
    clay: <span className="block h-9 w-full rounded-lg bg-muted clay-flat" />,
    flat: <span className="block h-9 w-full rounded-lg bg-muted m-card-flat" />,
    outline: (
      <span className="block h-9 w-full rounded-lg bg-muted m-card-outline" />
    ),
    plain: <span className="block h-9 w-full rounded-lg bg-muted m-card-plain" />,
  };

  const pricePreviews: Record<PriceStyle, ReactNode> = {
    accent: (
      <span
        className="font-[Baloo_2] text-sm font-extrabold"
        style={{ color: varsRecord["--m-price"] }}
      >
        12,50 €
      </span>
    ),
    plain: (
      <span className="font-[Baloo_2] text-sm font-extrabold" style={{ color: settings.text }}>
        12,50 €
      </span>
    ),
    pill: (
      <span
        className="font-[Baloo_2] rounded-full px-2.5 py-0.5 text-xs font-extrabold"
        style={{
          background: varsRecord["--m-pill-bg"],
          color: varsRecord["--m-pill-text"],
        }}
      >
        12,50 €
      </span>
    ),
  };

  const photoPreviews: Record<PhotoShape, ReactNode> = {
    rounded: (
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-base">
        🍽️
      </span>
    ),
    circle: (
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted text-base">
        🍽️
      </span>
    ),
    square: (
      <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-md bg-muted text-base">
        🍽️
      </span>
    ),
  };

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
                  Réinitialiser l'apparence ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Vos couleurs, polices et choix de décor repasseront au look
                  d'origine V'la le Menu ! Le menu public est mis à jour dès
                  l'enregistrement.
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
                <div className="max-h-[70vh] overflow-y-auto lg:max-h-[calc(100vh-14rem)]">
                  <MenuPreview
                    restaurant={restaurant}
                    menus={menus ?? undefined}
                    appearance={settings}
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
          {/* Bandeau plan gratuit */}
          {!pro && (
            <div className="clay-butter clay-flat flex flex-wrap items-center gap-3 rounded-3xl p-4 text-sm">
              <Sparkles className="size-5 shrink-0 text-[oklch(0.5_0.1_70)]" />
              <p className="flex-1 text-[oklch(0.38_0.07_70)]">
                <strong>Plan Gratuit :</strong> 3 ambiances au choix. Passez au
                Pro pour débloquer les 8 ambiances et la personnalisation
                complète (couleurs, polices, décor).
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

          {/* Ambiances */}
          <Panel
            title="Ambiances"
            hint={
              pro
                ? "Un look complet (couleurs + polices + décor) en un clic."
                : "3 ambiances offertes — les 5 autres sont réservées au plan Pro."
            }
            icon={<Sparkles className="size-5 text-clay-deep" />}
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {AMBIANCES.map((a) => {
                const active = ambiance?.id === a.id;
                const locked = !pro && !FREE_AMBIANCE_IDS.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        toast.info(
                          "Réservé au plan Pro : passez au Pro pour débloquer cette ambiance.",
                        );
                        return;
                      }
                      applyAmbiance(a.settings);
                    }}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-2xl p-2.5 text-center transition-all",
                      active
                        ? "clay-btn clay-teal text-white"
                        : "clay-sm bg-card hover:-translate-y-0.5",
                      locked && "cursor-not-allowed opacity-70 grayscale hover:translate-y-0",
                    )}
                  >
                    <span
                      className="flex h-9 w-full items-center justify-center rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${a.settings.accent}, ${a.settings.accent2})`,
                      }}
                    >
                      <span
                        className="size-3.5 rounded-full border-2 border-white/85"
                        style={{ background: a.settings.background }}
                      />
                    </span>
                    <span className="text-xs leading-tight font-bold">
                      {a.emoji} {a.name}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] leading-tight",
                        active ? "text-white/80" : "text-muted-foreground",
                      )}
                    >
                      {a.blurb}
                    </span>
                    {locked && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/60">
                        <ProSeal className="scale-[0.85]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Couleurs */}
          <Panel
            title="Couleurs"
            hint="Jeu de couleurs sur mesure, du fond jusqu'aux prix."
            icon={<Palette className="size-5 text-clay-deep" />}
            locked={!pro}
          >
            <div className="space-y-4">
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={cn(
                      "flex-1 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all",
                      settings.mode === m
                        ? "clay-btn clay-teal text-white"
                        : "clay-sm bg-card text-muted-foreground",
                    )}
                  >
                    {m === "light" ? " Clair" : " Sombre"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Le basculement remet le fond, les cartes et le texte aux valeurs
                standard du mode — vos couleurs d'accent sont conservées.
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <ColorField
                  label="Couleur principale"
                  hint="En-tête, boutons, prix"
                  value={settings.accent}
                  onChange={changeAccent}
                />
                <ColorField
                  label="Couleur secondaire"
                  hint="Fin du dégradé de l'en-tête"
                  value={settings.accent2}
                  onChange={(v) => {
                    setAccent2Manual(true);
                    patch({ accent2: v });
                  }}
                />
                <ColorField
                  label="Fond de page"
                  value={settings.background}
                  onChange={(v) => patch({ background: v })}
                />
                <ColorField
                  label="Cartes & panneaux"
                  value={settings.surface}
                  onChange={(v) => patch({ surface: v })}
                />
                <ColorField
                  label="Texte principal"
                  value={settings.text}
                  onChange={(v) => patch({ text: v })}
                />
              </div>
            </div>
          </Panel>

          {/* Typographie */}
          <Panel
            title="Typographie"
            hint="Des polices sélectionnées pour la lecture sur mobile."
            icon={<TypeIcon className="size-5 text-clay-deep" />}
            locked={!pro}
          >
            <div className="space-y-4">
              <div>
                <SubTitle>Police des titres</SubTitle>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {HEADING_FONT_VALUES.map((id) => {
                    const f = headingFont(id);
                    const active = settings.headingFont === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => patch({ headingFont: id })}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl px-3 py-3 transition-all",
                          active
                            ? "clay-btn clay-teal text-white"
                            : "clay-sm bg-card",
                        )}
                      >
                        <span
                          className="w-full truncate text-center text-lg leading-tight"
                          style={{
                            fontFamily: f.stack,
                            fontWeight: f.headWeight,
                          }}
                        >
                          Notre carte
                        </span>
                        <span
                          className="text-[10px] leading-tight"
                          style={{
                            fontFamily: '"Quicksand", ui-sans-serif, sans-serif',
                            color: active
                              ? "rgba(255,255,255,0.8)"
                              : "var(--muted-foreground)",
                          }}
                        >
                          {f.name} · {f.blurb}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <SubTitle>Police du texte</SubTitle>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BODY_FONT_VALUES.map((id) => {
                    const f = bodyFont(id);
                    const active = settings.bodyFont === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => patch({ bodyFont: id })}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl px-3 py-3 transition-all",
                          active
                            ? "clay-btn clay-teal text-white"
                            : "clay-sm bg-card",
                        )}
                      >
                        <span
                          className="w-full truncate text-center text-sm font-semibold"
                          style={{ fontFamily: f.stack }}
                        >
                          Menu du jour
                        </span>
                        <span
                          className="text-[10px] leading-tight"
                          style={{
                            fontFamily: '"Quicksand", ui-sans-serif, sans-serif',
                            color: active
                              ? "rgba(255,255,255,0.8)"
                              : "var(--m-muted-foreground)",
                          }}
                        >
                          {f.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
                <div>
                  <Label htmlFor="upper" className="cursor-pointer font-bold">
                    Titres en majuscules
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    EX. ENTRÉES · PLATS · DESSERTS
                  </p>
                </div>
                <Switch
                  id="upper"
                  checked={settings.headingCase === "uppercase"}
                  onCheckedChange={(c) =>
                    patch({ headingCase: c ? "uppercase" : "normal" })
                  }
                />
              </div>
            </div>
          </Panel>

          {/* Décor & finitions */}
          <Panel
            title="Décor & finitions"
            hint="Fioritures, cadres, textures : le détail qui change tout."
            icon={<Flower2 className="size-5 text-clay-deep" />}
            locked={!pro}
          >
            <div className="space-y-5" style={vars}>
              <div>
                <SubTitle>Séparateurs (fioritures)</SubTitle>
                <OptionGrid
                  value={settings.divider}
                  options={dividerOptions}
                  onChange={(d: Divider) => patch({ divider: d })}
                  cols={3}
                />
              </div>
              <div>
                <SubTitle>Titres de catégories</SubTitle>
                <OptionGrid
                  value={settings.categoryStyle}
                  options={CATEGORY_STYLE_VALUES.map((c: CategoryStyle) => ({
                    value: c,
                    label: CATEGORY_STYLE_META[c],
                    preview: categoryPreviews[c],
                  }))}
                  onChange={(c: CategoryStyle) => patch({ categoryStyle: c })}
                />
              </div>
              <div>
                <SubTitle>Cadres des catégories</SubTitle>
                <OptionGrid
                  value={settings.cardStyle}
                  options={CARD_STYLE_VALUES.map((c: CardStyle) => ({
                    value: c,
                    label: CARD_STYLE_META[c],
                    preview: cardPreviews[c],
                  }))}
                  onChange={(c: CardStyle) => patch({ cardStyle: c })}
                />
              </div>
              <div>
                <SubTitle>Affichage des prix</SubTitle>
                <OptionGrid
                  value={settings.priceStyle}
                  options={PRICE_STYLE_VALUES.map((p: PriceStyle) => ({
                    value: p,
                    label: PRICE_STYLE_META[p],
                    preview: (
                      <span className="flex h-7 items-center justify-center">
                        {pricePreviews[p]}
                      </span>
                    ),
                  }))}
                  onChange={(p: PriceStyle) => patch({ priceStyle: p })}
                />
              </div>
              <div>
                <SubTitle>En-tête du menu</SubTitle>
                <OptionGrid
                  value={settings.headerStyle}
                  options={HEADER_STYLE_VALUES.map((h: HeaderStyle) => ({
                    value: h,
                    label: HEADER_STYLE_META[h],
                    preview: (
                      <span
                        className="block h-8 w-full rounded-lg"
                        style={{ background: headerBgFor(h) }}
                      />
                    ),
                  }))}
                  onChange={(h: HeaderStyle) => patch({ headerStyle: h })}
                />
              </div>
              <div>
                <SubTitle>Texture de fond</SubTitle>
                <OptionGrid
                  value={settings.texture}
                  options={TEXTURE_VALUES.map((t: Texture) => {
                    const tex = TEXTURE_STYLES[t];
                    return {
                      value: t,
                      label: TEXTURE_META[t],
                      preview: (
                        <span
                          className="block h-8 w-full rounded-lg"
                          style={{
                            backgroundColor: settings.background,
                            backgroundImage: tex?.backgroundImage,
                            backgroundSize: tex?.backgroundSize,
                          }}
                        />
                      ),
                    };
                  })}
                  onChange={(t: Texture) => patch({ texture: t })}
                />
              </div>
              <div>
                <SubTitle>Forme des photos de plats</SubTitle>
                <OptionGrid
                  value={settings.photoShape}
                  options={PHOTO_SHAPE_VALUES.map((p: PhotoShape) => ({
                    value: p,
                    label: PHOTO_SHAPE_META[p],
                    preview: photoPreviews[p],
                  }))}
                  onChange={(p: PhotoShape) => patch({ photoShape: p })}
                />
              </div>
            </div>
          </Panel>

          <p className="pb-2 text-center text-xs text-muted-foreground">
            Les modifications s'appliquent immédiatement à l'aperçu — pensez à{" "}
            <span className="font-bold text-foreground">Enregistrer</span> pour
            les publier sur le menu public.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
