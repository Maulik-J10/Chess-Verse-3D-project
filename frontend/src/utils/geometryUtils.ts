import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface GeometryPartSpec {
  geo: THREE.BufferGeometry;
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

const _mat4 = new THREE.Matrix4();
const _euler = new THREE.Euler();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

/**
 * Merges multiple transformed BufferGeometries into a single static BufferGeometry.
 * Normalizes indexing and vertex attributes (position, normal, uv) and immediately
 * disposes intermediate clones to prevent memory leaks.
 */
export function mergeTransformedParts(parts: GeometryPartSpec[]): THREE.BufferGeometry {
  if (parts.length === 0) {
    return new THREE.BufferGeometry();
  }

  const prepared: THREE.BufferGeometry[] = [];

  for (let i = 0; i < parts.length; i++) {
    const { geo, pos, rot, scale } = parts[i];
    const cloned = geo.index ? geo.toNonIndexed() : geo.clone();

    if (!cloned.getAttribute('normal')) {
      cloned.computeVertexNormals();
    }
    if (!cloned.getAttribute('uv')) {
      const count = cloned.getAttribute('position').count;
      cloned.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }

    // Keep only position, normal, uv so attributes match cleanly across heterogeneous primitives
    const attrNames = Object.keys(cloned.attributes);
    for (let k = 0; k < attrNames.length; k++) {
      const name = attrNames[k];
      if (name !== 'position' && name !== 'normal' && name !== 'uv') {
        cloned.deleteAttribute(name);
      }
    }

    _pos.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
    _euler.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    _quat.setFromEuler(_euler);
    _scale.set(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1);
    _mat4.compose(_pos, _quat, _scale);
    cloned.applyMatrix4(_mat4);

    prepared.push(cloned);
  }

  const merged = mergeGeometries(prepared, false);

  for (let i = 0; i < prepared.length; i++) {
    prepared[i].dispose();
  }

  if (!merged) {
    return new THREE.BufferGeometry();
  }

  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/**
 * No-op raycast handler for non-interactive 3D meshes to eliminate pointer raycast overhead.
 */
export const NO_RAYCAST = () => null;
