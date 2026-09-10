import Link from "next/link";
import { loadAll } from "@/lib/loader";
import { RELIC_TYPE_LABEL } from "@/lib/schemas/relic";

export const metadata = { title: "遺物一覧" };

export default function RelicsPage() {
  const { relicSets } = loadAll();
  const cavern = relicSets.filter((r) => r.type === "cavern");
  const planar = relicSets.filter((r) => r.type === "planar");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">遺物</h1>
        <p className="mt-1 text-sm text-hsr-muted">
          洞窟遺物(2セット+4セット効果)と、次元界遺物(2セットのみ)に分かれます。
        </p>
      </header>
      <RelicGroup title={RELIC_TYPE_LABEL.cavern} items={cavern} />
      <RelicGroup title={RELIC_TYPE_LABEL.planar} items={planar} />
    </div>
  );
}

function RelicGroup({
  title,
  items,
}: {
  title: string;
  items: ReturnType<typeof loadAll>["relicSets"];
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <li key={r.id}>
            <Link
              href={`/relics/${r.id}`}
              className="block rounded-xl border border-hsr-border bg-hsr-surface p-4 transition hover:border-hsr-accent/60"
            >
              <p className="text-base font-semibold">{r.name}</p>
              <p className="mt-2 line-clamp-2 text-sm text-hsr-muted">
                {r.effects.twoPiece ?? r.effects.fourPiece}
              </p>
              <p className="mt-2 text-xs text-hsr-muted">{r.source}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
