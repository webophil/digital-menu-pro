import {
  HEADER_ALIGN_META,
  HEADER_ALIGN_VALUES,
  HEADER_MARK_META,
  HEADER_MARK_VALUES,
  HEADER_STYLE_META,
  HEADER_STYLE_VALUES,
  HEADING_FONT_VALUES,
  appearanceCssVars,
  headingFont,
  shade,
  type AppearanceSettings,
  type HeaderAlign,
  type HeaderMark,
  type HeaderStyle,
} from "@/lib/theme";
import { ImageIcon, LayoutTemplate, UtensilsCrossed } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { dividerOptions } from "./options";
import { LogoUploader } from "./LogoUploader";
import { ColorField, FontGrid, OptionGrid, Panel, SubTitle, ToggleRow } from "./ui";
import type { Id } from "@/convex/_generated/dataModel";

export function HeaderPanel({
  settings,
  pro,
  vars,
  restaurantName,
  logoUrl,
  onPatch,
  onLogoChange,
  onResetZone,
  onActivate,
}: {
  settings: AppearanceSettings;
  pro: boolean;
  vars: CSSProperties;
  restaurantName: string;
  logoUrl: string | null;
  onPatch: (p: Partial<AppearanceSettings>) => void;
  onLogoChange: (storageId: Id<"_storage"> | null, previewUrl: string | null) => void;
  onResetZone?: () => void;
  onActivate?: () => void;
}) {
  const headerBgFor = (hs: HeaderStyle) =>
    appearanceCssVars({ ...settings, headerStyle: hs })["--m-header-bg"];

  const markPreviews: Record<HeaderMark, ReactNode> = {
    icon: (
      <span className="flex h-8 items-center justify-center">
        <UtensilsCrossed className="size-5" />
      </span>
    ),
    logo: (
      <span className="flex h-8 items-center justify-center">
        <ImageIcon className="size-5" />
      </span>
    ),
    none: <span className="flex h-8 items-center justify-center text-lg">—</span>,
  };

  const alignPreviews: Record<HeaderAlign, ReactNode> = {
    center: (
      <span className="flex w-full flex-col items-center gap-1 rounded-lg bg-muted/70 px-2 py-2">
        <span className="h-1.5 w-2/3 rounded-full bg-current" />
        <span className="h-1 w-1/3 rounded-full bg-current" />
      </span>
    ),
    left: (
      <span className="flex w-full flex-col gap-1 rounded-lg bg-muted/70 px-2 py-2">
        <span className="h-1.5 w-2/3 rounded-full bg-current" />
        <span className="h-1 w-1/3 rounded-full bg-current" />
      </span>
    ),
  };

  return (
    <Panel
      title="En-tête"
      hint="Nom, slogan, ville et repère visuel : la vitrine de votre menu."
      icon={<LayoutTemplate className="size-5 text-clay-deep" />}
      locked={!pro}
      lockedLabel="En-tête et logo sur mesure"
      onResetZone={onResetZone}
      onActivate={onActivate}
    >
      <div className="space-y-5" style={vars}>
        <div className="space-y-2.5">
          <SubTitle>Repère visuel</SubTitle>
          <OptionGrid
            value={settings.headerMark}
            options={HEADER_MARK_VALUES.map((m: HeaderMark) => ({
              value: m,
              label: HEADER_MARK_META[m],
              preview: markPreviews[m],
            }))}
            onChange={(m: HeaderMark) => onPatch({ headerMark: m })}
          />
          {settings.headerMark === "logo" && (
            <LogoUploader logoUrl={logoUrl} onChange={onLogoChange} />
          )}
        </div>

        <div>
          <SubTitle>Police du nom de l&apos;établissement</SubTitle>
          <FontGrid
            fonts={HEADING_FONT_VALUES.map((id) => {
              const f = headingFont(id);
              return {
                id,
                name: f.name,
                stack: f.stack,
                weight: f.headWeight,
                blurb: f.blurb,
              };
            })}
            value={settings.headerFont}
            sample={restaurantName}
            onChange={(id) =>
              onPatch({ headerFont: id as AppearanceSettings["headerFont"] })
            }
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Cette police ne touche que le nom : les catégories gardent la leur.
          </p>
        </div>

        <ToggleRow
          id="header-upper"
          label="Nom en majuscules"
          hint="EX. CHEZ MARCEL"
          checked={settings.headerCase === "uppercase"}
          onChange={(c) => onPatch({ headerCase: c ? "uppercase" : "normal" })}
        />

        <div className="space-y-2.5">
          <SubTitle>Fond de l&apos;en-tête</SubTitle>
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
            onChange={(h: HeaderStyle) => onPatch({ headerStyle: h })}
          />
          <ToggleRow
            id="header-follow"
            label="Suivre la couleur d'accent"
            hint="Désactivez pour choisir une couleur propre à l'en-tête."
            checked={settings.headerFollowAccent}
            onChange={(c) =>
              onPatch(
                c
                  ? { headerFollowAccent: true }
                  : {
                      headerFollowAccent: false,
                      headerColor: settings.accent,
                      headerColor2: settings.accent2,
                    },
              )
            }
          />
          {!settings.headerFollowAccent && (
            <ColorField
              label="Couleur de l'en-tête"
              value={settings.headerColor}
              onChange={(c) =>
                onPatch({ headerColor: c, headerColor2: shade(c, -0.28) })
              }
            />
          )}
        </div>

        <div>
          <SubTitle>Alignement</SubTitle>
          <OptionGrid
            value={settings.headerAlign}
            cols={2}
            options={HEADER_ALIGN_VALUES.map((a: HeaderAlign) => ({
              value: a,
              label: HEADER_ALIGN_META[a],
              preview: alignPreviews[a],
            }))}
            onChange={(a: HeaderAlign) => onPatch({ headerAlign: a })}
          />
        </div>

        <div>
          <SubTitle>Fioriture sous le nom</SubTitle>
          <OptionGrid
            value={settings.headerDivider}
            options={dividerOptions}
            onChange={(d) => onPatch({ headerDivider: d })}
          />
        </div>

        <div className="space-y-2">
          <SubTitle>Informations affichées</SubTitle>
          <ToggleRow
            id="show-tagline"
            label="Slogan"
            checked={settings.showTagline}
            onChange={(c) => onPatch({ showTagline: c })}
          />
          <ToggleRow
            id="show-city"
            label="Ville"
            checked={settings.showCity}
            onChange={(c) => onPatch({ showCity: c })}
          />
          <ToggleRow
            id="show-phone"
            label="Téléphone"
            checked={settings.showPhone}
            onChange={(c) => onPatch({ showPhone: c })}
          />
          <p className="text-[11px] text-muted-foreground">
            Le contenu se modifie dans{" "}
            <Link to="/mes-infos" className="font-bold text-clay-deep underline">
              Mon établissement
            </Link>
            .
          </p>
        </div>
      </div>
    </Panel>
  );
}
