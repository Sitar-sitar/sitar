import { z } from "zod";
import { slugRegex } from "./common";

const GlossaryCategorySchema = z.enum([
  "aeon",
  "path",
  "starSystem",
  "faction",
  "race",
  "concept",
  "item",
  "other",
]);

export type GlossaryCategory = z.infer<typeof GlossaryCategorySchema>;

export const GLOSSARY_CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  aeon: "アイオーン",
  path: "命途",
  starSystem: "星系",
  faction: "組織・勢力",
  race: "種族",
  concept: "概念",
  item: "アイテム",
  other: "その他",
};

export const GlossarySchema = z.object({
  id: z.string().regex(slugRegex),
  term: z.string().min(1),
  reading: z.string().optional(),
  category: GlossaryCategorySchema,
  summary: z.string().min(1),
  description: z.string().min(1),
  relatedTerms: z.array(z.string().regex(slugRegex)).optional(),
  relatedCharacters: z.array(z.string().regex(slugRegex)).optional(),
});

export type GlossaryEntry = z.infer<typeof GlossarySchema>;
