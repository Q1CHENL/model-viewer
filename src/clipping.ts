import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { Viewer } from './viewer/Viewer';

export class ClipperController {
  private components: OBC.Components;
  private world: OBC.World;
  private clipper: OBC.Clipper;

  constructor(components: OBC.Components, world: OBC.World) {
    this.components = components;
    this.world = world;
    this.clipper = this.components.get(OBC.Clipper);
    this.clipper.setup();
    this.clipper.orthogonalY = false;
    this.clipper.toleranceOrthogonalY = 0.7;
    this.clipper.enabled = true;
    this.clipper.visible = true;
    this.clipper.config.opacity = 0.35;
    this.clipper.config.color = new THREE.Color(0xff0077);
    this.clipper.config.size = 5;
  }

  scaleSizeToUserModels(scene: THREE.Scene) {
    const box = new THREE.Box3();
    let hasAny = false;
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if ((m as any).isMesh && (m as any).userData?.isUserModel) {
        box.expandByObject(m);
        hasAny = true;
      }
    });
    const dim = hasAny ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1);
    const maxDim = Math.max(dim.x, dim.y, dim.z) || 1;
    this.clipper.config.size = Math.max(1, maxDim * 0.5);
  }

  createAxis(scene: THREE.Scene, axis: 'x' | 'y' | 'z'): string {
    this.deleteAll();
    const box = new THREE.Box3();
    let hasAny = false;
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if ((m as any).isMesh && (m as any).userData?.isUserModel) {
        box.expandByObject(m);
        hasAny = true;
      }
    });
    const center = hasAny ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
    const normal = axis === 'x' ? new THREE.Vector3(1, 0, 0)
                 : axis === 'y' ? new THREE.Vector3(0, 1, 0)
                 : new THREE.Vector3(0, 0, 1);
    return this.clipper.createFromNormalAndCoplanarPoint(this.world, normal, center);
  }

  createAt(normal: THREE.Vector3, point: THREE.Vector3): string {
    return this.clipper.createFromNormalAndCoplanarPoint(this.world, normal, point);
  }

  setVisible(visible: boolean) { this.clipper.visible = visible; }
  isVisible(): boolean { return this.clipper.visible; }
  deleteAll() { this.clipper.deleteAll(); }
  dispose() { this.clipper.dispose(); }
}

export function installClippingUI(viewer: Viewer) {
  const clipBtn = document.getElementById('clip-btn') as HTMLButtonElement | null;
  const clipMenu = document.getElementById('clip-menu') as HTMLElement | null;
  const clipX = document.getElementById('clip-x');
  const clipY = document.getElementById('clip-y');
  const clipZ = document.getElementById('clip-z');
  const clipWrap = document.getElementById('clip-config');
  if (!clipWrap || !clipBtn || !clipMenu) return;

  let clipActive = false;
  function setClipActive(active: boolean) {
    clipActive = active;
    (clipBtn as HTMLButtonElement).setAttribute('data-active', active ? 'true' : 'false');
    viewer.setSelectionEnabled(!active);
  }

  clipWrap.addEventListener('mouseenter', () => { if (!clipActive && clipMenu) clipMenu.style.display = 'block'; });
  clipWrap.addEventListener('mouseleave', () => { if (clipMenu) clipMenu.style.display = 'none'; });
  (clipBtn as HTMLButtonElement).addEventListener('click', () => {
    if (clipActive) {
      viewer.deleteAllClipPlanes();
      setClipActive(false);
      if (clipMenu) clipMenu.style.display = 'none';
    } else {
      if (clipMenu) clipMenu.style.display = 'block';
    }
  });

  function activateWithAxis(axis: 'x'|'y'|'z') {
    viewer.createClipPlaneAxis(axis);
    setClipActive(true);
    if (clipMenu) clipMenu.style.display = 'none';
  }

  if (clipX) clipX.addEventListener('click', () => activateWithAxis('x'));
  if (clipY) clipY.addEventListener('click', () => activateWithAxis('y'));
  if (clipZ) clipZ.addEventListener('click', () => activateWithAxis('z'));
}


