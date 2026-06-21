
import { listRandomizerGroups, RANDOMIZER_PACK_KEY } from './randomizer_pool.js';
import { setRandomizerEnabled, setRandomizerGroups, isRandomizerEnabled, setTotalRandomizerEnabled } from '../../randomizer_state.js';
import { getActivePack } from '../../pack.js';
import { GAME_SOURCES, type GameSource } from '../../shared/constants/index.js';

const ENABLED_KEY = 'wmb-randomizer-enabled';
const DIFFICULTIES_KEY = 'wmb-randomizer-difficulties';
const ENABLE_CHECKBOX_IDS = ['randomizer-toggle-sp', 'randomizer-toggle-mp'];
const SOURCE_SELECT_ID = 'course-play-source';
const SP_DIFFICULTY_SELECT_ID = 'course-play-difficulty';
const SP_DIFFICULTIES_CONTAINER_ID = 'randomizer-difficulties-sp';

interface CurrentSource {
  gameSource: GameSource;
  isPack: boolean;
}

function resolveCurrentSource(): CurrentSource {
  const value = (document.getElementById(SOURCE_SELECT_ID) as HTMLSelectElement | null)?.value ?? GAME_SOURCES.SMB1;
  if (value.startsWith('pack:')) {
    const pack = getActivePack();
    return { gameSource: (pack?.manifest?.gameSource ?? GAME_SOURCES.SMB1) as GameSource, isPack: true };
  }
  return { gameSource: value as GameSource, isPack: false };
}

function readStoredEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStoredEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
  }
}

function readStoredDifficulties(): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(DIFFICULTIES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredDifficulties(map: Record<string, string[]>) {
  try {
    window.localStorage.setItem(DIFFICULTIES_KEY, JSON.stringify(map));
  } catch {
  }
}

function setEnabledFlag(enabled: boolean) {
  setRandomizerEnabled(enabled);
  writeStoredEnabled(enabled);
  for (const id of ENABLE_CHECKBOX_IDS) {
    const box = document.getElementById(id) as HTMLInputElement | null;
    if (box && box.checked !== enabled) {
      box.checked = enabled;
    }
  }
}

function applySelection(current: CurrentSource) {
  if (current.isPack) {
    setRandomizerGroups([RANDOMIZER_PACK_KEY]);
    return;
  }
  const stored = readStoredDifficulties();
  setRandomizerGroups(Array.isArray(stored[current.gameSource]) ? stored[current.gameSource] : []);
}

function renderDifficultyPicker(enabled: boolean) {
  const container = document.getElementById(SP_DIFFICULTIES_CONTAINER_ID);
  if (!container) {
    return;
  }
  container.classList.toggle('hidden', !enabled);
  if (!enabled) {
    return;
  }

  const current = resolveCurrentSource();
  container.innerHTML = '';

  if (current.isPack) {
    const note = document.createElement('div');
    note.className = 'control-hint';
    note.textContent = 'All pack levels are randomized';
    container.appendChild(note);
    setRandomizerGroups([RANDOMIZER_PACK_KEY]);
    return;
  }

  const difficulties = listRandomizerGroups(current.gameSource);
  if (difficulties.length === 0) {
    const note = document.createElement('div');
    note.className = 'control-hint';
    note.textContent = 'Nothing to randomize here';
    container.appendChild(note);
    setRandomizerGroups([]);
    return;
  }

  const stored = readStoredDifficulties();
  let selected = Array.isArray(stored[current.gameSource]) ? stored[current.gameSource] : null;
  if (!selected) {
    const diffSelect = document.getElementById(SP_DIFFICULTY_SELECT_ID) as HTMLSelectElement | null;
    const value = diffSelect?.value;
    selected = value && difficulties.some((d) => d.value === value) ? [value] : [];
  }

  for (const difficulty of difficulties) {
    const label = document.createElement('label');
    label.className = 'checkbox-field';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = difficulty.value;
    input.checked = selected.includes(difficulty.value);
    const span = document.createElement('span');
    span.textContent = difficulty.label;
    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);

    input.addEventListener('change', () => {
      const picked = Array.from(container.querySelectorAll('input[type="checkbox"]'))
        .filter((el) => (el as HTMLInputElement).checked)
        .map((el) => (el as HTMLInputElement).value);
      const map = readStoredDifficulties();
      map[current.gameSource] = picked;
      writeStoredDifficulties(map);
      setRandomizerGroups(picked);
    });
  }

  setRandomizerGroups(selected);
}

export function initRandomizerToggle() {
  const enabled = readStoredEnabled();
  setEnabledFlag(enabled);
  applySelection(resolveCurrentSource());
  renderDifficultyPicker(enabled);

  for (const id of ENABLE_CHECKBOX_IDS) {
    const box = document.getElementById(id) as HTMLInputElement | null;
    if (!box) {
      continue;
    }
    box.addEventListener('change', () => {
      setEnabledFlag(box.checked);
      renderDifficultyPicker(box.checked);
    });
  }

  const sourceSelect = document.getElementById(SOURCE_SELECT_ID) as HTMLSelectElement | null;
  sourceSelect?.addEventListener('change', () => {
    renderDifficultyPicker(isRandomizerEnabled());
  });

  const TOTAL_KEY = 'wmb-randomizer-total';
  let storedTotal = false;
  try {
    storedTotal = window.localStorage.getItem(TOTAL_KEY) === '1';
  } catch {
    storedTotal = false;
  }
  setTotalRandomizerEnabled(storedTotal);
  const applyTotal = (value: boolean) => {
    setTotalRandomizerEnabled(value);
    try {
      window.localStorage.setItem(TOTAL_KEY, value ? '1' : '0');
    } catch {
    }
    for (const id of ['randomizer-total-sp', 'randomizer-total-mp']) {
      const box = document.getElementById(id) as HTMLInputElement | null;
      if (box && box.checked !== value) {
        box.checked = value;
      }
    }
  };
  for (const id of ['randomizer-total-sp', 'randomizer-total-mp']) {
    const box = document.getElementById(id) as HTMLInputElement | null;
    if (!box) {
      continue;
    }
    box.checked = storedTotal;
    box.addEventListener('change', () => applyTotal(box.checked));
  }
}
