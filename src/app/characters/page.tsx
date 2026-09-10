import { Suspense } from "react";
import { loadAll } from "@/lib/loader";
import { CharacterFilterBar } from "@/components/CharacterFilterBar";
import { CharacterGrid } from "@/components/CharacterGrid";

export const metadata = { title: "キャラクター一覧" };

export default function CharactersPage() {
  const { characters } = loadAll();
  const sorted = [...characters].sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">キャラクター</h1>
        <p className="mt-1 text-sm text-hsr-muted">
          レア度・属性・命途で絞り込めます。詳細ページではビルドや編成例を確認できます。
        </p>
      </header>
      <Suspense fallback={null}>
        <CharacterFilterBar />
      </Suspense>
      <Suspense fallback={null}>
        <CharacterGrid characters={sorted} />
      </Suspense>
    </div>
  );
}
