import { z } from "zod";
import {
  CharacterRaritySchema,
  ElementSchema,
  PathSchema,
  slugRegex,
} from "./common";

const SkillTypeSchema = z.enum([
  "basic",
  "skill",
  "ultimate",
  "talent",
  "technique",
]);

export const SKILL_TYPE_LABEL: Record<z.infer<typeof SkillTypeSchema>, string> =
  {
    basic: "通常攻撃",
    skill: "戦闘スキル",
    ultimate: "必殺技",
    talent: "天賦",
    technique: "秘技",
  };

const StatsSchema = z.object({
  hp: z.number().nonnegative(),
  atk: z.number().nonnegative(),
  def: z.number().nonnegative(),
  spd: z.number().nonnegative(),
  taunt: z.number().nonnegative(),
});

const SkillSchema = z.object({
  type: SkillTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
});

const EidolonSchema = z.object({
  level: z.number().int().min(1).max(6),
  name: z.string().min(1),
  description: z.string().min(1),
});

const TraceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
});

const BuildRelicSetSchema = z.object({
  sets: z.array(z.string().regex(slugRegex)).min(1).max(2),
  note: z.string().optional(),
});

const BuildSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  lightCones: z.array(z.string().regex(slugRegex)),
  relicSets: z.array(BuildRelicSetSchema),
  mainStats: z.object({
    body: z.array(z.string()).default([]),
    feet: z.array(z.string()).default([]),
    sphere: z.array(z.string()).default([]),
    rope: z.array(z.string()).default([]),
  }),
  subStats: z.array(z.string()),
  teamComps: z
    .array(
      z.object({
        name: z.string().min(1),
        members: z.array(z.string()).min(1).max(4),
        note: z.string().min(1),
      }),
    )
    .optional(),
});

export const CharacterSchema = z.object({
  id: z.string().regex(slugRegex),
  name: z.string().min(1),
  rarity: CharacterRaritySchema,
  element: ElementSchema,
  path: PathSchema,
  faction: z.string().min(1),
  releaseVersion: z.string().regex(/^\d+\.\d+$/),
  description: z.string().min(1),
  lore: z.string().optional(),
  stats: z.object({
    level80: StatsSchema,
  }),
  skills: z.array(SkillSchema).min(1),
  eidolons: z.array(EidolonSchema).length(6),
  traces: z.array(TraceSchema),
  builds: z.array(BuildSchema).min(1),
  tags: z.array(z.string()).optional(),
});

export type Character = z.infer<typeof CharacterSchema>;
