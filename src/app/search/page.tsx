import { SearchClient } from "@/components/SearchClient";
import { buildSearchIndex } from "@/lib/search";

export const metadata = { title: "横断検索" };

export default function SearchPage() {
  const items = buildSearchIndex();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">横断検索</h1>
        <p className="mt-1 text-sm text-hsr-muted">
          キャラ・光円錐・遺物・用語集を横断してあいまい検索します。
        </p>
      </header>
      <SearchClient items={items} />
    </div>
  );
}
