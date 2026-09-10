import Link from "next/link";
import { loadAll } from "@/lib/loader";

const SECTIONS = [
  {
    href: "/characters",
    title: "キャラクター",
    description: "各キャラのステータス・スキル・星魂・おすすめビルドを掲載。",
  },
  {
    href: "/light-cones",
    title: "光円錐",
    description: "光円錐の効果 (S1〜S5)・ステータス・入手方法を一覧表示。",
  },
  {
    href: "/relics",
    title: "遺物",
    description: "洞窟/次元界遺物のセット効果と入手先をまとめて参照。",
  },
  {
    href: "/glossary",
    title: "用語集",
    description: "アイオーン・命途・星系・組織など世界観の用語を解説。",
  },
];

export default function Home() {
  const { characters, lightCones, relicSets, glossary } = loadAll();
  const counts = {
    characters: characters.length,
    lightCones: lightCones.length,
    relicSets: relicSets.length,
    glossary: glossary.length,
  };

  const latestCharacters = [...characters]
    .sort((a, b) => b.releaseVersion.localeCompare(a.releaseVersion))
    .slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-hsr-border bg-gradient-to-br from-hsr-surface via-hsr-surface/80 to-hsr-bg px-6 py-10">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          崩壊スターレイル データベース
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-hsr-muted">
          キャラ・光円錐・遺物・用語集を一箇所にまとめたファンメイドDB。
          JSON + スキーマ検証で新規データを安全に追加できます。
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-hsr-muted">
          <Stat label="キャラクター" value={counts.characters} />
          <Stat label="光円錐" value={counts.lightCones} />
          <Stat label="遺物セット" value={counts.relicSets} />
          <Stat label="用語" value={counts.glossary} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">カテゴリ</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="block rounded-xl border border-hsr-border bg-hsr-surface p-5 transition hover:border-hsr-accent/60"
              >
                <h3 className="text-base font-semibold text-hsr-accent">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-hsr-muted">{s.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">最新キャラ</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {latestCharacters.map((c) => (
            <li key={c.id}>
              <Link
                href={`/characters/${c.id}`}
                className="block rounded-xl border border-hsr-border bg-hsr-surface p-4 transition hover:border-hsr-accent/60"
              >
                <p className="text-xs text-hsr-muted">Ver. {c.releaseVersion}</p>
                <p className="mt-1 text-base font-semibold">{c.name}</p>
                <p className="mt-2 line-clamp-2 text-sm text-hsr-muted">
                  {c.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-hsr-bg/60 px-3 py-2">
      <span className="text-hsr-muted">{label}</span>{" "}
      <span className="font-semibold text-hsr-text">{value}</span>
    </div>
  );
}
