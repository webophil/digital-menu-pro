/**
 * Logo de marque « V'la le Menu ! » (image officielle public/vlalemenu-logo.webp,
 * ratio ~3:1). `mix-blend-multiply` fond le fond blanc de l'image dans les
 * surfaces claires du thème clay.
 */
export function BrandLogo({
  className = "h-10 w-auto",
}: {
  className?: string;
}) {
  return (
    <img
      src="/vlalemenu-logo.webp"
      alt="V'la le Menu !"
      width={2168}
      height={725}
      className={`mix-blend-multiply ${className}`}
    />
  );
}
