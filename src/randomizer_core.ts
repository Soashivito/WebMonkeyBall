
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

function isBonusStageId(stageId: number): boolean {
  return stageId >= 91 && stageId <= 95;
}

export function courseIndexIsBonus(course: RandomizerCourse, index: number): boolean {
  if (Array.isArray(course.bonusFlags) && course.bonusFlags.length > 0) {
    return course.bonusFlags[index] === true;
  }
  const id = course.stageList[index]?.id;
  return typeof id === 'number' && isBonusStageId(id);
}

function entryStageUnavailable(entry: RandomizerStageEntry | undefined): boolean {
  if (!entry || typeof entry.id !== 'number' || typeof entry.gameSource !== 'string') {
    return false;
  }
  return isStageRuntimeUnavailable(entry.gameSource, entry.id, entry.packStage === true);
}

export function pickRandomizerIndex(course: RandomizerCourse, currentIndex: number): number | null {
  if (!course.__randomizerVisited) {
    course.__randomizerVisited = new Set<number>();
  }
  course.__randomizerVisited.add(currentIndex);
  const remaining: number[] = [];
  for (let i = 0; i < course.stageList.length; i += 1) {
    if (course.__randomizerVisited.has(i) || courseIndexIsBonus(course, i)) {
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
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
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

export function applyRandomizerPool(
  course: RandomizerCourse,
  stageList: RandomizerStageEntry[],
  bonusFlags?: boolean[] | null,
) {
  if (!Array.isArray(stageList) || stageList.length === 0) {
    return;
  }
  course.stageList = stageList;
  if (Array.isArray(bonusFlags)) {
    course.bonusFlags = bonusFlags;
  }
  course.__randomizerVisited = null;
  setCourseStage(course, 0);
}

export function randomizerEnabled(): boolean {
  return isRandomizerEnabled() || isTotalRandomizerEnabled();
}
