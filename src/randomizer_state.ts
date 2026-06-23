
let enabled = false;
let groups: string[] = [];
let totalEnabled = false;

export function setRandomizerEnabled(value: boolean) {
  enabled = value;
}

export function isRandomizerEnabled(): boolean {
  return enabled;
}

export function setTotalRandomizerEnabled(value: boolean) {
  totalEnabled = value;
}

export function isTotalRandomizerEnabled(): boolean {
  return totalEnabled;
}

export const RANDO_DEBUG = true;

type RandoLogEntry = { t: number; label: string; data?: unknown };
const randoLogBuffer: RandoLogEntry[] = [];
const RANDO_LOG_CAP = 2000;

export function randoDebug(label: string, data?: unknown): void {
  if (!RANDO_DEBUG) {
    return;
  }
  randoLogBuffer.push({ t: Date.now(), label, data });
  if (randoLogBuffer.length > RANDO_LOG_CAP) {
    randoLogBuffer.splice(0, randoLogBuffer.length - RANDO_LOG_CAP);
  }
  if (data !== undefined) {
    console.log(`rando: ${label}`, data);
  } else {
    console.log(`rando: ${label}`);
  }
}

export function dumpRandoLog(): string {
  return randoLogBuffer
    .map((entry) => {
      const ts = new Date(entry.t).toISOString().slice(11, 23);
      let payload = '';
      if (entry.data !== undefined) {
        try {
          payload = ` ${JSON.stringify(entry.data)}`;
        } catch (_err) {
          payload = ` ${String(entry.data)}`;
        }
      }
      return `[${ts}] ${entry.label}${payload}`;
    })
    .join('\n');
}

export function clearRandoLog(): void {
  randoLogBuffer.length = 0;
}

if (RANDO_DEBUG && typeof window !== 'undefined') {
  const w = window as any;
  w.randoLog = () => dumpRandoLog();
  w.randoClear = () => {
    clearRandoLog();
    return 'rando log cleared';
  };
  w.randoCopy = async () => {
    const text = dumpRandoLog();
    try {
      await navigator.clipboard.writeText(text);
      console.log(`rando: copied ${text.length} chars to clipboard`);
    } catch (_err) {
      console.log('rando: clipboard blocked; run copy(randoLog()) instead');
    }
    return `rando log: ${text.length} chars`;
  };
}

export function setRandomizerGroups(values: string[]) {
  groups = Array.isArray(values) ? [...values] : [];
}

export function getRandomizerGroups(): string[] {
  return groups;
}

const runtimeUnavailableStages = new Set<string>();

export function stageRuntimeKey(source: string | undefined, stageId: number, isPackStage: boolean): string {
  const src = source ?? '';
  return isPackStage ? `pack:${src}:${stageId}` : `${src}:${stageId}`;
}

export function markStageRuntimeUnavailable(source: string | undefined, stageId: number, isPackStage: boolean) {
  runtimeUnavailableStages.add(stageRuntimeKey(source, stageId, isPackStage));
}

export function isStageRuntimeUnavailable(source: string | undefined, stageId: number, isPackStage: boolean): boolean {
  return runtimeUnavailableStages.has(stageRuntimeKey(source, stageId, isPackStage));
}

export function getRuntimeUnavailableStages(): string[] {
  return [...runtimeUnavailableStages];
}

export function clearRuntimeUnavailableStages() {
  runtimeUnavailableStages.clear();
}

const verifiedInstalledStages = new Map<string, Set<number>>();

export function setVerifiedInstalledStages(source: string, ids: number[]) {
  verifiedInstalledStages.set(source, new Set(ids));
}

export function getVerifiedInstalledStages(source: string): Set<number> | null {
  return verifiedInstalledStages.get(source) ?? null;
}

export function clearVerifiedInstalledStages() {
  verifiedInstalledStages.clear();
}
