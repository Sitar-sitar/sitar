import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadAll,
  getLightCone,
  getCharactersUsingLightCone,
} from "@/lib/loader";
import { PathBadge, RarityBadge } from "@/components/Badges";

type Params = { slug: string };

export function generateStaticParams(): Array<Params> {
  return loadAll().lightCones.map((l) => ({ slug: l.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const l = getLightCone(slug);
  return { title: l ? l.name : "光円錐" };
}

export default async function LightConeDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const l = getLightCone(slug);
  if (!l) notFound();

  const users = getCharactersUsingLightCone(slug);

  return (
    <article className="space-y-8">
      <header className="rounded-2xl border border-hsr-border bg-hsr-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{l.name}</h1>
          <RarityBadge rarity={l.rarity} />
          <PathBadge path={l.path} />
        </div>
        <p className="mt-2 text-xs text-hsr-muted">
          実装 Ver.{l.releaseVersion} / 入手: {l.source.join(", ")}
        </p>
        <p className="mt-4 text-sm leading-relaxed">{l.description}</p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">ステータス (Lv80)</h2>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          {(
            [
              ["HP", l.stats.level80.hp],
              ["攻撃", l.stats.level80.atk],
              ["防御", l.stats.level80.def],
            ] as const
          ).map(([label, v]) => (
            <div
              key={label}
              className="rounded-lg border border-hsr-border bg-hsr-surface p-3"
            >
              <dt className="text-xs text-hsr-muted">{label}</dt>
              <dd className="mt-1 text-base font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          効果: {l.effect.name}
        </h2>
        <ul className="space-y-2">
          {l.effect.descriptions.map((d) => (
            <li
              key={d.superimposition}
              className="rounded-lg border border-hsr-border bg-hsr-surface p-3 text-sm"
            >
              <p className="mb-1 text-xs text-hsr-accent">
                重畳 S{d.superimposition}
              </p>
              <p className="text-hsr-muted">{d.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {users.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            この光円錐を推奨するキャラ
          </h2>
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
