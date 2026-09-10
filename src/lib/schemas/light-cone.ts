import { z } from "zod";
import { LightConeRaritySchema, PathSchema, slugRegex } from "./common";

const LightConeStatsSchema = z.object({
  hp: z.number().nonnegative(),
  atk: z.number().nonnegative(),
  def: z.number().nonnegative(),
});

const SuperimpositionSchema = z.object({
  superimposition: z.number().int().min(1).max(5),
  description: z.string().min(1),
});

export const LightConeSchema = z.object({
  id: z.string().regex(slugRegex),
  name: z.string().min(1),
  rarity: LightConeRaritySchema,
  path: PathSchema,
  releaseVersion: z.string().regex(/^\d+\.\d+$/),
  description: z.string().min(1),
  stats: z.object({
    level80: LightConeStatsSchema,
  }),
  effect: z.object({
    name: z.string().min(1),
    descriptions: z.array(SuperimpositionSchema).min(1).max(5),
  }),
  source: z.array(z.string().min(1)).min(1),
});

export type LightCone = z.infer<typeof LightConeSchema>;
