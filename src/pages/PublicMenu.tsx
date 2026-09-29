import { allergenLabel, formatPrice, ALLERGENS, LANGS, type LangCode, cn } from "@/lib/utils";
import {
  ChevronDown,
  Languages,
  Loader2,
  MapPin,
  Phone,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

const TYPE_EMOJI: Record<string, string> = {
  carte: "📖",
  "menu-du-jour": "✨",
  soir: "🌙",
  enfants: "🧒",
  boissons: "🥤",
  autre: "🍴",
};

/**
 * Rendu complet du menu client tel que le voient les clients.
 * Utilisé par la page publique /m/:slug et par l'aperçu en modale
 * de l'espace restaurateur.
 */
export function MenuPreview({
  restaurant,
  menus,
  className = "mx-auto flex min-h-screen w-full max-w-md flex-col",
}: {
  restaurant: Doc<"restaurants">;
  menus: Doc<"menus">[] | undefined;
  className?: string;
}) {
  const [lang, setLang] = useState<LangCode>("fr");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

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
    <div className={className}>

      {/* En-tête vitrine */}
      <header className="clay-teal px-6 pt-10 pb-12 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-[1.5rem] bg-white/20 backdrop-blur">
          <UtensilsCrossed className="size-8 text-white" />
        </div>
        <h1 className="font-[Baloo_2] text-3xl font-extrabold text-white">{name}</h1>
        {tagline && <p className="mt-1.5 text-sm text-white/85">{tagline}</p>}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs font-semibold text-white/80">
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
          <div className="clay flex gap-1.5 overflow-x-auto rounded-3xl bg-card p-2">
            {menus.map((m) => (
              <button
                key={m._id}
                onClick={() => {
                  setActiveMenuId(m._id);
                  setOpenCats({});
                }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-bold transition-all",
                  menu?._id === m._id
                    ? "clay-btn clay-teal text-white"
                    : "text-muted-foreground",
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
        <Languages className="size-4 text-muted-foreground" />
        {LANGS.map((l: { code: string; label: string; flag: string }) => {
          // L'affichage retombe sur le FR si la traduction manque
          return (
            <button
              key={l.code}
              onClick={() => setLang(l.code as LangCode)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                lang === l.code
                  ? "clay-btn clay-teal text-white"
                  : "clay-in bg-muted text-muted-foreground",
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
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {categories?.length === 0 && (
          <p className="clay-flat rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground">
            Le menu arrive bientôt !
          </p>
        )}
        {categories?.map((cat) => {
          const open = openCats[cat._id] ?? true;
          const dishes = (dishesLists ?? []).filter((d) => d.categoryId === cat._id);
          return (
            <section key={cat._id} className="clay-flat overflow-hidden rounded-3xl bg-card">
              <button
                className="flex w-full items-center justify-between px-5 py-4"
                onClick={() => setOpenCats((s) => ({ ...s, [cat._id]: !open }))}
              >
                <span className="flex items-center gap-2 font-[Baloo_2] text-lg font-extrabold">
                  <span className="text-xl">{cat.emoji ?? "🍽️"}</span>
                  {cat.name}
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>
              {open && (
                <div className="space-y-3 px-4 pb-4">
                  {dishes.length === 0 && (
                    <p className="px-1 text-xs text-muted-foreground">—</p>
                  )}
                  {dishes.map((d) => {
                    const dName = localize(d.name, d.nameEn, d.nameEs, d.nameDe);
                    const dDesc = localize(
                      d.description ?? undefined,
                      d.descriptionEn,
                      d.descriptionEs,
                      d.descriptionDe,
                    );
                    return (
                      <article key={d._id} className="flex gap-3">
                        {d.imageUrl && (
                          <img
                            src={d.imageUrl}
                            alt={dName}
                            loading="lazy"
                            className="size-20 shrink-0 rounded-2xl object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-sm font-bold">{dName}</h3>
                            <span className="font-[Baloo_2] shrink-0 text-base font-extrabold text-clay-deep">
                              {formatPrice(d.price)}
                            </span>
                          </div>
                          {dDesc && (
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
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
                                    className="clay-in flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
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

        <footer className="pt-4 text-center text-[11px] text-muted-foreground">
          <p>
            Allergènes : information fournie à titre indicatif, signalez toute
            allergie au personnel.
          </p>
          <p className="mt-1">
            <a href="/" className="font-semibold">
              Menu digital par V'la le Menu !
            </a>
          </p>
        </footer>
      </main>
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
      <MenuPreview restaurant={restaurant} menus={menus ?? undefined} />
    </>
  );
}
