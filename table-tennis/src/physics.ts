import {
  DRAG,
  E_TABLE,
  G,
  HL,
  HW,
  MAG,
  MAGS,
  NET_H,
  NET_HW,
} from "./config.ts";
import type {
  BallVector,
  LandingResult,
  ServeSolution,
} from "./types.ts";

export function integrate(ball: BallVector, dt: number): void {
  const horizontalSpeed = Math.hypot(ball.vx, ball.vz);
  const ax = -DRAG * ball.vx + MAGS * ball.side * ball.vz;
  const ay =
    -G - DRAG * ball.vy - MAG * ball.spin * horizontalSpeed;
  const az = -DRAG * ball.vz - MAGS * ball.side * ball.vx;

  ball.vx += ax * dt;
  ball.vy += ay * dt;
  ball.vz += az * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;
}

export function onTable(x: number, z: number): boolean {
  return Math.abs(x) <= HW && Math.abs(z) <= HL;
}

export function tableBounce(ball: BallVector): void {
  ball.y = 0;
  ball.vy = -ball.vy * E_TABLE * (1 + 0.22 * ball.spin);
  if (ball.vy < 22) {
    ball.vy = 22;
  }
  ball.vz *= 1 + 0.3 * ball.spin;
  ball.vx += ball.side * 55;
  ball.spin *= 0.55;
  ball.side *= 0.6;
}

export function cloneBall(ball: BallVector): BallVector {
  return {
    x: ball.x,
    y: ball.y,
    z: ball.z,
    vx: ball.vx,
    vy: ball.vy,
    vz: ball.vz,
    spin: ball.spin || 0,
    side: ball.side || 0,
  };
}

export function simLand(
  initial: BallVector,
  maxTime = 3,
): LandingResult {
  const ball = cloneBall(initial);
  const dt = 1 / 240;
  let previousX: number;
  let previousY: number;
  let previousZ: number;

  for (let time = 0; time < maxTime; time += dt) {
    previousX = ball.x;
    previousY = ball.y;
    previousZ = ball.z;
    integrate(ball, dt);

    if ((previousZ < 0) !== (ball.z < 0)) {
      const ratio = (0 - previousZ) / (ball.z - previousZ);
      const y = previousY + (ball.y - previousY) * ratio;
      const x = previousX + (ball.x - previousX) * ratio;
      if (y < NET_H && Math.abs(x) < NET_HW) {
        return { net: true, x, z: 0, t: time };
      }
    }

    if (previousY > 0 && ball.y <= 0) {
      const ratio = previousY / (previousY - ball.y);
      return {
        net: false,
        x: previousX + (ball.x - previousX) * ratio,
        z: previousZ + (ball.z - previousZ) * ratio,
        t: time,
      };
    }
  }

  return {
    net: false,
    x: ball.x,
    z: ball.z,
    timeout: true,
    t: maxTime,
  };
}

export function launch(
  speed: number,
  elevation: number,
  azimuth: number,
): Pick<BallVector, "vx" | "vy" | "vz"> {
  const horizontal = speed * Math.cos(elevation);
  return {
    vx: horizontal * Math.sin(azimuth),
    vy: speed * Math.sin(elevation),
    vz: horizontal * Math.cos(azimuth),
  };
}

export function solveAngle(
  from: Pick<BallVector, "x" | "y" | "z">,
  targetX: number,
  targetZ: number,
  speed: number,
  spin: number,
  side: number,
  highLimit = 0.85,
): { elev: number; azim: number } {
  const direction = Math.sign(targetZ - from.z) || 1;
  const azimuth = Math.atan2(targetX - from.x, targetZ - from.z);
  const targetDistance = (targetZ - from.z) * direction;
  let low = -0.4;
  let high = highLimit;

  for (let index = 0; index < 11; index += 1) {
    const elevation = (low + high) / 2;
    const velocity = launch(speed, elevation, azimuth);
    const result = simLand({
      ...from,
      ...velocity,
      spin,
      side,
    });
    const distance = (result.z - from.z) * direction;
    if (distance < targetDistance) {
      low = elevation;
    } else {
      high = elevation;
    }
  }

  return { elev: (low + high) / 2, azim: azimuth };
}

export function solveSpeed(
  from: Pick<BallVector, "x" | "y" | "z">,
  targetX: number,
  targetZ: number,
  elevation: number,
  spin: number,
  side: number,
): { speed: number; azim: number } {
  const direction = Math.sign(targetZ - from.z) || 1;
  const azimuth = Math.atan2(targetX - from.x, targetZ - from.z);
  const targetDistance = (targetZ - from.z) * direction;
  let low = 250;
  let high = 1300;

  for (let index = 0; index < 11; index += 1) {
    const speed = (low + high) / 2;
    const velocity = launch(speed, elevation, azimuth);
    const result = simLand({
      ...from,
      ...velocity,
      spin,
      side,
    });
    const distance = (result.z - from.z) * direction;
    if (distance < targetDistance) {
      low = speed;
    } else {
      high = speed;
    }
  }

  return { speed: (low + high) / 2, azim: azimuth };
}

export function simState(initial: BallVector, time: number): BallVector {
  const ball = cloneBall(initial);
  const dt = 1 / 240;
  for (let elapsed = 0; elapsed < time; elapsed += dt) {
    integrate(ball, dt);
  }
  ball.y = 0;
  return ball;
}

function serveTry(
  from: Pick<BallVector, "x" | "y" | "z">,
  aimX: number,
  spin: number,
  side: number,
  direction: number,
  speed: number,
  distance: number,
): ServeSolution {
  const firstTargetZ = from.z + direction * distance;
  const compensatedAimX = aimX * 0.35 - side * direction * 5;
  const angle = solveAngle(
    from,
    compensatedAimX,
    firstTargetZ,
    speed,
    spin,
    side,
    0.7,
  );
  const velocity = launch(speed, angle.elev, angle.azim);
  const ball: BallVector = { ...from, ...velocity, spin, side };
  const first = simLand(ball);
  let secondZ = first.z;
  let valid = false;

  if (
    !first.net &&
    onTable(first.x, first.z) &&
    first.z * direction < 0
  ) {
    const afterFirst = simState(ball, first.t);
    tableBounce(afterFirst);
    const second = simLand(afterFirst);
    secondZ = second.z;
    valid =
      !second.net &&
      onTable(second.x, second.z) &&
      second.z * direction > 0;
  }

  return {
    elev: angle.elev,
    azim: angle.azim,
    speed,
    z2: secondZ,
    ok: valid,
  };
}

export function solveServe(
  from: Pick<BallVector, "x" | "y" | "z">,
  aimX: number,
  spin: number,
  side: number,
  direction: number,
): ServeSolution {
  const targetZ = direction * 70;
  let best: ServeSolution | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const distance of [82, 60]) {
    for (let index = 0; index < 10; index += 1) {
      const candidate = serveTry(
        from,
        aimX,
        spin,
        side,
        direction,
        300 + index * 66,
        distance,
      );
      const score =
        (candidate.ok ? 0 : 1000) + Math.abs(candidate.z2 - targetZ);
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  if (!best) {
    throw new Error("サーブ解の探索候補がありません。");
  }
  return best;
}

export function ensureNetClear(
  from: Pick<BallVector, "x" | "y" | "z">,
  initialElevation: number,
  azimuth: number,
  speed: number,
  spin: number,
  side: number,
  margin = 0,
): number {
  let elevation = initialElevation;
  for (let index = 0; index < 6; index += 1) {
    const velocity = launch(speed, elevation, azimuth);
    const result = simLand({
      ...from,
      ...velocity,
      spin,
      side,
    });
    if (!result.net) {
      return elevation;
    }
    elevation += 0.022 + margin;
  }
  return elevation;
}

export function predictAt(
  initial: BallVector,
  targetZ: number,
  direction: number,
  floor: number,
): { x: number; y: number; t: number } | null {
  const ball = cloneBall(initial);
  const dt = 1 / 240;
  let previousX: number;
  let previousY: number;
  let previousZ: number;

  for (let time = 0; time < 2.6; time += dt) {
    previousX = ball.x;
    previousY = ball.y;
    previousZ = ball.z;
    integrate(ball, dt);

    if (previousY > 0 && ball.y <= 0) {
      if (!onTable(ball.x, ball.z)) {
        return null;
      }
      ball.y = 0;
      tableBounce(ball);
    }

    if (
      (direction < 0 && ball.z <= targetZ) ||
      (direction >= 0 && ball.z >= targetZ)
    ) {
      const ratio = (targetZ - previousZ) / (ball.z - previousZ);
      return {
        x: previousX + (ball.x - previousX) * ratio,
        y: previousY + (ball.y - previousY) * ratio,
        t: time,
      };
    }

    if (ball.y < floor) {
      return null;
    }
  }

  return null;
}
