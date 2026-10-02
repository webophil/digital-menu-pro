import { allergenLabel, formatPrice, ALLERGENS, LANGS, type LangCode, cn } from "@/lib/utils";
import {
  CARD_STYLE_CLASS,
  DIVIDER_META,
  PHOTO_SHAPE_CLASS,
  TEXTURE_STYLES,
  appearanceCssVars,
  resolveAppearance,
  type AppearanceSettings,
  type Divider,
} from "@/lib/theme";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Languages,
  Loader2,
  MapPin,
  Phone,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { BrandLogo } from "@/components/Logo";

const TYPE_EMOJI: Record<string, string> = {
  carte: "📖",
  "menu-du-jour": "✨",
  soir: "🌙",
  enfants: "🧒",
  boissons: "🥤",
  autre: "🍴",
};

type DishPhoto = { url: string };

/** Photos d'un plat : carrousel auto si plusieurs (plan Pro), cliquable. */
function DishPhotos({
  photos,
  multi,
  alt,
  shape,
  onOpen,
}: {
  photos: DishPhoto[];
  multi: boolean;
  alt: string;
  shape: string;
  onOpen: (index: number) => void;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!multi || photos.length < 2) return;
    const t = setInterval(
      () => setIdx((i) => (i + 1) % photos.length),
      3500,
    );
    return () => clearInterval(t);
  }, [multi, photos.length]);

  if (photos.length === 0) return null;

  return (
    <button
      type="button"
      className={cn(
        "relative size-20 shrink-0 cursor-zoom-in overflow-hidden",
        shape,
      )}
      onClick={() => onOpen(idx)}
      aria-label="Agrandir les photos du plat"
    >
      <img
        src={photos[idx]?.url}
        alt={alt}
        loading="lazy"
        className="size-full object-cover"
      />
      {multi && (
        <>
          <span className="absolute top-1 right-1 rounded-full bg-black/45 px-1.5 text-[9px] font-bold text-white">
            {idx + 1}/{photos.length}
          </span>
          <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1">
            {photos.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  i === idx ? "bg-white" : "bg-white/50",
                )}
              />
            ))}
          </span>
        </>
      )}
    </button>
  );
}

/** Visionneuse plein écran : fermeture par la croix ou Échap. */
function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: DishPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (delta: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate(1);
      if (e.key === "ArrowLeft") onNavigate(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onNavigate]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        title="Fermer"
        aria-label="Fermer"
        className="absolute top-4 right-4 z-10 rounded-full bg-white/15 p-2 text-white backdrop-blur transition-colors hover:bg-white/30"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="size-5" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            title="Photo précédente"
            className="absolute left-3 rounded-full bg-white/15 p-2 text-white backdrop-blur transition-colors hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(-1);
            }}
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            title="Photo suivante"
            className="absolute right-3 rounded-full bg-white/15 p-2 text-white backdrop-blur transition-colors hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(1);
            }}
          >
            <ChevronRight className="size-6" />
          </button>
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white">
            {index + 1} / {photos.length}
          </p>
        </>
      )}
      <img
        src={photo.url}
        alt=""
        className="max-h-[88vh] max-w-full rounded-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/**
 * Fioriture de séparation choisie sur la page « Apparence ».
 * Rendue sous le titre du restaurant, sous chaque titre de catégorie et
 * au-dessus du pied de page.
 */
function MenuDivider({
  kind,
  tone = "accent",
}: {
  kind: Divider;
  tone?: "accent" | "onAccent";
}) {
  if (kind === "none") return null;
  const color =
    tone === "onAccent" ? "var(--m-on-accent)" : "var(--m-accent)";
  const side = (
    <span
      className="h-px max-w-16 flex-1 rounded-full"
      style={{
        background:
          tone === "onAccent" ? "var(--m-on-accent-soft)" : "var(--m-border)",
      }}
    />
  );

  if (kind === "line") {
    return (
      <div className="flex justify-center" aria-hidden>
        <span
          className="h-0.5 w-12 rounded-full"
          style={{ background: color }}
        />
      </div>
    );
  }
  if (kind === "dots") {
    return (
      <div className="flex items-center justify-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("rounded-full", i === 1 ? "size-1.5" : "size-1")}
            style={{ background: color }}
          />
        ))}
      </div>
    );
  }
  if (kind === "stars") {
    return (
      <div
        className="flex items-center justify-center gap-2 text-[10px] leading-none"
        style={{ color }}
        aria-hidden
      >
        <span>✦</span>
        <span>✦</span>
        <span>✦</span>
      </div>
    );
  }
  const glyph = kind === "diamond" ? "◆" : "❦";
  return (
    <div className="flex items-center justify-center gap-2.5" aria-hidden>
      {side}
      <span
        className={cn(
          "leading-none",
          kind === "diamond" ? "text-[9px]" : "text-sm",
        )}
        style={{ color }}
      >
        {glyph}
      </span>
      {side}
    </div>
  );
}

/**
 * Rendu complet du menu client tel que le voient les clients.
 * Utilisé par la page publique /m/:slug, par l'aperçu en modale de l'espace
 * restaurateur et par l'aperçu en direct de la page « Apparence ».
 * L'apparence (couleurs, polices, décor) est pilotée par les variables CSS
 * calculées dans lib/theme — un thème absent = look d'origine.
 */
export function MenuPreview({
  restaurant,
  menus,
  appearance,
  className = "mx-auto flex min-h-screen w-full max-w-md flex-col",
}: {
  restaurant: Doc<"restaurants">;
  menus: Doc<"menus">[] | undefined;
  appearance?: Partial<AppearanceSettings> | null;
  className?: string;
}) {
  const [lang, setLang] = useState<LangCode>("fr");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const theme = useMemo(() => resolveAppearance(appearance), [appearance]);
  const vars = useMemo(
    () => appearanceCssVars(theme) as CSSProperties,
    [theme],
  );
  const texture = TEXTURE_STYLES[theme.texture];

  const menu = useMemo(
    () => menus?.find((m) => m._id === (activeMenuId ?? menus[0]?._id)),
    [menus, activeMenuId],
  );

  const categories = useQuery(
    api.publicMenu.getPublicCategories,
    menu ? { menuId: menu._id } : "skip",
  ) as Doc<"categories">[] | undefined | null;

  const dishesLists = useQuery(
    api.publicMenu.getPublicDishesBatch,
    menu && categories ? { categoryIds: categories.map((c) => c._id) } : "skip",
  );

  const allDishIds = useMemo(
    () => (dishesLists ?? []).map((d) => d._id),
    [dishesLists],
  );
  const photosByDish = useQuery(
    api.photos.getPhotosBatch,
    allDishIds.length > 0 ? { dishIds: allDishIds } : "skip",
  );
  const isPro = useQuery(api.photos.isProRestaurant, {
    restaurantId: restaurant._id,
  });
  const [lightbox, setLightbox] = useState<{
    dishId: string;
    index: number;
  } | null>(null);

  // Langue du navigateur au premier chargement
  useEffect(() => {
    const nav = navigator.language.slice(0, 2) as LangCode;
    if (["en", "es", "de"].includes(nav)) setLang(nav);
  }, []);

  const localize = (
    fr: string | undefined,
    en: string | undefined,
    es: string | undefined,
    de: string | undefined,
  ) => {
    switch (lang) {
      case "en": return en || fr;
      case "es": return es || fr;
      case "de": return de || fr;
      default: return fr;
    }
  };

  const name = localize(restaurant.name, restaurant.nameEn, restaurant.nameEs, restaurant.nameDe);
  const tagline = localize(restaurant.tagline, restaurant.taglineEn, restaurant.taglineEs, restaurant.taglineDe);

  return (
    <div
      className={cn(className, "relative")}
      style={{
        ...vars,
        backgroundColor: "var(--m-bg)",
        color: "var(--m-text)",
      }}
    >
      {/* Texture de fond (papier, pointillés…) */}
      {texture && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={texture as CSSProperties}
        />
      )}

      <div className="relative z-10 flex min-h-full flex-1 flex-col">
        {/* En-tête vitrine */}
        <header
          className="px-6 pt-10 pb-12 text-center"
          style={{
            background: "var(--m-header-bg)",
            color: "var(--m-on-accent)",
          }}
        >
          <div
            className="mx-auto mb-4 flex size-16 items-center justify-center rounded-[1.5rem]"
            style={{ background: "var(--m-on-accent-soft)" }}
          >
            <UtensilsCrossed className="size-8" />
          </div>
          <h1 className="font-head text-3xl">{name}</h1>
          {tagline && (
            <p className="mt-1.5 text-sm opacity-[0.85]">{tagline}</p>
          )}
          {theme.divider !== "none" && (
            <div className="mx-auto mt-3 max-w-56">
              <MenuDivider kind={theme.divider} tone="onAccent" />
            </div>
          )}
          <div className="mt-3 flex items-center justify-center gap-4 text-xs font-semibold opacity-[0.85]">
            {restaurant.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {restaurant.city}
              </span>
            )}
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1">
                <Phone className="size-3.5" /> {restaurant.phone}
              </a>
            )}
          </div>
        </header>

        {/* Sélecteur de menu */}
        {menus && menus.length > 1 && (
          <div className="-mt-6 px-4">
            <div
              className="clay flex gap-1.5 overflow-x-auto rounded-3xl p-2"
              style={{ background: "var(--m-surface)" }}
            >
              {menus.map((m) => (
                <button
                  key={m._id}
                  onClick={() => {
                    setActiveMenuId(m._id);
                    setOpenCats({});
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-bold transition-all",
                    menu?._id === m._id ? "clay-btn m-accent" : "m-muted",
                  )}
                >
                  <span>{TYPE_EMOJI[m.menuType] ?? "🍴"}</span>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sélecteur de langue */}
        <div className="mt-4 flex items-center justify-center gap-1.5 px-4">
          <Languages className="size-4 m-muted" />
          {LANGS.map((l: { code: string; label: string; flag: string }) => {
            // L'affichage retombe sur le FR si la traduction manque
            return (
              <button
                key={l.code}
                onClick={() => setLang(l.code as LangCode)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                  lang === l.code
                    ? "clay-btn m-accent"
                    : "clay-in m-chip",
                )}
              >
                {l.flag} {l.code.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Contenu du menu */}
        <main className="flex-1 space-y-3 px-4 py-5 pb-16">
          {categories === undefined && (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin m-muted" />
            </div>
          )}
          {categories?.length === 0 && (
            <p
              className={cn(
                "rounded-3xl p-6 text-center text-sm m-muted",
                CARD_STYLE_CLASS[theme.cardStyle],
              )}
              style={{ background: "var(--m-surface)" }}
            >
              Le menu arrive bientôt !
            </p>
          )}
          {categories?.map((cat) => {
            const open = openCats[cat._id] ?? true;
            const dishes = (dishesLists ?? []).filter((d) => d.categoryId === cat._id);
            const catName = localize(cat.name, cat.nameEn, cat.nameEs, cat.nameDe);
            return (
              <section
                key={cat._id}
                className={cn(
                  "overflow-hidden rounded-3xl",
                  CARD_STYLE_CLASS[theme.cardStyle],
                )}
                style={{ background: "var(--m-surface)" }}
              >
                <button
                  className={cn(
                    "relative flex w-full items-center px-5 py-4",
                    theme.categoryStyle === "left"
                      ? "justify-start pr-10"
                      : "justify-center pr-10",
                  )}
                  onClick={() => setOpenCats((s) => ({ ...s, [cat._id]: !open }))}
                >
                  {theme.categoryStyle === "framed" ? (
                    <span className="m-frame block w-full rounded-xl px-3 py-2 text-center font-head text-lg">
                      <span className="mr-1.5 text-xl">{cat.emoji ?? "🍽️"}</span>
                      {catName}
                    </span>
                  ) : theme.categoryStyle === "center" ? (
                    <span className="flex flex-col items-center gap-1 text-center font-head text-lg">
                      <span className="text-2xl leading-none">
                        {cat.emoji ?? "🍽️"}
                      </span>
                      {catName}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 font-head text-lg">
                      <span className="text-xl">{cat.emoji ?? "🍽️"}</span>
                      {catName}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "m-muted absolute top-1/2 right-4 size-5 -translate-y-1/2 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open && (
                  <div className="space-y-3 px-4 pb-4">
                    <MenuDivider kind={theme.divider} />
                    {dishes.length === 0 && (
                      <p className="px-1 text-xs m-muted">—</p>
                    )}
                    {dishes.map((d) => {
                      const dName = localize(d.name, d.nameEn, d.nameEs, d.nameDe);
                      const dDesc = localize(
                        d.description ?? undefined,
                        d.descriptionEn,
                        d.descriptionEs,
                        d.descriptionDe,
                      );
                      const dPhotos: DishPhoto[] =
                        photosByDish?.[d._id] ??
                        (d.imageUrl ? [{ url: d.imageUrl }] : []);
                      return (
                        <article key={d._id} className="flex gap-3">
                          {dPhotos.length > 0 && (
                            <DishPhotos
                              photos={dPhotos}
                              multi={isPro === true}
                              alt={dName ?? d.name}
                              shape={PHOTO_SHAPE_CLASS[theme.photoShape]}
                              onOpen={(i) =>
                                setLightbox({ dishId: d._id, index: i })
                              }
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <h3 className="text-sm font-bold">{dName}</h3>
                              {theme.priceStyle === "pill" ? (
                                <span
                                  className="font-head shrink-0 rounded-full px-2.5 py-0.5 text-xs"
                                  style={{
                                    background: "var(--m-pill-bg)",
                                    color: "var(--m-pill-text)",
                                  }}
                                >
                                  {formatPrice(d.price)}
                                </span>
                              ) : (
                                <span
                                  className="font-head shrink-0 text-base"
                                  style={{
                                    color:
                                      theme.priceStyle === "plain"
                                        ? "var(--m-text)"
                                        : "var(--m-price)",
                                  }}
                                >
                                  {formatPrice(d.price)}
                                </span>
                              )}
                            </div>
                            {dDesc && (
                              <p className="mt-0.5 text-xs leading-relaxed m-muted">
                                {dDesc}
                              </p>
                            )}
                            {d.allergens.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {d.allergens.map((code) => {
                                  const a = (ALLERGENS as ReadonlyArray<{ code: string; emoji: string }>).find((al) => al.code === code);
                                  return (
                                    <span
                                      key={code}
                                      className="clay-in m-chip flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                      title={allergenLabel(code, lang)}
                                    >
                                      <span>{a?.emoji}</span>
                                      {allergenLabel(code, lang)}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          <footer className="pt-4 text-center text-[11px]">
            {theme.divider !== "none" && (
              <div className="px-8 pb-3">
                <MenuDivider kind={theme.divider} />
              </div>
            )}
            <p className="m-muted">
              Allergènes : information fournie à titre indicatif, signalez toute
              allergie au personnel.
            </p>
            <p className="mt-2 m-muted">
              <a
                href="/"
                className="inline-flex items-center"
                title="Menu digital par V'la le Menu !"
              >
                <BrandLogo className="h-5 w-auto" />
              </a>
            </p>
          </footer>
        </main>
      </div>

      {lightbox && (
        <Lightbox
          photos={photosByDish?.[lightbox.dishId] ?? []}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(delta) =>
            setLightbox((lb) => {
              if (!lb) return lb;
              const n = photosByDish?.[lb.dishId]?.length ?? 1;
              return { ...lb, index: (lb.index + delta + n) % n };
            })
          }
        />
      )}
    </div>
  );
}

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const restaurant = useQuery(
    api.publicMenu.getPublicRestaurant,
    slug ? { slug } : "skip",
  ) as Doc<"restaurants"> | undefined | null;
  const menus = useQuery(
    api.publicMenu.getPublicMenus,
    restaurant ? { restaurantId: restaurant._id } : "skip",
  ) as Doc<"menus">[] | undefined | null;
  const appearance = useQuery(
    api.appearance.getPublicAppearance,
    restaurant ? { restaurantId: restaurant._id } : "skip",
  );

  useEffect(() => {
    if (restaurant) {
      document.title = `${restaurant.name} — Menu digital | V'la le Menu !`;
    }
  }, [restaurant]);

  if (restaurant === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (restaurant === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background gap-3 p-6 text-center">
        <div className="clay-in flex size-14 items-center justify-center rounded-3xl bg-muted">
          <UtensilsCrossed className="size-6 text-muted-foreground" />
        </div>
        <h1 className="font-[Baloo_2] text-2xl font-extrabold">Menu introuvable</h1>
        <p className="text-sm text-muted-foreground">
          Ce lien ne correspond à aucun établissement.
        </p>
      </main>
    );
  }

  // JSON-LD Restaurant pour le SEO local
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    description: restaurant.tagline ?? undefined,
    servesCuisine: restaurant.establishmentType,
    telephone: restaurant.phone ?? undefined,
    address: restaurant.city
      ? { "@type": "PostalAddress", addressLocality: restaurant.city, addressCountry: "FR" }
      : undefined,
    hasMenu: typeof window !== "undefined" ? window.location.href : undefined,
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <MenuPreview
        restaurant={restaurant}
        menus={menus ?? undefined}
        appearance={appearance}
      />
    </>
  );
}
