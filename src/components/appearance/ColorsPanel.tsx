import { cn } from "@/lib/utils";
import {
  TEXTURE_META,
  TEXTURE_STYLES,
  TEXTURE_VALUES,
  type AppearanceSettings,
  type Mode,
  type Texture,
} from "@/lib/theme";
import { Palette } from "lucide-react";
import { ColorField, OptionGrid, Panel, SubTitle } from "./ui";

export function ColorsPanel({
  settings,
  pro,
  onSwitchMode,
  onAccent,
  onPatch,
  onResetZone,
  onActivate,
}: {
  settings: AppearanceSettings;
  pro: boolean;
  onSwitchMode: (mode: Mode) => void;
  onAccent: (accent: string) => void;
  onPatch: (p: Partial<AppearanceSettings>) => void;
  onResetZone?: () => void;
  onActivate?: () => void;
}) {
  return (
    <Panel
      title="Couleurs & fond"
      hint="La palette de la page : fond, cartes, texte et couleur d'accent."
      icon={<Palette className="size-5 text-clay-deep" />}
      locked={!pro}
      lockedLabel="Couleurs et textures sur mesure"
      onResetZone={onResetZone}
      onActivate={onActivate}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSwitchMode(m)}
              className={cn(
                "flex-1 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all",
                settings.mode === m
                  ? "clay-btn clay-teal text-white"
                  : "clay-sm bg-card text-muted-foreground",
              )}
            >
              {m === "light" ? "Clair" : "Sombre"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Le basculement remet le fond, les cartes et le texte aux valeurs
          standard du mode. L&apos;accent et l&apos;en-tête ne changent pas.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <ColorField
            label="Couleur d'accent"
            hint="Onglet actif, prix, fioritures"
            value={settings.accent}
            onChange={onAccent}
          />
          <ColorField
            label="Fond de page"
            value={settings.background}
            onChange={(v) => onPatch({ background: v })}
          />
          <ColorField
            label="Cartes & panneaux"
            value={settings.surface}
            onChange={(v) => onPatch({ surface: v })}
          />
          <ColorField
            label="Texte principal"
            value={settings.text}
            onChange={(v) => onPatch({ text: v })}
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
            onChange={(t: Texture) => onPatch({ texture: t })}
          />
        </div>
      </div>
    </Panel>
  );
}
