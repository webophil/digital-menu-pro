import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/DashboardShell";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "convex/react";
import QRCode from "qrcode";

const QR_COLORS = [
  { name: "Océan", fg: "#1d5f6e", bg: "#eaf7f9" },
  { name: "Pêche", fg: "#a05a2c", bg: "#fdeee2" },
  { name: "Menthe", fg: "#2e6b4f", bg: "#e9f7f0" },
  { name: "Classic", fg: "#1f2937", bg: "#ffffff" },
];

export default function QrPage() {
  const { menuId } = useParams<{ menuId: string }>();
  const navigate = useNavigate();
  const menu = useQuery(
    api.restaurants.getMenu,
    menuId ? { menuId: menuId as Id<"menus"> } : "skip",
  );
  const restaurant = useQuery(
    api.restaurants.getRestaurant,
    menu?.restaurantId ? { id: menu.restaurantId } : "skip",
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [colorIdx, setColorIdx] = useState(0);

  const publicUrl = useMemo(() => {
    if (!restaurant) return "";
    return `${window.location.origin}/m/${restaurant.slug}`;
  }, [restaurant]);

  useEffect(() => {
    if (!publicUrl || !canvasRef.current) return;
    const { fg, bg } = QR_COLORS[colorIdx];
    QRCode.toCanvas(canvasRef.current, publicUrl, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: fg, light: bg },
    }).catch(() => undefined);
  }, [publicUrl, colorIdx]);

  if (menu === undefined || restaurant === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!menu || !restaurant) {
    return (
      <DashboardShell title="Menu introuvable">
        <p>Ce menu n'existe pas ou ne vous appartient pas.</p>
      </DashboardShell>
    );
  }

  const color = QR_COLORS[colorIdx];

  return (
    <DashboardShell
      title="QR code du menu"
      subtitle="Imprimez-le et affichez-le sur vos tables"
      actions={
        <>
          <Button
            variant="outline"
            className="clay-sm rounded-2xl border-0 bg-card font-bold"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="size-4" /> Retour
          </Button>
          <Button
            className="clay-btn clay-teal rounded-2xl font-bold text-white"
            onClick={() => window.print()}
          >
            <Printer className="size-4" /> Imprimer
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Aperçu imprimable */}
        <div className="clay-flat rounded-[2rem] bg-card p-6 print:border-0 print:shadow-none">
          <div
            className="mx-auto flex max-w-sm flex-col items-center rounded-[1.75rem] p-8 text-center"
            style={{ background: color.bg }}
          >
            <p className="text-xs font-bold tracking-widest text-neutral-600 uppercase">
              {restaurant.name}
            </p>
            <h2 className="mt-1 mb-5 font-[Baloo_2] text-2xl font-extrabold text-neutral-800">
              {menu.name}
            </h2>
            <canvas ref={canvasRef} className="max-w-full rounded-2xl" />
            <p className="mt-5 text-sm font-semibold text-neutral-700">
              Scannez pour découvrir la carte
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Photos · Allergènes · FR / EN / ES / DE
            </p>
            {restaurant.city && (
              <p className="mt-3 text-xs font-bold tracking-wide text-neutral-600 uppercase">
                {restaurant.city}
              </p>
            )}
          </div>
        </div>

        {/* Contrôles */}
        <aside className="space-y-5 print:hidden">
          <div className="clay-flat rounded-3xl bg-card p-5">
            <p className="mb-3 text-sm font-bold">Couleur du visuel</p>
            <div className="flex flex-wrap gap-2">
              {QR_COLORS.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => setColorIdx(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                    colorIdx === i
                      ? "clay-btn clay-teal text-white"
                      : "clay-in bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    className="size-3 rounded-full border border-white/60"
                    style={{ background: c.fg }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="clay-flat rounded-3xl bg-card p-5">
            <p className="mb-2 text-sm font-bold">Lien du menu</p>
            <p className="clay-in rounded-2xl bg-muted p-3 text-xs break-all text-muted-foreground">
              {publicUrl}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="clay-sm mt-3 w-full rounded-2xl border-0 bg-muted font-bold"
              onClick={() => navigator.clipboard?.writeText(publicUrl)}
            >
              Copier le lien
            </Button>
          </div>

          <div className="clay-butter clay-flat rounded-3xl p-5 text-sm">
            <p className="font-bold">Conseil d'impression 🖨️</p>
            <p className="mt-1 text-[oklch(0.4_0.07_70)]">
              Format carte de table (A6) ou tenture (A5). Gardez le QR à au
              moins 2 × 2 cm pour un scan facile.
            </p>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
