export const CATEGORIES = [
  { id: "fuel", label: "Fuel", badgeClass: "b-prog" },
  { id: "stock", label: "Stock", badgeClass: "b-new" },
  { id: "misc", label: "Misc", badgeClass: "b-pend" },
  { id: "other", label: "Other", badgeClass: "b-done" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function categoryBadgeClass(categoryId: string): string {
  const c = CATEGORIES.find((x) => x.id === categoryId);
  return c?.badgeClass ?? "b-pend";
}

export function categoryLabel(categoryId: string): string {
  const c = CATEGORIES.find((x) => x.id === categoryId);
  return c?.label ?? categoryId;
}
