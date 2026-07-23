"use client";

import { usePantryReady, useUser } from "../lib/pantry/store";

export function AuthMessage() {
  const ready = usePantryReady();
  const user = useUser();

  // Auth resolves on the client *after* mount (useUser starts null, then
  // fills in). Render nothing until ready so a signed-in user never flashes
  // the logged-out message for a frame. This is the same gate FavoriteButton
  // and the header badge use.
  if (!ready) return null;

  return user ? (
    <p className="text-muted">
          Add the cocktail ingredients you have InHome!
        </p>
  ) : (
    <p className="text-muted">
          Add the cocktail ingredients you have InHome. Your bar stock will be saved temporarily. Sign in to save it permanently across all your devices!
        </p>
  );
}