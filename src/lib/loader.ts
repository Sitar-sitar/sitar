import fs from "node:fs";
import path from "node:path";
import type { ZodTypeAny, z } from "zod";
import { CharacterSchema, type Character } from "./schemas/character";
import { LightConeSchema, type LightCone } from "./schemas/light-cone";
import { RelicSetSchema, type RelicSet } from "./schemas/relic";
import { GlossarySchema, type GlossaryEntry } from "./schemas/glossary";

const DATA_DIR = path.join(process.cwd(), "src", "data");

function loadDir<T extends ZodTypeAny>(
  category: string,
  schema: T,
): Array<z.infer<T>> {
  const dir = path.join(DATA_DIR, category);
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  return files.map((file) => {
    const full = path.join(dir, file);
    const raw = fs.readFileSync(full, "utf-8");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `JSON parse failed for ${full}: ${(e as Error).message}`,
      );
    }
    const result = schema.safeParse(parsedJson);
    if (!result.success) {
      throw new Error(
        `Schema validation failed for ${full}:\n${result.error.issues
          .map((i) => `  - [${i.path.join(".")}] ${i.message}`)
          .join("\n")}`,
      );
    }
    const data = result.data as { id?: unknown };
    const baseName = file.replace(/\.json$/, "");
    if (typeof data.id !== "string" || data.id !== baseName) {
      throw new Error(
        `File name and id mismatch: ${full} (id=${String(
          data.id,
        )}, expected ${baseName})`,
      );
    }
    return data as z.infer<T>;
  });
}

let cache: DataSet | null = null;

export interface DataSet {
  characters: Character[];
  lightCones: LightCone[];
  relicSets: RelicSet[];
  glossary: GlossaryEntry[];
}

export function loadAll(): DataSet {
  if (cache) return cache;
  const data: DataSet = {
    characters: loadDir("characters", CharacterSchema),
    lightCones: loadDir("light-cones", LightConeSchema),
    relicSets: loadDir("relics", RelicSetSchema),
    glossary: loadDir("glossary", GlossarySchema),
  };
  assertReferentialIntegrity(data);
  cache = data;
  return data;
}

function assertReferentialIntegrity(data: DataSet): void {
  const errors: string[] = [];
  const lcIds = new Set(data.lightCones.map((l) => l.id));
  const relicIds = new Set(data.relicSets.map((r) => r.id));
  const charIds = new Set(data.characters.map((c) => c.id));
  const glossaryIds = new Set(data.glossary.map((g) => g.id));

  for (const c of data.characters) {
    c.builds.forEach((b, bi) => {
      for (const lc of b.lightCones) {
        if (!lcIds.has(lc)) {
          errors.push(
            `characters/${c.id}: builds[${bi}] references unknown light cone "${lc}"`,
          );
        }
      }
      b.relicSets.forEach((rs, ri) => {
        for (const s of rs.sets) {
          if (!relicIds.has(s)) {
            errors.push(
              `characters/${c.id}: builds[${bi}].relicSets[${ri}] references unknown relic "${s}"`,
            );
          }
        }
      });
      if (b.teamComps) {
        b.teamComps.forEach((tc, ti) => {
          for (const m of tc.members) {
            if (m !== c.id && !charIds.has(m)) {
              errors.push(
                `characters/${c.id}: builds[${bi}].teamComps[${ti}] references unknown character "${m}"`,
              );
            }
          }
        });
      }
    });
  }

  for (const g of data.glossary) {
    for (const t of g.relatedTerms ?? []) {
      if (!glossaryIds.has(t)) {
        errors.push(
          `glossary/${g.id}: relatedTerms references unknown term "${t}"`,
        );
      }
    }
    for (const ch of g.relatedCharacters ?? []) {
      if (!charIds.has(ch)) {
        errors.push(
          `glossary/${g.id}: relatedCharacters references unknown character "${ch}"`,
        );
      }
    }
  }

  if (errors.length) {
    throw new Error(
      `Referential integrity check failed:\n${errors
        .map((e) => `  - ${e}`)
        .join("\n")}`,
    );
  }
}

export function getCharacter(slug: string): Character | undefined {
  return loadAll().characters.find((c) => c.id === slug);
}
export function getLightCone(slug: string): LightCone | undefined {
  return loadAll().lightCones.find((l) => l.id === slug);
}
export function getRelicSet(slug: string): RelicSet | undefined {
  return loadAll().relicSets.find((r) => r.id === slug);
}
export function getGlossary(slug: string): GlossaryEntry | undefined {
  return loadAll().glossary.find((g) => g.id === slug);
}

export function getCharactersUsingLightCone(slug: string): Character[] {
  return loadAll().characters.filter((c) =>
    c.builds.some((b) => b.lightCones.includes(slug)),
  );
}

export function getCharactersUsingRelic(slug: string): Character[] {
  return loadAll().characters.filter((c) =>
    c.builds.some((b) => b.relicSets.some((rs) => rs.sets.includes(slug))),
  );
}
