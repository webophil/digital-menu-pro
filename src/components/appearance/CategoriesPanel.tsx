import {
  CATEGORY_FONT_VALUES,
  headingFont,
  type AppearanceSettings,
  type HeadingFontId,
} from "@/lib/theme";
import { Rows3 } from "lucide-react";
import type { CSSProperties } from "react";
import { cardStyleOptions, categoryStyleOptions, dividerOptions } from "./options";
import { FontGrid, OptionGrid, Panel, SubTitle, ToggleRow } from "./ui";

export function CategoriesPanel({
  settings,
  pro,
  vars,
  onPatch,
  onResetZone,
  onActivate,
}: {
  settings: AppearanceSettings;
  pro: boolean;
  vars: CSSProperties;
  onPatch: (p: Partial<AppearanceSettings>) => void;
  onResetZone?: () => void;
  onActivate?: () => void;
}) {
  // Un menu déjà enregistré avec la signature manuscrite la garde sélectionnable.
  const ids: HeadingFontId[] = (CATEGORY_FONT_VALUES as readonly HeadingFontId[]).includes(
    settings.headingFont,
  )
    ? [...CATEGORY_FONT_VALUES]
    : [...CATEGORY_FONT_VALUES, settings.headingFont];

  return (
    <Panel
      title="Catégories"
      hint="Titres, cadres et fioritures des sections du menu."
      icon={<Rows3 className="size-5 text-clay-deep" />}
      locked={!pro}
      lockedLabel="Titres et cadres sur mesure"
      onResetZone={onResetZone}
      onActivate={onActivate}
    >
      <div className="space-y-5" style={vars}>
        <div>
          <SubTitle>Police des titres de catégories</SubTitle>
          <FontGrid
            fonts={ids.map((id) => {
              const f = headingFont(id);
              return {
                id,
                name: f.name,
                stack: f.stack,
                weight: f.headWeight,
                blurb: f.blurb,
              };
            })}
            value={settings.headingFont}
            sample="Entrées"
            onChange={(id) => onPatch({ headingFont: id as HeadingFontId })}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Aussi utilisée pour les prix. Seules des polices lisibles sont proposées
            ici ; la signature manuscrite est réservée au nom de l&apos;établissement.
          </p>
        </div>

        <ToggleRow
          id="heading-upper"
          label="Titres en majuscules"
          hint="EX. ENTRÉES · PLATS · DESSERTS"
          checked={settings.headingCase === "uppercase"}
          onChange={(c) => onPatch({ headingCase: c ? "uppercase" : "normal" })}
        />

        <div>
          <SubTitle>Présentation des titres</SubTitle>
          <OptionGrid
            value={settings.categoryStyle}
            options={categoryStyleOptions}
            onChange={(c) => onPatch({ categoryStyle: c })}
          />
        </div>
        <div>
          <SubTitle>Cadres des catégories</SubTitle>
          <OptionGrid
            value={settings.cardStyle}
            options={cardStyleOptions}
            onChange={(c) => onPatch({ cardStyle: c })}
          />
        </div>
        <div>
          <SubTitle>Fioritures sous les titres</SubTitle>
          <OptionGrid
            value={settings.divider}
            options={dividerOptions}
            onChange={(d) => onPatch({ divider: d })}
          />
        </div>
      </div>
    </Panel>
  );
}
