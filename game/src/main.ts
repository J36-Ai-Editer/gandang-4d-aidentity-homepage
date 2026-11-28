import * as ex from "excalibur";
import {
  NPC, SAVE_KEY, SIZE, type Placement, type PropKind, type Tile,
  decodeSave, depthAtFoot, encodeSave, findPath, gridToWorld, sameTile,
  walkable, worldToGrid
} from "./iso.ts";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const debug = document.querySelector<HTMLOutputElement>("#debug")!;
const message = document.querySelector<HTMLElement>("#message")!;
const confirm = document.querySelector<HTMLButtonElement>("#confirm")!;
const cancel = document.querySelector<HTMLButtonElement>("#cancel")!;
const atlas = new Image();
atlas.src = "/assets/korean-village-atlas.png";
let artworkReady = false;
try { await atlas.decode(); artworkReady = true; }
catch { message.textContent = "마을 그림을 불러오지 못했습니다. 기본 그림으로 체험하거나 새로고침해 주세요."; }
function artwork(ctx: CanvasRenderingContext2D, quadrant: number, width: number, height: number): void {
  const cell = atlas.naturalWidth / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, (quadrant % 2) * cell, Math.floor(quadrant / 2) * cell,
    cell, cell, 0, 0, width, height);
}
const engine = new ex.Engine({
  width: 960, height: 560, canvasElementId: "game",
  backgroundColor: ex.Color.fromHex("#dce7d3"), antialiasing: false
});

type Draw = (ctx: CanvasRenderingContext2D) => void;
function picture(width: number, height: number, draw: Draw): ex.Canvas {
  return new ex.Canvas({ width, height, draw });
}
function sprite(tile: Tile, width: number, height: number, draw: Draw): ex.Actor {
  const foot = gridToWorld(tile);
  const actor = new ex.Actor({
    x: foot.x, y: foot.y - height / 2, width, height
  });
  actor.graphics.use(picture(width, height, draw));
  actor.z = depthAtFoot(foot.y);
  engine.add(actor);
  return actor;
}
function polygon(ctx: CanvasRenderingContext2D, points: number[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number,
  w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function ground(ctx: CanvasRenderingContext2D, tile: Tile): void {
  const road = tile.x === 5 || (tile.y === 5 && tile.x > 2 && tile.x < 10);
  const field = tile.y >= 9 && (tile.x === 4 || tile.x === 5);
  polygon(ctx, [32, 0, 64, 16, 32, 32, 0, 16],
    road ? "#d6bb91" : field ? "#9d805b" : (tile.x + tile.y) % 2 ? "#9eae75" : "#a4b57c");
  // Repeatable pixel texture; no random shimmer between frames.
  let seed = tile.x * 71 + tile.y * 139 + 13;
  for (let i = 0; i < 13; i++) {
    seed = (seed * 16807) % 2147483647;
    const x = 8 + seed % 48;
    const y = 8 + (seed >> 6) % 16;
    if (Math.abs(x - 32) / 32 + Math.abs(y - 16) / 16 < .9)
      box(ctx, x, y, road ? 4 : 2, 1, road ? "#bca47d" : "#889e68");
  }
  if (field) {
    for (let i = 9; i < 57; i += 12) box(ctx, i, 14, 5, 4, "#6dac48");
  }
}
function house(ctx: CanvasRenderingContext2D): void {
  if (artworkReady) { artwork(ctx, 0, 170, 160); return; }
  polygon(ctx, [14, 56, 53, 75, 94, 52, 55, 34], "#9c8062");
  polygon(ctx, [53, 75, 94, 52, 94, 81, 53, 100], "#d8b98b");
  polygon(ctx, [14, 56, 53, 75, 53, 100, 14, 80], "#f1dbaf");
  polygon(ctx, [5, 49, 49, 65, 60, 42, 18, 27], "#414b59");
  polygon(ctx, [49, 65, 103, 48, 91, 23, 60, 42], "#56606b");
  ctx.strokeStyle = "#292f3c";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(4, 51); ctx.lineTo(49, 68); ctx.lineTo(104, 50); ctx.stroke();
  for (const x of [20, 43]) box(ctx, x, 70, 4, 18, "#865339");
  box(ctx, 30, 77, 11, 19, "#926644");
  box(ctx, 66, 65, 15, 11, "#b9d5d1");
  box(ctx, 71, 65, 3, 11, "#805a3d");
}
function tree(ctx: CanvasRenderingContext2D): void {
  if (artworkReady) { artwork(ctx, 1, 140, 150); return; }
  box(ctx, 34, 42, 8, 35, "#74543b");
  for (const [x, y, r] of [[38, 23, 20], [22, 37, 15], [51, 36, 16]]) {
    ctx.fillStyle = "#397d57";
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
  }
  box(ctx, 34, 35, 7, 3, "#89bc76");
}
function drawProp(ctx: CanvasRenderingContext2D, kind: PropKind): void {
  if (kind === "flower") {
    box(ctx, 13, 22, 5, 10, "#4a9156");
    for (const [x, y] of [[12, 20], [20, 17], [24, 24]]) {
      box(ctx, x, y, 7, 6, "#e889a4");
      box(ctx, x + 2, y + 2, 3, 2, "#f6df80");
    }
  } else if (kind === "lantern") {
    box(ctx, 15, 8, 3, 23, "#6a5140");
    box(ctx, 10, 10, 13, 12, "#e8b569");
    box(ctx, 9, 8, 15, 3, "#4b5158");
    box(ctx, 12, 22, 9, 2, "#4b5158");
  } else {
    box(ctx, 5, 15, 23, 7, "#a96c47");
    box(ctx, 6, 22, 4, 9, "#694a3b");
    box(ctx, 24, 22, 4, 9, "#694a3b");
    box(ctx, 6, 10, 22, 5, "#b87b52");
  }
}
type Facing = "up" | "down" | "left" | "right";
function avatar(ctx: CanvasRenderingContext2D, facing: Facing, step: number,
  npc = false): void {
  const skin = "#f4c9a8";
  const coat = npc ? "#a56f94" : "#79a8c7";
  const hair = npc ? "#554455" : "#3d3944";
  // Native 32 × 48 canvas: large head, short torso and alternating feet.
  box(ctx, 9, 34, 5, step ? 12 : 10, "#554b61");
  box(ctx, 19, 34, 5, step ? 10 : 12, "#554b61");
  box(ctx, 7, 24, 19, 13, coat);
  box(ctx, 14, 25, 4, 11, "#f7e5ce");
  box(ctx, 3, 26, 4, 9, skin);
  box(ctx, 26, 26, 4, 9, skin);
  box(ctx, 7, 5, 19, 23, "#bb876b");
  box(ctx, 5, 8, 23, 15, skin);
  box(ctx, 8, 5, 17, 22, skin);
  box(ctx, 5, 5, 23, 7, hair);
  box(ctx, 9, 3, 15, 5, hair);
  box(ctx, 9, 6, 12, 2, npc ? "#79606b" : "#62564c");
  box(ctx, 6, 11, 3, 7, hair);
  box(ctx, 25, 11, 3, 7, hair);
  if (facing !== "up") {
    if (facing === "left") {
      box(ctx, 10, 17, 2, 3, hair);
    } else if (facing === "right") {
      box(ctx, 22, 17, 2, 3, hair);
    } else {
      box(ctx, 11, 17, 2, 3, hair);
      box(ctx, 21, 17, 2, 3, hair);
      box(ctx, 8, 21, 4, 2, "#db9c90");
      box(ctx, 23, 21, 3, 2, "#db9c90");
      box(ctx, 16, 23, 3, 1, "#a66f64");
    }
  }
  box(ctx, 12, 36, 10, 2, npc ? "#eac5ca" : "#f5d6a4");
  polygon(ctx, [9, 27, 16, 33, 23, 27, 17, 36], "#fff0d5");
  box(ctx, 17, 32, 8, 2, npc ? "#743d67" : "#304f6d");
  if (npc) { box(ctx, 24, 8, 6, 5, "#dda7ad"); box(ctx, 26, 9, 2, 2, "#ffdea5"); }
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const tile = { x, y };
    const actor = sprite(tile, 64, 32, ctx => ground(ctx, tile));
    actor.z = -1000;
  }
}
for (const tile of [{ x: 2, y: 2 }, { x: 8, y: 3 }]) {
  sprite(tile, 170, 160, tile.x === 2 ? house : ctx => {
    if (artworkReady) artwork(ctx, 2, 170, 160); else house(ctx);
  });
}
for (const tile of [{ x: 1, y: 7 }, { x: 10, y: 5 }]) {
  sprite(tile, 140, 150, tile.x === 1 ? ctx => {
    if (artworkReady) artwork(ctx, 3, 140, 150); else tree(ctx);
  } : tree);
}
for (const tile of [{ x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }]) {
  sprite(tile, 64, 32, ctx => {
    polygon(ctx, [9, 14, 31, 4, 54, 14, 32, 25], "#c3b9a0");
    box(ctx, 13, 15, 39, 8, "#a49c88");
  });
}
for (const tile of [{ x: 8, y: 8 }, { x: 8, y: 9 }, { x: 9, y: 8 }]) {
  sprite(tile, 64, 32, ctx => {
    polygon(ctx, [5, 16, 32, 3, 59, 16, 32, 29], "#6db7c3");
    polygon(ctx, [16, 16, 32, 9, 49, 16, 32, 24], "#88d3cf");
  });
}

let saved;
try { saved = decodeSave(localStorage.getItem(SAVE_KEY)); }
catch { saved = decodeSave(null); }
let position: Tile = { ...saved.player };
const placed: Placement[] = [...saved.placed];

function addPlacement(item: Placement): void {
  sprite(item, 32, 32, ctx => drawProp(ctx, item.kind));
}
for (const item of placed) addPlacement(item);

function character(ctx: CanvasRenderingContext2D, direction: Facing, step: number, npc = false): void {
  ctx.save(); ctx.scale(4 / 3, 4 / 3); avatar(ctx, direction, step, npc); ctx.restore();
}
sprite(NPC, 44, 64, ctx => character(ctx, "down", 0, true));
const hero = sprite(position, 44, 64, ctx => character(ctx, "down", 0));
const frames = new Map<string, ex.Canvas>();
for (const facing of ["up", "down", "left", "right"] as const) {
  for (const step of [0, 1]) {
    frames.set(`${facing}-${step}`, picture(44, 64, ctx => character(ctx, facing, step)));
  }
}
let facing: Facing = "down";
let walkFrame = 0;
let path: Tile[] = [];
let elapsed = 0;
let selection: PropKind | null = null;
let previewTile: Tile | null = null;
const preview = sprite({ x: -30, y: -30 }, 32, 32, ctx => drawProp(ctx, "flower"));
preview.z = 10000;

function report(text: string): void {
  message.textContent = text;
}
function refresh(): void {
  debug.textContent = `플레이어: (${position.x}, ${position.y}) · 배치: ${placed.length}개`;
  confirm.disabled = !selection || !previewTile;
  cancel.disabled = !selection;
}
function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, encodeSave({
      version: 1, player: position, placed
    }));
  } catch {
    report("이 브라우저에서는 체험 상태를 저장할 수 없습니다.");
  }
}
function hidePreview(): void {
  previewTile = null;
  preview.pos.x = -300;
  preview.pos.y = -300;
  refresh();
}
function stepTo(next: Tile): void {
  if (!walkable(next, placed)) return;
  facing = next.x > position.x ? "right" : next.x < position.x ? "left" :
    next.y > position.y ? "down" : "up";
  position = { ...next };
  walkFrame = 1 - walkFrame;
  hero.graphics.use(frames.get(`${facing}-${walkFrame}`)!);
  const foot = gridToWorld(position);
  hero.pos.x = foot.x;
  hero.pos.y = foot.y - 32;
  hero.z = depthAtFoot(foot.y);
  persist();
  refresh();
}
const held = new Set<Facing>();
function stepDirection(dir: Facing): void {
  const offsets: Record<Facing, Tile> = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  const d = offsets[dir];
  stepTo({ x: position.x + d.x, y: position.y + d.y });
}
const keys: Record<string, Facing> = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right"
};
let quest: "not-started" | "plant" | "return" | "done" = "not-started";
const questProgress = document.querySelector<HTMLElement>("#quest-progress")!;
function talk(): void {
  const distance = Math.abs(position.x - NPC.x) + Math.abs(position.y - NPC.y);
  if (distance > 2) { report("보라색 옷의 마을지기에게 조금 더 가까이 다가가세요."); return; }
  if (quest === "not-started") {
    quest = "plant";
    questProgress.textContent = "② 꽃밭을 고르고 빈 칸에 새로 배치하세요.";
    report("마을지기: 잘 오셨어요. 마을길에 꽃밭 하나를 놓아 주시겠어요?");
  } else if (quest === "return") {
    quest = "done";
    questProgress.textContent = "✓ 첫 의뢰 완료! 자유롭게 마을을 꾸며 보세요.";
    report("마을지기: 덕분에 마을이 환해졌네요. 이곳에서 편히 쉬었다 가세요.");
  } else if (quest === "plant") {
    report("마을지기: 꽃밭을 선택하고 빈 칸을 누른 뒤 배치를 확정해 주세요.");
  } else {
    report("마을지기: 꽃이 참 예쁘네요. 오늘도 반가워요!");
  }
}
window.addEventListener("keydown", event => {
  const dir = keys[event.code];
  if (dir) {
    event.preventDefault();
    if (!held.has(dir)) { stepDirection(dir); elapsed = 0; }
    held.add(dir);
    path = [];
  } else if (event.code === "KeyE" && !event.repeat) {
    talk();
  }
});
window.addEventListener("keyup", event => {
  const dir = keys[event.code];
  if (dir) held.delete(dir);
});
window.addEventListener("blur", () => held.clear());
document.querySelector<HTMLButtonElement>("#talk")!.addEventListener("click", talk);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-dir]")) {
  const dir = button.dataset.dir as Facing;
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    stepDirection(dir);
    elapsed = 0;
    held.add(dir);
    path = [];
  });
  const release = () => held.delete(dir);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-prop]")) {
  button.addEventListener("click", () => {
    selection = button.dataset.prop as PropKind;
    hidePreview();
    report("빈 타일을 누르고 배치를 확정하세요.");
  });
}
canvas.addEventListener("click", event => {
  const rect = canvas.getBoundingClientRect();
  const point = {
    // Canvas backing pixels include devicePixelRatio; the map uses logical pixels.
    x: (event.clientX - rect.left) * 960 / rect.width,
    y: (event.clientY - rect.top) * 560 / rect.height
  };
  const tile = worldToGrid(point);
  if (!walkable(tile, placed)) {
    report("그곳에는 이동하거나 물건을 놓을 수 없습니다.");
    return;
  }
  if (selection) {
    if (sameTile(tile, position)) {
      report("서 있는 타일에는 물건을 놓을 수 없습니다.");
      return;
    }
    previewTile = tile;
    preview.graphics.use(picture(32, 32, ctx => drawProp(ctx, selection!)));
    const foot = gridToWorld(tile);
    preview.pos.x = foot.x;
    preview.pos.y = foot.y - 16;
    preview.z = depthAtFoot(foot.y) + 1;
    refresh();
  } else {
    path = findPath(position, tile, placed).slice(1);
    if (path.length === 0 && !sameTile(position, tile)) report("갈 수 없는 타일입니다.");
  }
});
confirm.addEventListener("click", () => {
  if (!selection || !previewTile || !walkable(previewTile, placed) ||
      sameTile(previewTile, position)) return;
  const item = { ...previewTile, kind: selection };
  placed.push(item);
  addPlacement(item);
  if (quest === "plant" && item.kind === "flower") {
    quest = "return";
    questProgress.textContent = "③ 마을지기에게 돌아가 다시 대화하세요.";
  }
  path = [];
  selection = null;
  hidePreview();
  persist();
  report("마을에 배치했습니다. 체험 상태만 이 브라우저에 저장됩니다.");
});
cancel.addEventListener("click", () => {
  selection = null;
  hidePreview();
  report("배치를 취소했습니다.");
});

class MovementClock extends ex.Actor {
  override onPreUpdate(_engine: ex.Engine, delta: number): void {
    elapsed += delta;
    if (elapsed < 145) return;
    elapsed = 0;
    const dir = [...held].at(-1);
    if (dir) {
      stepDirection(dir);
    } else if (path.length) {
      stepTo(path.shift()!);
    } else if (walkFrame) {
      walkFrame = 0;
      hero.graphics.use(frames.get(`${facing}-0`)!);
    }
  }
}
engine.add(new MovementClock());
refresh();
void engine.start().catch(() => report("게임 화면을 시작하지 못했습니다."));

