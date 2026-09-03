"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  ELEMENT_LABEL,
  PATH_LABEL,
  type Element,
  type Path,
} from "@/lib/schemas/common";

const RARITIES = [4, 5] as const;

export function CharacterFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentRarity = searchParams.get("rarity") ?? "";
  const currentElement = searchParams.get("element") ?? "";
  const currentPath = searchParams.get("path") ?? "";

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.replace(qs ? `/characters?${qs}` : "/characters", {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-wrap gap-3 rounded-lg border border-hsr-border bg-hsr-surface p-3 text-sm">
      <Group label="レア度">
        <FilterChip
          active={!currentRarity}
          onClick={() => update("rarity", "")}
        >
          全て
        </FilterChip>
        {RARITIES.map((r) => (
          <FilterChip
            key={r}
            active={currentRarity === String(r)}
            onClick={() => update("rarity", String(r))}
          >
            {"★".repeat(r)}
          </FilterChip>
        ))}
      </Group>

      <Group label="属性">
        <FilterChip
          active={!currentElement}
          onClick={() => update("element", "")}
        >
          全て
        </FilterChip>
        {(Object.keys(ELEMENT_LABEL) as Element[]).map((e) => (
          <FilterChip
            key={e}
            active={currentElement === e}
            onClick={() => update("element", e)}
          >
            {ELEMENT_LABEL[e]}
          </FilterChip>
        ))}
      </Group>

      <Group label="命途">
        <FilterChip active={!currentPath} onClick={() => update("path", "")}>
          全て
        </FilterChip>
        {(Object.keys(PATH_LABEL) as Path[]).map((p) => (
          <FilterChip
            key={p}
            active={currentPath === p}
            onClick={() => update("path", p)}
          >
            {PATH_LABEL[p]}
          </FilterChip>
        ))}
      </Group>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs uppercase tracking-wider text-hsr-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs transition ${
        active
          ? "bg-hsr-accent text-hsr-bg"
          : "bg-hsr-bg text-hsr-text/80 hover:bg-hsr-border"
      }`}
    >
      {children}
    </button>
  );
}
