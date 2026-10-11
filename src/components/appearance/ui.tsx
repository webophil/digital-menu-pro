import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Crown, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

/** Sceau « réservé aux Pro » affiché sur les options verrouillées du plan gratuit. */
export function ProSeal({ className }: { className?: string }) {
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

export function Panel({
  title,
  hint,
  icon,
  locked = false,
  lockedLabel = "Personnalisation complète",
  onResetZone,
  resetLabel,
  onActivate,
  children,
}: {
  title: string;
  hint?: string;
  icon: ReactNode;
  locked?: boolean;
  lockedLabel?: string;
  /** Affiché seulement quand la zone diverge de l'ambiance de départ. */
  onResetZone?: () => void;
  resetLabel?: string;
  /** Appelé au premier clic/focus dans le panneau (défilement de l'aperçu). */
  onActivate?: () => void;
  children: ReactNode;
}) {
  return (
    <Card
      className="clay-card clay-flat gap-4 rounded-3xl border-0 p-5"
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      <div className="flex items-start gap-3">
        <div className="clay-in flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-[Baloo_2] text-lg leading-tight font-extrabold">
            {title}
          </h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {locked ? (
          <ProSeal />
        ) : (
          onResetZone && (
            <button
              type="button"
              onClick={onResetZone}
              className="clay-sm inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              {resetLabel ?? "Revenir à l'ambiance"}
            </button>
          )
        )}
      </div>
      <CardContent className="p-0">
        {locked ? (
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none select-none opacity-40 grayscale"
            >
              {children}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/55 px-4 text-center">
              <ProSeal />
              <span className="text-[11px] font-semibold text-muted-foreground">
                {lockedLabel}
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

export function SubTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function OptionGrid<T extends string>({
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

export function ColorField({
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
          <span className="block text-[11px] text-muted-foreground">{hint}</span>
        )}
      </span>
    </label>
  );
}

export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer font-bold">
          {label}
        </Label>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export interface FontOption {
  id: string;
  name: string;
  stack: string;
  weight?: number;
  blurb?: string;
}

/** Grille de polices : chaque vignette est écrite dans sa propre police. */
export function FontGrid({
  fonts,
  value,
  sample,
  onChange,
  cols = 3,
}: {
  fonts: readonly FontOption[];
  value: string;
  sample: string;
  onChange: (id: string) => void;
  cols?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2",
        cols === 3 && "sm:grid-cols-3",
        cols === 4 && "sm:grid-cols-4",
      )}
    >
      {fonts.map((f) => {
        const active = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl px-3 py-3 transition-all",
              active ? "clay-btn clay-teal text-white" : "clay-sm bg-card",
            )}
          >
            <span
              className="w-full truncate text-center text-lg leading-tight"
              style={{ fontFamily: f.stack, fontWeight: f.weight ?? 600 }}
            >
              {sample}
            </span>
            <span
              className="text-[10px] leading-tight"
              style={{
                fontFamily: '"Quicksand", ui-sans-serif, sans-serif',
                color: active ? "rgba(255,255,255,0.8)" : "var(--muted-foreground)",
              }}
            >
              {f.name}
              {f.blurb ? ` · ${f.blurb}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
