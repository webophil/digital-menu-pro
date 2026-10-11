import { cn } from "@/lib/utils";
import {
  AMBIANCES,
  FREE_AMBIANCE_IDS,
  appearanceCssVars,
  getAmbiance,
  sameAppearance,
  type Ambiance,
  type AppearanceSettings,
} from "@/lib/theme";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Panel, ProSeal } from "./ui";

/** Vignette : l'en-tête avec la police du nom, puis un titre de catégorie. */
function AmbianceThumb({
  ambiance,
  sampleName,
}: {
  ambiance: Ambiance;
  sampleName: string;
}) {
  const s = ambiance.settings;
  const vars = appearanceCssVars(s);
  return (
    <span
      className="block w-full overflow-hidden rounded-xl text-left"
      style={{ background: s.background }}
    >
      <span
        className={cn(
          "block truncate px-2 py-1.5 text-sm leading-tight",
          s.headerAlign === "center" && "text-center",
        )}
        style={{
          background: vars["--m-header-bg"],
          color: vars["--m-on-header"],
          fontFamily: vars["--m-font-brand"],
          fontWeight: Number(vars["--m-brand-weight"]),
          textTransform: s.headerCase === "uppercase" ? "uppercase" : "none",
        }}
      >
        {sampleName}
      </span>
      <span className="flex items-center justify-between gap-1 px-2 py-1.5">
        <span
          className="truncate text-[11px] leading-tight"
          style={{
            color: s.text,
            fontFamily: vars["--m-font-head"],
            fontWeight: Number(vars["--m-head-weight"]),
            textTransform: s.headingCase === "uppercase" ? "uppercase" : "none",
          }}
        >
          Entrées
        </span>
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: s.accent }}
        />
      </span>
    </span>
  );
}

export function AmbiancesPanel({
  pro,
  settings,
  baseId,
  sampleName,
  onApply,
  onActivate,
}: {
  pro: boolean;
  settings: AppearanceSettings;
  baseId: string | null;
  sampleName: string;
  onApply: (ambiance: Ambiance) => void;
  onActivate?: () => void;
}) {
  const base = getAmbiance(baseId);
  const customized = base ? !sameAppearance(settings, base.settings) : false;

  return (
    <Panel
      title="Ambiances"
      hint={
        pro
          ? "Un point de départ complet : modifiez ensuite chaque zone librement."
          : "3 ambiances offertes — les autres sont réservées au plan Pro."
      }
      icon={<Sparkles className="size-5 text-clay-deep" />}
      onActivate={onActivate}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {AMBIANCES.map((a) => {
            const active = base?.id === a.id;
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
                  onApply(a);
                }}
                className={cn(
                  "relative flex flex-col items-stretch gap-1.5 rounded-2xl p-2 text-center transition-all",
                  active
                    ? "clay-btn clay-teal text-white"
                    : "clay-sm bg-card hover:-translate-y-0.5",
                  locked && "cursor-not-allowed opacity-70 grayscale hover:translate-y-0",
                )}
              >
                <AmbianceThumb ambiance={a} sampleName={sampleName} />
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
        <p className="text-xs text-muted-foreground">
          {base ? (
            customized ? (
              <>
                <strong className="text-foreground">Personnalisée</strong> — base :{" "}
                {base.name}. Chaque panneau propose de revenir à cette ambiance, zone
                par zone.
              </>
            ) : (
              <>
                Ambiance appliquée :{" "}
                <strong className="text-foreground">{base.name}</strong>.
              </>
            )
          ) : (
            <strong className="text-foreground">Personnalisée</strong>
          )}
        </p>
      </div>
    </Panel>
  );
}
