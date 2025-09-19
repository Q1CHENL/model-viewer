import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { batchMeshes, unbatch, type BatchingResult } from './batching';
import { AdaptiveResolutionController } from './adaptiveRes';
import { InteractionCullingController } from './culling';
import { SelectionController } from './selection';

const container = document.getElementById('container')!;

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

components.init();
world.scene.setup();

world.camera.controls.setLookAt(3, 3, 3, 0, 0, 0);

const scene = world.scene.three;
const loader = new GLTFLoader();

// Reusable material & edge configuration
const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, depthTest: true });
const EDGE_THRESHOLD_ANGLE_DETAILED = 1;   // for small (unbatched) meshes (fine detail)
const EDGE_THRESHOLD_ANGLE_MERGED = 25;    // for merged batch meshes (suppress interior coplanar seams)
// Cache EdgesGeometry per (geometry uuid + threshold)
const edgesCache = new Map<string, THREE.EdgesGeometry>();
function getOrCreateEdgesGeometry(geometry: THREE.BufferGeometry, threshold: number) {
  const key = geometry.uuid + ':' + threshold;
  let geom = edgesCache.get(key);
  if (!geom) {
    geom = new THREE.EdgesGeometry(geometry, threshold);
    edgesCache.set(key, geom);
  }
  return geom;
}
function clearEdgesCache() {
  edgesCache.forEach(g => g.dispose());
  edgesCache.clear();
}

// Using default lighting from world.scene.setup() (reverted from custom hemisphere-only lighting)

let edgesEnabled = false; // Start with edges disabled; user can enable via toggle button

// Draw-call batching feature flag and state
const BATCHING_ENABLED = true; // master switch (can toggle off for debugging)
let batchingEnabled = true; // user toggle
let currentBatching: BatchingResult | null = null;

// Selection controller
const selection = new SelectionController({ world, scene, selectionColor: 0x00D5B9 });
selection.attach();

function supportsUint32Indices(renderer: OBC.SimpleRenderer): boolean {
  const gl = renderer.three.getContext() as WebGLRenderingContext | WebGL2RenderingContext;
  const isWebGL2 = (gl as WebGL2RenderingContext).drawBuffers !== undefined || (gl as any).VERSION === 2;
  if (isWebGL2) return true;
  return !!(gl as WebGLRenderingContext).getExtension && !!(gl as WebGLRenderingContext).getExtension('OES_element_index_uint');
}

// Controllers
const adaptiveRes = new AdaptiveResolutionController(world.renderer);
const cullingCtrl = new InteractionCullingController(world.camera, world.renderer);

// Animation loop delegates
function animationLoop() {
  cullingCtrl.update();
  requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// Interaction hooks to drive adaptive resolution (culling controller manages its own interaction state)
window.addEventListener('pointerdown', () => { adaptiveRes.onInteractionStart(); }, { passive: true });
window.addEventListener('pointerup', () => { adaptiveRes.onInteractionEnd(); }, { passive: true });
window.addEventListener('wheel', () => { adaptiveRes.onInteractionStart(); }, { passive: true });

// Bind threshold input (default 50)
const thresholdInput = document.getElementById('cull-threshold') as HTMLInputElement | null;
if (thresholdInput) {
  const applyThreshold = () => {
    const v = parseFloat(thresholdInput.value);
    if (!isNaN(v) && v >= 0) cullingCtrl.setThreshold(v);
  };
  thresholdInput.addEventListener('change', applyThreshold);
  thresholdInput.addEventListener('input', applyThreshold);
  thresholdInput.value = '50';
  applyThreshold();
}

// Remove damping / smoothing to reduce perceived orbit lag if controls expose it
const ctrls: any = world.camera.controls as any;
if (ctrls) {
  if ('smoothTime' in ctrls) ctrls.smoothTime = 0;
  
  // Add this line to remove smoothing during the drag itself
  if ('draggingSmoothTime' in ctrls) ctrls.draggingSmoothTime = 0.05;

  if ('dragInertia' in ctrls) ctrls.dragInertia = 0;
}

function clearPreviousModel() {
  const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj: THREE.Object3D) => { if ((obj as any).userData?.isUserModel) toRemove.push(obj); });
  toRemove.forEach(obj => {
    obj.parent?.remove(obj);
    obj.traverse((child: THREE.Object3D) => {
      const anyChild = child as any;
      if (anyChild.geometry?.dispose) anyChild.geometry.dispose();
      const mat = anyChild.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
      else mat?.dispose?.();
    });
  });
  // Undo batching state if present
  if (currentBatching) {
    unbatch(currentBatching);
    currentBatching = null;
  }
  removeAllEdgeOverlays();
  clearEdgesCache();
  selection.clear();
  cullingCtrl.clear();
}

function fitCameraToObject(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  const camera = world.camera.three;
  let distance = 10; // fallback
  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const persp = camera as THREE.PerspectiveCamera;
    const fov = persp.fov * (Math.PI / 180);
    distance = Math.abs(maxDim / Math.tan(fov / 2)) * 0.5;
  } else if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    // For orthographic, adjust zoom to fit
    const ortho = camera as THREE.OrthographicCamera;
    const span = maxDim * 1.5;
    ortho.top = span / 2; ortho.bottom = -span / 2; ortho.left = -span / 2; ortho.right = span / 2;
    ortho.updateProjectionMatrix();
    distance = maxDim * 2; // place eye a bit away
  }

  const dir = new THREE.Vector3(1, 1, 1).normalize();
  const eye = center.clone().add(dir.multiplyScalar(distance));
  world.camera.controls.setLookAt(eye.x, eye.y, eye.z, center.x, center.y, center.z);
}

async function loadGLBFromFile(file: File) {
  clearPreviousModel();
  const url = URL.createObjectURL(file);
  try {
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    root.userData.isUserModel = true;
    scene.add(root);
    // Apply batching before registering for culling so merged geometries get entries
    if (BATCHING_ENABLED && batchingEnabled) {
      const allow32 = supportsUint32Indices(world.renderer!);
      currentBatching = batchMeshes(root, { allow32Bit: allow32 }) || null;
    }
    cullingCtrl.register(root);
    // Reset defaults: adaptive res OFF, culling threshold 50
    adaptiveRes.resetToDefaults();
    if (thresholdInput) {
      thresholdInput.value = '50';
      cullingCtrl.setThreshold(50);
    }
    if (edgesEnabled) addEdgesForCurrentModel();
    fitCameraToObject(root);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function addEdgesForCurrentModel() {
  if (!scene) return;
  const mergedMeshes: THREE.Mesh[] = [];
  const smallMeshes: THREE.Mesh[] = [];
  scene.traverse(obj => {
    const m = obj as THREE.Mesh;
    if (!(m as any).isMesh) return;
    if (!(m as any).userData?.isUserModel) return;
    if ((m as any).userData.isMergedBatch) mergedMeshes.push(m);
    else smallMeshes.push(m);
  });
  // Add edges for small (unbatched) meshes individually
  for (const mesh of smallMeshes) {
    if (!mesh.geometry) continue;
    const hasEdges = mesh.children.some(c => (c as any).userData?.isEdgeOverlay);
    if (hasEdges) continue;
    const egeom = getOrCreateEdgesGeometry(mesh.geometry as THREE.BufferGeometry, EDGE_THRESHOLD_ANGLE_DETAILED);
    const lines = new THREE.LineSegments(egeom, edgesMaterial.clone());
    lines.userData.isUserModel = true;
    lines.userData.isEdgeOverlay = true;
    lines.renderOrder = 1;
    mesh.add(lines);
  }
  // Add a single edges overlay per merged mesh
  for (const mesh of mergedMeshes) {
    const hasMerged = mesh.children.some(c => (c as any).userData?.isMergedEdgeOverlay);
    if (hasMerged) continue;
    const geom = mesh.geometry as THREE.BufferGeometry;
    if (!geom) continue;
    const egeom = getOrCreateEdgesGeometry(geom, EDGE_THRESHOLD_ANGLE_MERGED);
    const lines = new THREE.LineSegments(egeom, edgesMaterial.clone());
    lines.userData.isUserModel = true;
    lines.userData.isEdgeOverlay = true;
    lines.userData.isMergedEdgeOverlay = true;
    lines.renderOrder = 1;
    mesh.add(lines);
  }
}

function removeAllEdgeOverlays() {
  const toRemove: THREE.Object3D[] = [];
  scene.traverse(o => { if ((o as any).userData?.isEdgeOverlay) toRemove.push(o); });
  toRemove.forEach(e => {
    const lines = e as THREE.LineSegments;
    const mat = lines.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
    else mat?.dispose?.();
    e.parent?.remove(e);
  });
}

document.getElementById('open')!.addEventListener('click', () => {
  (document.getElementById('file') as HTMLInputElement).click();
});

document.getElementById('file')!.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) loadGLBFromFile(file);
  input.value = '';
});

// Edges toggle button logic
const toggleBtn = document.getElementById('toggle-edges');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    edgesEnabled = !edgesEnabled;
    toggleBtn.setAttribute('data-active', edgesEnabled ? 'true' : 'false');
    toggleBtn.textContent = `Edges: ${edgesEnabled ? 'On' : 'Off'}`;

    if (edgesEnabled) {
      // Edges ON: keep batching (do NOT unbatch); generate overlays for both small and merged meshes
      addEdgesForCurrentModel();
    } else {
      // Edges OFF: remove overlays only
      removeAllEdgeOverlays();
      clearEdgesCache();
    }
  });
}

// Batching toggle button logic
const batchingBtn = document.getElementById('toggle-batching');
if (batchingBtn) {
  batchingBtn.addEventListener('click', () => {
    batchingEnabled = !batchingEnabled;
    batchingBtn.setAttribute('data-active', batchingEnabled ? 'true' : 'false');
    batchingBtn.textContent = `Batching: ${batchingEnabled ? 'On' : 'Off'}`;

    // Re-apply batching state to current model(s)
    if (currentBatching) {
      unbatch(currentBatching);
      currentBatching = null;
    }
    // Clear any selection tied to previous geometry state
    selection.clear();
    // Re-batch existing user models if turning on
    if (batchingEnabled) {
      const allow32 = supportsUint32Indices(world.renderer!);
      const root = new THREE.Group();
      root.userData.isUserModel = true;
      // Collect current user meshes into a temporary group for batching
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        if ((m as any).isMesh && (m as any).userData?.isUserModel && !(m as any).userData.isMergedBatch) {
          root.add(m);
        }
      });
      const result = batchMeshes(root, { allow32Bit: allow32 });
      if (result) {
        // Add merged meshes to scene and hide originals already handled inside batchMeshes
        for (const mm of result.mergedMeshes) scene.add(mm);
        currentBatching = result;
      }
    } else {
      // Turning off batching: ensure originals visible (handled by unbatch above)
    }

    // Refresh edges overlays to account for merged/unmerged state
    if (edgesEnabled) {
      removeAllEdgeOverlays();
      addEdgesForCurrentModel();
    }

    // Re-register culling entries reflecting current visibility/merged meshes
    cullingCtrl.clear();
    const userRoot = new THREE.Group();
    scene.traverse(o => { if ((o as any).userData?.isUserModel) userRoot.add(o); });
    cullingCtrl.register(userRoot);
  });
}

// Culling toggle and UI show/hide
const cullToggle = document.getElementById('toggle-cull');
const cullWrap = document.getElementById('cull-input-wrap') as HTMLElement | null;
if (cullToggle && cullWrap) {
  const setCullUi = (enabled: boolean) => {
    cullToggle.setAttribute('data-active', enabled ? 'true' : 'false');
    cullToggle.textContent = `Cull: ${enabled ? 'On' : 'Off'}`;
    cullWrap.style.display = enabled ? 'inline-flex' : 'none';
    cullingCtrl.enabled = enabled;
    if (!enabled) cullingCtrl.onInteractionEndVisibilityRestore();
  };
  setCullUi(false);
  cullToggle.addEventListener('click', () => {
    setCullUi(!(cullingCtrl as any).enabled);
  });
}

window.addEventListener('resize', () => { world.renderer?.resize(); });

// Adaptive resolution toggle button (default Off)
const adaptiveBtn = document.getElementById('toggle-adaptive');
if (adaptiveBtn) {
  adaptiveBtn.setAttribute('data-active', 'false');
  adaptiveBtn.textContent = 'Adaptive Res: Off';
  adaptiveBtn.addEventListener('click', () => {
    adaptiveRes.setEnabled(!adaptiveRes.enabled);
    adaptiveBtn.setAttribute('data-active', adaptiveRes.enabled ? 'true' : 'false');
    adaptiveBtn.textContent = `Adaptive Res: ${adaptiveRes.enabled ? 'On' : 'Off'}`;
  });
}
