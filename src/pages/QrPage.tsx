import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/DashboardShell";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import QRCode from "qrcode";

const QR_COLORS = [
  { name: "Océan", fg: "#1d5f6e", bg: "#eaf7f9" },
  { name: "Pêche", fg: "#a05a2c", bg: "#fdeee2" },
  { name: "Menthe", fg: "#2e6b4f", bg: "#e9f7f0" },
  { name: "Classic", fg: "#1f2937", bg: "#ffffff" },
];

/**
 * QR code unique de l'établissement : il pointe vers la page publique
 * /m/{slug}, qui affiche automatiquement les menus actifs sous forme
 * d'onglets. Un seul QR à imprimer, quel que soit le nombre de menus.
 */
export default function QrPage() {
  const navigate = useNavigate();
  const profile = useQuery(api.account.getMyProfile);
  const restaurant = profile?.restaurant ?? null;
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [colorIdx, setColorIdx] = useState(0);

  const publicUrl = useMemo(() => {
    if (!restaurant) return "";
    return `${window.location.origin}/m/${restaurant.slug}`;
  }, [restaurant]);

  useEffect(() => {
    if (!publicUrl) return;
    let cancelled = false;
    const { fg, bg } = QR_COLORS[colorIdx];
    // Image (data URL) plutôt que canvas : rendu toujours carré, à l'écran
    // comme à l'impression, quelles que soient les contraintes CSS du conteneur.
    QRCode.toDataURL(publicUrl, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: fg, light: bg },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [publicUrl, colorIdx]);

  if (profile === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (!restaurant) {
    return (
      <DashboardShell title="Aucun établissement">
        <p>Créez d'abord votre établissement pour obtenir votre QR code.</p>
      </DashboardShell>
    );
  }

  const color = QR_COLORS[colorIdx];

  return (
    <DashboardShell
      title="QR code de votre établissement"
      subtitle="Un seul QR code pour tous vos menus — il affiche vos menus actifs au client"
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
              {restaurant.city ? `${restaurant.name} · ${restaurant.city}` : restaurant.name}
            </p>
            <h2 className="mt-1 mb-5 font-[Baloo_2] text-2xl font-extrabold text-neutral-800">
              Notre carte
            </h2>
            <img
              src={qrDataUrl}
              alt={`QR code de l'établissement ${restaurant.name}`}
              className="aspect-square w-64 max-w-full rounded-2xl"
            />
            <p className="mt-5 text-sm font-semibold text-neutral-700">
              Scannez pour découvrir la carte
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Photos · Allergènes · FR / EN / ES / DE
            </p>
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
            <p className="mb-2 text-sm font-bold">Lien de votre carte</p>
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
            <p className="font-bold">Bon à savoir 💡</p>
            <p className="mt-1 text-[oklch(0.4_0.07_70)]">
              Ce QR code ne change jamais : si vous masquez un menu ou en
              créez un nouveau, il reste valable — la page affiche toujours
              vos menus actifs.
            </p>
          </div>

          <div className="clay-flat rounded-3xl bg-card p-5 text-sm">
            <p className="font-bold">Conseil d'impression 🖨️</p>
            <p className="mt-1 text-muted-foreground">
              Format carte de table (A6) ou tenture (A5). Gardez le QR à au
              moins 2 × 2 cm pour un scan facile.
            </p>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
