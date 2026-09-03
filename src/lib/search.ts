import { loadAll } from "./loader";

export type SearchItemKind =
  | "character"
  | "lightCone"
  | "relic"
  | "glossary";

export interface SearchItem {
  kind: SearchItemKind;
  id: string;
  title: string;
  subtitle: string;
  body: string;
  href: string;
}

export function buildSearchIndex(): SearchItem[] {
  const data = loadAll();
  const items: SearchItem[] = [];

  for (const c of data.characters) {
    items.push({
      kind: "character",
      id: c.id,
      title: c.name,
      subtitle: `${c.rarity}★ / ${c.element} / ${c.path} / ${c.faction}`,
      body: `${c.description} ${c.lore ?? ""} ${(c.tags ?? []).join(" ")}`,
      href: `/characters/${c.id}`,
    });
  }

  for (const l of data.lightCones) {
    items.push({
      kind: "lightCone",
      id: l.id,
      title: l.name,
      subtitle: `${l.rarity}★ / ${l.path}`,
      body: `${l.description} ${l.effect.name} ${l.effect.descriptions
        .map((d) => d.description)
        .join(" ")}`,
      href: `/light-cones/${l.id}`,
    });
  }

  for (const r of data.relicSets) {
    items.push({
      kind: "relic",
      id: r.id,
      title: r.name,
      subtitle: `${r.type === "cavern" ? "洞窟遺物" : "次元界遺物"}`,
      body: `${r.effects.twoPiece ?? ""} ${r.effects.fourPiece ?? ""} ${r.source}`,
      href: `/relics/${r.id}`,
    });
  }

  for (const g of data.glossary) {
    items.push({
      kind: "glossary",
      id: g.id,
      title: g.term,
      subtitle: g.category,
      body: `${g.summary} ${g.description} ${g.reading ?? ""}`,
      href: `/glossary/${g.id}`,
    });
  }

  return items;
}
