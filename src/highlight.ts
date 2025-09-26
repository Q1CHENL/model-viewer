import * as THREE from 'three';
import type { BatchingResult } from './batching';

export class HighlightController {
  private textHighlightActive = false;
  private currentSearchText = '';
  private originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });

  constructor(
    private scene: THREE.Scene,
    private getCurrentBatching: () => BatchingResult | null,
    private isBatchingEnabled: () => boolean
  ) {}

  highlightTextMeshes(enable: boolean, searchText: string) {
    this.textHighlightActive = enable;
    this.currentSearchText = searchText.toLowerCase();
    
    if (enable && searchText.trim()) {
      this.applyTextHighlighting();
    } else {
      this.removeTextHighlighting();
    }
  }

  isTextHighlightActive(): boolean {
    return this.textHighlightActive;
  }

  getCurrentSearchText(): string {
    return this.currentSearchText;
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

    // For batched meshes, we need to make the original matching meshes visible and highlight them individually
    for (const range of currentBatching.ranges) {
      const originalMesh = range.original;
      if (this.meshContainsText(originalMesh, this.currentSearchText)) {
        // Make the original mesh visible and highlight it
        originalMesh.visible = true;
        this.highlightMesh(originalMesh);
        
        // Store reference for cleanup
        (originalMesh as any).userData.wasHighlightedText = true;
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
        this.highlightMesh(mesh);
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

  private highlightMesh(mesh: THREE.Mesh) {
    if (!mesh.material) return;
    
    // Store original material if not already stored
    if (!this.originalMaterials.has(mesh)) {
      this.originalMaterials.set(mesh, mesh.material);
    }
    
    // Apply highlight material
    mesh.material = this.highlightMaterial;
  }

  private removeTextHighlighting() {
    // Restore original materials
    for (const [mesh, originalMaterial] of this.originalMaterials) {
      if (mesh.material === this.highlightMaterial) {
        mesh.material = originalMaterial;
      }
      
      // If this was a batched original mesh that we made visible, hide it again
      if ((mesh as any).userData?.wasHighlightedText && (mesh as any).userData?.isBatchedOriginal) {
        mesh.visible = false;
        delete (mesh as any).userData.wasHighlightedText;
      }
    }
    this.originalMaterials.clear();
  }
}

// UI installation function
export function installHighlightUI(
  highlightController: HighlightController
) {
  const highlightButton = document.getElementById('highlight-search');
  const searchInput = document.getElementById('search-text') as HTMLInputElement;
  
  if (!highlightButton || !searchInput) return;

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
