// What a dry run has to show before anyone trusts an import
// (docs/expansion-plan.md §16.5). Building the report and printing it are
// separate: the shape is asserted by tests, the text is for a human.

export type RecipeReport = {
  name: string;
  slug: string;
  domain: string;
  published: boolean;
  /** One line per ingredient, as it will be stored. */
  lines: string[];
  warnings: string[];
};

export type IngestReport = {
  /** Everything the source declared. */
  catalog: {
    recipes: number;
    proposedIngredients: string[];
    proposedAliases: string[];
  };
  accepted: RecipeReport[];
  rejected: { name: string; reason: string }[];
  /** Ingredient names no alias or canonical row resolves. */
  unresolved: string[];
  /** Slugs or names that collide with each other or with the catalog. */
  duplicates: string[];
  /** The writes this run would perform, in order. */
  operations: string[];
};

export function isClean(report: IngestReport): boolean {
  return (
    report.rejected.length === 0 &&
    report.unresolved.length === 0 &&
    report.duplicates.length === 0
  );
}

function section(title: string, lines: string[]): string[] {
  return lines.length === 0 ? [] : [`${title}:`, ...lines.map((l) => `  ${l}`)];
}

/** Human-readable dry-run output. Every field of the report is represented. */
export function formatReport(report: IngestReport): string {
  const out: string[] = [
    `${report.catalog.recipes} recipe(s) in the catalog · ` +
      `${report.accepted.length} accepted · ${report.rejected.length} rejected`,
    "",
  ];

  for (const recipe of report.accepted) {
    out.push(
      `▸ ${recipe.name} (${recipe.slug}) — ${recipe.domain}, ` +
        `${recipe.published ? "published" : "unpublished (awaiting review)"}`,
    );
    out.push(...recipe.lines.map((l) => `    ${l}`));
    out.push(...recipe.warnings.map((w) => `    ! ${w}`));
    out.push("");
  }

  out.push(
    ...section(
      "Rejected",
      report.rejected.map((r) => `${r.name}: ${r.reason}`),
    ),
    ...section("Unresolved ingredients", report.unresolved),
    ...section("Duplicate candidates", report.duplicates),
    ...section("New canonical ingredients", report.catalog.proposedIngredients),
    ...section("New aliases", report.catalog.proposedAliases),
    ...section("Database operations", report.operations),
  );

  if (isClean(report)) {
    out.push("", "No unresolved ingredients, duplicates or rejections.");
  }
  return out.join("\n");
}