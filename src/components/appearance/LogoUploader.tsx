import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convertToWebp, isAcceptedImage } from "@/lib/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

const LOGO_MAX_DIM = 512;

/**
 * Téléversement du logo : conversion WebP (512 px max) côté navigateur, envoi
 * direct vers le stockage Convex. Le fichier n'est rattaché au restaurant
 * qu'à l'enregistrement de l'apparence ; d'ici là, seul l'aperçu change.
 */
export function LogoUploader({
  logoUrl,
  onChange,
}: {
  logoUrl: string | null;
  onChange: (storageId: Id<"_storage"> | null, previewUrl: string | null) => void;
}) {
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!isAcceptedImage(file)) {
      toast.error("Format non supporté (JPEG, PNG, WebP, GIF, AVIF).");
      return;
    }
    setBusy(true);
    try {
      const webp = await convertToWebp(file, LOGO_MAX_DIM);
      const postUrl = await generateUploadUrl({});
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": webp.type },
        body: webp,
      });
      if (!res.ok) throw new Error("Échec de l'envoi du logo.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      onChange(storageId, URL.createObjectURL(webp));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
      <div className="clay-in flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-card">
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : logoUrl ? (
          <img src={logoUrl} alt="Logo de l'établissement" className="size-full object-contain p-1" />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs text-muted-foreground">
          PNG à fond transparent recommandé. Converti en WebP, 512 px maximum.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="clay-btn clay-teal rounded-xl px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {logoUrl ? "Remplacer" : "Choisir un logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange(null, null)}
              className="clay-sm inline-flex items-center gap-1 rounded-xl bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              <Trash2 className="size-3.5" /> Retirer
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files)}
      />
    </div>
  );
}
