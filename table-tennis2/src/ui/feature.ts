import type {
  GameState,
  ServeLength,
  ServeType,
} from "../types.ts";

export type FeatureSlot =
  | "left-rail"
  | "right-rail"
  | "hud-secondary"
  | "overlay";

export interface FeatureServices {
  getGameSnapshot(): Readonly<GameState>;
  subscribe(listener: (state: Readonly<GameState>) => void): () => void;
  readonly commands: {
    selectServe(type: ServeType): void;
    selectServeLength(length: ServeLength): void;
  };
}

export interface FeatureModule {
  readonly id: string;
  readonly slot: FeatureSlot;
  mount(host: HTMLElement, services: FeatureServices): () => void;
}

export function validateFeatureModules(
  modules: readonly Pick<FeatureModule, "id" | "slot">[],
): void {
  const ids = new Set<string>();
  for (const module of modules) {
    if (!module.id.trim()) {
      throw new Error("Feature idは空にできません。");
    }
    if (ids.has(module.id)) {
      throw new Error(`Feature idが重複しています: ${module.id}`);
    }
    ids.add(module.id);
  }
}

export function mountFeatures(
  modules: readonly FeatureModule[],
  hosts: Readonly<Record<FeatureSlot, HTMLElement>>,
  services: FeatureServices,
): () => void {
  validateFeatureModules(modules);
  const cleanup = modules.map((module) =>
    module.mount(hosts[module.slot], services),
  );
  return () => {
    cleanup.reverse().forEach((dispose) => dispose());
  };
}
