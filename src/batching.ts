import * as THREE from 'three';

/** Metadata for an original mesh range inside a merged geometry */
export interface BatchingRangeMeta {
  original: THREE.Mesh;
  start: number; // index start
  count: number; // index count
  material: THREE.Material;
  bbox: THREE.Box3;
}

export interface BatchingResult {
  mergedMeshes: THREE.Mesh[];
  ranges: BatchingRangeMeta[];
}

interface MeshInfo {
  mesh: THREE.Mesh;
  geom: THREE.BufferGeometry;
  material: THREE.Material;
  index: THREE.BufferAttribute | null;
}

export interface BatchOptions {
  maxVerticesPerBatch?: number; // soft cap to keep batches manageable
  allow32Bit?: boolean; // allow using 32 bit indices (WebGL2)
  minDiagonalForBatch?: number; // world-space diagonal threshold below which a mesh is NOT batched
}

const DEFAULT_OPTS: Required<BatchOptions> = {
  maxVerticesPerBatch: 80000,
  allow32Bit: true,
  minDiagonalForBatch: 0.5
};

/**
 * Collect static meshes eligible for batching.
 * Criteria: has geometry, not skinned, not morphing, visible, single material.
 */
function collectMeshes(root: THREE.Object3D, minDiagonal: number): MeshInfo[] {
  const list: MeshInfo[] = [];
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as any).isMesh) return;
    if (!mesh.visible) return; // respect current visibility
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geom) return;
    // Skip if morphTargets or skinning attributes present
    if ((geom as any).attributes?.skinIndex || (geom as any).attributes?.skinWeight) return;
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat || Array.isArray(mat)) return; // skip multi-material for now (simplifies index remap)
    const index = geom.getIndex();
    if (!index) return; // require indexed geometry to simplify merging
    // Compute world-space diagonal for size filtering
    const box = new THREE.Box3().setFromObject(mesh);
    if (!box.isEmpty()) {
      const diag = box.getSize(new THREE.Vector3()).length();
      if (diag < minDiagonal) return; // leave small mesh out of batching to preserve fine culling granularity
    }
    list.push({ mesh, geom, material: mat, index });
  });
  return list;
}

/** Key for grouping: material + attribute layout signature */
function makeGroupKey(info: MeshInfo): string {
  const geom = info.geom;
  const attrs = Object.keys(geom.attributes).sort().join(',');
  return info.material.uuid + '|' + attrs;
}

/** Apply world transform to a geometry into given target attribute arrays */
function writeTransformed(
  src: THREE.BufferGeometry,
  dstPositions: Float32Array,
  dstNormals: Float32Array | null,
  vertexOffset: number,
  matrix: THREE.Matrix4,
  normalMatrix: THREE.Matrix3
) {
  const posAttr = src.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = src.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
    const base = (vertexOffset + i) * 3;
    dstPositions[base] = v.x; dstPositions[base + 1] = v.y; dstPositions[base + 2] = v.z;
    if (dstNormals && normAttr) {
      n.fromBufferAttribute(normAttr, i).applyMatrix3(normalMatrix).normalize();
      dstNormals[base] = n.x; dstNormals[base + 1] = n.y; dstNormals[base + 2] = n.z;
    }
  }
}

/** Merge meshes into batches per grouping key */
export function batchMeshes(root: THREE.Object3D, opts: BatchOptions = {}): BatchingResult | null {
  const options = { ...DEFAULT_OPTS, ...opts };
  const collected = collectMeshes(root, options.minDiagonalForBatch);
  if (collected.length === 0) return null;

  const groups = new Map<string, MeshInfo[]>();
  for (const info of collected) {
    const key = makeGroupKey(info);
    let arr = groups.get(key);
    if (!arr) { arr = []; groups.set(key, arr); }
    arr.push(info);
  }

  const mergedMeshes: THREE.Mesh[] = [];
  const ranges: BatchingRangeMeta[] = [];
  const tmpMatrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const bbox = new THREE.Box3();
  const tmpBox = new THREE.Box3();

  groups.forEach(infos => {
    // Sort small to large to reduce early large buffers
    infos.sort((a,b) => a.geom.getAttribute('position').count - b.geom.getAttribute('position').count);

    let currentVertices = 0;

    let batchInfos: MeshInfo[] = [];
    const maxVertsPerBatch = options.allow32Bit ? options.maxVerticesPerBatch : Math.min(options.maxVerticesPerBatch, 65535);

    const flush = () => {
      if (batchInfos.length === 0) return;
      // Determine attribute presence (assume uniform within group)
      const withNormals = batchInfos.every(i => !!i.geom.getAttribute('normal'));
      const withTangents = batchInfos.every(i => !!i.geom.getAttribute('tangent'));
      const withUv = batchInfos.every(i => !!i.geom.getAttribute('uv'));
      const withUv2 = batchInfos.every(i => !!i.geom.getAttribute('uv2'));
      const withColor = batchInfos.every(i => !!i.geom.getAttribute('color'));
      const totalVerts = batchInfos.reduce((s,i)=> s + (i.geom.getAttribute('position') as THREE.BufferAttribute).count, 0);
      const totalIndices = batchInfos.reduce((s,i)=> s + i.index!.count, 0);

      const position = new Float32Array(totalVerts * 3);
      const normals = withNormals ? new Float32Array(totalVerts * 3) : null;
      // Prepare optional attribute buffers using first geometry's layout
      const firstGeom = batchInfos[0].geom;
      const uvAttr0 = withUv ? (firstGeom.getAttribute('uv') as THREE.BufferAttribute) : null;
      const uv2Attr0 = withUv2 ? (firstGeom.getAttribute('uv2') as THREE.BufferAttribute) : null;
      const colorAttr0 = withColor ? (firstGeom.getAttribute('color') as THREE.BufferAttribute) : null;
      const tangentAttr0 = withTangents ? (firstGeom.getAttribute('tangent') as THREE.BufferAttribute) : null;

      // Preserve underlying array constructor for uv/uv2/color
      const UvCtor: any = uvAttr0 ? (uvAttr0.array as any).constructor : null;
      const Uv2Ctor: any = uv2Attr0 ? (uv2Attr0.array as any).constructor : null;
      const ColorCtor: any = colorAttr0 ? (colorAttr0.array as any).constructor : null;

      const uvs = uvAttr0 ? new UvCtor(totalVerts * uvAttr0.itemSize) : null;
      const uv2s = uv2Attr0 ? new Uv2Ctor(totalVerts * uv2Attr0.itemSize) : null;
      const colors = colorAttr0 ? new ColorCtor(totalVerts * colorAttr0.itemSize) : null;
      const tangents = tangentAttr0 ? new Float32Array(totalVerts * tangentAttr0.itemSize) : null;

      // Choose index type
      const use32 = options.allow32Bit && (totalVerts > 65535);
      const IndexArray = use32 ? Uint32Array : Uint16Array;
      const indexArr = new IndexArray(totalIndices);

      let vOffset = 0; // vertex offset
      let iOffset = 0; // index write offset
      bbox.makeEmpty();

      const tVec = new THREE.Vector3();
      const batchRanges: BatchingRangeMeta[] = [];

      for (const info of batchInfos) {
        info.mesh.updateWorldMatrix(true, false);
        tmpMatrix.copy(info.mesh.matrixWorld);
        normalMatrix.getNormalMatrix(tmpMatrix);
        const posAttr = info.geom.getAttribute('position') as THREE.BufferAttribute;
        const vertCount = posAttr.count;
        writeTransformed(info.geom, position, normals, vOffset, tmpMatrix, normalMatrix);

        // Copy optional attributes
        if (uvs && uvAttr0) {
          const src = info.geom.getAttribute('uv') as THREE.BufferAttribute;
          const item = src.itemSize;
          (uvs as any).set(src.array as any, vOffset * item);
        }
        if (uv2s && uv2Attr0) {
          const src = info.geom.getAttribute('uv2') as THREE.BufferAttribute;
          const item = src.itemSize;
          (uv2s as any).set(src.array as any, vOffset * item);
        }
        if (colors && colorAttr0) {
          const src = info.geom.getAttribute('color') as THREE.BufferAttribute;
          const item = src.itemSize;
          (colors as any).set(src.array as any, vOffset * item);
        }
        if (tangents && tangentAttr0) {
          const src = info.geom.getAttribute('tangent') as THREE.BufferAttribute;
          const item = tangentAttr0.itemSize; // typically 4
          for (let i = 0; i < vertCount; i++) {
            const dstBase = (vOffset + i) * item;
            const tx = src.getX(i) as number;
            const ty = src.getY(i) as number;
            const tz = src.getZ(i) as number;
            const tw = item > 3 ? (src as any).getW(i) as number : 1;
            tVec.set(tx, ty, tz).applyMatrix3(normalMatrix).normalize();
            tangents[dstBase] = tVec.x;
            tangents[dstBase + 1] = tVec.y;
            tangents[dstBase + 2] = tVec.z;
            if (item > 3) tangents[dstBase + 3] = tw;
          }
        }

        // Indices remap
        const srcIndex = info.index!;
        for (let i = 0; i < srcIndex.count; i++) {
          indexArr[iOffset + i] = (srcIndex.getX(i) as number) + vOffset;
        }

        // Bounding box for this range
        tmpBox.setFromBufferAttribute(posAttr);
        // Transform box correctly to world-space
        tmpBox.applyMatrix4(tmpMatrix);
        const rangeStart = iOffset;
        const rangeCount = srcIndex.count;

        const mergedGeomBox = tmpBox.clone();
        const meta: BatchingRangeMeta = {
          original: info.mesh,
          start: rangeStart,
          count: rangeCount,
          material: info.material,
          bbox: mergedGeomBox
        };
        ranges.push(meta);
        batchRanges.push(meta);

        bbox.union(tmpBox);
        vOffset += vertCount;
        iOffset += srcIndex.count;

        // Hide original mesh (logical placeholder)
        info.mesh.visible = false;
        (info.mesh as any).userData = (info.mesh as any).userData || {};
        (info.mesh as any).userData.isBatchedOriginal = true;
      }

      const mergedGeom = new THREE.BufferGeometry();
      mergedGeom.setAttribute('position', new THREE.BufferAttribute(position, 3));
      if (normals) mergedGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      // Attach optional attributes, preserving normalized flags
      if (uvs && uvAttr0) {
        mergedGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, uvAttr0.itemSize, (uvAttr0 as any).normalized === true));
      }
      if (uv2s && uv2Attr0) {
        mergedGeom.setAttribute('uv2', new THREE.BufferAttribute(uv2s, uv2Attr0.itemSize, (uv2Attr0 as any).normalized === true));
      }
      if (colors && colorAttr0) {
        mergedGeom.setAttribute('color', new THREE.BufferAttribute(colors, colorAttr0.itemSize, (colorAttr0 as any).normalized === true));
      }
      if (tangents && tangentAttr0) {
        mergedGeom.setAttribute('tangent', new THREE.BufferAttribute(tangents, tangentAttr0.itemSize));
      }
      mergedGeom.setIndex(new THREE.BufferAttribute(indexArr, 1));
      mergedGeom.computeBoundingSphere();

      const material = batchInfos[0].material; // shared
      const mergedMesh = new THREE.Mesh(mergedGeom, material);
      (mergedMesh as any).userData.isUserModel = true;
      (mergedMesh as any).userData.isMergedBatch = true;
      (mergedMesh as any).userData.mergedRanges = batchRanges;
      root.add(mergedMesh);
      mergedMeshes.push(mergedMesh);
      batchInfos = [];
      currentVertices = 0;
    };

    for (const info of infos) {
      const posAttr = info.geom.getAttribute('position') as THREE.BufferAttribute;
      const count = posAttr.count;
      if (currentVertices + count > maxVertsPerBatch && batchInfos.length) {
        flush();
      }
      batchInfos.push(info);
      currentVertices += count;
    }
    flush();
  });

  return { mergedMeshes, ranges };
}

/** Undo function to restore originals (makes their meshes visible and disposes merged) */
export function unbatch(result: BatchingResult | null) {
  if (!result) return;
  for (const mm of result.mergedMeshes) {
    mm.parent?.remove(mm);
    mm.geometry.dispose();
  }
  for (const meta of result.ranges) {
    meta.original.visible = true;
    if ((meta.original as any).userData) {
      delete (meta.original as any).userData.isBatchedOriginal;
    }
  }
}
