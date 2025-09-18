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

  private pickInfoPanel = document.getElementById('info-panel') as HTMLElement | null;
  private selNameEl = document.getElementById('sel-name') as HTMLElement | null;
  private selTypeEl = document.getElementById('sel-type') as HTMLElement | null;
  private selVertsEl = document.getElementById('sel-verts') as HTMLElement | null;
  private selTrisEl = document.getElementById('sel-tris') as HTMLElement | null;

  private clickHandler = (e: MouseEvent) => {
    this.pickAtClientPos(e.clientX, e.clientY);
  };

  constructor(params: SelectionControllerParams) {
    this.world = params.world;
    this.scene = params.scene;
    this.selectionColor = params.selectionColor ?? 0x00D5B9;
  }

  attach() {
    this.world.renderer!.three.domElement.addEventListener('click', this.clickHandler);
  }

  detach() {
    this.world.renderer!.three.domElement.removeEventListener('click', this.clickHandler);
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
    for (const obj of candidates) {
      const mesh = obj as THREE.Mesh;
      const res = this.raycaster.intersectObject(mesh, false);
      if (res && res.length) hits.push(...res);
    }
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
      return;
    }
    const Ctor: any = (baseIndex.array as any).constructor;
    const sub = (baseIndex.array as any).subarray(start, start + count);
    const arr = new Ctor(count);
    arr.set(sub);
    (this.selectionOverlay.geometry as THREE.BufferGeometry).setIndex(new THREE.BufferAttribute(arr, 1));
    (this.selectionOverlay as any).visible = true;
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
    }
    this.updateInfoPanel(original);
  }

  private findOriginalFromMergedIntersection(mergedMesh: THREE.Mesh, faceIndex: number | null) {
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
}
