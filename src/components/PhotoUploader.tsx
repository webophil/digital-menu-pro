import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convertToWebp, isAcceptedImage } from "@/lib/image";
import { cn } from "@/lib/utils";
import { Camera, Crown, Loader2, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { toast } from "sonner";

/**
 * Gestion des photos d'un plat : upload depuis mobile/PC/tablette.
 * L'image est convertie en WebP compressé côté client puis stockée via
 * Convex. Free : 1 photo par plat — Pro : illimité.
 */
export function PhotoUploader({
  dishId,
  pro,
  className,
}: {
  dishId: Id<"dishes">;
  pro: boolean;
  className?: string;
}) {
  const photos = useQuery(api.photos.getPhotoUrls, { dishId });
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const attachPhoto = useMutation(api.photos.attachPhoto);
  const removePhoto = useMutation(api.photos.removePhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const list = photos ?? [];
  const atLimit = !pro && list.length >= 1;

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!isAcceptedImage(file)) {
      toast.error("Format non supporté (JPEG, PNG, WebP, GIF, AVIF).");
      return;
    }
    setBusy(true);
    try {
      // 1) Conversion + compression WebP côté client (gain serveur)
      const webp = await convertToWebp(file);
      // 2) Upload direct navigateur → stockage Convex
      const postUrl = await generateUploadUrl({});
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": webp.type },
        body: webp,
      });
      if (!res.ok) throw new Error("Échec de l'envoi de l'image.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      // 3) Rattachement au plat (quota vérifié côté serveur)
      await attachPhoto({ dishId, storageId });
      toast.success("Photo ajoutée !");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (storageId: Id<"_storage">) => {
    try {
      await removePhoto({ dishId, storageId });
      toast.success("Photo supprimée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {list.map((p, i) => (
          <div
            key={p.storageId}
            className="clay-in group relative size-20 overflow-hidden rounded-2xl bg-muted"
          >
            <img
              src={p.url}
              alt={i === 0 ? "Photo principale du plat" : "Photo du plat"}
              className="size-full object-cover"
            />
            <button
              type="button"
              title="Supprimer cette photo"
              className="absolute top-1 right-1 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              onClick={() => handleRemove(p.storageId)}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        {busy ? (
          <div className="clay-in flex size-20 items-center justify-center rounded-2xl bg-muted">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !atLimit ? (
          <button
            type="button"
            className="clay-in flex size-20 flex-col items-center justify-center gap-1 rounded-2xl bg-muted/60 text-muted-foreground transition-colors hover:bg-muted"
            onClick={() => inputRef.current?.click()}
          >
            <Plus className="size-5" />
            <span className="text-[10px] font-bold">Photo</span>
          </button>
        ) : null}
      </div>

      {atLimit ? (
        <Link
          to="/subscription"
          className="clay-butter flex items-center gap-2 rounded-2xl p-2.5 text-xs font-semibold text-[oklch(0.42_0.07_70)]"
        >
          <Crown className="size-4 shrink-0" />
          <span className="flex-1">
            Plan Gratuit : 1 photo par plat. Passez Pro pour des photos
            illimitées.
          </span>
        </Link>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Camera className="size-3.5" />
          JPG/PNG/WebP — convertie automatiquement en WebP optimisé.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

/** Vignette (première photo) d'un plat, pour les listes de l'éditeur.
 * Repli : ancien champ imageUrl (menu de démo, données historiques). */
export function DishThumb({
  dishId,
  imageUrl,
  className,
}: {
  dishId: Id<"dishes">;
  imageUrl?: string;
  className?: string;
}) {
  const photos = useQuery(api.photos.getPhotoUrls, { dishId });
  const url = photos?.[0]?.url ?? imageUrl;
  if (!url) {
    return (
      <div
        className={cn(
          "clay-in flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted",
          className,
        )}
      >
        <Camera className="size-5 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={cn("size-16 shrink-0 rounded-2xl object-cover", className)}
    />
  );
}
