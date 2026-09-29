/**
 * Optimisation d'images côté client : conversion en WebP + redimensionnement
 * via canvas. Gain de stockage : aucune image brute n'est envoyée au serveur,
 * seulement la version WebP compressée (max 1280 px, qualité 0.82).
 */

export const PHOTO_MAX_DIM = 1280;
export const PHOTO_QUALITY = 0.82;

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export function isAcceptedImage(file: File) {
  return ACCEPTED_TYPES.includes(file.type);
}

/**
 * Charge un File image, le redimensionne (en conservant les proportions,
 * sans jamais agrandir), le convertit en WebP et renvoie un Blob prêt à
 * l'upload. Les GIF restent des GIF (canvas ne préserve pas l'animation) :
 * ils sont convertis en WebP animé par le navigateur quand possible, sinon
 * première frame — acceptable pour des photos de plats.
 */
export async function convertToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    PHOTO_MAX_DIM / Math.max(bitmap.width, bitmap.height),
  );
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible sur cet appareil.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", PHOTO_QUALITY),
  );
  if (!blob) throw new Error("Conversion WebP impossible sur cet appareil.");
  return blob;
}
