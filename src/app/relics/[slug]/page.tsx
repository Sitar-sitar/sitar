import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadAll,
  getRelicSet,
  getCharactersUsingRelic,
} from "@/lib/loader";
import { RELIC_TYPE_LABEL, SLOT_LABEL } from "@/lib/schemas/relic";

type Params = { slug: string };

export function generateStaticParams(): Array<Params> {
  return loadAll().relicSets.map((r) => ({ slug: r.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const r = getRelicSet(slug);
  return { title: r ? r.name : "遺物" };
}

export default async function RelicDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const r = getRelicSet(slug);
  if (!r) notFound();

  const users = getCharactersUsingRelic(slug);

  return (
    <article className="space-y-8">
      <header className="rounded-2xl border border-hsr-border bg-hsr-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{r.name}</h1>
          <span className="rounded-full bg-hsr-accent/15 px-2.5 py-0.5 text-xs text-hsr-accent">
            {RELIC_TYPE_LABEL[r.type]}
          </span>
          <span className="rounded-full bg-hsr-surface px-2.5 py-0.5 text-xs text-hsr-muted ring-1 ring-hsr-border">
            {r.rarity.map((x) => `${x}★`).join(" / ")}
          </span>
        </div>
        <p className="mt-2 text-xs text-hsr-muted">入手: {r.source}</p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">セット効果</h2>
        <ul className="space-y-2">
          {r.effects.twoPiece && (
            <li className="rounded-lg border border-hsr-border bg-hsr-surface p-3 text-sm">
              <p className="mb-1 text-xs text-hsr-accent">2セット効果</p>
              <p className="text-hsr-muted">{r.effects.twoPiece}</p>
            </li>
          )}
          {r.effects.fourPiece && (
            <li className="rounded-lg border border-hsr-border bg-hsr-surface p-3 text-sm">
              <p className="mb-1 text-xs text-hsr-accent">4セット効果</p>
              <p className="text-hsr-muted">{r.effects.fourPiece}</p>
            </li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">部位</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {r.pieces.map((p) => (
            <li
              key={p.slot}
              className="rounded-lg border border-hsr-border bg-hsr-surface p-3 text-sm"
            >
              <p className="text-xs text-hsr-accent">{SLOT_LABEL[p.slot]}</p>
              <p className="mt-1 font-semibold">{p.name}</p>
              <p className="mt-1 text-xs text-hsr-muted">{p.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {users.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">この遺物を推奨するキャラ</h2>
          <ul className="flex flex-wrap gap-2">
            {users.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/characters/${c.id}`}
                  className="rounded-full bg-hsr-surface px-3 py-1 text-sm ring-1 ring-hsr-border hover:text-hsr-accent"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
