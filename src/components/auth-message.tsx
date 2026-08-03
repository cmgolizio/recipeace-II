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
      Add the ingredients you have on hand, they will be saved in your pantry.
    </p>
  ) : (
    <p className="text-muted">
      Add the ingredients you have on hand. Your bar is saved on this device;
      sign in to keep it across all of them.
    </p>
  );
}