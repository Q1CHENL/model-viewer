import type { SimpleRenderer } from '@thatopen/components';

// Controller for adaptive resolution during user interaction.
// Default state: disabled (off) until user explicitly enables.
export class AdaptiveResolutionController {
  private renderer: SimpleRenderer;
  private interactionScale = 0.6;
  private minInteractionPR = 0.5;
  private basePixelRatio = window.devicePixelRatio;
  private currentPixelRatio = this.basePixelRatio;
  private lowResApplied = false;
  enabled = false; // default OFF per requirement

  private rafHandle: number | null = null;

  constructor(renderer: SimpleRenderer) {
    this.renderer = renderer;
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  dispose() {
    window.removeEventListener('resize', this.handleResize);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.restoreFullRes();
  }

  resetToDefaults() {
    this.enabled = false;
    this.basePixelRatio = window.devicePixelRatio;
    this.restoreFullRes();
  }

  private applyPixelRatio(pr: number) {
    const r = this.renderer.three;
    const target = Math.max(0.3, pr);
    if (Math.abs(target - this.currentPixelRatio) < 0.01) return;
    this.currentPixelRatio = target;
    r.setPixelRatio(this.currentPixelRatio);
    r.setSize(r.domElement.clientWidth, r.domElement.clientHeight, false);
  }

  private setLowRes() {
    if (!this.enabled || this.lowResApplied) return;
    this.basePixelRatio = window.devicePixelRatio;
    const target = Math.max(this.minInteractionPR, this.basePixelRatio * this.interactionScale);
    // Defer to next rAF to avoid same-frame stall as event dispatch
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = requestAnimationFrame(() => {
      this.applyPixelRatio(target);
      this.lowResApplied = true;
      this.rafHandle = null;
    });
  }

  private restoreFullRes() {
    if (!this.lowResApplied) return;
    this.basePixelRatio = window.devicePixelRatio;
    // Defer to next rAF as well, to mirror setLowRes behavior
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = requestAnimationFrame(() => {
      this.applyPixelRatio(this.basePixelRatio);
      this.lowResApplied = false;
      this.rafHandle = null;
    });
  }

  onInteractionStart() {
    this.setLowRes();
  }

  onInteractionEnd() {
    if (!this.enabled) return;
    this.restoreFullRes();
  }

  private handleResize = () => {
    // If idle, ensure full res; if interacting (low-res applied) recompute base and reapply scale.
    if (!this.lowResApplied) {
      this.restoreFullRes();
    } else {
      this.basePixelRatio = window.devicePixelRatio;
      const target = Math.max(this.minInteractionPR, this.basePixelRatio * this.interactionScale);
      this.applyPixelRatio(target);
    }
  };
}
