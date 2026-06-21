
import { getStageListForDifficulty } from '../../course.js';
import {
  getSmb2ChallengeStageEntries,
  listSmb2ChallengeDifficulties,
} from '../../course_smb2.js';
import {
  getMb2wsChallengeStageEntries,
  listMb2wsChallengeDifficulties,
} from '../../course_mb2ws.js';
import { GAME_SOURCES, type GameSource } from '../../shared/constants/index.js';
import { getActivePack, getPackStageRules, getPackStageName, packStageHasModel, packStageHasStagedef, hasPackForGameSource } from '../../pack.js';
import { STAGE_INFO_MAP } from '../../noclip/SuperMonkeyBall/StageInfo.js';
import { getSmb2StageInfo, getMb2wsStageInfo } from '../../smb2_render.js';

function stageLoadableForSource(source: GameSource, id: number): boolean {
  if (source === GAME_SOURCES.SMB2) {
    return !!getSmb2StageInfo(id);
  }
  if (source === GAME_SOURCES.MB2WS) {
    return !!getMb2wsStageInfo(id);
  }
  return STAGE_INFO_MAP.has(id as never);
}

export const RANDOMIZER_PACK_KEY = '__pack__';

export interface RandomizerGroup {
  value: string;
  label: string;
}

export interface RandomizerPool {
  stageList: any[];
  bonusFlags: boolean[];
}

const SMB1_DIFFICULTIES: RandomizerGroup[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
  { value: 'beginner-extra', label: 'Beginner (Extra)' },
  { value: 'advanced-extra', label: 'Advanced (Extra)' },
  { value: 'expert-extra', label: 'Expert (Extra)' },
  { value: 'master', label: 'Master' },
];

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function randomizerPackActive(gameSource: GameSource): boolean {
  return hasPackForGameSource(gameSource);
}

export function listRandomizerGroups(gameSource: GameSource): RandomizerGroup[] {
  if (hasPackForGameSource(gameSource)) {
    return [];
  }
  if (gameSource === GAME_SOURCES.SMB1) {
    return [...SMB1_DIFFICULTIES];
  }
  if (gameSource === GAME_SOURCES.SMB2) {
    return listSmb2ChallengeDifficulties().map((d) => ({ value: d, label: titleCase(d) }));
  }
  if (gameSource === GAME_SOURCES.MB2WS) {
    return listMb2wsChallengeDifficulties().map((d) => ({ value: d, label: titleCase(d) }));
  }
  return [];
}

function packStageEntries(): any[] {
  const pack = getActivePack();
  const ids: number[] = pack?.manifest?.content?.stages ?? [];
  const packSource: GameSource = (pack?.manifest?.gameSource as GameSource) ?? GAME_SOURCES.SMB1;
  return ids
    .filter((id) =>
      packStageHasModel(id) &&
      packStageHasStagedef(id) &&
      stageLoadableForSource(packSource, id),
    )
    .map((id) => {
      const rules = getPackStageRules(id);
      const name = getPackStageName(id);
      return {
        id,
        parserId: rules?.parserId,
        rulesetId: rules?.rulesetId,
        ...(name ? { name } : {}),
      };
    });
}

export function buildRandomizerPool(gameSource: GameSource, keys: string[]): RandomizerPool | null {
  if (!Array.isArray(keys) || keys.length === 0) {
    return null;
  }
  const seen = new Set<number>();
  const stageList: any[] = [];
  const bonusFlags: boolean[] = [];

  const pushEntries = (entries: any[], bonus: boolean[] | null, difficultyTag: string | null) => {
    entries.forEach((entry, index) => {
      if (entry == null || typeof entry.id !== 'number' || seen.has(entry.id)) {
        return;
      }
      seen.add(entry.id);
      stageList.push(difficultyTag ? { ...entry, difficulty: difficultyTag } : entry);
      bonusFlags.push(Array.isArray(bonus) ? bonus[index] === true : false);
    });
  };

  for (const key of keys) {
    if (key === RANDOMIZER_PACK_KEY) {
      pushEntries(packStageEntries(), null, null);
      continue;
    }
    if (gameSource === GAME_SOURCES.SMB1) {
      pushEntries(getStageListForDifficulty(key), null, key);
    } else if (gameSource === GAME_SOURCES.SMB2) {
      const { stageList: list, bonusFlags: bf } = getSmb2ChallengeStageEntries(key);
      pushEntries(list, bf, key);
    } else if (gameSource === GAME_SOURCES.MB2WS) {
      const { stageList: list, bonusFlags: bf } = getMb2wsChallengeStageEntries(key);
      pushEntries(list, bf, key);
    }
  }

  return stageList.length > 0 ? { stageList, bonusFlags } : null;
}

export function buildTotalRandomizerPool(): RandomizerPool | null {
  const seen = new Set<string>();
  const stageList: any[] = [];
  const bonusFlags: boolean[] = [];

  const pushFrom = (source: GameSource, entries: any[], bonus: boolean[] | null, difficultyTag: string | null) => {
    entries.forEach((entry, index) => {
      if (entry == null || typeof entry.id !== 'number') {
        return;
      }
      if (!stageLoadableForSource(source, entry.id)) {
        return;
      }
      const key = `${source}:${entry.id}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      stageList.push({
        ...entry,
        gameSource: source,
        ...(difficultyTag ? { difficulty: difficultyTag } : {}),
      });
      bonusFlags.push(Array.isArray(bonus) ? bonus[index] === true : false);
    });
  };

  for (const group of SMB1_DIFFICULTIES) {
    pushFrom(GAME_SOURCES.SMB1, getStageListForDifficulty(group.value), null, group.value);
  }
  for (const difficulty of listSmb2ChallengeDifficulties()) {
    const { stageList: list, bonusFlags: bf } = getSmb2ChallengeStageEntries(difficulty);
    pushFrom(GAME_SOURCES.SMB2, list, bf, difficulty);
  }
  for (const difficulty of listMb2wsChallengeDifficulties()) {
    const { stageList: list, bonusFlags: bf } = getMb2wsChallengeStageEntries(difficulty);
    pushFrom(GAME_SOURCES.MB2WS, list, bf, difficulty);
  }

  return stageList.length > 0 ? { stageList, bonusFlags } : null;
}
