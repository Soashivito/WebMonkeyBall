const STORAGE_KEY = 'wmb-randomizer-options';

export type RandomizerOptions = {
  disabledSources: string[];
  seed: string;
  includeBonus: boolean;
  infiniteTime: boolean;
};

const DEFAULTS: RandomizerOptions = {
  disabledSources: [],
  seed: '',
  includeBonus: false,
  infiniteTime: false,
};

let cached: RandomizerOptions | null = null;

export function getRandomizerOptions(): RandomizerOptions {
  if (cached) {
    return cached;
  }
  let parsed: any = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  cached = {
    disabledSources: Array.isArray(parsed?.disabledSources)
      ? parsed.disabledSources.filter((entry: unknown) => typeof entry === 'string')
      : DEFAULTS.disabledSources.slice(),
    seed: typeof parsed?.seed === 'string' ? parsed.seed : DEFAULTS.seed,
    includeBonus: parsed?.includeBonus === true,
    infiniteTime: parsed?.infiniteTime === true,
  };
  return cached;
}

export function setRandomizerOptions(next: Partial<RandomizerOptions>): RandomizerOptions {
  const merged = { ...getRandomizerOptions(), ...next };
  cached = merged;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
  }
  return merged;
}

export function sourceKeyForPack(identity: string): string {
  return `pack:${identity}`;
}

export function isSourceEnabled(key: string): boolean {
  return !getRandomizerOptions().disabledSources.includes(key);
}

export function setSourceEnabled(key: string, enabled: boolean): void {
  const current = getRandomizerOptions().disabledSources.filter((entry) => entry !== key);
  if (!enabled) {
    current.push(key);
  }
  setRandomizerOptions({ disabledSources: current });
}
