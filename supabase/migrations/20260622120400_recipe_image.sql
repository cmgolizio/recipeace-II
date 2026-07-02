-- Recipe images (phase 9). Populated by the offline image step
-- (`npm run pipeline:images`), which uploads to the `recipe-images` Storage
-- bucket and stores the resulting public URL here. Nullable: a recipe without
-- a generated image simply renders without one.
alter table public.recipes add column if not exists image_url text;