-- Where a recipe came from, and on what terms (docs/expansion-plan.md §15,
-- §16.3 item 12, phase 8).
--
-- `source` already existed but only ever held the literal 'ai-generated'. Food
-- content is curated rather than generated (Decision 12), so provenance has to
-- be recordable: who it came from, where, and under what licence. Shared
-- fields — a cocktail has provenance too.
--
-- Nullable and un-backfilled on purpose: existing rows genuinely are
-- 'ai-generated' with no URL and no external licence.

alter table public.recipes
  add column source_url text,
  add column license text;

comment on column public.recipes.source is
  'Where this recipe came from: ''ai-generated'', ''original'', or the name of '
  'the publication or dataset it was licensed from.';
comment on column public.recipes.source_url is
  'Canonical URL of the source, when there is one. Null for original and '
  'AI-generated recipes.';
comment on column public.recipes.license is
  'The terms the content is used under (e.g. ''original'', ''CC-BY-4.0''). '
  'Recorded before publication — §15 requires source and licensing decisions '
  'to be written down, not assumed.';
