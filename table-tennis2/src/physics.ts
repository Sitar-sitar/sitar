import {
  ACTIVE_SIDE_CARRY,
  ACTIVE_SPIN_CARRY,
  AI_SHOT_SPEED_MARGIN,
  AZ,
  PLAYER_SHOT_SPEED_MARGIN,
  SHOT_MIN_SPEED_ELEV,
  CONTACT_PLANE_FAR,
  CONTACT_PLANE_NEAR,
  DRAG,
  E_TABLE,
  FLOOR,
  G,
  HL,
  HW,
  MAG,
  MAGS,
  MAX_SIDE_SPIN,
  MAX_TOP_SPIN,
  NET_H,
  NET_HW,
  PASSIVE_SIDE_CARRY,
  PASSIVE_SPIN_CARRY,
  PZ,
  SHOTS,
} from "./config.ts";
import type {
  BallVector,
  LandingResult,
  ServeLengthProfile,
  ServeSolution,
  ShotId,
  ShotSpeed,
  ShotIntent,
  Side,
} from "./types.ts";

function clampValue(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(first: number, second: number, ratio: number): number {
  return first + (second - first) * ratio;
}

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

/**
 * 打点から狙い着地点へ届く最低速度。乱数を消費しない純粋関数。
 * `solveSpeed()` の探索範囲 [250, 1300] を超える要求は 1300 で飽和する。
 */
export function minimumViableSpeed(
  from: Pick<BallVector, "x" | "y" | "z">,
  targetX: number,
  targetZ: number,
  spin: number,
  side: number,
  margin: number,
): number {
  return (
    solveSpeed(from, targetX, targetZ, SHOT_MIN_SPEED_ELEV, spin, side).speed *
    margin
  );
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
  length: ServeLengthProfile,
): ServeSolution {
  const firstTargetZ = from.z + direction * distance;
  const compensatedAimX =
    aimX * length.aimScale - side * direction * 5;
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
  length: ServeLengthProfile,
): ServeSolution {
  const targetZ = direction * length.targetZ;
  let best: ServeSolution | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const distance of length.distances) {
    for (let index = 0; index < 10; index += 1) {
      const candidate = serveTry(
        from,
        aimX,
        spin,
        side,
        direction,
        length.speedBase + index * length.speedStep,
        distance,
        length,
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

export function solveShot(input: {
  from: Pick<BallVector, "x" | "y" | "z">;
  type: ShotId;
  direction: number;
  aimX: number;
  depth: number;
  contactQuality: number;
  extraError: number;
  ballY: number;
  random: () => number;
  /** AI の absolute 速度を最低成立速度へ寄せる係数。1（既定）で現行と同一 */
  pace?: number;
  /** 基礎誤差に掛ける係数。1（既定）で現行と同一 */
  precision?: number;
}): { vx: number; vy: number; vz: number; spin: number; side: number } {
  const {
    from,
    type,
    direction,
    aimX,
    depth,
    contactQuality,
    extraError,
    ballY,
    random,
    pace = 1,
    precision = 1,
  } = input;
  const shot = SHOTS[type];
  const targetZ =
    direction * Math.max(24, Math.min(HL - 14, depth));
  const targetX = Math.max(-HW + 7, Math.min(HW - 7, aimX));
  const side = (random() - 0.5) * 0.25;
  const spin = shot.spin;

  // 打ち出しの3要素を速度モデルごとに解く。乱数消費は arc=0 / touch=1 / absolute=1。
  function launchPlan(
    speedSpec: ShotSpeed,
  ): { speed: number; azimuth: number; elevation: number } {
    switch (speedSpec.model) {
      case "arc": {
        const result = solveSpeed(
          from,
          targetX,
          targetZ,
          speedSpec.elev,
          spin,
          side,
        );
        return {
          speed: result.speed,
          azimuth: result.azim,
          elevation: speedSpec.elev,
        };
      }
      case "touch": {
        const { elev, margin } = speedSpec;
        const result = solveSpeed(
          from,
          targetX,
          targetZ,
          elev,
          spin,
          side,
        );
        const roll = random();
        return {
          speed:
            result.speed *
            (margin[0] + roll * (margin[1] - margin[0])),
          azimuth: result.azim,
          elevation: elev,
        };
      }
      case "absolute": {
        const { sp } = speedSpec;
        let speed = sp[0] + random() * (sp[1] - sp[0]);
        if (type === "SMASH") {
          speed *=
            0.86 +
            0.14 * Math.min(1, Math.max(0, (ballY - 20) / 30));
        }
        // pace は「最低成立速度」と「抽選速度」の補間。抽選速度が最低成立速度を
        // 下回る場合は min() により減速せず、届かない球を作らない。
        if (pace < 1) {
          const need = minimumViableSpeed(
            from,
            targetX,
            targetZ,
            spin,
            side,
            AI_SHOT_SPEED_MARGIN,
          );
          speed = lerp(Math.min(need, speed), speed, pace);
        }
        const result = solveAngle(
          from,
          targetX,
          targetZ,
          speed,
          spin,
          side,
        );
        return { speed, azimuth: result.azim, elevation: result.elev };
      }
    }
  }

  // 誤差適用で3要素すべてを更新するため、3つとも可変で受ける
  let { speed, elevation, azimuth } = launchPlan(shot.speed);

  // arc（LOB）は現行どおり ensureNetClear を通さない。この条件は必須。
  if (
    shot.speed.model !== "arc" &&
    !extraError &&
    contactQuality > 0.3
  ) {
    elevation = ensureNetClear(
      from,
      elevation,
      azimuth,
      speed,
      spin,
      side,
    );
  }

  const error =
    (shot.err + (1 - contactQuality) * 0.055) * precision + extraError;
  elevation += (random() * 2 - 1) * error;
  azimuth += (random() * 2 - 1) * error * 1.5;
  speed *= 1 + (random() * 2 - 1) * error * 1.6;

  return {
    ...launch(speed, elevation, azimuth),
    spin,
    side,
  };
}

export function solveDirectPlayerShot(input: {
  from: Pick<BallVector, "x" | "y" | "z">;
  incoming: Pick<BallVector, "spin" | "side">;
  intent: ShotIntent;
  random: () => number;
  /** 返球誤差に掛ける係数。1（既定）で現行と同一 */
  errorScale?: number;
}): { vx: number; vy: number; vz: number; spin: number; side: number } | null {
  const { from, incoming, intent, random, errorScale = 1 } = input;
  const shot = SHOTS[intent.classifiedShot];
  const targetX = intent.aimX * (HW - 7);
  const targetZ = lerp(24, HL - 14, intent.depth);
  const spinCarry = intent.passive ? PASSIVE_SPIN_CARRY : ACTIVE_SPIN_CARRY;
  const sideCarry = intent.passive ? PASSIVE_SIDE_CARRY : ACTIVE_SIDE_CARRY;
  const spin = clampValue(
    intent.topSpin * 1.25 + incoming.spin * spinCarry,
    -MAX_TOP_SPIN,
    MAX_TOP_SPIN,
  );
  const side = clampValue(
    intent.sideSpin * 1.1 + incoming.side * sideCarry,
    -MAX_SIDE_SPIN,
    MAX_SIDE_SPIN,
  );

  let speed: number;
  let elevation: number;
  let azimuth: number;
  switch (shot.speed.model) {
    case "arc": {
      const result = solveSpeed(
        from,
        targetX,
        targetZ,
        shot.speed.elev,
        spin,
        side,
      );
      speed = result.speed * lerp(0.95, 1.08, intent.power);
      elevation = shot.speed.elev;
      azimuth = result.azim;
      break;
    }
    case "touch": {
      const result = solveSpeed(
        from,
        targetX,
        targetZ,
        shot.speed.elev,
        spin,
        side,
      );
      speed = result.speed * lerp(shot.speed.margin[0], shot.speed.margin[1], intent.power);
      elevation = shot.speed.elev;
      azimuth = result.azim;
      break;
    }
    case "absolute": {
      // 打点が狙い着地点から遠いと抽選速度では物理的に届かない。必要速度を
      // 片側フロアとして与える（速度は下げない）。drawn >= need では現行と一致する。
      speed = Math.max(
        lerp(shot.speed.sp[0] * 0.72, shot.speed.sp[1], intent.power),
        minimumViableSpeed(
          from,
          targetX,
          targetZ,
          spin,
          side,
          PLAYER_SHOT_SPEED_MARGIN,
        ),
      );
      const result = solveAngle(
        from,
        targetX,
        targetZ,
        speed,
        spin,
        side,
      );
      elevation = result.elev;
      azimuth = result.azim;
      break;
    }
  }

  if (shot.speed.model !== "arc" && intent.contactQuality > 0.3) {
    elevation = ensureNetClear(
      from,
      elevation,
      azimuth,
      speed,
      spin,
      side,
    );
  }

  const qualityLoss = 1 - intent.contactQuality;
  const error =
    (shot.err + qualityLoss * qualityLoss * 0.16) * errorScale;
  const elevationRoll = random();
  const azimuthRoll = random();
  const speedRoll = random();
  elevation += (elevationRoll * 2 - 1) * error;
  azimuth += (azimuthRoll * 2 - 1) * error * 1.5;
  speed *= 1 + (speedRoll * 2 - 1) * error * 1.6;
  const solution = { ...launch(speed, elevation, azimuth), spin, side };
  return Object.values(solution).every(Number.isFinite) && speed > 0
    ? solution
    : null;
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

function clampPlane(z: number, direction: number): number {
  return direction < 0
    ? Math.max(-CONTACT_PLANE_FAR, Math.min(-CONTACT_PLANE_NEAR, z))
    : Math.min(CONTACT_PLANE_FAR, Math.max(CONTACT_PLANE_NEAR, z));
}

export function solveContactPlane(
  ball: BallVector,
  receiver: Side,
): number {
  const direction = receiver === "P" ? -1 : 1;
  const state = cloneBall(ball);
  const dt = 1 / 240;
  let previousY: number;
  let previousZ: number;
  let bounced = false;

  for (let time = 0; time < 3; time += dt) {
    previousY = state.y;
    previousZ = state.z;
    integrate(state, dt);
    if (previousY > 0 && state.y <= 0) {
      if (!onTable(state.x, state.z)) {
        break;
      }
      if (!bounced) {
        state.y = 0;
        if (Math.sign(state.z) === direction) {
          bounced = true;
        }
        tableBounce(state);
        continue;
      }
      return clampPlane(previousZ, direction);
    }
    if (bounced && state.vy < 0 && state.y <= 22) {
      return clampPlane(state.z, direction);
    }
    if (state.y < FLOOR) {
      break;
    }
  }
  return direction < 0 ? PZ : AZ;
}
