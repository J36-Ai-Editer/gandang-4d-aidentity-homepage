export const SIZE = 12;
export const SAVE_KEY = "gandang-isometric-poc-v1";
export const SAVE_VERSION = 1;
export const ORIGIN = { x: 480, y: 110 };
export const START = { x: 5, y: 4 };
export const NPC = { x: 7, y: 5 };

export type Tile = { x: number; y: number };
export type PropKind = "flower" | "lantern" | "bench";
export type Placement = Tile & { kind: PropKind };
export type SaveData = {
  version: 1;
  player: Tile;
  placed: Placement[];
};

const BLOCKS: Tile[] = [
  { x: 2, y: 2 }, { x: 3, y: 2 },
  { x: 8, y: 3 }, { x: 9, y: 3 },
  { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 },
  { x: 8, y: 8 }, { x: 8, y: 9 }, { x: 9, y: 8 },
  { x: 1, y: 7 }, { x: 10, y: 5 },
  NPC
];

export const sameTile = (a: Tile, b: Tile): boolean =>
  a.x === b.x && a.y === b.y;

export const tileKey = (t: Tile): string => `${t.x},${t.y}`;

export function gridToWorld(t: Tile): Tile {
  return {
    x: ORIGIN.x + (t.x - t.y) * 32,
    y: ORIGIN.y + (t.x + t.y) * 16
  };
}

export function worldToGrid(p: Tile): Tile {
  const dx = (p.x - ORIGIN.x) / 32;
  const dy = (p.y - ORIGIN.y) / 16;
  return { x: Math.round((dx + dy) / 2), y: Math.round((dy - dx) / 2) };
}

export function inBounds(t: Tile): boolean {
  return Number.isInteger(t.x) && Number.isInteger(t.y) &&
    t.x >= 0 && t.x < SIZE && t.y >= 0 && t.y < SIZE;
}

export function walkable(t: Tile, placed: readonly Placement[] = []): boolean {
  return inBounds(t) && !BLOCKS.some(b => sameTile(b, t)) &&
    !placed.some(p => sameTile(p, t));
}

/** Isometric overlap order: the sprite with the lower foot is drawn later. */
export function depthAtFoot(footY: number): number {
  return Math.round(footY * 10);
}

export function findPath(
  from: Tile,
  to: Tile,
  placed: readonly Placement[] = []
): Tile[] {
  if (!walkable(from, placed) || !walkable(to, placed)) return [];
  const queue: Tile[] = [from];
  const previous = new Map<string, Tile | null>([[tileKey(from), null]]);
  for (let head = 0; head < queue.length; head++) {
    const here = queue[head];
    if (sameTile(here, to)) break;
    for (const next of [
      { x: here.x + 1, y: here.y },
      { x: here.x - 1, y: here.y },
      { x: here.x, y: here.y + 1 },
      { x: here.x, y: here.y - 1 }
    ]) {
      const key = tileKey(next);
      if (!walkable(next, placed) || previous.has(key)) continue;
      previous.set(key, here);
      queue.push(next);
    }
  }
  if (!previous.has(tileKey(to))) return [];
  const path: Tile[] = [];
  for (let at: Tile | null = to; at !== null; at = previous.get(tileKey(at)) ?? null) {
    path.push(at);
  }
  return path.reverse();
}

export const freshSave = (): SaveData => ({
  version: SAVE_VERSION,
  player: { ...START },
  placed: []
});

function validTile(value: unknown): value is Tile {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.x === "number" && typeof item.y === "number" &&
    inBounds({ x: item.x, y: item.y });
}

function validKind(value: unknown): value is PropKind {
  return value === "flower" || value === "lantern" || value === "bench";
}

/** Never trust localStorage: reject an invalid envelope and filter invalid entries. */
export function decodeSave(text: string | null): SaveData {
  if (text === null) return freshSave();
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== "object" || data === null) return freshSave();
    const record = data as Record<string, unknown>;
    if (record.version !== SAVE_VERSION || !Array.isArray(record.placed)) {
      return freshSave();
    }
    const placed: Placement[] = [];
    for (const item of record.placed as unknown[]) {
      if (typeof item !== "object" || item === null) continue;
      const candidate = item as Record<string, unknown>;
      const kind = candidate.kind;
      if (!validTile(candidate) || !validKind(kind) ||
          !walkable(candidate, placed)) continue;
      placed.push({ x: candidate.x, y: candidate.y, kind });
    }
    const player = validTile(record.player) && walkable(record.player, placed)
      ? { x: record.player.x, y: record.player.y }
      : { ...START };
    // A damaged save must not put a decoration under the fallback player.
    return {
      version: SAVE_VERSION,
      player,
      placed: placed.filter(p => !sameTile(p, player))
    };
  } catch {
    return freshSave();
  }
}

export function encodeSave(data: SaveData): string {
  return JSON.stringify(data);
}

