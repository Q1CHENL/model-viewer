import * as THREE from 'three';
import type { BatchingResult } from './batching';

interface HighlightOverlay {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  parentMesh: THREE.Mesh;
}


export class HighlightController {
  private textHighlightActive = false;
  private currentSearchText = '';
  private highlightOverlays: HighlightOverlay[] = [];
  private highlightMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000, 
    transparent: true, 
    opacity: 0.8,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  private scene: THREE.Scene;
  private getCurrentBatching: () => BatchingResult | null;
  private isBatchingEnabled: () => boolean;

  constructor(
    scene: THREE.Scene,
    getCurrentBatching: () => BatchingResult | null,
    isBatchingEnabled: () => boolean
  ) {
    this.scene = scene;
    this.getCurrentBatching = getCurrentBatching;
    this.isBatchingEnabled = isBatchingEnabled;
  }

  highlightTextMeshes(enable: boolean, searchText: string) {
    this.textHighlightActive = enable;
    this.currentSearchText = searchText.toLowerCase();
    
    if (enable && searchText.trim()) {
      this.applyTextHighlighting();
    } else {
      this.removeTextHighlighting();
    }
    
    // Notify that highlighting state changed for stats update
    window.dispatchEvent(new CustomEvent('viewer:highlightChanged'));
  }

  isTextHighlightActive(): boolean {
    return this.textHighlightActive;
  }

  getCurrentSearchText(): string {
    return this.currentSearchText;
  }

  getHighlightedCount(): number {
    return this.highlightOverlays.length;
  }

  // Called when batching state changes to preserve highlighting
  refreshHighlighting() {
    if (this.textHighlightActive && this.currentSearchText) {
      this.removeTextHighlighting();
      this.applyTextHighlighting();
    }
  }

  dispose() {
    this.removeTextHighlighting();
    this.highlightMaterial.dispose();
  }

  private applyTextHighlighting() {
    // Clear any existing highlights
    this.removeTextHighlighting();

    if (this.isBatchingEnabled() && this.getCurrentBatching()) {
      // Handle batched meshes
      this.highlightTextInBatchedMeshes();
    } else {
      // Handle non-batched meshes
      this.highlightTextInRegularMeshes();
    }
  }

  private highlightTextInBatchedMeshes() {
    const currentBatching = this.getCurrentBatching();
    if (!currentBatching) return;

    // Group ranges by merged mesh for overlay creation
    const mergedMeshRanges = new Map<THREE.Mesh, Array<{start: number, count: number, original: THREE.Mesh}>>();

    for (const range of currentBatching.ranges) {
      const originalMesh = range.original;
      if (this.meshContainsText(originalMesh, this.currentSearchText)) {
        // Find the merged mesh containing this range
        const mergedMesh = this.findMergedMeshContainingRange(range, currentBatching);
        if (mergedMesh) {
          // Add range for overlay creation
          if (!mergedMeshRanges.has(mergedMesh)) {
            mergedMeshRanges.set(mergedMesh, []);
          }
          mergedMeshRanges.get(mergedMesh)!.push({
            start: range.start,
            count: range.count,
            original: originalMesh
          });
        }
      }
    }

    // Create highlight overlays for each range
    for (const [mergedMesh, ranges] of mergedMeshRanges) {
      for (const range of ranges) {
        this.createHighlightOverlay(mergedMesh, range.start, range.count, range.original);
      }
    }
  }

  private highlightTextInRegularMeshes() {
    this.scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      if (!(mesh as any).userData?.isUserModel) return;
      if ((mesh as any).userData?.isMergedBatch) return;
      if ((mesh as any).userData?.isEdgeOverlay) return;

      if (this.meshContainsText(mesh, this.currentSearchText)) {
        this.createHighlightOverlayForMesh(mesh);
      }
    });
  }

  private meshContainsText(mesh: THREE.Mesh, searchText: string): boolean {
    if (!searchText) return false;
    
    // Check name property
    if (mesh.name && mesh.name.toLowerCase().includes(searchText)) {
      return true;
    }
    
    // Check userData for any ID properties
    const userData = (mesh as any).userData || {};
    for (const [, value] of Object.entries(userData)) {
      if (typeof value === 'string' && value.toLowerCase().includes(searchText)) {
        return true;
      }
    }
    
    return false;
  }

  private createHighlightOverlay(mergedMesh: THREE.Mesh, indexStart: number, indexCount: number, originalMesh: THREE.Mesh) {
    const geometry = mergedMesh.geometry as THREE.BufferGeometry;
    
    // Create overlay geometry
    const overlayGeom = new THREE.BufferGeometry();
    overlayGeom.setAttribute('position', geometry.getAttribute('position'));
    
    // Set index range for this specific highlight
    const baseIndex = geometry.getIndex() as THREE.BufferAttribute;
    if (baseIndex) {
      const Ctor: any = (baseIndex.array as any).constructor;
      const sub = (baseIndex.array as any).subarray(indexStart, indexStart + indexCount);
      const arr = new Ctor(indexCount);
      arr.set(sub);
      overlayGeom.setIndex(new THREE.BufferAttribute(arr, 1));
    }
    
    // Create highlight overlay mesh
    const overlayMesh = new THREE.Mesh(overlayGeom, this.highlightMaterial.clone());
    (overlayMesh as any).userData.isHighlightOverlay = true;
    (overlayMesh as any).userData.originalMesh = originalMesh;
    overlayMesh.renderOrder = 2;
    
    // Add to merged mesh
    mergedMesh.add(overlayMesh);
    
    // Track for cleanup
    this.highlightOverlays.push({
      mesh: overlayMesh,
      material: overlayMesh.material as THREE.MeshBasicMaterial,
      parentMesh: mergedMesh
    });
  }

  private createHighlightOverlayForMesh(mesh: THREE.Mesh) {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    
    // Create overlay geometry
    const overlayGeom = new THREE.BufferGeometry();
    overlayGeom.setAttribute('position', geometry.getAttribute('position'));
    
    // Copy index if it exists
    const baseIndex = geometry.getIndex();
    if (baseIndex) {
      overlayGeom.setIndex(baseIndex);
    }
    
    // Create highlight overlay mesh
    const overlayMesh = new THREE.Mesh(overlayGeom, this.highlightMaterial.clone());
    (overlayMesh as any).userData.isHighlightOverlay = true;
    (overlayMesh as any).userData.originalMesh = mesh;
    overlayMesh.renderOrder = 2;
    
    // Add to original mesh
    mesh.add(overlayMesh);
    
    // Track for cleanup
    this.highlightOverlays.push({
      mesh: overlayMesh,
      material: overlayMesh.material as THREE.MeshBasicMaterial,
      parentMesh: mesh
    });
  }

  private removeTextHighlighting() {
    // Remove all highlight overlays
    for (const overlay of this.highlightOverlays) {
      overlay.parentMesh.remove(overlay.mesh);
      overlay.material.dispose();
      overlay.mesh.geometry.dispose();
    }
    this.highlightOverlays = [];
  }

  private findMergedMeshContainingRange(targetRange: any, batching: BatchingResult): THREE.Mesh | null {
    for (const mergedMesh of batching.mergedMeshes) {
      const ranges = (mergedMesh as any).userData?.mergedRanges;
      if (ranges && ranges.includes(targetRange)) {
        return mergedMesh;
      }
    }
    return null;
  }

}

// UI installation function
export function installHighlightUI(
  highlightController: HighlightController
) {
  const highlightButton = document.getElementById('highlight-search');
  const searchInput = document.getElementById('search-text') as HTMLInputElement;
  
  if (!highlightButton || !searchInput) return;
  
  // Reset UI when new model loads
  const resetHighlightUI = () => {
    highlightButton.setAttribute('data-active', 'false');
    highlightButton.textContent = 'Highlight';
    searchInput.style.display = 'none';
  };
  
  // Listen for model load events to reset UI
  window.addEventListener('viewer:modelLoaded', resetHighlightUI);

  const toggleHighlight = () => {
    const isActive = highlightController.isTextHighlightActive();
    
    if (!isActive) {
      // Show input when enabling
      searchInput.style.display = 'inline-block';
      searchInput.focus();
      const searchText = searchInput.value.trim();
      if (searchText) {
        highlightController.highlightTextMeshes(true, searchText);
        highlightButton.setAttribute('data-active', 'true');
        highlightButton.textContent = 'Highlight: On';
      }
    } else {
      // Hide input and disable when turning off
      highlightController.highlightTextMeshes(false, '');
      highlightButton.setAttribute('data-active', 'false');
      highlightButton.textContent = 'Highlight';
      searchInput.style.display = 'none';
    }
  };

  highlightButton.addEventListener('click', toggleHighlight);
  
  // Apply search on Enter key in the input
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const searchText = searchInput.value.trim();
      if (searchText) {
        highlightController.highlightTextMeshes(true, searchText);
        highlightButton.setAttribute('data-active', 'true');
        highlightButton.textContent = 'Highlight: On';
      }
    }
  });
}
