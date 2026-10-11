import type { HeaderIcon as HeaderIconId } from "@/lib/theme";
import {
  Beer,
  CakeSlice,
  ChefHat,
  Coffee,
  Croissant,
  Fish,
  IceCreamCone,
  Pizza,
  Salad,
  Soup,
  Utensils,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<HeaderIconId, LucideIcon> = {
  utensils: UtensilsCrossed,
  couverts: Utensils,
  chef: ChefHat,
  wine: Wine,
  beer: Beer,
  coffee: Coffee,
  pizza: Pizza,
  fish: Fish,
  salad: Salad,
  croissant: Croissant,
  cake: CakeSlice,
  icecream: IceCreamCone,
  soup: Soup,
};

export function HeaderIcon({
  id,
  className,
}: {
  id: HeaderIconId;
  className?: string;
}) {
  const Icon = ICONS[id] ?? UtensilsCrossed;
  return <Icon className={className} aria-hidden />;
}
