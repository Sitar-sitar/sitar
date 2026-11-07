import { z } from "zod";

export const ElementSchema = z.enum([
  "physical",
  "fire",
  "ice",
  "lightning",
  "wind",
  "quantum",
  "imaginary",
]);
export type Element = z.infer<typeof ElementSchema>;

export const ELEMENT_LABEL: Record<Element, string> = {
  physical: "物理",
  fire: "炎",
  ice: "氷",
  lightning: "雷",
  wind: "風",
  quantum: "量子",
  imaginary: "虚数",
};

export const PathSchema = z.enum([
  "destruction",
  "hunt",
  "erudition",
  "harmony",
  "nihility",
  "preservation",
  "abundance",
  "remembrance",
]);
export type Path = z.infer<typeof PathSchema>;

export const PATH_LABEL: Record<Path, string> = {
  destruction: "壊滅",
  hunt: "巡狩",
  erudition: "知恵",
  harmony: "調和",
  nihility: "虚無",
  preservation: "存護",
  abundance: "豊穣",
  remembrance: "記憶",
};

export const CharacterRaritySchema = z.union([z.literal(4), z.literal(5)]);
export type CharacterRarity = z.infer<typeof CharacterRaritySchema>;

export const LightConeRaritySchema = z.union([
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type LightConeRarity = z.infer<typeof LightConeRaritySchema>;

export const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
