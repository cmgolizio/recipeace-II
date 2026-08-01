// Recipe name → URL slug. Shared by every adapter: slugs are one namespace
// across domains, because /recipes/[slug] is one route.

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
