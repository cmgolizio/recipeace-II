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

  // Both surfaces this renders on are shared — the chooser at `/` and the
  // combined pantry — so the message is about where the pantry lives, not
  // about adding to it. There is nothing to add on the chooser.
  return user ? (
    <p className="text-muted">
      Your pantry is saved to your account, on every device you sign in on.
    </p>
  ) : (
    <p className="text-muted">
      Your pantry is saved on this device; sign in to keep it across all of
      them.
    </p>
  );
}