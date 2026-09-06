// v0.3.0 §5.3: 卓球台。静的な L1（手前の脚・側面・天板・反射・白線・支柱・ネットの台上影）と、
// 毎フレーム描く動的なネット網（§5.7.3 の揺れを適用）。
import { FLOOR, HL, HW, NET_H, NET_HW } from "../config.ts";
import { netWobbleOffset } from "../view/effects.ts";
import type { NetWobble } from "../view/effects.ts";
import { projectOn, quad, type SceneSurface } from "./layers.ts";
import { THEME } from "./theme.ts";

const LINE_WIDTH = 2;
const NET_MESH_COLUMNS = 28;
const NET_MESH_ROWS = 5;
const NET_TAPE_HEIGHT = 2;

/** L1 静的レイヤ。ネット網は含まない。 */
export function drawTableLayer(surface: SceneSurface): void {
  drawNearLegs(surface);
  drawSides(surface);
  drawTop(surface);
  drawLines(surface);
  drawNetShadow(surface);
  drawNetPosts(surface);
}

function drawNearLegs(surface: SceneSurface): void {
  const context = surface.context;
  for (const [x, z] of [
    [-HW + 16, -HL + 18],
    [HW - 16, -HL + 18],
  ] as const) {
    const top = projectOn(surface, x, -4, z);
    const bottom = projectOn(surface, x, FLOOR, z);
    const width = Math.max(3, 7 * top.s);
    context.fillStyle = THEME.leg;
    context.fillRect(top.x - width / 2, top.y, width, bottom.y - top.y);
    context.fillStyle = THEME.legHighlight;
    context.fillRect(
      top.x - width / 2,
      top.y,
      Math.max(1, width * 0.28),
      bottom.y - top.y,
    );
  }
}

function drawSides(surface: SceneSurface): void {
  const context = surface.context;
  const nearLeft = projectOn(surface, -HW, 0, -HL);
  const nearRight = projectOn(surface, HW, 0, -HL);
  const thickNearLeft = projectOn(surface, -HW, -5, -HL);
  const thickNearRight = projectOn(surface, HW, -5, -HL);
  quad(context, nearLeft, nearRight, thickNearRight, thickNearLeft, THEME.sideNear);
  quad(
    context,
    projectOn(surface, -HW, 0, HL),
    nearLeft,
    thickNearLeft,
    projectOn(surface, -HW, -5, HL),
    THEME.sideEdge,
  );
  quad(
    context,
    nearRight,
    projectOn(surface, HW, 0, HL),
    projectOn(surface, HW, -5, HL),
    thickNearRight,
    THEME.sideEdge,
  );
  context.strokeStyle = THEME.sideHighlight;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(nearLeft.x, nearLeft.y);
  context.lineTo(nearRight.x, nearRight.y);
  context.stroke();
}

function drawTop(surface: SceneSurface): void {
  const context = surface.context;
  const nearLeft = projectOn(surface, -HW, 0, -HL);
  const nearRight = projectOn(surface, HW, 0, -HL);
  const farRight = projectOn(surface, HW, 0, HL);
  const farLeft = projectOn(surface, -HW, 0, HL);

  const gradient = context.createLinearGradient(0, farLeft.y, 0, nearLeft.y);
  gradient.addColorStop(0, THEME.top.far);
  gradient.addColorStop(0.5, THEME.top.middle);
  gradient.addColorStop(1, THEME.top.near);
  quad(context, nearLeft, nearRight, farRight, farLeft, gradient);

  // 反射帯。天板奥行き 40% の位置に横長楕円を置く。
  const reflectionZ = HL - (HL * 2) * 0.4;
  const center = projectOn(surface, 0, 0, reflectionZ);
  const edge = projectOn(surface, HW, 0, reflectionZ);
  const radiusX = Math.max(4, Math.abs(edge.x - center.x) * 0.95);
  const radiusY = Math.max(2, Math.abs(nearLeft.y - farLeft.y) * 0.16);
  const shine = context.createRadialGradient(
    center.x,
    center.y,
    1,
    center.x,
    center.y,
    radiusX,
  );
  shine.addColorStop(0, THEME.topReflection);
  shine.addColorStop(1, THEME.topReflectionEdge);
  context.save();
  context.beginPath();
  context.moveTo(nearLeft.x, nearLeft.y);
  context.lineTo(nearRight.x, nearRight.y);
  context.lineTo(farRight.x, farRight.y);
  context.lineTo(farLeft.x, farLeft.y);
  context.closePath();
  context.clip();
  context.translate(center.x, center.y);
  context.scale(1, radiusY / radiusX);
  context.translate(-center.x, -center.y);
  context.fillStyle = shine;
  context.beginPath();
  context.arc(center.x, center.y, radiusX, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function band(
  surface: SceneSurface,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
): void {
  quad(
    surface.context,
    projectOn(surface, x0, 0.2, z0),
    projectOn(surface, x1, 0.2, z0),
    projectOn(surface, x1, 0.2, z1),
    projectOn(surface, x0, 0.2, z1),
    THEME.line,
  );
}

function drawLines(surface: SceneSurface): void {
  const context = surface.context;
  band(surface, -HW, -HW + LINE_WIDTH, -HL, HL);
  band(surface, HW - LINE_WIDTH, HW, -HL, HL);
  band(surface, -HW, HW, -HL, -HL + LINE_WIDTH);
  band(surface, -HW, HW, HL - LINE_WIDTH, HL);
  context.globalAlpha = 0.45;
  band(surface, -0.15, 0.15, -HL, HL);
  context.globalAlpha = 1;
}

/** ネットの台上影。天板の上にだけ描くため x は天板幅へ収める。 */
function drawNetShadow(surface: SceneSurface): void {
  quad(
    surface.context,
    projectOn(surface, -HW, 0.3, 0),
    projectOn(surface, HW, 0.3, 0),
    projectOn(surface, HW, 0.3, 3),
    projectOn(surface, -HW, 0.3, 3),
    THEME.netShadow,
  );
}

function drawNetPosts(surface: SceneSurface): void {
  const context = surface.context;
  for (const x of [-NET_HW, NET_HW]) {
    const bottom = projectOn(surface, x, 0, 0);
    const top = projectOn(surface, x, NET_H + 2, 0);
    const width = Math.max(2, 2.4 * bottom.s);
    context.fillStyle = THEME.netPost;
    context.fillRect(bottom.x - width / 2, top.y, width, bottom.y - top.y);
    context.fillStyle = THEME.netPostCap;
    context.beginPath();
    context.arc(top.x, top.y, Math.max(1.5, 1.6 * bottom.s), 0, Math.PI * 2);
    context.fill();
  }
}

/**
 * ネット網（動的）。縦線 28 本 + 横線 5 本。テープ・支柱・台上影は揺らさない。
 * 揺れは網全体へ同じ位相で与え、イベントの交点 x は使わない（§5.7.3）。
 */
export function drawNetMesh(
  surface: SceneSurface,
  wobble: NetWobble | null,
): void {
  const context = surface.context;
  const offsetAt = (x: number): number =>
    wobble ? netWobbleOffset(wobble.age, x) : 0;

  quad(
    context,
    projectOn(surface, -NET_HW + offsetAt(-NET_HW), NET_H, 0),
    projectOn(surface, NET_HW + offsetAt(NET_HW), NET_H, 0),
    projectOn(surface, NET_HW, 0, 0),
    projectOn(surface, -NET_HW, 0, 0),
    THEME.netFace,
  );

  context.strokeStyle = THEME.netMesh;
  context.lineWidth = 1;
  for (let index = 1; index < NET_MESH_COLUMNS; index += 1) {
    const x = -NET_HW + ((2 * NET_HW) * index) / NET_MESH_COLUMNS;
    const bottom = projectOn(surface, x, 0, 0);
    const top = projectOn(surface, x + offsetAt(x), NET_H, 0);
    context.beginPath();
    context.moveTo(bottom.x, bottom.y);
    context.lineTo(top.x, top.y);
    context.stroke();
  }
  for (let index = 1; index < NET_MESH_ROWS; index += 1) {
    const y = (NET_H * index) / NET_MESH_ROWS;
    const ratio = y / NET_H;
    const left = projectOn(surface, -NET_HW + offsetAt(-NET_HW) * ratio, y, 0);
    const right = projectOn(surface, NET_HW + offsetAt(NET_HW) * ratio, y, 0);
    context.beginPath();
    context.moveTo(left.x, left.y);
    context.lineTo(right.x, right.y);
    context.stroke();
  }

  quad(
    context,
    projectOn(surface, -NET_HW, NET_H, 0),
    projectOn(surface, NET_HW, NET_H, 0),
    projectOn(surface, NET_HW, NET_H + NET_TAPE_HEIGHT, 0),
    projectOn(surface, -NET_HW, NET_H + NET_TAPE_HEIGHT, 0),
    THEME.netTape,
  );
}
