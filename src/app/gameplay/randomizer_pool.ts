
import { getStageListForDifficulty } from '../../course.js';
import {
  getSmb2ChallengeStageEntries,
  listSmb2ChallengeDifficulties,
} from '../../course_smb2.js';
import {
  getMb2wsChallengeStageEntries,
  listMb2wsChallengeDifficulties,
} from '../../course_mb2ws.js';
import { GAME_SOURCES, STAGE_BASE_PATHS, type GameSource } from '../../shared/constants/index.js';
import { getActivePack, getPackStageRules, getPackStageNameUnchecked, packStageHasModel, packStageHasStagedef, hasPackForGameSource, getAllLoadedPacks, setActivePack, setPackEnabled, isPackEnabled, packIdentity } from '../../pack.js';
import { setVerifiedInstalledStages, getVerifiedInstalledStages } from '../../randomizer_state.js';
import { isSmb1BonusStageId } from '../../randomizer_core.js';
import { STAGE_INFO_MAP } from '../../noclip/SuperMonkeyBall/StageInfo.js';
import { hasSmb2StageInfo, hasMb2wsStageInfo } from '../../smb2_render.js';
import { isSourceEnabled, sourceKeyForPack } from './randomizer_options.js';

//use has*StageInfo, get* synthesizes an entry for any id
function stageLoadableForSource(source: GameSource, id: number): boolean {
  if (source === GAME_SOURCES.SMB2) {
    return hasSmb2StageInfo(id);
  }
  if (source === GAME_SOURCES.MB2WS) {
    return hasMb2wsStageInfo(id);
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

function packDeclaredPlayableIds(): Set<number> | null {
  const pack = getActivePack();
  if (!pack) {
    return null;
  }
  const ids = new Set<number>();
  const order = pack.manifest?.courses?.challenge?.order;
  if (order && typeof order === 'object') {
    for (const key of Object.keys(order)) {
      const list = (order as Record<string, Array<number | { id?: number }>>)[key];
      if (!Array.isArray(list)) {
        continue;
      }
      for (const entry of list) {
        const id = typeof entry === 'number' ? entry : entry?.id;
        if (typeof id === 'number' && Number.isFinite(id)) {
          ids.add(id);
        }
      }
    }
  }
  if (ids.size > 0) {
    return ids;
  }
  const stageNames = pack.manifest?.content?.stageNames;
  if (stageNames && Object.keys(stageNames).length > 0) {
    for (const key of Object.keys(stageNames)) {
      const id = Number(key);
      if (Number.isFinite(id)) {
        ids.add(id);
      }
    }
    return ids;
  }
  return null;
}

function packStageEntries(): any[] {
  const pack = getActivePack();
  const ids: number[] = pack?.manifest?.content?.stages ?? [];
  const packSource: GameSource = (pack?.manifest?.gameSource as GameSource) ?? GAME_SOURCES.SMB1;
  const declaredPlayable = packDeclaredPlayableIds();
  return ids
    .filter((id) =>
      packStageHasModel(id) &&
      packStageHasStagedef(id) &&
      stageLoadableForSource(packSource, id) &&
      (declaredPlayable === null || declaredPlayable.has(id)),
    )
    .map((id) => {
      const rules = getPackStageRules(id);
      const name = getPackStageNameUnchecked(id);
      return {
        id,
        parserId: rules?.parserId,
        rulesetId: rules?.rulesetId,
        packStage: true,
        ...(name ? { name } : {}),
      };
    });
}

function getInstalledStageIdSet(source: GameSource): Set<number> | null {
  return getVerifiedInstalledStages(source);
}

async function baseFileExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) {
      return true;
    }
    if (head.status === 405 || head.status === 501) {
      const ranged = await fetch(url, { headers: { Range: 'bytes=0-0' } });
      return ranged.ok;
    }
    return false;
  } catch {
    return false;
  }
}

async function probeStageIds(
  ids: number[],
  probe: (id: number) => Promise<boolean>,
): Promise<number[]> {
  const present: number[] = [];
  let cursor = 0;
  const runWorker = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= ids.length) {
        return;
      }
      const id = ids[index];
      if (await probe(id)) {
        present.push(id);
      }
    }
  };
  const workers: Array<Promise<void>> = [];
  for (let w = 0; w < Math.min(12, ids.length); w += 1) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
  return present;
}

//we probe the stagedef first, a missing stage costs one request
//only packs check the model, no base candidate is missing one
async function stageFilesExist(base: string, id: number, requireModel: boolean): Promise<boolean> {
  if (!Number.isFinite(id)) {
    return false;
  }
  const idStr = String(id).padStart(3, '0');
  if (!(await baseFileExists(`${base}/st${idStr}/STAGE${idStr}.lz`))) {
    return false;
  }
  if (!requireModel) {
    return true;
  }
  return baseFileExists(`${base}/st${idStr}/st${idStr}.gma`);
}

function baseCandidateIds(source: GameSource): number[] {
  const ids = new Set<number>();
  const add = (entries: any[]) => {
    for (const entry of entries) {
      if (entry && typeof entry.id === 'number' && stageLoadableForSource(source, entry.id)) {
        ids.add(entry.id);
      }
    }
  };
  if (source === GAME_SOURCES.SMB1) {
    for (const group of SMB1_DIFFICULTIES) {
      add(getStageListForDifficulty(group.value));
    }
  } else if (source === GAME_SOURCES.SMB2) {
    for (const difficulty of listSmb2ChallengeDifficulties()) {
      add(getSmb2ChallengeStageEntries(difficulty).stageList);
    }
  } else if (source === GAME_SOURCES.MB2WS) {
    for (const difficulty of listMb2wsChallengeDifficulties()) {
      add(getMb2wsChallengeStageEntries(difficulty).stageList);
    }
  }
  return [...ids];
}

//we cache the probe per source and base path, the build commit is in the key
const VERIFIED_CACHE_PREFIX = 'wmb-verified:';

declare const __APP_COMMIT__: string | undefined;

function verifiedCacheKey(source: GameSource, base: string): string {
  const commit = typeof __APP_COMMIT__ !== 'undefined' && __APP_COMMIT__ ? String(__APP_COMMIT__) : 'dev';
  return `${VERIFIED_CACHE_PREFIX}${commit}:${source}:${base}`;
}

function readCachedVerified(source: GameSource, base: string): number[] | null {
  try {
    const raw = window.localStorage.getItem(verifiedCacheKey(source, base));
    if (!raw) {
      return null;
    }
    const ids = JSON.parse(raw);
    //never reuse a cached empty list, we cant tell it from unmounted content
    return Array.isArray(ids) && ids.length > 0 && ids.every((n) => typeof n === 'number') ? ids : null;
  } catch {
    return null;
  }
}

function writeCachedVerified(source: GameSource, base: string, ids: number[]): void {
  if (ids.length === 0) {
    return;
  }
  try {
    window.localStorage.setItem(verifiedCacheKey(source, base), JSON.stringify(ids));
  } catch {
  }
}

async function verifySourceStages(source: GameSource): Promise<void> {
  const base = (STAGE_BASE_PATHS as Record<string, string>)[source];
  if (!base) {
    setVerifiedInstalledStages(source, []);
    return;
  }
  const cached = readCachedVerified(source, base);
  if (cached) {
    setVerifiedInstalledStages(source, cached);
    return;
  }
  const candidates = baseCandidateIds(source);
  if (candidates.length === 0) {
    setVerifiedInstalledStages(source, []);
    return;
  }
  const sampleSize = Math.min(8, candidates.length);
  let anyPresent = false;
  for (let i = 0; i < sampleSize; i += 1) {
    const idStr = String(candidates[i]).padStart(3, '0');
    if (await baseFileExists(`${base}/st${idStr}/STAGE${idStr}.lz`)) {
      anyPresent = true;
      break;
    }
  }
  if (!anyPresent) {
    setVerifiedInstalledStages(source, []);
    return;
  }
  const available = await probeStageIds(candidates, (id) => stageFilesExist(base, id, false));
  setVerifiedInstalledStages(source, available);
  writeCachedVerified(source, base, available);
}

let verificationPromise: Promise<void> | null = null;

export function ensureStagesVerified(): Promise<void> {
  if (!verificationPromise) {
    verificationPromise = Promise.all([
      verifySourceStages(GAME_SOURCES.SMB1),
      verifySourceStages(GAME_SOURCES.SMB2),
      verifySourceStages(GAME_SOURCES.MB2WS),
    ]).then(() => undefined);
  }
  return verificationPromise;
}

let packVerifiedIds: Set<number> | null = null;
let packVerifiedKey: string | null = null;
let packVerificationPromise: Promise<void> | null = null;

async function verifyPackStages(
  pack: NonNullable<ReturnType<typeof getActivePack>>,
  identity: string,
): Promise<void> {
  const commit = (ids: Set<number> | null) => {
    if (packVerifiedKey === identity) {
      packVerifiedIds = ids;
    }
  };
  if (pack.provider.has) {
    commit(null);
    return;
  }
  const ids: number[] = pack.manifest?.content?.stages ?? [];
  if (!Array.isArray(ids) || ids.length === 0) {
    commit(new Set<number>());
    return;
  }
  const base = String(pack.basePath ?? '').replace(/\/+$/, '');
  commit(new Set(await probeStageIds(ids, (id) => stageFilesExist(base, id, true))));
}

export function ensurePackStagesVerified(): Promise<void> {
  const pack = getActivePack();
  if (!pack) {
    packVerifiedIds = null;
    packVerifiedKey = null;
    packVerificationPromise = null;
    return Promise.resolve();
  }
  const identity = packIdentity(pack);
  if (packVerifiedKey === identity && packVerificationPromise) {
    return packVerificationPromise;
  }
  packVerifiedKey = identity;
  packVerifiedIds = null;
  packVerificationPromise = verifyPackStages(pack, identity);
  return packVerificationPromise;
}

function getVerifiedPackStageSet(): Set<number> | null {
  return packVerifiedIds;
}

function smb1BonusFlags(entries: any[]): boolean[] {
  return entries.map((entry) => typeof entry?.id === 'number' && isSmb1BonusStageId(entry.id));
}

export function buildRandomizerPool(gameSource: GameSource, keys: string[]): RandomizerPool | null {
  if (!Array.isArray(keys) || keys.length === 0) {
    return null;
  }
  const seen = new Set<number>();
  const stageList: any[] = [];
  const bonusFlags: boolean[] = [];
  const installed = getInstalledStageIdSet(gameSource);

  const pushEntries = (entries: any[], bonus: boolean[] | null, difficultyTag: string | null, gateBySource: boolean) => {
    const packVerified = gateBySource ? null : getVerifiedPackStageSet();
    entries.forEach((entry, index) => {
      if (entry == null || typeof entry.id !== 'number' || seen.has(entry.id)) {
        return;
      }
      if (gateBySource && installed && !installed.has(entry.id)) {
        return;
      }
      if (!gateBySource && packVerified && !packVerified.has(entry.id)) {
        return;
      }
      seen.add(entry.id);
      stageList.push({ ...entry, gameSource, ...(difficultyTag ? { difficulty: difficultyTag } : {}) });
      bonusFlags.push(Array.isArray(bonus) ? bonus[index] === true : false);
    });
  };

  for (const key of keys) {
    if (key === RANDOMIZER_PACK_KEY) {
      pushEntries(packStageEntries(), null, null, false);
      continue;
    }
    if (gameSource === GAME_SOURCES.SMB1) {
      const smb1List = getStageListForDifficulty(key);
      pushEntries(smb1List, smb1BonusFlags(smb1List), key, true);
    } else if (gameSource === GAME_SOURCES.SMB2) {
      const { stageList: list, bonusFlags: bf } = getSmb2ChallengeStageEntries(key);
      pushEntries(list, bf, key, true);
    } else if (gameSource === GAME_SOURCES.MB2WS) {
      const { stageList: list, bonusFlags: bf } = getMb2wsChallengeStageEntries(key);
      pushEntries(list, bf, key, true);
    }
  }

  return stageList.length > 0 ? { stageList, bonusFlags } : null;
}

export function buildTotalRandomizerPool(): RandomizerPool | null {
  const seen = new Set<string>();
  const stageList: any[] = [];
  const bonusFlags: boolean[] = [];

  const pushFrom = (source: GameSource, entries: any[], bonus: boolean[] | null, difficultyTag: string | null) => {
    if (!isSourceEnabled(source)) {
      return;
    }
    const installed = getInstalledStageIdSet(source);
    entries.forEach((entry, index) => {
      if (entry == null || typeof entry.id !== 'number') {
        return;
      }
      if (installed && !installed.has(entry.id)) {
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
    const smb1List = getStageListForDifficulty(group.value);
    pushFrom(GAME_SOURCES.SMB1, smb1List, smb1BonusFlags(smb1List), group.value);
  }
  for (const difficulty of listSmb2ChallengeDifficulties()) {
    const { stageList: list, bonusFlags: bf } = getSmb2ChallengeStageEntries(difficulty);
    pushFrom(GAME_SOURCES.SMB2, list, bf, difficulty);
  }
  for (const difficulty of listMb2wsChallengeDifficulties()) {
    const { stageList: list, bonusFlags: bf } = getMb2wsChallengeStageEntries(difficulty);
    pushFrom(GAME_SOURCES.MB2WS, list, bf, difficulty);
  }

  const allPacks = getAllLoadedPacks();
  const savedActivePack = getActivePack();
  const savedPackEnabled = isPackEnabled();
  for (const pack of allPacks) {
    const identity = packIdentity(pack);
    if (!isSourceEnabled(sourceKeyForPack(identity))) {
      continue;
    }
    const packSource = pack.manifest.gameSource;
    setActivePack(pack);
    setPackEnabled(true);
    const entries = packStageEntries();
    entries.forEach((entry) => {
      if (entry == null || typeof entry.id !== 'number') {
        return;
      }
      //key by pack identity and id, so two packs sharing a stage number keep both
      const key = `pack:${identity}:${entry.id}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      stageList.push({ ...entry, gameSource: packSource, packStage: true, packId: identity });
      bonusFlags.push(false);
    });
  }
  setActivePack(savedActivePack);
  setPackEnabled(savedPackEnabled);



  return stageList.length > 0 ? { stageList, bonusFlags } : null;
}
