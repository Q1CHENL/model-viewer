import { Viewer } from './viewer/Viewer';

export function installEdgesUI(viewer: Viewer) {
  const edgesBanner = document.getElementById('edges-banner') as HTMLElement | null;
  const edgesSecEl = document.getElementById('stat-edgessec') as HTMLElement | null;
  const edgesToggleBtn = document.getElementById('toggle-edges');
  if (!edgesToggleBtn) return;

  edgesToggleBtn.addEventListener('click', () => {
    const next = !viewer.isEdgesEnabled();
    edgesToggleBtn.setAttribute('data-active', next ? 'true' : 'false');
    (edgesToggleBtn as HTMLElement).textContent = `Edges: ${next ? 'On' : 'Off'}`;
    if (next) {
      if (!viewer.hasBuiltEdges() && edgesBanner) edgesBanner.style.display = 'block';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          viewer.setEdgesEnabled(true);
        });
      });
    } else {
      viewer.setEdgesEnabled(false);
    }
  });

  // Listen for edge building start
  window.addEventListener('viewer:edgeStart', (e: any) => {
    if (edgesBanner) {
      const { totalMeshes } = e.detail;
      edgesBanner.innerHTML = `Adding edges… (${totalMeshes} meshes)`;
      edgesBanner.style.display = 'block';
    }
  });

  // Listen for edge building progress
  window.addEventListener('viewer:edgeProgress', (e: any) => {
    if (edgesBanner) {
      const { meshId, meshName, meshType, currentIndex, totalMeshes } = e.detail;
      edgesBanner.innerHTML = `Adding edges… (${currentIndex}/${totalMeshes})<br/>
        <small>Processing ${meshType} mesh: <strong>${meshName}</strong> (ID: ${meshId})</small>`;
    }
  });

  window.addEventListener('viewer:edgesBuilt', (e: any) => {
    const ms = e?.detail?.ms as number | undefined;
    if (typeof ms === 'number' && edgesSecEl) edgesSecEl.textContent = (ms / 1000).toFixed(2);
    if (edgesBanner) edgesBanner.style.display = 'none';
  });
}


