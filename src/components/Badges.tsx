import { ELEMENT_LABEL, PATH_LABEL, type Element, type Path } from "@/lib/schemas/common";

const ELEMENT_BG: Record<Element, string> = {
  physical: "bg-element-physical/20 text-element-physical",
  fire: "bg-element-fire/20 text-element-fire",
  ice: "bg-element-ice/20 text-element-ice",
  lightning: "bg-element-lightning/20 text-element-lightning",
  wind: "bg-element-wind/20 text-element-wind",
  quantum: "bg-element-quantum/20 text-element-quantum",
  imaginary: "bg-element-imaginary/20 text-element-imaginary",
};

export function ElementBadge({ element }: { element: Element }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ELEMENT_BG[element]}`}
    >
      {ELEMENT_LABEL[element]}
    </span>
  );
}

export function PathBadge({ path }: { path: Path }) {
  return (
    <span className="inline-flex items-center rounded-full bg-hsr-surface px-2.5 py-0.5 text-xs font-medium text-hsr-muted ring-1 ring-hsr-border">
      {PATH_LABEL[path]}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-hsr-accent/15 px-2.5 py-0.5 text-xs font-medium text-hsr-accent">
      {"★".repeat(rarity)}
    </span>
  );
}
