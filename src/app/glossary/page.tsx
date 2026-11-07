import Link from "next/link";
import { loadAll } from "@/lib/loader";
import {
  GLOSSARY_CATEGORY_LABEL,
  type GlossaryCategory,
} from "@/lib/schemas/glossary";

export const metadata = { title: "用語集" };

export default function GlossaryPage() {
  const { glossary } = loadAll();

  const grouped = new Map<GlossaryCategory, typeof glossary>();
  for (const g of glossary) {
    const list = grouped.get(g.category) ?? [];
    list.push(g);
    grouped.set(g.category, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) =>
      (a.reading ?? a.term).localeCompare(b.reading ?? b.term, "ja"),
    );
  }

  const categoryOrder: GlossaryCategory[] = [
    "aeon",
    "path",
    "starSystem",
    "faction",
    "race",
    "concept",
    "item",
    "other",
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">用語集</h1>
        <p className="mt-1 text-sm text-hsr-muted">
          アイオーン・命途・星系・組織・種族など、物語理解に役立つ用語を整理しています。
        </p>
      </header>
      {categoryOrder.map((cat) => {
        const list = grouped.get(cat);
        if (!list || list.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="mb-3 text-lg font-semibold">
              {GLOSSARY_CATEGORY_LABEL[cat]}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {list.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/glossary/${g.id}`}
                    className="block rounded-xl border border-hsr-border bg-hsr-surface p-4 transition hover:border-hsr-accent/60"
                  >
                    <p className="text-base font-semibold">
                      {g.term}
                      {g.reading && (
                        <span className="ml-2 text-xs text-hsr-muted">
                          {g.reading}
                        </span>
                      )}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-hsr-muted">
                      {g.summary}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
