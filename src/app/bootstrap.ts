import { ensureStagesVerified, ensurePackStagesVerified } from './gameplay/randomizer_pool.js';
import { randomizerPersistedOn } from './gameplay/randomizer_toggle.js';

type AppBootstrapOptions = {
  setOverlayVisible: (visible: boolean) => void;
  startButton: HTMLButtonElement;
  refreshPackUi: () => void;
  syncPackEnabled: () => void;
  initPackFromQuery: () => Promise<void>;
  onPackReady: () => void;
};

export function runAppBootstrap(options: AppBootstrapOptions) {
  options.setOverlayVisible(true);
  options.startButton.disabled = false;
  options.refreshPackUi();
  options.syncPackEnabled();
  const randomizerOn = randomizerPersistedOn();
  if (randomizerOn) {
    void ensureStagesVerified();
  }
  void options.initPackFromQuery().finally(() => {
    options.onPackReady();
    if (randomizerOn) {
      void ensurePackStagesVerified();
    }
  });
}
