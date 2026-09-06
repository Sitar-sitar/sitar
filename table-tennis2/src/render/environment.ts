// v0.3.0 §5.2: 会場（L0 静的レイヤ）。壁・照明ハロー・観客帯・柵・床・台の床影・奥側の脚。
// **完全に静的**であり、毎フレーム変化する要素を含めない（設計レビュー P1-01）。
// 模様の揺らぎはインデックス由来の決定論値で作り、乱数生成器を使わない（§4.3）。
import { FLOOR, HL, HW } from "../config.ts";
import { deterministicUnit } from "../view/effects.ts";
import { projectOn, quad, type SceneSurface } from "./layers.ts";
import { THEME } from "./theme.ts";

const FENCE_Z = 620;
/** 観客帯。柵の後ろに置きつつ、柵の上端より高い位置でだけ見えるようにする。 */
const CROWD_ROWS = [
  { z: 660, y: FLOOR + 92, count: 26 },
  { z: 700, y: FLOOR + 114, count: 22 },
] as const;

export function drawEnvironment(surface: SceneSurface): void {
  drawWall(surface);
  drawLights(surface);
  // 床は地平線から画面下端まで塗りつぶすため、観客帯と柵より先に描く。
  // （地平線がviewport上端より上に来る横画面では、床の塗りが画面全体を覆う。）
  drawFloor(surface);
  drawCrowd(surface);
  drawFence(surface, FENCE_Z);
  drawTableFloorShadow(surface);
  drawFarLegs(surface);
}

function drawWall(surface: SceneSurface): void {
  const { context, width, camera } = surface;
  const horizon = camera.cy;
  const gradient = context.createLinearGradient(0, 0, 0, Math.max(1, horizon));
  gradient.addColorStop(0, THEME.wall.top);
  gradient.addColorStop(0.55, THEME.wall.middle);
  gradient.addColorStop(1, THEME.wall.horizon);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, horizon + 1);
}

/** スポット照明。L0 に置くため脈動させない（full / reduced とも動かない）。 */
function drawLights(surface: SceneSurface): void {
  const { context, width, camera } = surface;
  const horizon = camera.cy;
  const radiusX = width * 0.16;
  const radiusY = Math.max(12, Math.abs(horizon) * 0.22);
  for (const ratio of [0.22, 0.5, 0.78]) {
    const x = width * ratio;
    const y = horizon * 0.18;
    const gradient = context.createRadialGradient(x, y, 1, x, y, radiusX);
    gradient.addColorStop(0, THEME.lightHalo);
    gradient.addColorStop(1, THEME.lightHaloEdge);
    context.save();
    context.translate(x, y);
    context.scale(1, radiusY / radiusX);
    context.translate(-x, -y);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radiusX, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawCrowd(surface: SceneSurface): void {
  const context = surface.context;
  context.fillStyle = THEME.crowd;
  let seed = 0;
  for (const row of CROWD_ROWS) {
    for (let index = 0; index < row.count; index += 1) {
      const x = -460 + (920 * index) / Math.max(1, row.count - 1);
      const head = projectOn(surface, x, row.y, row.z);
      const radius = (7 + deterministicUnit(seed) * 3) * head.s;
      seed += 1;
      if (!(radius > 0)) continue;
      context.beginPath();
      context.arc(head.x, head.y, radius, Math.PI, Math.PI * 2);
      context.closePath();
      context.fill();
    }
  }
}

function drawFence(surface: SceneSurface, z: number): void {
  const context = surface.context;
  const base = projectOn(surface, 0, FLOOR, z);
  const top = projectOn(surface, 0, FLOOR + 75, z);
  const left = projectOn(surface, -460, FLOOR, z);
  const right = projectOn(surface, 460, FLOOR, z);
  const height = base.y - top.y;
  const spanX = right.x - left.x;
  context.fillStyle = THEME.fence;
  context.fillRect(left.x, top.y, spanX, height);
  context.fillStyle = THEME.fenceShade;
  context.fillRect(left.x, base.y - height * 0.16, spanX, height * 0.16);
  context.fillStyle = THEME.fenceTop;
  context.fillRect(left.x, top.y, spanX, 2);
  context.strokeStyle = THEME.fenceEdge;
  context.lineWidth = 1.5;
  context.strokeRect(left.x, top.y, spanX, height);
  context.strokeStyle = THEME.fenceRib;
  context.lineWidth = 1;
  for (let index = 1; index < 9; index += 1) {
    const x = left.x + (spanX * index) / 9;
    context.beginPath();
    context.moveTo(x, top.y);
    context.lineTo(x, base.y);
    context.stroke();
  }
}

function drawFloor(surface: SceneSurface): void {
  const { context, width, height, camera } = surface;
  const horizon = camera.cy;
  const gradient = context.createLinearGradient(0, horizon, 0, height);
  gradient.addColorStop(0, THEME.floor.top);
  gradient.addColorStop(0.45, THEME.floor.middle);
  gradient.addColorStop(1, THEME.floor.bottom);
  context.fillStyle = gradient;
  context.fillRect(0, horizon, width, height - horizon);

  context.strokeStyle = THEME.floorPlank;
  context.lineWidth = 1;
  for (let index = -12; index <= 12; index += 1) {
    const x = index * 46;
    const near = projectOn(surface, x, FLOOR, -300);
    const far = projectOn(surface, x, FLOOR, 1500);
    context.beginPath();
    context.moveTo(near.x, near.y);
    context.lineTo(far.x, far.y);
    context.stroke();
  }

  context.strokeStyle = THEME.floorCross;
  for (let z = -260; z < 1400; z += 180) {
    const left = projectOn(surface, -900, FLOOR, z);
    const right = projectOn(surface, 900, FLOOR, z);
    context.beginPath();
    context.moveTo(left.x, left.y);
    context.lineTo(right.x, right.y);
    context.stroke();
  }

  context.strokeStyle = THEME.floorLine;
  context.lineWidth = 2;
  for (const x of [-330, 330]) {
    const near = projectOn(surface, x, FLOOR, -320);
    const far = projectOn(surface, x, FLOOR, 900);
    context.beginPath();
    context.moveTo(near.x, near.y);
    context.lineTo(far.x, far.y);
    context.stroke();
  }

  // 周縁の暗がり。中心は透明、外縁へ向けて暗くする。
  const vignette = context.createRadialGradient(
    width / 2,
    horizon + (height - horizon) * 0.5,
    Math.max(1, width * 0.12),
    width / 2,
    horizon + (height - horizon) * 0.5,
    Math.max(2, width * 0.78),
  );
  vignette.addColorStop(0, THEME.floorVignetteInner);
  vignette.addColorStop(1, THEME.floorVignetteOuter);
  context.fillStyle = vignette;
  context.fillRect(0, horizon, width, height - horizon);

  // 台への光。中心を天板中央の投影点に合わせる。
  const center = projectOn(surface, 0, 0, 0);
  const light = context.createRadialGradient(
    center.x,
    center.y,
    10,
    center.x,
    center.y,
    Math.max(20, width * 0.95),
  );
  light.addColorStop(0, THEME.tableLight);
  light.addColorStop(1, THEME.tableLightEdge);
  context.fillStyle = light;
  context.fillRect(0, horizon, width, height - horizon);
}

/** 天板4隅を床へ投影し、3枚重ねでぼかしを近似する。 */
function drawTableFloorShadow(surface: SceneSurface): void {
  const context = surface.context;
  const offsetX = 6;
  const offsetZ = 10;
  THEME.tableFloorShadow.forEach((color, index) => {
    const spread = index * 4;
    quad(
      context,
      projectOn(surface, -HW - spread + offsetX, FLOOR, -HL - spread + offsetZ),
      projectOn(surface, HW + spread + offsetX, FLOOR, -HL - spread + offsetZ),
      projectOn(surface, HW + spread + offsetX, FLOOR, HL + spread + offsetZ),
      projectOn(surface, -HW - spread + offsetX, FLOOR, HL + spread + offsetZ),
      color,
    );
  });
}

/** 奥側の脚2本。相手プレイヤーより後ろに来るため L0 に置く。 */
function drawFarLegs(surface: SceneSurface): void {
  const context = surface.context;
  context.fillStyle = THEME.leg;
  for (const [x, z] of [
    [-HW + 16, HL - 18],
    [HW - 16, HL - 18],
  ] as const) {
    const top = projectOn(surface, x, -4, z);
    const bottom = projectOn(surface, x, FLOOR, z);
    const width = Math.max(3, 7 * top.s);
    context.fillRect(top.x - width / 2, top.y, width, bottom.y - top.y);
  }
}
