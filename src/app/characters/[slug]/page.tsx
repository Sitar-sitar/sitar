import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAll, getCharacter } from "@/lib/loader";
import {
  ElementBadge,
  PathBadge,
  RarityBadge,
} from "@/components/Badges";
import { SKILL_TYPE_LABEL } from "@/lib/schemas/character";

type Params = { slug: string };

export function generateStaticParams(): Array<Params> {
  return loadAll().characters.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const c = getCharacter(slug);
  return { title: c ? c.name : "キャラクター" };
}

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const c = getCharacter(slug);
  if (!c) notFound();

  const { lightCones, relicSets, characters } = loadAll();
  const lcById = new Map(lightCones.map((l) => [l.id, l]));
  const relicById = new Map(relicSets.map((r) => [r.id, r]));
  const charById = new Map(characters.map((ch) => [ch.id, ch]));

  return (
    <article className="space-y-8">
      <header className="rounded-2xl border border-hsr-border bg-hsr-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{c.name}</h1>
          <RarityBadge rarity={c.rarity} />
          <ElementBadge element={c.element} />
          <PathBadge path={c.path} />
        </div>
        <p className="mt-2 text-xs text-hsr-muted">
          所属: {c.faction} / 実装 Ver.{c.releaseVersion}
        </p>
        <p className="mt-4 text-sm leading-relaxed">{c.description}</p>
        {c.lore && (
          <details className="mt-4 text-sm text-hsr-muted">
            <summary className="cursor-pointer text-hsr-text">設定・背景</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{c.lore}</p>
          </details>
        )}
      </header>

      <Section title="ステータス (Lv80)">
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          {(
            [
              ["HP", c.stats.level80.hp],
              ["攻撃", c.stats.level80.atk],
              ["防御", c.stats.level80.def],
              ["速度", c.stats.level80.spd],
              ["挑発", c.stats.level80.taunt],
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
      </Section>

      <Section title="スキル">
        <ul className="space-y-3">
          {c.skills.map((s, i) => (
            <li
              key={i}
              className="rounded-lg border border-hsr-border bg-hsr-surface p-4"
            >
              <p className="text-xs uppercase tracking-wider text-hsr-accent">
                {SKILL_TYPE_LABEL[s.type]}
              </p>
              <p className="mt-1 font-semibold">{s.name}</p>
              <p className="mt-2 text-sm text-hsr-muted">{s.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="星魂">
        <ol className="space-y-2">
          {c.eidolons.map((e) => (
            <li
              key={e.level}
              className="rounded-lg border border-hsr-border bg-hsr-surface p-3 text-sm"
            >
              <p>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-hsr-accent/20 text-xs font-semibold text-hsr-accent">
                  {e.level}
                </span>
                <span className="font-semibold">{e.name}</span>
              </p>
              <p className="mt-1 text-hsr-muted">{e.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {c.traces.length > 0 && (
        <Section title="トレース">
          <ul className="space-y-2">
            {c.traces.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-hsr-border bg-hsr-surface p-3 text-sm"
              >
                <p className="font-semibold">{t.name}</p>
                <p className="mt-1 text-hsr-muted">{t.description}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="ビルド">
        <div className="space-y-5">
          {c.builds.map((b, i) => (
            <div
              key={i}
              className="rounded-xl border border-hsr-border bg-hsr-surface p-5"
            >
              <h3 className="text-base font-semibold text-hsr-accent">
                {b.name}
              </h3>
              <p className="mt-2 text-sm text-hsr-muted">{b.description}</p>

              <BuildBlock label="推奨光円錐">
                <ul className="flex flex-wrap gap-2">
                  {b.lightCones.map((id) => {
                    const lc = lcById.get(id);
                    return (
                      <li key={id}>
                        <Link
                          href={`/light-cones/${id}`}
                          className="rounded-full bg-hsr-bg px-3 py-1 text-xs text-hsr-text ring-1 ring-hsr-border hover:text-hsr-accent"
                        >
                          {lc?.name ?? id}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </BuildBlock>

              <BuildBlock label="推奨遺物セット">
                <ul className="space-y-2 text-sm">
                  {b.relicSets.map((rs, ri) => (
                    <li key={ri} className="text-hsr-muted">
                      <div className="flex flex-wrap gap-1.5">
                        {rs.sets.map((sid) => (
                          <Link
                            key={sid}
                            href={`/relics/${sid}`}
                            className="rounded-full bg-hsr-bg px-3 py-1 text-xs text-hsr-text ring-1 ring-hsr-border hover:text-hsr-accent"
                          >
                            {relicById.get(sid)?.name ?? sid}
                          </Link>
                        ))}
                      </div>
                      {rs.note && (
                        <p className="mt-1 text-xs">{rs.note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </BuildBlock>

              <BuildBlock label="メインステータス">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  {(
                    [
                      ["身(body)", b.mainStats.body],
                      ["足(feet)", b.mainStats.feet],
                      ["次元球(sphere)", b.mainStats.sphere],
                      ["連結縄(rope)", b.mainStats.rope],
                    ] as const
                  ).map(([label, list]) => (
                    <div
                      key={label}
                      className="rounded-lg bg-hsr-bg/60 p-2"
                    >
                      <dt className="text-hsr-muted">{label}</dt>
                      <dd>{list.length > 0 ? list.join(" / ") : "—"}</dd>
                    </div>
                  ))}
                </dl>
              </BuildBlock>

              <BuildBlock label="サブステ優先度">
                <p className="text-sm">{b.subStats.join(" > ")}</p>
              </BuildBlock>

              {b.teamComps && b.teamComps.length > 0 && (
                <BuildBlock label="編成例">
                  <ul className="space-y-2 text-sm">
                    {b.teamComps.map((tc, ti) => (
                      <li
                        key={ti}
                        className="rounded-lg border border-hsr-border bg-hsr-bg/60 p-3"
                      >
                        <p className="font-medium">{tc.name}</p>
                        <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                          {tc.members.map((mid) => (
                            <Link
                              key={mid}
                              href={`/characters/${mid}`}
                              className="rounded-full bg-hsr-surface px-2 py-0.5 ring-1 ring-hsr-border hover:text-hsr-accent"
                            >
                              {charById.get(mid)?.name ?? mid}
                            </Link>
                          ))}
                        </p>
                        <p className="mt-2 text-xs text-hsr-muted">{tc.note}</p>
                      </li>
                    ))}
                  </ul>
                </BuildBlock>
              )}
            </div>
          ))}
        </div>
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function BuildBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs uppercase tracking-wider text-hsr-muted">
        {label}
      </p>
      {children}
    </div>
  );
}
