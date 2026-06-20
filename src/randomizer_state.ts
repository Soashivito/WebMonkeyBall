
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

export function setRandomizerGroups(values: string[]) {
  groups = Array.isArray(values) ? [...values] : [];
}

export function getRandomizerGroups(): string[] {
  return groups;
}
