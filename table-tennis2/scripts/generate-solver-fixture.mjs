// v0.2.4 の負の対照（U-A3 / U-B1）が使う「v0.2.3 solver の出力」fixtureを生成する。
//
//   node --experimental-strip-types scripts/generate-solver-fixture.mjs
//
// 変更前コード（commit 0d324cd = 製品コードはv0.2.3の17d7507と同一）の
// src/physics.ts を git から取り出し、型除去してメモリ内でimportして実行する。
// 生成物 tests/fixtures/v023-solver.json はリポジトリへコミットし、テストは
// git に依存せず fixture と比較する。
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { pathToFileURL } from "node:url";

const BASE_COMMIT = "0d324cd";
const SEED = 20260903;
const base = pathToFileURL(process.cwd() + "/");

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const oldSource = execFileSync(
  "git",
  ["show", `${BASE_COMMIT}:table-tennis2/src/physics.ts`],
  { cwd: process.cwd(), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
const oldJs = stripTypeScriptTypes(oldSource.replaceAll("\r\n", "\n")).replaceAll(
  '"./config.ts"',
  JSON.stringify(new URL("src/config.ts", base).href),
);
const oldPhysics = await import(
  "data:text/javascript;base64," + Buffer.from(oldJs).toString("base64")
);

const { HL, SHOTS } = await import(new URL("src/config.ts", base));

const SHOT_IDS = ["DRIVE", "SMASH", "PUSH", "CHOP", "LOB", "STOP", "FLICK"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const baseDepth = (type) =>
  clamp((SHOTS[type].dep - 24) / (HL - 14 - 24), 0, 1);

// --- solveShot（AI/legacy 既定引数）---
const solveShotCases = [];
for (const type of SHOT_IDS) {
  for (const ballY of [10, 26, 52]) {
    for (const direction of [-1, 1]) {
      for (const contactQuality of [0.25, 0.6, 1]) {
        const from = { x: 0, y: ballY, z: direction === -1 ? 178 : -178 };
        const input = {
          from,
          type,
          direction,
          aimX: 25,
          depth: 90,
          contactQuality,
          extraError: 0,
          ballY,
        };
        const output = oldPhysics.solveShot({ ...input, random: seeded(SEED) });
        solveShotCases.push({ input, output });
      }
    }
  }
}

// --- solveDirectPlayerShot（プレイヤー返球）---
const directCases = [];
for (const type of SHOT_IDS) {
  for (const z of [-30, -100, -178]) {
    for (const y of [10, 25, 52]) {
      for (const power of [0.12, 0.3, 1]) {
        for (const contactQuality of [0.4, 0.85]) {
          for (const incomingSpin of [0, 0.2]) {
            const passive = type === "PUSH" && power === 0.12;
            const lift = passive ? 0 : type === "CHOP" ? -0.7 : 0.7;
            const intent = {
              power,
              aimX: 0,
              depth: passive
                ? baseDepth(type)
                : clamp(baseDepth(type) + (power - 0.5) * 0.12, 0, 1),
              lift,
              topSpin: passive ? 0 : lift * (0.35 + 0.65 * power),
              sideSpin: 0,
              contactQuality,
              timingQuality: contactQuality,
              strokeCurvature: 0,
              classifiedShot: type,
              passive,
              isServe: false,
            };
            const from = { x: 0, y, z };
            const incoming = { spin: incomingSpin, side: 0 };
            const output = oldPhysics.solveDirectPlayerShot({
              from,
              incoming,
              intent,
              random: seeded(SEED),
            });
            directCases.push({ from, incoming, intent, output });
          }
        }
      }
    }
  }
}

mkdirSync("tests/fixtures", { recursive: true });
writeFileSync(
  "tests/fixtures/v023-solver.json",
  `${JSON.stringify(
    {
      note:
        "v0.2.3 solver（commit 0d324cd の src/physics.ts）の出力。" +
        "scripts/generate-solver-fixture.mjs で再生成する。",
      baseCommit: BASE_COMMIT,
      seed: SEED,
      randomKind: "LCG(1664525, 1013904223)",
      solveShotCases,
      directCases,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `fixture: solveShot ${solveShotCases.length}件 / direct ${directCases.length}件`,
);
