import { z } from "zod";
import { slugRegex } from "./common";

const SlotSchema = z.enum([
  "head",
  "hands",
  "body",
  "feet",
  "sphere",
  "rope",
]);

export const SLOT_LABEL: Record<z.infer<typeof SlotSchema>, string> = {
  head: "頭",
  hands: "手",
  body: "身",
  feet: "足",
  sphere: "次元界・球",
  rope: "次元界・縄",
};

const PieceSchema = z.object({
  slot: SlotSchema,
  name: z.string().min(1),
  description: z.string().min(1),
});

const RelicTypeSchema = z.enum(["cavern", "planar"]);

export const RELIC_TYPE_LABEL: Record<z.infer<typeof RelicTypeSchema>, string> =
  {
    cavern: "洞窟遺物",
    planar: "次元界遺物",
  };

export const RelicSetSchema = z
  .object({
    id: z.string().regex(slugRegex),
    name: z.string().min(1),
    rarity: z.array(z.number().int().min(2).max(5)).min(1),
    type: RelicTypeSchema,
    effects: z.object({
      twoPiece: z.string().optional(),
      fourPiece: z.string().optional(),
    }),
    pieces: z.array(PieceSchema).min(1),
    source: z.string().min(1),
  })
  .superRefine((val, ctx) => {
    if (val.type === "planar" && val.effects.fourPiece) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "次元界遺物に4セット効果は設定できません",
        path: ["effects", "fourPiece"],
      });
    }
    if (val.type === "cavern" && !val.effects.fourPiece) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "洞窟遺物には4セット効果が必要です",
        path: ["effects", "fourPiece"],
      });
    }
    const validSlotsByType: Record<
      z.infer<typeof RelicTypeSchema>,
      ReadonlyArray<z.infer<typeof SlotSchema>>
    > = {
      cavern: ["head", "hands", "body", "feet"],
      planar: ["sphere", "rope"],
    };
    const allowed = validSlotsByType[val.type];
    val.pieces.forEach((p, i) => {
      if (!allowed.includes(p.slot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${val.type}では ${p.slot} 部位は使えません`,
          path: ["pieces", i, "slot"],
        });
      }
    });
  });

export type RelicSet = z.infer<typeof RelicSetSchema>;
