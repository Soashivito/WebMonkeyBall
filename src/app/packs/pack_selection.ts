import { GAME_SOURCES, STAGE_BASE_PATHS, type GameSource } from '../../shared/constants/index.js';
import {
  getActivePack,
  getPackStageBasePath,
  hasPackForGameSource,
  setActivePack,
  setPackEnabled,
  packIdentity,
  normalizeIdentity,
  registerPackInRegistry,
  unregisterPackFromRegistry,
} from '../../pack.js';
import type { LoadedPack } from '../../pack.js';

export type GameSourceSelection = GameSource | `pack:${string}`;

type PackSelectionControllerOptions = {
  gameSourceSelect: HTMLSelectElement | null;
  packStatus: HTMLElement | null;
};

export class PackSelectionController {
  private readonly gameSourceSelect: HTMLSelectElement | null;
  private readonly packStatus: HTMLElement | null;
  private readonly loadedPacks = new Map<string, LoadedPack>();
  private activePackKey: string | null = null;

  constructor(options: PackSelectionControllerOptions) {
    this.gameSourceSelect = options.gameSourceSelect;
    this.packStatus = options.packStatus;
  }

  getStageBasePath(gameSource: GameSource): string {
    const selection = this.gameSourceSelect?.value as GameSourceSelection | undefined;
    const usePack = !!selection && selection.startsWith('pack:') && hasPackForGameSource(gameSource);
    if (usePack) {
      return getPackStageBasePath(gameSource)
        ?? STAGE_BASE_PATHS[gameSource]
        ?? STAGE_BASE_PATHS[GAME_SOURCES.SMB1];
    }
    return STAGE_BASE_PATHS[gameSource] ?? STAGE_BASE_PATHS[GAME_SOURCES.SMB1];
  }

  resolveSelectedGameSource() {
    const selection = (this.gameSourceSelect?.value as GameSourceSelection) ?? GAME_SOURCES.SMB1;
    if (selection.startsWith('pack:')) {
      const key = selection.slice('pack:'.length);
      const loaded = this.loadedPacks.get(key) ?? null;
      const active = getActivePack();
      if (loaded && active !== loaded) {
        this.activePackKey = key;
        setActivePack(loaded);
        setPackEnabled(true);
      }
      const pack = getActivePack();
      if (pack) {
        return { selection, gameSource: pack.manifest.gameSource };
      }
      return { selection, gameSource: GAME_SOURCES.SMB1 };
    }
    return { selection, gameSource: selection as GameSource };
  }

  refreshUi() {
    const pack = getActivePack();
    if (this.packStatus) {
      if (!pack) {
        if (this.loadedPacks.size > 0) {
          this.packStatus.textContent = `Loaded packs: ${this.loadedPacks.size}`;
        } else {
          this.packStatus.textContent = 'No pack loaded';
        }
      } else if (this.loadedPacks.size <= 1) {
        this.packStatus.textContent = `Loaded: ${pack.manifest.name} (${pack.manifest.gameSource.toUpperCase()})`;
      } else {
        this.packStatus.textContent = `Loaded packs: ${this.loadedPacks.size} (active: ${pack.manifest.name})`;
      }
    }
    if (!this.gameSourceSelect) {
      return;
    }
    for (const option of Array.from(this.gameSourceSelect.querySelectorAll('option[data-pack="true"]'))) {
      option.remove();
    }
    for (const [key, entry] of this.loadedPacks.entries()) {
      const option = document.createElement('option');
      option.value = `pack:${key}`;
      option.textContent = `Pack: ${entry.manifest.name}`;
      option.dataset.pack = 'true';
      this.gameSourceSelect.appendChild(option);
    }
    if (this.activePackKey && this.gameSourceSelect.querySelector(`option[value="pack:${this.activePackKey}"]`)) {
      this.gameSourceSelect.value = `pack:${this.activePackKey}`;
    }
  }

  syncEnabled() {
    if (!this.gameSourceSelect) {
      return;
    }
    const selection = this.gameSourceSelect.value;
    if (selection.startsWith('pack:')) {
      const key = selection.slice('pack:'.length);
      const pack = this.loadedPacks.get(key) ?? null;
      this.activePackKey = pack ? key : null;
      setActivePack(pack);
      setPackEnabled(!!pack);
    } else {
      this.activePackKey = null;
      setPackEnabled(false);
    }
  }

  getLoadedPackList(): { identity: string; name: string; gameSource: GameSource }[] {
    return Array.from(this.loadedPacks.entries()).map(([key, entry]) => ({
      identity: key,
      name: entry.manifest.name ?? 'Custom pack',
      gameSource: entry.manifest.gameSource,
    }));
  }

  removePack(identity: string): void {
    const target = normalizeIdentity(identity);
    for (const key of Array.from(this.loadedPacks.keys())) {
      if (normalizeIdentity(key) !== target) {
        continue;
      }
      this.loadedPacks.delete(key);
      unregisterPackFromRegistry(key);
      if (this.activePackKey === key) {
        this.activePackKey = null;
        setActivePack(null);
        setPackEnabled(false);
        if (this.gameSourceSelect && this.gameSourceSelect.value === `pack:${key}`) {
          this.gameSourceSelect.value = GAME_SOURCES.SMB1;
        }
      }
    }
    this.refreshUi();
  }

  registerLoadedPack(pack: LoadedPack) {
    const key = packIdentity(pack);
    this.loadedPacks.set(key, pack);
    registerPackInRegistry(pack);
    this.activePackKey = key;
    setActivePack(pack);
    setPackEnabled(true);
  }

  registerLoadedPackQuiet(pack: LoadedPack) {
    this.loadedPacks.set(packIdentity(pack), pack);
    registerPackInRegistry(pack);
  }

  hasPackIdentity(identity: string): boolean {
    return this.loadedPacks.has(normalizeIdentity(identity));
  }

  getActivePackInfo(): { id: string; name: string; gameSource: GameSource } | null {
    const pack = getActivePack();
    if (!pack) {
      return null;
    }
    return { id: packIdentity(pack), name: pack.manifest.name ?? 'Custom pack', gameSource: pack.manifest.gameSource };
  }

  selectPackByIdentity(identity: string): boolean {
    const key = normalizeIdentity(identity);
    const pack = this.loadedPacks.get(key);
    if (!pack) {
      return false;
    }
    this.activePackKey = key;
    setActivePack(pack);
    setPackEnabled(true);
    if (this.gameSourceSelect) {
      this.refreshUi();
      this.gameSourceSelect.value = `pack:${key}`;
    }
    return true;
  }
}
