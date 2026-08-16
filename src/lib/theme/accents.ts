export const ACCENTS = ["blue", "magenta", "pink", "lime", "cyan"] as const;
export type Accent = (typeof ACCENTS)[number];

/**
 * How many previously dealt colours a new pick must differ from. 3 covers 1-,
 * 2- and 3-column grids, where a cell's neighbours are i±1, i±2 and i±3.
 */
const LOOKBACK = 3;

/** FNV-1a. Stable across server and client — never Math.random() at render. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Seeded Fisher–Yates over the palette (mulberry32 PRNG). */
function shuffled(seed: number): Accent[] {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bag: Accent[] = [...ACCENTS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/**
 * Deal one accent per key. Guarantees, by construction:
 *  - counts across the list differ by at most 1 (equal dispersion)
 *  - no two entries within LOOKBACK positions share a colour
 *  - identical output for identical input, on server and client
 *
 * The bag holds all five and is refilled only once empty, which is what keeps
 * the counts even. The recent-window check is what makes bag boundaries safe —
 * within a single bag every colour is already distinct.
 */
export function dealAccents(keys: readonly string[]): Accent[] {
  const seed = hash(`${keys[0] ?? ""}:${keys.length}`);
  const out: Accent[] = [];
  let bag: Accent[] = [];
  let round = 0;

  for (let i = 0; i < keys.length; i++) {
    if (bag.length === 0) bag = shuffled(seed + round++);
    const recent = out.slice(-LOOKBACK);
    // With five colours and LOOKBACK 3 this never returns -1: a bag is only
    // refilled at full size, and remaining bag entries are by definition not
    // yet dealt from this bag. The fallback exists so a future palette or
    // lookback change degrades instead of throwing.
    let pick = bag.findIndex((a) => !recent.includes(a));
    if (pick === -1) pick = 0;
    out.push(bag[pick]);
    bag.splice(pick, 1);
  }
  return out;
}

/** For a lone component with no neighbours to avoid — stable per key. */
export function accentFor(key: string): Accent {
  return ACCENTS[hash(key) % ACCENTS.length];
}

/** The class that rebinds --accent for a subtree (D6). */
export function accentClass(accent: Accent): string {
  return `accent-${accent}`;
}
