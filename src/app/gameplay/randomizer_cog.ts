import { GAME_SOURCES } from '../../shared/constants/index.js';
import { isTotalRandomizerEnabled } from '../../randomizer_state.js';
import { refreshRandomizerPicker } from './randomizer_toggle.js';
import { getAllLoadedPacks, packIdentity } from '../../pack.js';
import {
  getRandomizerOptions,
  isSourceEnabled,
  setRandomizerOptions,
  setSourceEnabled,
  sourceKeyForPack,
} from './randomizer_options.js';

const SOURCE_LABELS: Array<{ key: string; label: string }> = [
  { key: GAME_SOURCES.SMB1, label: 'SMB1 (vanilla)' },
  { key: GAME_SOURCES.SMB2, label: 'SMB2 (vanilla)' },
  { key: GAME_SOURCES.MB2WS, label: 'MB2WS (vanilla)' },
];

function makeCheckbox(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLLabelElement {
  const field = document.createElement('label');
  field.className = 'checkbox-field';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = checked;
  box.addEventListener('change', () => onChange(box.checked));
  const text = document.createElement('span');
  text.textContent = label;
  field.append(box, text);
  return field;
}

function buildPanel(panel: HTMLElement, onChanged: () => void) {
  panel.innerHTML = '';
  const suffix = panel.id.endsWith('-mp') ? 'mp' : 'sp';
  const options = getRandomizerOptions();

  const sources = document.createElement('div');
  sources.className = 'randomizer-options-group randomizer-options-sources';
  sources.classList.toggle('hidden', !isTotalRandomizerEnabled());
  const sourcesTitle = document.createElement('div');
  sourcesTitle.className = 'randomizer-options-title';
  sourcesTitle.textContent = 'Sources';
  sources.appendChild(sourcesTitle);
  for (const entry of SOURCE_LABELS) {
    sources.appendChild(makeCheckbox(entry.label, isSourceEnabled(entry.key), (value) => {
      setSourceEnabled(entry.key, value);
      onChanged();
    }));
  }
  const packs = getAllLoadedPacks();
  for (const pack of packs) {
    const identity = packIdentity(pack);
    const key = sourceKeyForPack(identity);
    const name = pack.manifest.name ?? identity;
    sources.appendChild(makeCheckbox(`${name} (pack)`, isSourceEnabled(key), (value) => {
      setSourceEnabled(key, value);
      onChanged();
    }));
  }
  if (packs.length === 0) {
    const none = document.createElement('div');
    none.className = 'randomizer-options-title';
    none.textContent = 'No custom packs loaded';
    sources.appendChild(none);
  }
  panel.appendChild(sources);

  const seedGroup = document.createElement('div');
  seedGroup.className = 'randomizer-options-group';
  const seedTitle = document.createElement('div');
  seedTitle.className = 'randomizer-options-title';
  seedTitle.textContent = 'Seed';
  const seedRow = document.createElement('div');
  seedRow.className = 'randomizer-seed-row';
  const seedInput = document.createElement('input');
  seedInput.className = 'text-input';
  seedInput.type = 'text';
  seedInput.maxLength = 32;
  seedInput.placeholder = 'random';
  seedInput.value = options.seed;
  seedInput.addEventListener('change', () => {
    setRandomizerOptions({ seed: seedInput.value.trim() });
    onChanged();
  });
  const seedButton = document.createElement('button');
  seedButton.className = 'ghost compact';
  seedButton.type = 'button';
  seedButton.textContent = 'Roll';
  seedButton.addEventListener('click', () => {
    seedInput.value = Math.random().toString(36).slice(2, 10).toUpperCase();
    setRandomizerOptions({ seed: seedInput.value });
    onChanged();
  });
  seedRow.append(seedInput, seedButton);
  seedGroup.append(seedTitle, seedRow);
  panel.appendChild(seedGroup);

  panel.appendChild(makeCheckbox('Include bonus stages', options.includeBonus, (value) => {
    setRandomizerOptions({ includeBonus: value });
    onChanged();
  }));

  if (suffix === 'sp') {
    panel.appendChild(makeCheckbox('Infinite time', options.infiniteTime, (value) => {
      setRandomizerOptions({ infiniteTime: value });
      onChanged();
    }));
  }

  const difficulties = document.createElement('div');
  difficulties.className = 'randomizer-options-group randomizer-difficulties-group';
  const difficultiesTitle = document.createElement('div');
  difficultiesTitle.className = 'randomizer-options-title';
  difficultiesTitle.textContent = 'Difficulties';
  const difficultiesBox = document.createElement('div');
  difficultiesBox.className = 'randomizer-difficulties';
  difficultiesBox.id = `randomizer-difficulties-${suffix}`;
  difficulties.append(difficultiesTitle, difficultiesBox);
  panel.appendChild(difficulties);
  refreshRandomizerPicker();
}

export function bindRandomizerCog(onChanged: () => void) {
  const pairs: Array<[string, string]> = [
    ['randomizer-cog-sp', 'randomizer-options-sp'],
    ['randomizer-cog-mp', 'randomizer-options-mp'],
  ];
  const panels: HTMLElement[] = [];
  for (const [buttonId, panelId] of pairs) {
    const button = document.getElementById(buttonId) as HTMLButtonElement | null;
    const panel = document.getElementById(panelId);
    if (!button || !panel) {
      continue;
    }
    panels.push(panel);
    button.addEventListener('click', () => {
      const open = panel.classList.contains('hidden');
      if (open) {
        buildPanel(panel, () => {
          for (const other of panels) {
            if (other !== panel && !other.classList.contains('hidden')) {
              buildPanel(other, onChanged);
            }
          }
          onChanged();
        });
      }
      panel.classList.toggle('hidden', !open);
    });
  }
}
