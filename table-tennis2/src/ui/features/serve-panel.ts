import { SERVE_LENGTHS, SERVE_TYPES } from "../../config.ts";
import type { ServeLength, ServeType } from "../../types.ts";
import type { FeatureModule } from "../feature.ts";

export const servePanelFeature: FeatureModule = {
  id: "serve-panel",
  slot: "right-rail",
  mount(host, services) {
    const cleanup: Array<() => void> = [];
    const bind = (
      selector: string,
      listener: (button: HTMLButtonElement) => void,
    ): void => {
      host.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
        const handler = (): void => listener(button);
        button.addEventListener("click", handler);
        cleanup.push(() => button.removeEventListener("click", handler));
      });
    };

    bind("[data-serve-type]", (button) => {
      const value = button.dataset.serveType;
      if (value && SERVE_TYPES.includes(value as ServeType)) {
        services.commands.selectServe(value as ServeType);
      }
    });
    bind("[data-serve-length]", (button) => {
      const value = button.dataset.serveLength;
      if (value && SERVE_LENGTHS.includes(value as ServeLength)) {
        services.commands.selectServeLength(value as ServeLength);
      }
    });

    host.dataset.featureMounted = servePanelFeature.id;
    return () => {
      cleanup.forEach((dispose) => dispose());
      delete host.dataset.featureMounted;
    };
  },
};
