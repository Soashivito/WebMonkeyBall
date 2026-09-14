
import { isRandomizerEnabled, isTotalRandomizerEnabled, isStageRuntimeUnavailable } from './randomizer_state.js';

export interface RandomizerStageEntry {
  id: number;
  name?: string;
  parserId?: string;
  rulesetId?: string;
  difficulty?: string;
  gameSource?: string;
  packStage?: boolean;
  packId?: string;
}

export interface RandomizerCourse {
  stageList: RandomizerStageEntry[];
  bonusFlags?: boolean[];
  __randomizerVisited?: Set<number> | null;
  stageIndex?: number;
  currentIndex?: number;
  currentStageId?: number;
  currentStageParserId?: string;
  currentStageRulesetId?: string;
  currentStageGameSource?: string;
  currentStageIsPackStage?: boolean;
  currentStagePackId?: string;
  currentStageName?: string;
  currentFloor?: number;
}

export function isSmb1BonusStageId(stageId: number): boolean {
  return stageId >= 91 && stageId <= 95;
}

export function courseIndexIsBonus(course: RandomizerCourse, index: number): boolean {
  if (Array.isArray(course.bonusFlags) && course.bonusFlags.length > 0) {
    return course.bonusFlags[index] === true;
  }
  const id = course.stageList[index]?.id;
  return typeof id === 'number' && isSmb1BonusStageId(id);
}

function entryStageUnavailable(entry: RandomizerStageEntry | undefined): boolean {
  if (!entry || typeof entry.id !== 'number' || typeof entry.gameSource !== 'string') {
    return false;
  }
  return isStageRuntimeUnavailable(entry.gameSource, entry.id, entry.packStage === true);
}

function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function seedRandomizerCourse(course: RandomizerCourse, seed: string): void {
  const text = typeof seed === 'string' && seed.trim() ? seed.trim() : String(Date.now()) + ':' + String(Math.random());
  (course as any).__randomizerSeed = text;
  (course as any).__randomizerRngState = hashSeed(text) || 1;
}

function nextRandom(course: RandomizerCourse): number {
  const state = (course as any).__randomizerRngState;
  if (typeof state !== 'number') {
    return Math.random();
  }
  let x = (state + 0x6d2b79f5) >>> 0;
  (course as any).__randomizerRngState = x;
  x = Math.imul(x ^ (x >>> 15), x | 1) >>> 0;
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function pickRandomizerIndex(course: RandomizerCourse, currentIndex: number): number | null {
  if (!course.__randomizerVisited) {
    course.__randomizerVisited = new Set<number>();
  }
  course.__randomizerVisited.add(currentIndex);
  const remaining: number[] = [];
  for (let i = 0; i < course.stageList.length; i += 1) {
    if (course.__randomizerVisited.has(i)) {
      continue;
    }
    if (!(course as any).__randomizerIncludeBonus && courseIndexIsBonus(course, i)) {
      continue;
    }
    if (entryStageUnavailable(course.stageList[i])) {
      continue;
    }
    remaining.push(i);
  }
  if (remaining.length === 0) {
    return null;
  }
  const pick = remaining[Math.floor(nextRandom(course) * remaining.length)];
  course.__randomizerVisited.add(pick);
  return pick;
}

export function markCurrentRandomizerStageVisited(course: RandomizerCourse) {
  const index = typeof course.stageIndex === 'number' ? course.stageIndex : course.currentIndex;
  if (typeof index === 'number' && index >= 0) {
    if (!course.__randomizerVisited) {
      course.__randomizerVisited = new Set<number>();
    }
    course.__randomizerVisited.add(index);
  }
}

function setCourseStage(course: RandomizerCourse, index: number) {
  const entry = course.stageList[index];
  if (!entry) {
    return;
  }
  course.stageIndex = index;
  course.currentIndex = index;
  course.currentStageId = entry.id;
  if (entry.parserId !== undefined) {
    course.currentStageParserId = entry.parserId;
  }
  if (entry.rulesetId !== undefined) {
    course.currentStageRulesetId = entry.rulesetId;
  }
  if (entry.gameSource !== undefined) {
    course.currentStageGameSource = entry.gameSource;
  }
  course.currentStageIsPackStage = entry.packStage === true;
  course.currentStagePackId = entry.packStage === true ? entry.packId : undefined;
  course.currentStageName = entry.name ?? '';
  course.currentFloor = index + 1;
}

export function randomizerAdvanceCourse(course: RandomizerCourse): boolean {
  const current = typeof course.stageIndex === 'number' ? course.stageIndex : (course.currentIndex ?? 0);
  const next = pickRandomizerIndex(course, current);
  if (next === null) {
    return false;
  }
  setCourseStage(course, next);
  return true;
}

function pickRandomizerStartIndex(course: RandomizerCourse): number | null {
  const candidates: number[] = [];
  for (let i = 0; i < course.stageList.length; i += 1) {
    if (!(course as any).__randomizerIncludeBonus && courseIndexIsBonus(course, i)) {
      continue;
    }
    if (entryStageUnavailable(course.stageList[i])) {
      continue;
    }
    candidates.push(i);
  }
  if (candidates.length === 0) {
    return null;
  }
  return candidates[Math.floor(nextRandom(course) * candidates.length)];
}

export function applyRandomizerPool(
  course: RandomizerCourse,
  stageList: RandomizerStageEntry[],
  bonusFlags?: boolean[] | null,
  options?: { seed?: string; includeBonus?: boolean },
) {
  (course as any).__randomizerIncludeBonus = options?.includeBonus === true;
  seedRandomizerCourse(course, options?.seed ?? '');
  if (!Array.isArray(stageList) || stageList.length === 0) {
    return;
  }
  course.stageList = stageList;
  if (Array.isArray(bonusFlags)) {
    course.bonusFlags = bonusFlags;
  }
  course.__randomizerVisited = new Set<number>();
  const start = pickRandomizerStartIndex(course);
  if (start === null) {
    setCourseStage(course, 0);
    return;
  }
  course.__randomizerVisited.add(start);
  setCourseStage(course, start);
}

export function applyHostRandomizerStage(
  course: RandomizerCourse,
  stage: {
    id: number;
    gameSource: string;
    isPack?: boolean;
    packId?: string;
    floor?: number;
    total?: number;
    difficulty?: string;
  },
) {
  course.currentStageId = stage.id;
  course.currentStageGameSource = stage.gameSource;
  course.currentStageIsPackStage = stage.isPack === true;
  course.currentStagePackId = stage.isPack === true ? stage.packId : undefined;
  course.currentStageName = '';
  (course as any).hostFloorOverride = Number.isFinite(stage.floor)
    ? { current: stage.floor, total: stage.total, difficulty: stage.difficulty }
    : null;
}

export function randomizerEnabled(): boolean {
  return isRandomizerEnabled() || isTotalRandomizerEnabled();
}
