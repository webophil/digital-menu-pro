import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardShell } from "@/components/DashboardShell";
import { VisibilitySwitch } from "@/components/VisibilitySwitch";
import { DishThumb, PhotoUploader } from "@/components/PhotoUploader";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isProSubscription } from "@/convex/plans";
import { ALLERGENS, MENU_TYPES, menuTypeLabel, formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  Languages,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

interface DishDraft {
  _id?: Id<"dishes">;
  name: string;
  description: string;
  price: string;
  allergens: string[];
}

const emptyDish: DishDraft = {
  name: "",
  description: "",
  price: "",
  allergens: [],
};

function DishDialog({
  categoryId,
  initial,
  pro,
  onClose,
}: {
  categoryId: Id<"categories">;
  initial: DishDraft | null;
  pro: boolean;
  onClose: () => void;
}) {
  const isEdit = initial !== null;
  const create = useMutation(api.restaurants.createDish);
  const update = useMutation(api.restaurants.updateDish);
  const [draft, setDraft] = useState<DishDraft>(initial ?? emptyDish);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof DishDraft>(key: K, value: DishDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleAllergen = (code: string) =>
    setDraft((d) => ({
      ...d,
      allergens: d.allergens.includes(code)
        ? d.allergens.filter((a) => a !== code)
        : [...d.allergens, code],
    }));

  const submit = async () => {
    if (!draft.name.trim() || draft.price === "") {
      toast.error("Nom et prix sont obligatoires.");
      return;
    }
    const price = Number(draft.price.replace(",", "."));
    if (Number.isNaN(price) || price < 0) {
      toast.error("Prix invalide.");
      return;
    }
    setBusy(true);
    try {
      if (isEdit && draft._id) {
        await update({
          dishId: draft._id,
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          price,
          allergens: draft.allergens,
        });
        toast.success("Plat mis à jour");
      } else {
        await create({
          categoryId,
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          price,
          allergens: draft.allergens,
        });
        toast.success("Plat ajouté !");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="clay-card max-h-[90vh] overflow-y-auto rounded-3xl border-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[Baloo_2]">
            {isEdit ? "Modifier le plat" : "Nouveau plat"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Nom du plat *</Label>
            <Input
              className="clay-in h-11 rounded-2xl border-0 bg-muted"
              placeholder="Burger maison"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              className="clay-in min-h-20 rounded-2xl border-0 bg-muted"
              placeholder="Bœuf Angus, cheddar affiné, frites fraîches…"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Prix (€) *</Label>
            <Input
              className="clay-in h-11 rounded-2xl border-0 bg-muted"
              placeholder="18,00"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Allergènes (France — 14 obligatoires)</Label>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a: { code: string; labelFr: string; emoji: string }) => {
                const active = draft.allergens.includes(a.code);
                return (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => toggleAllergen(a.code)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                      active
                        ? "clay-btn clay-teal text-white"
                        : "clay-in bg-muted text-muted-foreground",
                    )}
                  >
                    <span>{a.emoji}</span>
                    {a.labelFr}
                    {active && <Check className="size-3" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Photos</Label>
            {isEdit && draft._id ? (
              <PhotoUploader dishId={draft._id} pro={pro} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Enregistrez le plat, puis ajoutez ses photos.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            className="clay-btn clay-teal w-full rounded-2xl font-bold text-white"
            onClick={submit}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Enregistrer" : "Ajouter le plat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MenuEditor() {
  const { menuId } = useParams<{ menuId: string }>();
  const navigate = useNavigate();
  const menu = useQuery(
    api.restaurants.getMenu,
    menuId ? { menuId: menuId as Id<"menus"> } : "skip",
  );
  const categories = useQuery(
    api.restaurants.listCategories,
    menuId ? { menuId: menuId as Id<"menus"> } : "skip",
  );
  const restaurant = useQuery(
    api.restaurants.getRestaurant,
    menu?.restaurantId ? { id: menu.restaurantId } : "skip",
  );
  const dishes = useQuery(
    api.restaurants.listDishes,
    restaurant ? { restaurantId: restaurant._id } : "skip",
  );
  const sub = useQuery(api.billing.getMySubscription);
  const translate = useAction(api.ai.translateAll);
  const createCategory = useMutation(api.restaurants.createCategory);
  const deleteCategory = useMutation(api.restaurants.deleteCategory);
  const deleteDish = useMutation(api.restaurants.deleteDish);
  const setMenuType = useMutation(api.restaurants.setMenuType);
  const setMenuActive = useMutation(api.restaurants.setMenuActive);
  const setCategoryActive = useMutation(api.restaurants.setCategoryActive);
  const updateDish = useMutation(api.restaurants.updateDish);

  const [dialog, setDialog] = useState<{
    categoryId: Id<"categories">;
    initial: DishDraft | null;
  } | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [translating, setTranslating] = useState(false);

  const pro = isProSubscription(sub);

  const dishesByCat = useMemo(() => {
    const map = new Map<string, NonNullable<typeof dishes>>();
    for (const d of dishes ?? []) {
      const list = map.get(d.categoryId) ?? [];
      list.push(d);
      map.set(d.categoryId, list);
    }
    return map;
  }, [dishes]);

  if (menu === undefined || categories === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (menu === null || categories === null) {
    return (
      <DashboardShell title="Menu introuvable">
        <p>Ce menu n'existe pas ou ne vous appartient pas.</p>
      </DashboardShell>
    );
  }

  const runTranslate = async () => {
    if (!restaurant) return;
    setTranslating(true);
    try {
      await translate({ restaurantId: restaurant._id });
      toast.success("Menu traduit en EN, ES et DE !");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setTranslating(false);
    }
  };

  return (
    <DashboardShell
      title={menu.name}
      subtitle="Organisez vos catégories et vos plats"
      actions={
        <>
          <Button
            variant="outline"
            className="clay-sm rounded-2xl border-0 bg-card font-bold"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="size-4" /> Mes menus
          </Button>
          <Button
            className="clay-btn rounded-2xl font-bold text-clay-deep"
            variant="outline"
            disabled={translating}
            onClick={runTranslate}
            title={pro ? "Traduire tout le menu" : "Réservé au plan Pro"}
          >
            {translating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Languages className="size-4" />
            )}
            {pro ? "Traduire EN/ES/DE" : "Traduction (Pro)"}
          </Button>
        </>
      }
    >
      {/* Bandeau type de menu */}
      <div className="clay-flat mb-6 flex flex-wrap items-center gap-3 rounded-3xl bg-card p-4">
        <span className="text-sm font-bold">Type de menu :</span>
        <div className="flex flex-wrap gap-2">
          {MENU_TYPES.map((t: { value: string; label: string }) => (
            <button
              key={t.value}
              onClick={() =>
                setMenuType({ menuId: menu._id, menuType: t.value }).catch(
                  (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
                )
              }
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                menu.menuType === t.value
                  ? "clay-btn clay-teal text-white"
                  : "clay-in bg-muted text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <VisibilitySwitch
            active={menu.active !== false}
            labelWhenOff="Masqué au client"
            onToggle={(next) =>
              setMenuActive({ menuId: menu._id, active: next }).then(() =>
                toast.success(
                  next
                    ? `Menu « ${menu.name} » affiché au client`
                    : `Menu « ${menu.name} » masqué du menu client`,
                ),
              )
            }
          />
        </div>
      </div>

      {!pro && (
        <div className="clay-butter clay-flat mb-6 flex items-center gap-3 rounded-3xl p-4 text-sm">
          <Languages className="size-5 shrink-0 text-[oklch(0.5_0.1_70)]" />
          <p className="flex-1 text-[oklch(0.38_0.07_70)]">
            <strong>Traduction automatique</strong> (anglais, espagnol, allemand)
            réservée au plan Pro.
          </p>
          <Link to="/subscription">
            <Button size="sm" className="rounded-2xl bg-white font-bold text-clay-deep hover:bg-white/90">
              Passer Pro
            </Button>
          </Link>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Colonnes catégories */}
        <div className="space-y-8">
          {categories.length === 0 && (
            <div className="clay-flat rounded-3xl bg-card p-8 text-center text-muted-foreground">
              Ajoutez votre première catégorie (Entrées, Plats, Desserts…).
            </div>
          )}
          {categories.map((cat) => {
            const catDishes = dishesByCat.get(cat._id) ?? [];
            return (
              <section key={cat._id}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2
                    className={cn(
                      "flex items-center gap-2 font-[Baloo_2] text-xl font-extrabold",
                      cat.active === false && "opacity-50",
                    )}
                  >
                    <span className="text-2xl">{cat.emoji ?? "🍽️"}</span>
                    {cat.name}
                    <Badge className="clay-in rounded-full border-0 bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {catDishes.length}
                    </Badge>
                  </h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <VisibilitySwitch
                      active={cat.active !== false}
                      labelWhenOff="Masquée"
                      onToggle={(next) =>
                        setCategoryActive({ categoryId: cat._id, active: next }).then(() =>
                          toast.success(
                            next
                              ? `Catégorie « ${cat.name} » affichée au client`
                              : `Catégorie « ${cat.name} » masquée du menu client`,
                          ),
                        )
                      }
                    />
                    <Button
                      size="sm"
                      className="clay-btn clay-teal rounded-2xl font-bold text-white"
                      onClick={() => setDialog({ categoryId: cat._id, initial: null })}
                    >
                      <Plus className="size-3.5" /> Plat
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-2xl text-muted-foreground"
                      onClick={() => {
                        if (
                          confirm(
                            `Supprimer la catégorie « ${cat.name} » et tous ses plats ?`,
                          )
                        ) {
                          deleteCategory({ categoryId: cat._id }).catch((e) =>
                            toast.error(e instanceof Error ? e.message : "Erreur"),
                          );
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {catDishes.length === 0 ? (
                  <button
                    className="clay-in w-full rounded-3xl bg-muted/60 p-5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
                    onClick={() => setDialog({ categoryId: cat._id, initial: null })}
                  >
                    + Ajouter un plat dans {cat.name}
                  </button>
                ) : (
                  <div className="space-y-3">
                    {catDishes.map((d) => (
                      <div
                        key={d._id}
                        className={cn(
                          "clay-flat flex items-center gap-3 rounded-3xl bg-card p-3 transition-opacity",
                          d.published === false && "opacity-60",
                        )}
                      >
                        <DishThumb dishId={d._id} imageUrl={d.imageUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{d.name}</p>
                          {d.description && (
                            <p className="truncate text-xs text-muted-foreground">
                              {d.description}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {d.allergens.map((code) => {
                              const a = ALLERGENS.find((al) => al.code === code);
                              return (
                                <span
                                  key={code}
                                  className="rounded-full bg-muted px-1.5 text-[10px]"
                                  title={a?.labelFr}
                                >
                                  {a?.emoji}
                                </span>
                              );
                            })}
                            {(d.nameEn || d.nameEs || d.nameDe) && (
                              <Badge className="ml-1 rounded-full border-0 bg-[oklch(0.91_0.06_200)] px-2 py-0 text-[10px] font-bold text-clay-deep">
                                <Languages className="mr-0.5 size-2.5" /> traduit
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <VisibilitySwitch
                            active={d.published !== false}
                            labelWhenOff="Rupture"
                            onToggle={(next) =>
                              updateDish({ dishId: d._id, published: next }).then(() =>
                                toast.success(
                                  next
                                    ? `« ${d.name} » est de retour sur le menu`
                                    : `« ${d.name} » masqué (rupture de stock)`,
                                ),
                              )
                            }
                          />
                          <span className="font-[Baloo_2] text-lg font-extrabold text-clay-deep">
                            {formatPrice(d.price)}
                          </span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-xl"
                            onClick={() =>
                              setDialog({
                                categoryId: cat._id,
                                initial: {
                                  _id: d._id,
                                  name: d.name,
                                  description: d.description ?? "",
                                  price: String(d.price),
                                  allergens: [...d.allergens],
                                },
                              })
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-xl text-destructive"
                            onClick={() => {
                              if (confirm(`Supprimer « ${d.name} » ?`)) {
                                deleteDish({ dishId: d._id }).catch((e) =>
                                  toast.error(e instanceof Error ? e.message : "Erreur"),
                                );
                              }
                            }}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* Nouvelle catégorie */}
          <div className="clay-flat flex gap-2 rounded-3xl bg-card p-4">
            <Input
              className="clay-in h-11 flex-1 rounded-2xl border-0 bg-muted"
              placeholder="Nouvelle catégorie (ex : Boissons)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCatName.trim()) {
                  createCategory({ menuId: menu._id, name: newCatName.trim() })
                    .then(() => setNewCatName(""))
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Erreur"),
                    );
                }
              }}
            />
            <Button
              className="clay-btn clay-teal rounded-2xl font-bold text-white"
              disabled={!newCatName.trim()}
              onClick={() =>
                createCategory({ menuId: menu._id, name: newCatName.trim() })
                  .then(() => setNewCatName(""))
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : "Erreur"),
                  )
              }
            >
              <Plus className="size-4" /> Ajouter
            </Button>
          </div>
        </div>

        {/* Aperçu mobile */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <p className="mb-3 text-center text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Aperçu client
            </p>
            <div className="clay mx-auto w-72 rounded-[2.5rem] bg-card p-3">
              <div className="overflow-hidden rounded-[2rem] bg-background">
                <div className="clay-teal px-4 pt-4 pb-7">
                  <p className="text-[10px] font-bold tracking-wide text-white/80 uppercase">
                    {restaurant?.name ?? "Votre établissement"}
                  </p>
                  <p className="font-[Baloo_2] text-lg font-extrabold text-white">
                    {menu.name}
                  </p>
                </div>
                <div className="-mt-3 space-y-2 p-3">
                  {categories.slice(0, 4).map((cat) => (
                    <div key={cat._id} className="clay-flat rounded-2xl bg-card p-2.5">
                      <p className="flex items-center gap-1.5 text-sm font-bold">
                        <span>{cat.emoji ?? "🍽️"}</span> {cat.name}
                      </p>
                      {(dishesByCat.get(cat._id) ?? []).slice(0, 2).map((d) => (
                        <div
                          key={d._id}
                          className="mt-1.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-muted-foreground">{d.name}</span>
                          <span className="font-bold">{formatPrice(d.price)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      L'aperçu apparaîtra ici.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {dialog && restaurant && (
        <DishDialog
          categoryId={dialog.categoryId}
          initial={dialog.initial}
          pro={pro}
          onClose={() => setDialog(null)}
        />
      )}
    </DashboardShell>
  );
}
