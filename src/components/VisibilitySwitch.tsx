import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Case à cocher « actif » : cochée = affiché sur le menu client,
 * décochée = masqué (rupture de stock…). undefined côté DB = actif.
 *
 * Style : bleu profond bien visible quand actif, pastille grise soutenue
 * quand masqué — le commutateur reprend la même couleur que son état.
 */
export function VisibilitySwitch({
  active,
  labelOn = "Affiché",
  labelWhenOff = "Masqué",
  onToggle,
  className,
}: {
  active: boolean;
  labelOn?: string;
  labelWhenOff?: string;
  onToggle: (next: boolean) => Promise<unknown>;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const handle = async (checked: boolean) => {
    setBusy(true);
    try {
      await onToggle(checked);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <label
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 text-[11px] font-bold whitespace-nowrap text-white transition-all select-none",
        active
          ? "bg-[oklch(0.55_0.12_210)] clay-sm"
          : "bg-[oklch(0.46_0.018_255)] clay-sm",
        busy && "opacity-60",
        className,
      )}
      title={
        active
          ? "Affiché sur le menu client — cliquez pour masquer"
          : "Masqué du menu client — cliquez pour afficher"
      }
    >
      {busy ? (
        <Loader2 className="mx-1 size-4 animate-spin" />
      ) : (
        <Switch
          checked={active}
          onCheckedChange={handle}
          className={cn(
            "border border-white/40",
            active
              ? "data-[state=checked]:bg-[oklch(0.75_0.1_205)] data-[state=unchecked]:bg-[oklch(0.38_0.015_255)]"
              : "data-[state=checked]:bg-[oklch(0.55_0.12_210)] data-[state=unchecked]:bg-[oklch(0.38_0.015_255)]",
          )}
        />
      )}
      {active ? labelOn : labelWhenOff}
    </label>
  );
}
