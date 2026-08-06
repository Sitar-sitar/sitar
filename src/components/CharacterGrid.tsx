"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { Character } from "@/lib/schemas/character";
import { Card } from "./Card";
import { ElementBadge, PathBadge, RarityBadge } from "./Badges";

export function CharacterGrid({ characters }: { characters: Character[] }) {
  const searchParams = useSearchParams();

  const filtered = useMemo(() => {
    const rarity = searchParams.get("rarity");
    const element = searchParams.get("element");
    const path = searchParams.get("path");
    return characters.filter((c) => {
      if (rarity && String(c.rarity) !== rarity) return false;
      if (element && c.element !== element) return false;
      if (path && c.path !== path) return false;
      return true;
    });
  }, [characters, searchParams]);

  if (filtered.length === 0) {
    return (
      <p className="rounded-lg border border-hsr-border bg-hsr-surface p-6 text-center text-sm text-hsr-muted">
        条件に一致するキャラが見つかりませんでした。
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((c) => (
        <li key={c.id}>
          <Card href={`/characters/${c.id}`}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold group-hover:text-hsr-accent">
                {c.name}
              </h3>
              <RarityBadge rarity={c.rarity} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ElementBadge element={c.element} />
              <PathBadge path={c.path} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-hsr-muted">
              {c.description}
            </p>
            <p className="mt-2 text-xs text-hsr-muted">
              所属: {c.faction} / Ver. {c.releaseVersion}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
