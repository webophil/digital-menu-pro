import { Languages, Lock } from "lucide-react";
import { Panel } from "./ui";

/** Rappel : ces éléments ne dépendent jamais de l'apparence choisie. */
export function FixedElementsPanel() {
  return (
    <Panel
      title="Toujours identiques"
      hint="Pour rester lisibles par tous les clients, ces éléments ne changent pas."
      icon={<Lock className="size-5 text-clay-deep" />}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-muted p-3">
          <Languages className="size-4 text-muted-foreground" />
          <span className="clay-btn rounded-full bg-black px-3 py-1.5 text-xs font-bold text-white">
            FR
          </span>
          <span className="clay-in rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">
            EN
          </span>
          <span className="clay-in rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">
            ES
          </span>
          <span className="clay-in rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">
            DE
          </span>
          <span className="ml-1 text-[11px] text-muted-foreground">
            Barre des langues
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-muted p-3">
          <span className="clay-in flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">
            <span>🥛</span>Lait
          </span>
          <span className="clay-in flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">
            <span>🌾</span>Gluten
          </span>
          <span className="ml-1 text-[11px] text-muted-foreground">
            Étiquettes d&apos;allergènes
          </span>
        </div>
      </div>
    </Panel>
  );
}
