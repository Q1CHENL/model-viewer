# Model Diff and Clash Detection Guide

This guide outlines how to build model diff and clash detection while keeping batching enabled and interactivity intact.

## Core principles

- Keep rendering batched: merge many objects into few meshes for low draw calls.
- Preserve object identity: store per-object metadata on the merged result so you can map interactions back to originals.
- Push styling to shaders: use object IDs + a palette texture to color objects without rebuilding geometry.
- Use BVHs for spatial queries (raycast, clashes) on merged geometry for speed.

---

## Data model

- For each merged mesh, store `mergedRanges: Array<{ start, count, original, bbox }>` in `userData`.

  - `start,count` refer to the merged index buffer range for an original object.
  - `bbox` is the world-space AABB for a quick broad-phase test.
  - Also persist a stable `objectId` for the original (e.g., IFC GUID) in `original.userData.objectId`.

- Optional (for shader coloring at scale):
  - Add a vertex attribute `objectId` (int) or encode as float texture coordinate.
  - Maintain a 1D palette texture mapping `objectId -> RGBA` for per-object color.

---

## Picking / selection (already implemented)

- Raycast merged meshes, map `faceIndex -> (start,count) -> original` via `mergedRanges`.
- Display metadata, overlay highlight for that range.
- For multi-select, union multiple ranges in a single overlay, or use shader palette.

---

## Model diff (A vs B)

Goal: color objects as Added / Removed / Modified / Unchanged between two versions.

1. Identity join

- Build sets: `idsA`, `idsB` from `userData.objectId`.
- Categories:
  - Added: `idsB - idsA`
  - Removed: `idsA - idsB`
  - Common: `idsA ∩ idsB`

1. Change detection for common IDs

- Cheap heuristic: compare per-object AABB (center/size) or hash of world-transformed vertex data.
- Better: compute bounding box and triangle count; if both match within tolerance, mark Unchanged.
- Advanced: compute a stable geometry signature (e.g., SHA of indexed positions after world transform) offline.

1. Coloring

- If using overlay: build an index union per category and render with category color materials.
- If using palette: update palette entries for each `objectId` to desired category color (e.g., Added=green, Removed=red shown in ghosted A, Modified=orange).

1. UX

- Provide toggles to show/hide categories.
- Add an info legend and counts.
- Optional: Split-view or swipe comparison by rendering both versions side-by-side.

---

## Clash detection (intra-model or inter-model)

Goal: find intersecting object pairs with good performance.

1. Broad phase

- Use the stored `bbox` in `mergedRanges` for a fast AABB overlap test.
- For inter-model clashes: iterate `rangesA x rangesB`, test AABB overlap.
- For intra-model: spatially bin AABBs (grid or BVH) and test neighbors.

1. Narrow phase

- For a candidate pair of ranges `(A,B)`, run triangle-level intersection using a BVH.
- Use `three-mesh-bvh` to build a BVH per merged geometry once.
- Query only the subranges by translating `(start,count)` to index windows when traversing.
- Alternatively, extract subset geometries (lightweight views) for the pair and test with BVH accelerated functions.

1. Results

- Report clashes as `{ idA, idB, contactPoints?, distance? }`.
- Visualize: color both objects, draw small spheres at contact points, and list in a sidebar.

---

## Performance tips

- Build BVHs for merged meshes after batching; reuse between queries.
- Keep batching ON; never split merged meshes per interaction.
- Avoid geometry rebuilds; prefer palette/overlay updates.
- Use workers for heavy comparisons; stream results incrementally.
- For WebGL1: ensure 16-bit indices; for large merged meshes ensure Uint32 extension is available.

---

## Suggested implementation steps

1. Identity & metadata

- Ensure every original mesh has a stable `userData.objectId`.
- Verify `mergedRanges` includes `objectId` and `bbox` for each range.

1. Palette-based coloring

- Add `objectId` attribute to merged geometry (per-vertex or per-triangle).
- Implement a simple shader material that samples color from a 1D texture by `objectId`.
- Maintain a palette Texture; updates are O(#changedObjects).

1. BVH integration

- Add `three-mesh-bvh` to merged meshes (once after batching).
- Create helpers to query only within `(start,count)` windows.

1. Model diff UI

- Load A and B; compute categories; update palette or overlay.
- Provide toggles and summary counts.

1. Clash detection UI

- Run broad phase; stream narrow-phase results; list pairs and highlight on hover.

With these pieces, you keep the renderer highly batched while delivering robust per-object interactivity at scale.
