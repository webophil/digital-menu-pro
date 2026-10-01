import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { MenuPreview } from "@/pages/PublicMenu";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ExternalLink } from "lucide-react";
import { useQuery } from "convex/react";

/**
 * Aperçu du menu client en modale : contrôle visuel sans quitter le
 * dashboard. Les données passent par les mêmes requêtes publiques que
 * /m/:slug, donc l'aperçu reflète exactement ce que voient les clients
 * (et se met à jour en temps réel).
 */
export function PublicMenuModal({
  open,
  onOpenChange,
  restaurant,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  restaurant: Doc<"restaurants">;
}) {
  const menus = useQuery(
    api.publicMenu.getPublicMenus,
    open ? { restaurantId: restaurant._id } : "skip",
  ) as Doc<"menus">[] | undefined | null;
  const appearance = useQuery(
    api.appearance.getPublicAppearance,
    open ? { restaurantId: restaurant._id } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl border-0 p-0 sm:max-w-sm [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:bg-white/25 [&_[data-slot=dialog-close]]:p-1.5 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:backdrop-blur">
        <DialogTitle className="sr-only">Aperçu du menu client</DialogTitle>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MenuPreview
            restaurant={restaurant}
            menus={menus ?? undefined}
            appearance={appearance}
            className="flex w-full flex-col"
          />
        </div>
        <DialogFooter className="clay-flat m-3 rounded-2xl bg-card p-2 sm:justify-center">
          <Button
            asChild
            variant="outline"
            className="clay-sm h-9 rounded-2xl border-0 bg-card text-sm font-bold"
          >
            <a href={`/m/${restaurant.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" /> Ouvrir dans un onglet
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
