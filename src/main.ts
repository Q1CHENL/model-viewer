import { Viewer } from './viewer/Viewer';
import { installClippingUI } from './clipping';
import { installEdgesUI } from './edges';

const container = document.getElementById('container')!;
const viewer = new Viewer(container);

// Stats updater
const meshesEl = document.getElementById('stat-meshes') as HTMLElement | null;
const batchesEl = document.getElementById('stat-batches') as HTMLElement | null;
const loadSecEl = document.getElementById('stat-loadsec') as HTMLElement | null;
const materialsEl = document.getElementById('stat-materials') as HTMLElement | null;
const edgesSecEl = document.getElementById('stat-edgessec') as HTMLElement | null;
const batchesBtn = document.getElementById('stat-batches-btn') as HTMLButtonElement | null;
const batchesPanel = document.getElementById('batch-details') as HTMLElement | null;
const edgesBanner = document.getElementById('edges-banner') as HTMLElement | null;
const unbatchedEl = document.getElementById('stat-unbatched') as HTMLElement | null;
function updateStats() {
  if (!meshesEl) return;
  const s = viewer.getStats();
  meshesEl.textContent = String(s.originalMeshes);
  const bText = String(s.batches);
  if (batchesBtn) batchesBtn.textContent = bText; else if (batchesEl) batchesEl.textContent = bText;
  if (materialsEl) materialsEl.textContent = String(s.uniqueMaterials);
  if (unbatchedEl) unbatchedEl.textContent = String(s.unbatchedOriginals);
}

// File open
document.getElementById('open')!.addEventListener('click', () => {
  (document.getElementById('file') as HTMLInputElement).click();
});

document.getElementById('file')!.addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    // Ensure edges are OFF for new model load
    viewer.setEdgesEnabled(false);
    const edgesToggle = document.getElementById('toggle-edges');
    if (edgesToggle) {
      edgesToggle.setAttribute('data-active', 'false');
      (edgesToggle as HTMLElement).textContent = 'Edges: Off';
    }
    if (edgesBanner) edgesBanner.style.display = 'none';
    if (edgesSecEl) edgesSecEl.textContent = 'N/A';
    const t0 = performance.now();
    await viewer.loadGLBFromFile(file);
    const t1 = performance.now();
    const sec = Math.round((t1 - t0) / 10) / 100; // keep 2 decimals
    if (loadSecEl) loadSecEl.textContent = sec.toFixed(2);
    updateStats();
    refreshBatchDetailsIfOpen();
  }
  input.value = '';
});

// Edges toggle button logic
installEdgesUI(viewer);

// Batching toggle button logic
const batchingBtn = document.getElementById('toggle-batching');
if (batchingBtn) {
  batchingBtn.addEventListener('click', () => {
    const next = !viewer.isBatchingEnabled();
    viewer.setBatchingEnabled(next);
    batchingBtn.setAttribute('data-active', next ? 'true' : 'false');
    batchingBtn.textContent = `Batching: ${next ? 'On' : 'Off'}`;
    updateStats();
    refreshBatchDetailsIfOpen();
  });
}

// Culling toggle and UI show/hide
const cullToggle = document.getElementById('toggle-cull');
const cullWrap = document.getElementById('cull-input-wrap') as HTMLElement | null;
const thresholdInput = document.getElementById('cull-threshold') as HTMLInputElement | null;
if (cullToggle && cullWrap) {
  const setCullUi = (enabled: boolean) => {
    cullToggle.setAttribute('data-active', enabled ? 'true' : 'false');
    cullToggle.textContent = `Cull: ${enabled ? 'On' : 'Off'}`;
    cullWrap.style.display = enabled ? 'inline-flex' : 'none';
    viewer.setCullingEnabled(enabled);
  };
  setCullUi(false);
  cullToggle.addEventListener('click', () => {
    setCullUi(!viewer.isCullingEnabled());
    updateStats();
  });
}

// Bind threshold input (default 50)
if (thresholdInput) {
  const applyThreshold = () => {
    const v = parseFloat(thresholdInput.value);
    if (!isNaN(v) && v >= 0) viewer.setCullingThreshold(v);
  };
  thresholdInput.addEventListener('change', applyThreshold);
  thresholdInput.addEventListener('input', applyThreshold);
  thresholdInput.value = '50';
  applyThreshold();
}

// Dragging smooth time input (0..0.5; default 0.05)
const dragInput = document.getElementById('drag-smooth') as HTMLInputElement | null;
if (dragInput) {
  const applyDrag = () => {
    const v = parseFloat(dragInput.value);
    if (!isNaN(v)) viewer.setDraggingSmoothTime(v);
  };
  dragInput.addEventListener('change', applyDrag);
  dragInput.addEventListener('input', applyDrag);
}

// Zoom speed multiplier
const zoomInput = document.getElementById('zoom-speed') as HTMLInputElement | null;
if (zoomInput) {
  const applyZoom = () => {
    const v = parseFloat(zoomInput.value);
    if (!isNaN(v)) viewer.setZoomSpeed(v);
  };
  zoomInput.addEventListener('change', applyZoom);
  zoomInput.addEventListener('input', applyZoom);
}

// Adaptive resolution toggle button (default Off)
const adaptiveBtn = document.getElementById('toggle-adaptive');
if (adaptiveBtn) {
  adaptiveBtn.setAttribute('data-active', 'false');
  adaptiveBtn.textContent = 'Adaptive Res: Off';
  adaptiveBtn.addEventListener('click', () => {
    const next = !viewer.isAdaptiveEnabled();
    viewer.setAdaptiveEnabled(next);
    adaptiveBtn.setAttribute('data-active', next ? 'true' : 'false');
    adaptiveBtn.textContent = `Adaptive Res: ${next ? 'On' : 'Off'}`;
    updateStats();
  });
}

// Clipping controls
installClippingUI(viewer);

updateStats();

function refreshBatchDetailsIfOpen() {
  if (!batchesBtn || !batchesPanel) return;
  if (batchesBtn.getAttribute('data-open') !== 'true') return;
  renderBatchDetails();
}

function renderBatchDetails() {
  if (!batchesPanel) return;
  const details = viewer.getBatchDetails();
  const parts: string[] = [];
  for (let i = 0; i < details.length; i++) {
    parts.push(`<div class="bd-row"><span class="key">Batch ${i+1}</span><span class="val">${details[i].originalCount}</span></div>`);
  }
  batchesPanel.innerHTML = parts.join('');
}

if (batchesBtn && batchesPanel) {
  batchesBtn.addEventListener('click', () => {
    const open = batchesBtn.getAttribute('data-open') === 'true';
    const next = !open;
    batchesBtn.setAttribute('data-open', next ? 'true' : 'false');
    batchesPanel.style.display = next ? 'block' : 'none';
    if (next) renderBatchDetails();
  });
}

// Listen for first-time edges build duration
window.addEventListener('viewer:edgesBuilt', (e: any) => {
  const ms = e?.detail?.ms as number | undefined;
  if (typeof ms === 'number' && edgesSecEl) edgesSecEl.textContent = (ms / 1000).toFixed(2);
  if (edgesBanner) edgesBanner.style.display = 'none';
});
