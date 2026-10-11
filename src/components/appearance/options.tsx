import {
  CARD_STYLE_CLASS,
  CARD_STYLE_META,
  CARD_STYLE_VALUES,
  CATEGORY_STYLE_META,
  CATEGORY_STYLE_VALUES,
  DIVIDER_META,
  DIVIDER_VALUES,
  type CardStyle,
  type CategoryStyle,
  type Divider,
} from "@/lib/theme";
import type { ReactNode } from "react";

export const dividerOptions: { value: Divider; label: string; preview: ReactNode }[] =
  DIVIDER_VALUES.map((d) => ({
    value: d,
    label: DIVIDER_META[d].label,
    preview: (
      <span className="flex h-5 items-center justify-center text-sm">
        {DIVIDER_META[d].glyph}
      </span>
    ),
  }));

const categoryPreviews: Record<CategoryStyle, ReactNode> = {
  left: (
    <span className="flex w-full flex-col gap-1 rounded-lg bg-muted/70 px-2 py-2">
      <span className="h-1.5 w-3/4 rounded-full bg-current" />
      <span className="h-1 w-1/2 rounded-full bg-current" />
    </span>
  ),
  center: (
    <span className="flex w-full flex-col items-center gap-1 rounded-lg bg-muted/70 px-2 py-2">
      <span className="h-1.5 w-2/3 rounded-full bg-current" />
      <span className="h-1 w-1/3 rounded-full bg-current" />
    </span>
  ),
  framed: (
    <span className="m-frame flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2">
      <span className="h-1.5 w-2/3 rounded-full bg-current" />
      <span className="h-1 w-1/3 rounded-full bg-current" />
    </span>
  ),
};

export const categoryStyleOptions = CATEGORY_STYLE_VALUES.map((c) => ({
  value: c,
  label: CATEGORY_STYLE_META[c],
  preview: categoryPreviews[c],
}));

export const cardStyleOptions = CARD_STYLE_VALUES.map((c: CardStyle) => ({
  value: c,
  label: CARD_STYLE_META[c],
  preview: (
    <span
      className={`block h-9 w-full rounded-lg ${CARD_STYLE_CLASS[c]}`}
      style={{ background: "var(--m-surface)" }}
    />
  ),
}));
