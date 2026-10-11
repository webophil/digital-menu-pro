import {
  BODY_FONT_VALUES,
  PHOTO_SHAPE_META,
  PHOTO_SHAPE_VALUES,
  PRICE_STYLE_META,
  PRICE_STYLE_VALUES,
  bodyFont,
  type AppearanceSettings,
  type BodyFontId,
  type PhotoShape,
  type PriceStyle,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { UtensilsCrossed } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { FontGrid, OptionGrid, Panel, SubTitle } from "./ui";

const photoPreviews: Record<PhotoShape, ReactNode> = {
  rounded: <span className="mx-auto block size-9 rounded-2xl bg-muted-foreground/40" />,
  circle: <span className="mx-auto block size-9 rounded-full bg-muted-foreground/40" />,
  square: <span className="mx-auto block size-9 rounded-md bg-muted-foreground/40" />,
};

const pricePreviews: Record<PriceStyle, ReactNode> = {
  accent: (
    <span className="font-head text-base" style={{ color: "var(--m-price)" }}>
      12,50 €
    </span>
  ),
  plain: (
    <span className="font-head text-base" style={{ color: "var(--m-text)" }}>
      12,50 €
    </span>
  ),
  pill: (
    <span
      className="font-head rounded-full px-2.5 py-0.5 text-xs"
      style={{ background: "var(--m-pill-bg)", color: "var(--m-pill-text)" }}
    >
      12,50 €
    </span>
  ),
};

export function DishesPanel({
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
  return (
    <Panel
      title="Plats"
      hint="Texte des plats, prix et forme des photos."
      icon={<UtensilsCrossed className="size-5 text-clay-deep" />}
      locked={!pro}
      lockedLabel="Police, prix et photos sur mesure"
      onResetZone={onResetZone}
      onActivate={onActivate}
    >
      <div className="space-y-5" style={vars}>
        <div>
          <SubTitle>Police du texte</SubTitle>
          <FontGrid
            cols={4}
            fonts={BODY_FONT_VALUES.map((id) => {
              const f = bodyFont(id);
              return { id, name: f.name, stack: f.stack, weight: 600 };
            })}
            value={settings.bodyFont}
            sample="Menu du jour"
            onChange={(id) => onPatch({ bodyFont: id as BodyFontId })}
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
                <span className={cn("flex h-7 items-center justify-center")}>
                  {pricePreviews[p]}
                </span>
              ),
            }))}
            onChange={(p: PriceStyle) => onPatch({ priceStyle: p })}
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
            onChange={(p: PhotoShape) => onPatch({ photoShape: p })}
          />
        </div>
      </div>
    </Panel>
  );
}
