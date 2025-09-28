import * as THREE from 'three';
import type { SimpleCamera, SimpleRenderer } from '@thatopen/components';

export interface CullingEntry { mesh: THREE.Object3D; radius: number; }

export interface OcclusionCullingEntry { 
  mesh: THREE.Object3D; 
  worldPosition: THREE.Vector3;
  boundingRadius: number;
}

export class InteractionCullingController {
  private camera: SimpleCamera;
  private renderer: SimpleRenderer;
  private entries: CullingEntry[] = [];
  private pointerActive = false;
  private zoomActive = false;
  private zoomTimeout: number | undefined;
  private zoomIdleMs = 180;
  private _thresholdPx = 50; // default 50 px per requirement
  enabled = true;

  // Incremental / hysteresis
  private frameIndex = 0;
  private cursor = 0; // rolling index
  private budgetPerFrame = 400; // number of entries processed per frame
  private pendingDelayFrames = 0; // 1-frame delay on interaction start
  private stableBelow: Map<THREE.Object3D, number> = new Map();
  private stableAbove: Map<THREE.Object3D, number> = new Map();
  private hysteresisFrames = 2; // require N consecutive frames before flipping

  constructor(camera: SimpleCamera, renderer: SimpleRenderer) {
    this.camera = camera;
    this.renderer = renderer;
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('wheel', this.onWheel, { passive: true });
  }

  dispose() {
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('wheel', this.onWheel);
  }

  resetToDefaults() {
    this._thresholdPx = 50;
    this.clear();
  }

  setThreshold(px: number) { if (px >= 0) this._thresholdPx = px; }
  get threshold() { return this._thresholdPx; }

  register(root: THREE.Object3D) {
    if (!this.enabled) return;
    const box = new THREE.Box3();
    root.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh && mesh.geometry) {
        // Skip originals hidden by batching to avoid mass churn
        if ((mesh as any).userData?.isBatchedOriginal) return;
        box.setFromObject(mesh);
        if (!box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          const radius = size.length() * 0.5;
          this.entries.push({ mesh, radius });
        }
      }
    });
    // Reset incremental state
    this.cursor = 0;
    this.stableAbove.clear();
    this.stableBelow.clear();
  }

  clear() { this.entries = []; this.cursor = 0; this.stableAbove.clear(); this.stableBelow.clear(); }

  update() {
    if (!this.enabled || !(this.pointerActive || this.zoomActive) || this.entries.length === 0) return;
    const cam = this.camera.three as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const r = this.renderer.three;
    const height = r.domElement.clientHeight;
    const meshPos = new THREE.Vector3();
    const perspCam = (cam as any).isPerspectiveCamera ? (cam as THREE.PerspectiveCamera) : null;

    // One-frame delay after interaction start
    if (this.pendingDelayFrames > 0) { this.pendingDelayFrames--; return; }

    const start = this.cursor;
    const end = Math.min(start + this.budgetPerFrame, this.entries.length);

    for (let i = start; i < end; i++) {
      const e = this.entries[i];
      const mesh = e.mesh;
      if (!mesh.parent) continue;

      let projectedRadiusPx = e.radius;
      if (perspCam) {
        meshPos.copy((mesh as THREE.Mesh).getWorldPosition(meshPos));
        const dist = meshPos.distanceTo(perspCam.position);
        if (dist > 0) {
          const vHeight = 2 * Math.tan(perspCam.fov * Math.PI / 180 / 2) * dist;
          projectedRadiusPx = (e.radius / vHeight) * height;
        }
      } else {
        const ortho = cam as THREE.OrthographicCamera;
        const orthoHeight = (ortho.top - ortho.bottom);
        projectedRadiusPx = (e.radius / orthoHeight) * height;
      }

      const shouldBeVisible = projectedRadiusPx >= this._thresholdPx;
      const currentlyVisible = (mesh as any).visible === true;

      if (shouldBeVisible === currentlyVisible) {
        // Reset opposite counters
        if (shouldBeVisible) this.stableBelow.delete(mesh); else this.stableAbove.delete(mesh);
        continue;
      }

      if (shouldBeVisible) {
        const n = (this.stableAbove.get(mesh) || 0) + 1;
        this.stableAbove.set(mesh, n);
        if (n >= this.hysteresisFrames) {
          (mesh as any).visible = true;
          this.stableAbove.delete(mesh);
        }
      } else {
        const n = (this.stableBelow.get(mesh) || 0) + 1;
        this.stableBelow.set(mesh, n);
        if (n >= this.hysteresisFrames) {
          (mesh as any).visible = false;
          this.stableBelow.delete(mesh);
        }
      }
    }

    this.cursor = end >= this.entries.length ? 0 : end; // wrap around
    this.frameIndex++;
  }

  onInteractionEndVisibilityRestore() {
    if (!this.enabled) return;
    this.entries.forEach(e => { if (!e.mesh.visible) e.mesh.visible = true; });
  }

  private onPointerDown = () => { this.pointerActive = true; this.pendingDelayFrames = 1; };
  private onPointerUp = () => {
    this.pointerActive = false;
    if (!this.zoomActive) this.onInteractionEndVisibilityRestore();
  };
  private onWheel = () => {
    this.zoomActive = true;
    if (this.zoomTimeout) window.clearTimeout(this.zoomTimeout);
    this.zoomTimeout = window.setTimeout(() => {
      this.zoomActive = false;
      if (!this.pointerActive) this.onInteractionEndVisibilityRestore();
    }, this.zoomIdleMs);
    this.pendingDelayFrames = 1;
  };
}

export class OcclusionCullingController {
  private camera: SimpleCamera;
  private scene: THREE.Scene;
  private entries: OcclusionCullingEntry[] = [];
  private raycaster = new THREE.Raycaster();
  enabled = true;

  // Incremental processing
  private cursor = 0;
  private budgetPerFrame = 20; // Lower budget due to expensive raycasting
  private frameIndex = 0;

  // Visibility state tracking with hysteresis
  private stableVisible: Map<THREE.Object3D, number> = new Map();
  private stableOccluded: Map<THREE.Object3D, number> = new Map();
  private hysteresisFrames = 3; // Require more frames for stability

  constructor(camera: SimpleCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;
  }

  dispose() {
    this.entries = [];
    this.stableVisible.clear();
    this.stableOccluded.clear();
  }

  register(root: THREE.Object3D) {
    if (!this.enabled) return;
    this.entries = [];
    const box = new THREE.Box3();
    
    root.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh && mesh.geometry) {
        // Skip originals hidden by batching to avoid mass churn
        if ((mesh as any).userData?.isBatchedOriginal) return;
        
        box.setFromObject(mesh);
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const radius = size.length() * 0.5;
          
          this.entries.push({ 
            mesh, 
            worldPosition: center,
            boundingRadius: radius
          });
        }
      }
    });
    
    // Reset incremental state
    this.cursor = 0;
    this.stableVisible.clear();
    this.stableOccluded.clear();
  }

  clear() { 
    this.entries = []; 
    this.cursor = 0; 
    this.stableVisible.clear(); 
    this.stableOccluded.clear(); 
  }

  update() {
    if (!this.enabled || this.entries.length === 0) return;
    
    const cam = this.camera.three as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const cameraPosition = cam.position;
    
    const start = this.cursor;
    const end = Math.min(start + this.budgetPerFrame, this.entries.length);

    for (let i = start; i < end; i++) {
      const entry = this.entries[i];
      const mesh = entry.mesh;
      
      if (!mesh.parent) continue;

      // Update world position (in case object moved)
      entry.worldPosition.copy((mesh as THREE.Mesh).getWorldPosition(entry.worldPosition));
      
      // Raycast from camera to object center
      const direction = entry.worldPosition.clone().sub(cameraPosition).normalize();
      this.raycaster.set(cameraPosition, direction);
      
      // Get distance to target object
      const targetDistance = cameraPosition.distanceTo(entry.worldPosition);
      
      // Find intersections, excluding the target mesh itself
      const intersects = this.raycaster.intersectObjects(this.scene.children, true)
        .filter(intersect => {
          // Exclude the target mesh and its children
          let obj = intersect.object;
          while (obj) {
            if (obj === mesh) return false;
            obj = obj.parent as THREE.Object3D;
          }
          return true;
        });

      // Check if any intersection occludes the target
      let isOccluded = false;
      for (const intersect of intersects) {
        if (intersect.distance < targetDistance - entry.boundingRadius) {
          isOccluded = true;
          break;
        }
      }

      const shouldBeVisible = !isOccluded;
      const currentlyVisible = (mesh as any).visible === true;

      if (shouldBeVisible === currentlyVisible) {
        // Reset opposite counters
        if (shouldBeVisible) {
          this.stableOccluded.delete(mesh);
        } else {
          this.stableVisible.delete(mesh);
        }
        continue;
      }

      // Apply hysteresis
      if (shouldBeVisible) {
        const n = (this.stableVisible.get(mesh) || 0) + 1;
        this.stableVisible.set(mesh, n);
        if (n >= this.hysteresisFrames) {
          (mesh as any).visible = true;
          this.stableVisible.delete(mesh);
        }
      } else {
        const n = (this.stableOccluded.get(mesh) || 0) + 1;
        this.stableOccluded.set(mesh, n);
        if (n >= this.hysteresisFrames) {
          (mesh as any).visible = false;
          this.stableOccluded.delete(mesh);
        }
      }
    }

    this.cursor = end >= this.entries.length ? 0 : end; // wrap around
    this.frameIndex++;
  }

  onInteractionEndVisibilityRestore() {
    if (!this.enabled) return;
    this.entries.forEach(e => { 
      if (!e.mesh.visible) e.mesh.visible = true; 
    });
  }
}
