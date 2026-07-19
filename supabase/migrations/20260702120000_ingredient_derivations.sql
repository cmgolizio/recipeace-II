-- ── Ingredient derivations (owning A physically yields B) ───────────────────
-- One-way edges: owning the source ingredient also grants the derived one as
-- an EXACT match (a whole orange yields orange peel/twist/juice by cutting or
-- juicing — no real preparation). The reverse does not hold: owning orange
-- peel does not grant a whole orange. Unlike substitutions ("close" matches),
-- derived ingredients count as "have".
create table public.ingredient_derivations (
  id          bigint generated always as identity primary key,
  source_id   bigint not null references public.ingredients (id) on delete cascade,
  derived_id  bigint not null references public.ingredients (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint ingredient_derivations_distinct check (source_id <> derived_id),
  constraint ingredient_derivations_unique unique (source_id, derived_id)
);

comment on table public.ingredient_derivations is
  'One-way physical derivations: owning source_id also counts as exactly having '
  'derived_id (whole orange -> orange twist / orange juice). The matcher expands '
  'the exact pantry set through these edges recursively.';

create index ingredient_derivations_derived_id_idx
  on public.ingredient_derivations (derived_id);

-- Reference data: world-readable, written only by the offline pipeline using
-- the secret key (which bypasses RLS — no write policies exist).
alter table public.ingredient_derivations enable row level security;

create policy "Derivations are readable by everyone"
  on public.ingredient_derivations for select using (true);