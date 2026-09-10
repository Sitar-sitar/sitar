import Link from "next/link";
import { loadAll } from "@/lib/loader";
import { PathBadge, RarityBadge } from "@/components/Badges";

export const metadata = { title: "光円錐一覧" };

export default function LightConesPage() {
  const { lightCones } = loadAll();
  const sorted = [...lightCones].sort(
    (a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, "ja"),
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">光円錐</h1>
        <p className="mt-1 text-sm text-hsr-muted">
          効果は重畳1〜5の各段階を詳細ページで確認できます。
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((l) => (
          <li key={l.id}>
            <Link
              href={`/light-cones/${l.id}`}
              className="block rounded-xl border border-hsr-border bg-hsr-surface p-4 transition hover:border-hsr-accent/60"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{l.name}</h3>
                <RarityBadge rarity={l.rarity} />
              </div>
              <div className="mt-2">
                <PathBadge path={l.path} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-hsr-muted">
                {l.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
