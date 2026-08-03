import type { GameState } from "../../types.ts";
import type { FeatureModule } from "../feature.ts";

export function formatMatchServerLabel(
  state: Pick<GameState, "server">,
): "あなた" | "あいて" {
  return state.server === "P" ? "あなた" : "あいて";
}

export const matchContextFeature: FeatureModule = {
  id: "match-context",
  slot: "hud-secondary",
  mount(host, services) {
    const serverValue = host.querySelector<HTMLElement>(
      "[data-match-server]",
    );
    if (serverValue === null) {
      throw new Error("match-contextのサーバー表示先が見つかりません。");
    }

    const render = (state: Readonly<GameState>): void => {
      serverValue.textContent = formatMatchServerLabel(state);
    };
    render(services.getGameSnapshot());
    const unsubscribe = services.subscribe(render);

    host.dataset.featureMounted = matchContextFeature.id;
    return () => {
      unsubscribe();
      delete host.dataset.featureMounted;
    };
  },
};
