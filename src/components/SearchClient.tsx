"use client";

import Fuse from "fuse.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { SearchItem, SearchItemKind } from "@/lib/search";

const KIND_LABEL: Record<SearchItemKind, string> = {
  character: "キャラクター",
  lightCone: "光円錐",
  relic: "遺物",
  glossary: "用語集",
};

export function SearchClient({ items }: { items: SearchItem[] }) {
  const [query, setQuery] = useState("");
  const fuse = useMemo(
    () =>
      new Fuse(items, {
        keys: [
          { name: "title", weight: 0.6 },
          { name: "subtitle", weight: 0.2 },
          { name: "body", weight: 0.2 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [items],
  );

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return items;
    return fuse.search(trimmed).map((r) => r.item);
  }, [fuse, items, query]);

  const grouped = useMemo(() => {
    const g: Record<SearchItemKind, SearchItem[]> = {
      character: [],
      lightCone: [],
      relic: [],
      glossary: [],
    };
    for (const item of results) g[item.kind].push(item);
    return g;
  }, [results]);

  return (
    <div className="space-y-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="キャラ名・光円錐・遺物・用語を検索"
        className="w-full rounded-lg border border-hsr-border bg-hsr-surface px-4 py-3 text-base text-hsr-text placeholder:text-hsr-muted focus:border-hsr-accent focus:outline-none"
        autoFocus
      />
      {(Object.keys(grouped) as SearchItemKind[]).map((kind) => {
        const list = grouped[kind];
        if (list.length === 0) return null;
        return (
          <section key={kind}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-hsr-muted">
              {KIND_LABEL[kind]} ({list.length})
            </h2>
            <ul className="divide-y divide-hsr-border overflow-hidden rounded-lg border border-hsr-border bg-hsr-surface">
              {list.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-0.5 px-4 py-3 transition hover:bg-hsr-border/40"
                  >
                    <span className="font-medium text-hsr-text">
                      {item.title}
                    </span>
                    <span className="text-xs text-hsr-muted">
                      {item.subtitle}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {results.length === 0 && (
        <p className="rounded-lg border border-hsr-border bg-hsr-surface p-6 text-center text-sm text-hsr-muted">
          ヒットする項目がありません。別のキーワードをお試しください。
        </p>
      )}
    </div>
  );
}
