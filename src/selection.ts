import * as THREE from 'three';
import type { SimpleCamera, SimpleRenderer } from '@thatopen/components';

export interface SelectionControllerParams {
  world: { camera: SimpleCamera | null; renderer: SimpleRenderer | null };
  scene: THREE.Scene;
  selectionColor?: number;
}

export class SelectionController {
  private world: { camera: SimpleCamera | null; renderer: SimpleRenderer | null };
  private scene: THREE.Scene;
  private selectionColor: number;

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();

  private selectionOverlay: THREE.Mesh | null = null;
  private selectionParent: THREE.Mesh | null = null;
  private selectionBaseGeomUuid: string | null = null;
  private selectionEdgeOverlay: THREE.LineSegments | null = null;

  private enabled = true;

  private pickInfoPanel = document.getElementById('info-panel') as HTMLElement | null;
  private selNameEl = document.getElementById('sel-name') as HTMLElement | null;
  private selTypeEl = document.getElementById('sel-type') as HTMLElement | null;
  private selVertsEl = document.getElementById('sel-verts') as HTMLElement | null;
  private selTrisEl = document.getElementById('sel-tris') as HTMLElement | null;

  // Drag-aware click guard and deferred pick
  private dragThresholdPx = 5;
  private lastDownPos: { x: number; y: number } | null = null;
  private isDrag = false;
  private pendingPickRaf: number | null = null;

  private clickHandler = (e: MouseEvent) => {
    if (!this.enabled) return;
    const t0 = performance.now();
    if (this.pendingPickRaf !== null) {
      cancelAnimationFrame(this.pendingPickRaf);
      this.pendingPickRaf = null;
    }
    if (this.isDrag) {
      // Ignore clicks that followed a drag
      this.lastDownPos = null;
      this.isDrag = false;
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    // Defer pick to next rAF to avoid release-frame hitch
    this.pendingPickRaf = requestAnimationFrame(() => {
      this.pickAtClientPos(x, y);
      const dt = performance.now() - t0;
      this.showPickTiming(dt);
      this.pendingPickRaf = null;
    });
    this.lastDownPos = null;
  };

  private pointerDownHandler = (e: PointerEvent | MouseEvent) => {
    if (!this.enabled) return;
    this.lastDownPos = { x: e.clientX, y: e.clientY };
    this.isDrag = false;
  };

  private pointerMoveHandler = (e: PointerEvent | MouseEvent) => {
    if (!this.enabled) return;
    if (!this.lastDownPos) return;
    const dx = e.clientX - this.lastDownPos.x;
    const dy = e.clientY - this.lastDownPos.y;
    if (!this.isDrag && (dx * dx + dy * dy) > (this.dragThresholdPx * this.dragThresholdPx)) {
      this.isDrag = true;
    }
  };

  private pointerUpHandler = (_e: PointerEvent | MouseEvent) => {
    if (!this.enabled) return;
    // Keep state; click will decide whether to pick
  };

  constructor(params: SelectionControllerParams) {
    this.world = params.world;
    this.scene = params.scene;
    this.selectionColor = params.selectionColor ?? 0x00D5B9;
    // React to global edges toggle to rebuild selection outline if needed
    window.addEventListener('viewer:edgesToggled', this.handleEdgesToggle as any);
  }

  setEnabled(state: boolean) {
    this.enabled = state;
    if (!state) {
      this.clearSelectionOverlay();
      this.updateInfoPanel(null);
    }
  }

  attach() {
    const el = this.world.renderer!.three.domElement;
    el.addEventListener('pointerdown', this.pointerDownHandler as any);
    el.addEventListener('pointermove', this.pointerMoveHandler as any);
    el.addEventListener('pointerup', this.pointerUpHandler as any);
    el.addEventListener('click', this.clickHandler);
  }

  detach() {
    const el = this.world.renderer!.three.domElement;
    el.removeEventListener('pointerdown', this.pointerDownHandler as any);
    el.removeEventListener('pointermove', this.pointerMoveHandler as any);
    el.removeEventListener('pointerup', this.pointerUpHandler as any);
    el.removeEventListener('click', this.clickHandler);
    window.removeEventListener('viewer:edgesToggled', this.handleEdgesToggle as any);
  }

  clear() {
    this.clearSelectionOverlay();
    this.updateInfoPanel(null);
  }

  setSelection(target: THREE.Mesh | null) {
    this.clearSelectionOverlay();
    if (!target) { this.updateInfoPanel(null); return; }
    this.showSelectionForOriginal(target);
  }

  pickAtClientPos(clientX: number, clientY: number) {
    const rect = this.world.renderer!.three.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.world.camera!.three as any);

    const hits: THREE.Intersection[] = [];
    const candidates: THREE.Object3D[] = [];
    this.scene.traverse(o => { if ((o as any).isMesh && (o as any).userData?.isUserModel) candidates.push(o); });
    const res = this.raycaster.intersectObjects(candidates, false);
    if (res && res.length) hits.push(...res);
    if (!hits.length) { this.setSelection(null); return; }
    hits.sort((a, b) => a.distance - b.distance);
    const top = hits[0];
    let target = top.object as THREE.Mesh;
    if ((target as any).userData?.isMergedBatch) {
      target = this.findOriginalFromMergedIntersection(target, (top.faceIndex as number) ?? null) as THREE.Mesh;
    }
    this.setSelection(target);
  }

  // Internal helpers
  private updateInfoPanel(target: THREE.Object3D | null) {
    if (!this.pickInfoPanel || !this.selNameEl || !this.selTypeEl || !this.selVertsEl || !this.selTrisEl) return;
    if (!target) { this.pickInfoPanel.style.display = 'none'; return; }
    this.pickInfoPanel.style.display = 'block';
    this.selNameEl.textContent = target.name || '(unnamed)';
    this.selTypeEl.textContent = target.type;
    const mesh = target as THREE.Mesh;
    const geom = (mesh.geometry as THREE.BufferGeometry) || null;
    const verts = geom ? (geom.getAttribute('position') as THREE.BufferAttribute)?.count || 0 : 0;
    const tris = geom && geom.getIndex() ? (geom.getIndex() as THREE.BufferAttribute).count / 3 : (verts / 3);
    this.selVertsEl.textContent = String(verts);
    this.selTrisEl.textContent = String(Math.floor(tris));
  }

  private clearSelectionOverlay() {
    if (this.selectionOverlay && this.selectionParent) {
      this.selectionParent.remove(this.selectionOverlay);
    }
    if (this.selectionEdgeOverlay) {
      this.selectionEdgeOverlay.parent?.remove(this.selectionEdgeOverlay);
      const mat = this.selectionEdgeOverlay.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
      else mat?.dispose?.();
      this.selectionEdgeOverlay = null;
    }
    this.selectionOverlay = null;
    this.selectionParent = null;
    this.selectionBaseGeomUuid = null;
  }

  private ensureOverlayForRenderedMesh(rendered: THREE.Mesh) {
    const geom = rendered.geometry as THREE.BufferGeometry;
    if (!this.selectionOverlay || this.selectionBaseGeomUuid !== geom.uuid) {
      const overlayGeom = new THREE.BufferGeometry();
      overlayGeom.setAttribute('position', geom.getAttribute('position'));
      const mat = new THREE.MeshBasicMaterial({
        color: this.selectionColor,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
      this.selectionOverlay = new THREE.Mesh(overlayGeom, mat);
      (this.selectionOverlay as any).userData.isSelectionOverlay = true;
      this.selectionOverlay.renderOrder = 2;
      this.selectionBaseGeomUuid = geom.uuid;
    }
    if (this.selectionParent !== rendered) {
      if (this.selectionOverlay?.parent) this.selectionOverlay.parent.remove(this.selectionOverlay);
      rendered.add(this.selectionOverlay!);
      this.selectionParent = rendered;
    }
  }

  private setOverlayIndexFromRange(baseGeom: THREE.BufferGeometry, start: number, count: number) {
    if (!this.selectionOverlay) return;
    const baseIndex = baseGeom.getIndex() as THREE.BufferAttribute | null;
    if (!baseIndex) {
      (this.selectionOverlay.geometry as THREE.BufferGeometry).setIndex(null);
      (this.selectionOverlay as any).visible = true;
      this.updateSelectionEdgeFromOverlay();
      return;
    }
    const Ctor: any = (baseIndex.array as any).constructor;
    const sub = (baseIndex.array as any).subarray(start, start + count);
    const arr = new Ctor(count);
    arr.set(sub);
    (this.selectionOverlay.geometry as THREE.BufferGeometry).setIndex(new THREE.BufferAttribute(arr, 1));
    (this.selectionOverlay as any).visible = true;
    this.updateSelectionEdgeFromOverlay();
  }

  private showSelectionForOriginal(original: THREE.Mesh) {
    const merged = this.findMergedContainingOriginal(original);
    if (merged) {
      this.ensureOverlayForRenderedMesh(merged.merged);
      this.setOverlayIndexFromRange(merged.merged.geometry as THREE.BufferGeometry, merged.meta.start, merged.meta.count);
      this.updateInfoPanel(original);
      return;
    }
    const rendered = original;
    this.ensureOverlayForRenderedMesh(rendered);
    const baseGeom = rendered.geometry as THREE.BufferGeometry;
    const idx = baseGeom.getIndex() as THREE.BufferAttribute | null;
    if (idx) this.setOverlayIndexFromRange(baseGeom, 0, idx.count);
    else {
      (this.selectionOverlay!.geometry as THREE.BufferGeometry).setIndex(null);
      (this.selectionOverlay as any).visible = true;
      this.updateSelectionEdgeFromOverlay();
    }
    this.updateInfoPanel(original);
  }

  private findOriginalFromMergedIntersection(mergedMesh: THREE.Mesh, faceIndex: number | null) {
    // Fast O(1) lookup using pre-computed face-to-original mapping
    const faceToOriginal = (mergedMesh as any).userData?.faceToOriginal as THREE.Mesh[] | undefined;
    if (faceToOriginal && faceIndex != null) {
      const original = faceToOriginal[faceIndex];
      if (original) return original;
    }
    
    // Fallback to O(n) search if lookup array is not available (for backward compatibility)
    const ranges = (mergedMesh as any).userData?.mergedRanges as { start: number; count: number; original: THREE.Mesh }[] | undefined;
    if (!ranges || faceIndex == null) return mergedMesh;
    const indexOffset = faceIndex * 3;
    for (const r of ranges) {
      if (indexOffset >= r.start && indexOffset < r.start + r.count) {
        return r.original || mergedMesh;
      }
    }
    return mergedMesh;
  }

  private findMergedContainingOriginal(original: THREE.Mesh): { merged: THREE.Mesh, meta: { start: number; count: number; original: THREE.Mesh } } | null {
    let result: { merged: THREE.Mesh, meta: { start: number; count: number; original: THREE.Mesh } } | null = null;
    this.scene.traverse(o => {
      if (result) return;
      const m = o as THREE.Mesh;
      if (!(m as any).isMesh || !(m as any).userData?.isMergedBatch) return;
      const ranges = (m as any).userData?.mergedRanges as { start: number; count: number; original: THREE.Mesh }[] | undefined;
      if (!ranges) return;
      const meta = ranges.find(r => r.original === original);
      if (meta) result = { merged: m, meta };
    });
    return result;
  }

  private updateSelectionEdgeFromOverlay() {
    if (!this.selectionOverlay) return;
    // Only show selection edge when global edges are ON
    const edgesOn = !!((this.scene as any).userData && (this.scene as any).userData.edgesEnabled === true);
    if (!edgesOn) {
      if (this.selectionEdgeOverlay) {
        this.selectionEdgeOverlay.parent?.remove(this.selectionEdgeOverlay);
        const mat = this.selectionEdgeOverlay.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
        else mat?.dispose?.();
        this.selectionEdgeOverlay = null;
      }
      return;
    }
    // Remove previous edge overlay
    if (this.selectionEdgeOverlay) {
      this.selectionEdgeOverlay.parent?.remove(this.selectionEdgeOverlay);
      const mat = this.selectionEdgeOverlay.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
      else mat?.dispose?.();
      this.selectionEdgeOverlay = null;
    }
    const geom = (this.selectionOverlay.geometry as THREE.BufferGeometry);
    const egeom = new THREE.EdgesGeometry(geom, 25); // moderate threshold to avoid coplanar clutter
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4F92E0 });
    // Ensure outline renders above the filled selection overlay
    lineMat.depthTest = false;
    lineMat.depthWrite = false;
    const lines = new THREE.LineSegments(egeom, lineMat);
    (lines as any).userData.isSelectionEdgeOverlay = true;
    lines.renderOrder = 10;
    this.selectionOverlay.add(lines);
    this.selectionEdgeOverlay = lines;
  }

  private handleEdgesToggle = () => {
    // Re-evaluate current selection to ensure edge visibility matches edges toggle
    if (!this.selectionOverlay) return;
    // Trigger a rebuild/hide of selection edge based on new state
    this.updateSelectionEdgeFromOverlay();
  };

  private showPickTiming(ms: number) {
    const el = document.getElementById('pick-banner') as HTMLElement | null;
    if (!el) return;
    el.textContent = `Picked in: ${ms.toFixed(1)} ms`;
    const toolbar = document.getElementById('toolbar') as HTMLElement | null;
    if (toolbar && !toolbar.contains(el)) toolbar.appendChild(el);
    el.style.display = 'inline-block';
  }
}
