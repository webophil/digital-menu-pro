import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Case à cocher « actif » : cochée = affiché sur le menu client,
 * décochée = masqué (rupture de stock…). undefined côté DB = actif.
 */
export function VisibilitySwitch({
  active,
  labelWhenOff = "Masqué",
  onToggle,
  className,
}: {
  active: boolean;
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
        "flex cursor-pointer items-center gap-2 text-xs font-bold select-none",
        active ? "text-clay-deep" : "text-muted-foreground",
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
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Switch checked={active} onCheckedChange={handle} />
      )}
      {active ? "Affiché" : labelWhenOff}
    </label>
  );
}
