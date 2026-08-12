
import { getAllPacks as getStoredPacks, deletePack as deletePackFromStore, type StoredPack } from './pack_store.js';

type PackManageUiOptions = {
  onPackRemoved: (identity: string) => void;
};

function downloadStoredPack(rec: StoredPack) {
  try {
    const blob = new Blob([rec.bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(rec.name || 'pack').replace(/[^a-z0-9_\-]+/gi, '_')}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.warn('Pack download failed.', err);
  }
}

export function bindPackManageUi(options: PackManageUiOptions) {
  const button = document.getElementById('pack-manage') as HTMLButtonElement | null;
  const panel = document.getElementById('pack-manage-panel');
  if (!button || !panel) {
    return;
  }

  const deleteStoredPack = async (identity: string) => {
    try {
      await deletePackFromStore(identity);
    } catch (err) {
      console.warn('Pack delete failed.', err);
    }
    options.onPackRemoved(identity);
    await rebuild();
  };

  const addRow = (rec: StoredPack) => {
    const row = document.createElement('div');
    row.className = 'pack-manage-row';
    const label = document.createElement('span');
    label.className = 'pack-status';
    label.textContent = `${rec.name} (${String(rec.gameSource).toUpperCase()})`;
    const downloadButton = document.createElement('button');
    downloadButton.className = 'ghost compact';
    downloadButton.type = 'button';
    downloadButton.textContent = 'Download';
    downloadButton.addEventListener('click', () => downloadStoredPack(rec));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'ghost compact';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
      void deleteStoredPack(rec.identity);
    });
    row.append(label, downloadButton, deleteButton);
    panel.appendChild(row);
  };

  const rebuild = async () => {
    panel.textContent = '';
    let stored: StoredPack[] = [];
    try {
      stored = await getStoredPacks();
    } catch (err) {
      console.warn('Pack store: failed to list packs.', err);
    }
    if (stored.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pack-status';
      empty.textContent = 'No stored packs';
      panel.appendChild(empty);
      return;
    }
    for (const rec of stored) {
      addRow(rec);
    }
  };

  button.addEventListener('click', () => {
    const willShow = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (willShow) {
      void rebuild();
    }
  });
}
