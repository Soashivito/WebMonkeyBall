
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
