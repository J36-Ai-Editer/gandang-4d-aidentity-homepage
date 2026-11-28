import { test } from "node:test";
import assert from "node:assert/strict";
import {
  START, NPC, decodeSave, depthAtFoot, encodeSave, findPath,
  freshSave, gridToWorld, inBounds, sameTile, walkable, worldToGrid
} from "./iso.ts";

test("grid/world coordinates round-trip across the village", () => {
  for (const tile of [
    { x: 0, y: 0 }, { x: 11, y: 0 },
    { x: 0, y: 11 }, { x: 11, y: 11 }, { x: 6, y: 4 }
  ]) {
    assert.deepEqual(worldToGrid(gridToWorld(tile)), tile);
  }
});

test("BFS avoids walls and respects the boundary", () => {
  const from = { x: 3, y: 7 };
  const to = { x: 7, y: 7 };
  const path = findPath(from, to);
  assert.deepEqual(path[0], from);
  assert.deepEqual(path.at(-1), to);
  assert.ok(path.length > 5);
  assert.ok(path.every(t => walkable(t)));
  assert.ok(path.slice(1).every((t, i) =>
    Math.abs(t.x - path[i].x) + Math.abs(t.y - path[i].y) === 1
  ));
  assert.deepEqual(findPath(from, { x: -1, y: 7 }), []);
  assert.deepEqual(findPath(from, { x: 5, y: 7 }), []);
  assert.equal(inBounds({ x: 12, y: 0 }), false);
  assert.equal(walkable(NPC), false);
});

test("depth is ordered by the feet, not the sprite top", () => {
  const behind = gridToWorld({ x: 2, y: 2 });
  const ahead = gridToWorld({ x: 6, y: 5 });
  assert.ok(depthAtFoot(behind.y) < depthAtFoot(ahead.y));
  assert.equal(depthAtFoot(behind.y), depthAtFoot(behind.y));
});

test("valid local save restores player and placed props", () => {
  const data = freshSave();
  data.player = { x: 5, y: 5 };
  data.placed = [{ x: 6, y: 6, kind: "flower" }];
  assert.deepEqual(decodeSave(encodeSave(data)), data);
});

test("damaged envelope resets; invalid, blocked and duplicate props are dropped", () => {
  assert.deepEqual(decodeSave("{"), freshSave());
  assert.deepEqual(decodeSave('{"version":2,"placed":[]}'), freshSave());
  const restored = decodeSave(JSON.stringify({
    version: 1,
    player: { x: 99, y: 0 },
    placed: [
      { x: 6, y: 6, kind: "flower" },
      { x: 6, y: 6, kind: "bench" },
      { x: 8, y: 8, kind: "flower" },
      { x: 7, y: 7, kind: "other" },
      { x: -1, y: 3, kind: "bench" },
      { x: START.x, y: START.y, kind: "lantern" }
    ]
  }));
  assert.ok(sameTile(restored.player, START));
  assert.deepEqual(restored.placed, [{ x: 6, y: 6, kind: "flower" }]);
});

