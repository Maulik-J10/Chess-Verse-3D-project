import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PieceColor, PieceType } from '../chess/types';
import { useGameStore } from '../store/gameStore';
import { mergeTransformedParts, NO_RAYCAST } from '../utils/geometryUtils';
import { detectDeviceCapabilities } from '../utils/deviceTier';

// ==================================================================================
// HANDCRAFTED WOODEN CHESS PIECES — MERGED SINGLETON GEOMETRIES
// Preserves 100% of the sculpted Staunton reliefs (Queen helical spiral stem & spires,
// King chiseled facets & cross finial, Bishop teardrop & spiral groove, Knight comb
// mane & snout, Rook masonry bricks & battlements, Pawn collar studs & skirt notches)
// while reducing 808 separate meshes down to ~94 merged static meshes!
// ==================================================================================

// Seeded deterministic PRNG for fast, repeatable wood fibers without runtime variance
function createWoodPRNG(seedInit: number) {
  let s = seedInit;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const createWoodDiffuseMap = (isWhite: boolean, res: number): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scale = res / 1024;
  ctx.scale(scale, scale);
  const rand = createWoodPRNG(isWhite ? 101 : 202);

  if (isWhite) {
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
    bgGrad.addColorStop(0, '#f4e7d1');
    bgGrad.addColorStop(0.35, '#ebd6b7');
    bgGrad.addColorStop(0.7, '#e0caa7');
    bgGrad.addColorStop(1, '#ecd8be');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.fillStyle = 'rgba(195, 160, 115, 0.08)';
    for (let r = 0; r < 6; r++) {
      ctx.beginPath();
      ctx.ellipse(512, r * 190 + 50, 600, 140, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const darkFibers = new Path2D();
    const lightFibers = new Path2D();
    for (let i = 0; i < 160; i++) {
      const x = rand() * 1024;
      const targetPath = rand() > 0.4 ? darkFibers : lightFibers;
      targetPath.moveTo(x, 0);
      targetPath.bezierCurveTo(
        x + (rand() - 0.5) * 24, 340,
        x + (rand() - 0.5) * 24, 680,
        x + (rand() - 0.5) * 16, 1024
      );
    }
    ctx.strokeStyle = 'rgba(165, 125, 78, 0.14)';
    ctx.lineWidth = 1.8;
    ctx.stroke(darkFibers);

    ctx.strokeStyle = 'rgba(255, 248, 230, 0.18)';
    ctx.lineWidth = 2.0;
    ctx.stroke(lightFibers);

    ctx.fillStyle = 'rgba(135, 95, 55, 0.18)';
    for (let p = 0; p < 150; p++) {
      ctx.fillRect(rand() * 1024, rand() * 1024, 1.6, 3.8);
    }
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
    bgGrad.addColorStop(0, '#131313');
    bgGrad.addColorStop(0.35, '#161616');
    bgGrad.addColorStop(0.7, '#1a1a1a');
    bgGrad.addColorStop(1, '#141414');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let r = 0; r < 6; r++) {
      ctx.beginPath();
      ctx.ellipse(512, r * 190 + 50, 600, 140, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const darkFibers = new Path2D();
    const lightFibers = new Path2D();
    for (let i = 0; i < 160; i++) {
      const x = rand() * 1024;
      const targetPath = rand() > 0.4 ? darkFibers : lightFibers;
      targetPath.moveTo(x, 0);
      targetPath.bezierCurveTo(
        x + (rand() - 0.5) * 22, 340,
        x + (rand() - 0.5) * 22, 680,
        x + (rand() - 0.5) * 14, 1024
      );
    }
    ctx.strokeStyle = 'rgba(4, 4, 4, 0.24)';
    ctx.lineWidth = 1.8;
    ctx.stroke(darkFibers);

    ctx.strokeStyle = 'rgba(60, 60, 60, 0.18)';
    ctx.lineWidth = 2.0;
    ctx.stroke(lightFibers);

    ctx.fillStyle = 'rgba(3, 3, 3, 0.35)';
    for (let p = 0; p < 150; p++) {
      ctx.fillRect(rand() * 1024, rand() * 1024, 1.6, 3.8);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const createWoodBumpMap = (res: number): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scale = res / 1024;
  ctx.scale(scale, scale);
  const rand = createWoodPRNG(303);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 1024, 1024);

  const valleyPaths = new Path2D();
  const ridgePaths = new Path2D();
  for (let i = 0; i < 140; i++) {
    const x = rand() * 1024;
    const targetPath = rand() > 0.4 ? valleyPaths : ridgePaths;
    targetPath.moveTo(x, 0);
    targetPath.bezierCurveTo(
      x + (rand() - 0.5) * 20, 340,
      x + (rand() - 0.5) * 20, 680,
      x + (rand() - 0.5) * 12, 1024
    );
  }
  ctx.strokeStyle = 'rgba(20, 20, 20, 0.14)';
  ctx.lineWidth = 1.6;
  ctx.stroke(valleyPaths);

  ctx.strokeStyle = 'rgba(235, 235, 235, 0.12)';
  ctx.lineWidth = 1.6;
  ctx.stroke(ridgePaths);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

const createWoodRoughnessMap = (): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(0.5, 0.5);
  const rand = createWoodPRNG(404);

  ctx.fillStyle = '#e6e6e6';
  ctx.fillRect(0, 0, 512, 512);

  const roughPath = new Path2D();
  const smoothPath = new Path2D();
  for (let i = 0; i < 90; i++) {
    const x = rand() * 512;
    const targetPath = rand() > 0.5 ? roughPath : smoothPath;
    targetPath.moveTo(x, 0);
    targetPath.bezierCurveTo(
      x + (rand() - 0.5) * 16, 170,
      x + (rand() - 0.5) * 16, 340,
      x + (rand() - 0.5) * 10, 512
    );
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.8;
  ctx.stroke(roughPath);

  ctx.strokeStyle = 'rgba(185, 185, 185, 0.12)';
  ctx.lineWidth = 1.8;
  ctx.stroke(smoothPath);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

// Lazily built shared wood materials — bump/roughness maps stay unallocated on Performance & Balanced tiers!
interface PieceMaterials {
  texRes: number;
  whiteMap: THREE.CanvasTexture | null;
  blackMap: THREE.CanvasTexture | null;
  whiteFull: THREE.MeshStandardMaterial | null;
  blackFull: THREE.MeshStandardMaterial | null;
  whiteFast: THREE.MeshStandardMaterial;
  blackFast: THREE.MeshStandardMaterial;
  emeraldFelt: THREE.MeshStandardMaterial;
  shadowGroove: THREE.MeshStandardMaterial;
  selectionRing: THREE.MeshBasicMaterial;
}

let cachedPieceMaterials: PieceMaterials | null = null;
function getPieceMaterials(): PieceMaterials | null {
  if (typeof document === 'undefined') return null;
  if (cachedPieceMaterials) return cachedPieceMaterials;

  const caps = detectDeviceCapabilities();
  const texRes = caps.isLowEndHardware || caps.isMobileViewport || caps.isTouch ? 256 : 512;

  const whiteMap = createWoodDiffuseMap(true, texRes);
  const blackMap = createWoodDiffuseMap(false, texRes);

  // Fast material for Performance ('low') & Balanced ('medium') profiles — preserves wood grain without dFdx/dFdy bump shader overhead
  const whiteFast = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f0e2cc'),
    map: whiteMap || undefined,
    roughness: 0.64,
    metalness: 0.0,
  });

  const blackFast = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    map: blackMap || undefined,
    roughness: 0.58,
    metalness: 0.0,
  });

  const emeraldFelt = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#143e18'),
    roughness: 0.95,
    metalness: 0.0,
  });

  const shadowGroove = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#050505'),
    roughness: 0.95,
    metalness: 0.0,
  });

  const selectionRing = new THREE.MeshBasicMaterial({
    color: '#d4af37',
    transparent: true,
    opacity: 0.88,
  });

  cachedPieceMaterials = {
    texRes,
    whiteMap,
    blackMap,
    whiteFull: null,
    blackFull: null,
    whiteFast,
    blackFast,
    emeraldFelt,
    shadowGroove,
    selectionRing,
  };
  return cachedPieceMaterials;
}

function getPieceWoodMaterial(mats: PieceMaterials, color: PieceColor, useDetailedWood: boolean): THREE.MeshStandardMaterial {
  if (!useDetailedWood) {
    return color === 'w' ? mats.whiteFast : mats.blackFast;
  }
  if (!mats.whiteFull || !mats.blackFull) {
    const bumpMap = createWoodBumpMap(mats.texRes);
    const roughMap = createWoodRoughnessMap();
    mats.whiteFull = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f0e2cc'),
      map: mats.whiteMap || undefined,
      bumpMap: bumpMap || undefined,
      bumpScale: 0.012,
      roughnessMap: roughMap || undefined,
      roughness: 0.64,
      metalness: 0.0,
    });
    mats.blackFull = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: mats.blackMap || undefined,
      bumpMap: bumpMap || undefined,
      bumpScale: 0.012,
      roughnessMap: roughMap || undefined,
      roughness: 0.58,
      metalness: 0.0,
    });
  }
  return color === 'w' ? mats.whiteFull : mats.blackFull;
}

// ==================================================================================
// SCULPTED PROFILES & HELICAL GEOMETRIES
// ==================================================================================
const createPawnProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.38, 0),
    new THREE.Vector2(0.38, 0.04),
    new THREE.Vector2(0.355, 0.065),
    new THREE.Vector2(0.34, 0.085),
    new THREE.Vector2(0.36, 0.115),
    new THREE.Vector2(0.325, 0.14),
    new THREE.Vector2(0.28, 0.185),
    new THREE.Vector2(0.22, 0.26),
    new THREE.Vector2(0.17, 0.39),
    new THREE.Vector2(0.135, 0.53),
    new THREE.Vector2(0.155, 0.67),
    new THREE.Vector2(0.2, 0.74),
    new THREE.Vector2(0.235, 0.78),
    new THREE.Vector2(0.175, 0.81),
    new THREE.Vector2(0.21, 0.84),
    new THREE.Vector2(0.135, 0.865),
  ];
  const cy = 1.01;
  const r = 0.188;
  for (let i = 0; i <= 14; i++) {
    const a = -0.92 + (i / 14) * (Math.PI / 2 + 0.92);
    pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), cy + r * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, cy + r));
  return pts;
};

const createRookProfile = (): THREE.Vector2[] => [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.42, 0),
  new THREE.Vector2(0.42, 0.05),
  new THREE.Vector2(0.395, 0.08),
  new THREE.Vector2(0.38, 0.12),
  new THREE.Vector2(0.34, 0.165),
  new THREE.Vector2(0.31, 0.23),
  new THREE.Vector2(0.285, 0.46),
  new THREE.Vector2(0.275, 0.72),
  new THREE.Vector2(0.27, 0.96),
  new THREE.Vector2(0.3, 1.03),
  new THREE.Vector2(0.37, 1.085),
  new THREE.Vector2(0.38, 1.13),
  new THREE.Vector2(0.375, 1.18),
  new THREE.Vector2(0.37, 1.38),
  new THREE.Vector2(0.265, 1.38),
  new THREE.Vector2(0.265, 1.09),
  new THREE.Vector2(0, 1.09),
];

const createBishopProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.42, 0),
    new THREE.Vector2(0.42, 0.05),
    new THREE.Vector2(0.39, 0.08),
    new THREE.Vector2(0.37, 0.12),
    new THREE.Vector2(0.33, 0.17),
    new THREE.Vector2(0.28, 0.25),
    new THREE.Vector2(0.215, 0.4),
    new THREE.Vector2(0.155, 0.6),
    new THREE.Vector2(0.175, 0.8),
    new THREE.Vector2(0.235, 0.91),
    new THREE.Vector2(0.27, 0.955),
    new THREE.Vector2(0.215, 0.995),
    new THREE.Vector2(0.245, 1.035),
    new THREE.Vector2(0.165, 1.075),
    new THREE.Vector2(0.225, 1.13),
    new THREE.Vector2(0.27, 1.25),
    new THREE.Vector2(0.265, 1.38),
    new THREE.Vector2(0.22, 1.49),
    new THREE.Vector2(0.14, 1.58),
    new THREE.Vector2(0.07, 1.615),
  ];
  const fcy = 1.675;
  const fr = 0.076;
  for (let i = 0; i <= 10; i++) {
    const a = -0.72 + (i / 10) * (Math.PI / 2 + 0.72);
    pts.push(new THREE.Vector2(Math.max(0, fr * Math.cos(a)), fcy + fr * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, fcy + fr));
  return pts;
};

const createQueenBaseProfile = (): THREE.Vector2[] => [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.44, 0),
  new THREE.Vector2(0.44, 0.06),
  new THREE.Vector2(0.41, 0.1),
  new THREE.Vector2(0.38, 0.145),
  new THREE.Vector2(0.33, 0.205),
  new THREE.Vector2(0.28, 0.29),
  new THREE.Vector2(0.225, 0.38),
  new THREE.Vector2(0, 0.38),
];

const createQueenCrownProfile = (): THREE.Vector2[] => [
  new THREE.Vector2(0, 1.14),
  new THREE.Vector2(0.23, 1.14),
  new THREE.Vector2(0.265, 1.185),
  new THREE.Vector2(0.22, 1.225),
  new THREE.Vector2(0.25, 1.285),
  new THREE.Vector2(0.315, 1.38),
  new THREE.Vector2(0.365, 1.46),
  new THREE.Vector2(0.315, 1.46),
  new THREE.Vector2(0.18, 1.35),
  new THREE.Vector2(0, 1.33),
];

const createQueenHelicalRibbon = (
  strandIndex: number,
  totalStrands: number = 4,
  tubeSegs: number = 14,
  radialSegs: number = 6
): THREE.BufferGeometry => {
  const points: THREE.Vector3[] = [];
  const startY = 0.38;
  const endY = 1.14;
  const height = endY - startY;
  const steps = 18;
  const baseAngle = (strandIndex * Math.PI * 2) / totalStrands;
  const totalTurns = 1.18 * Math.PI * 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = startY + t * height;
    const r = 0.16 + 0.045 * Math.pow(2 * t - 1, 2);
    const angle = baseAngle + t * totalTurns;
    points.push(new THREE.Vector3(Math.sin(angle) * r, y, Math.cos(angle) * r));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubeSegs, 0.044, radialSegs, false);
  geo.computeVertexNormals();
  return geo;
};

const createKingProfile = (): THREE.Vector2[] => [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.46, 0),
  new THREE.Vector2(0.46, 0.06),
  new THREE.Vector2(0.43, 0.1),
  new THREE.Vector2(0.4, 0.145),
  new THREE.Vector2(0.35, 0.205),
  new THREE.Vector2(0.3, 0.29),
  new THREE.Vector2(0.245, 0.54),
  new THREE.Vector2(0.205, 0.84),
  new THREE.Vector2(0.235, 1.14),
  new THREE.Vector2(0.315, 1.3),
  new THREE.Vector2(0.355, 1.35),
  new THREE.Vector2(0.275, 1.4),
  new THREE.Vector2(0.305, 1.45),
  new THREE.Vector2(0.265, 1.5),
  new THREE.Vector2(0.345, 1.57),
  new THREE.Vector2(0.395, 1.7),
  new THREE.Vector2(0.375, 1.725),
  new THREE.Vector2(0.325, 1.745),
  new THREE.Vector2(0.265, 1.77),
  new THREE.Vector2(0.185, 1.85),
  new THREE.Vector2(0.085, 1.89),
  new THREE.Vector2(0, 1.9),
];

const createKnightBaseProfile = (): THREE.Vector2[] => [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.42, 0),
  new THREE.Vector2(0.42, 0.05),
  new THREE.Vector2(0.39, 0.09),
  new THREE.Vector2(0.36, 0.14),
  new THREE.Vector2(0.3, 0.2),
  new THREE.Vector2(0.25, 0.25),
  new THREE.Vector2(0.23, 0.28),
  new THREE.Vector2(0, 0.28),
];

const createBishopSpiralGroove = (tubeSegs: number = 12): THREE.BufferGeometry => {
  const points: THREE.Vector3[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = 0.9 - t * 0.58;
    const r = 0.165 + 0.13 * Math.pow(t, 1.35);
    const angle = 0.25 + t * 1.85;
    points.push(new THREE.Vector3(Math.sin(angle) * (r + 0.005), y, Math.cos(angle) * (r + 0.005)));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubeSegs, 0.016, 6, false);
  geo.computeVertexNormals();
  return geo;
};

// ==================================================================================
// MERGED PIECE MESH CACHE (ONLY 1 wood + 1 groove + 1 felt per piece type!)
// Created once lazily on module init; zero runtime re-allocation!
// ==================================================================================
interface MergedPieceGeos {
  wood: THREE.BufferGeometry;
  groove: THREE.BufferGeometry | null;
  felt: THREE.BufferGeometry;
}

let cachedMergedGeos: Record<PieceType, MergedPieceGeos> | null = null;
let cachedSelectionRingGeo: THREE.RingGeometry | null = null;

// Fast Box3 raycast per piece (0 extra meshes/draw calls, ~1000x faster than triangle raycasting)
const _hitMatrix = new THREE.Matrix4();
const _hitRay = new THREE.Ray();
const _hitPoint = new THREE.Vector3();

function createFastPieceRaycast(height: number): THREE.Object3D['raycast'] {
  const box = new THREE.Box3(
    new THREE.Vector3(-0.42, 0, -0.42),
    new THREE.Vector3(0.42, height, 0.42)
  );
  return function fastPieceRaycast(this: THREE.Object3D, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    _hitMatrix.copy(this.matrixWorld).invert();
    _hitRay.copy(raycaster.ray).applyMatrix4(_hitMatrix);
    if (!_hitRay.intersectBox(box, _hitPoint)) return;
    _hitPoint.applyMatrix4(this.matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(_hitPoint);
    if (distance < raycaster.near || distance > raycaster.far) return;
    intersects.push({
      distance,
      point: _hitPoint.clone(),
      object: this,
    });
  };
}

const PIECE_RAYCAST: Record<PieceType, THREE.Object3D['raycast']> = {
  p: createFastPieceRaycast(1.22),
  r: createFastPieceRaycast(1.42),
  n: createFastPieceRaycast(1.38),
  b: createFastPieceRaycast(1.78),
  q: createFastPieceRaycast(1.62),
  k: createFastPieceRaycast(2.25),
};

function getPieceMergedGeos(): Record<PieceType, MergedPieceGeos> | null {
  if (typeof document === 'undefined') return null;
  if (cachedMergedGeos) return cachedMergedGeos;

  const caps = detectDeviceCapabilities();
  const isCompactGeo = caps.isLowEndHardware || caps.isTouch || caps.isMobileViewport;
  const latheSegs = isCompactGeo ? 18 : 22;
  const feltSegs = isCompactGeo ? 16 : 20;

  const pawnFelt = new THREE.CylinderGeometry(0.375, 0.375, 0.01, feltSegs);
  const majorFelt = new THREE.CylinderGeometry(0.415, 0.415, 0.01, feltSegs);
  const queenFelt = new THREE.CylinderGeometry(0.435, 0.435, 0.01, feltSegs);
  const kingFelt = new THREE.CylinderGeometry(0.455, 0.455, 0.01, feltSegs);

  // ---------------- 1. PAWN ----------------
  const pawnLathe = new THREE.LatheGeometry(createPawnProfile(), latheSegs);
  pawnLathe.computeVertexNormals();
  const pawnStud = new THREE.SphereGeometry(0.026, 6, 5);
  const pawnSkirtNotch = new THREE.BoxGeometry(0.032, 0.075, 0.025);

  const pawnWoodParts = [{ geo: pawnLathe }];
  for (let sIdx = 0; sIdx < 10; sIdx++) {
    const a = (sIdx * Math.PI * 2) / 10;
    pawnWoodParts.push({ geo: pawnStud, pos: [Math.sin(a) * 0.228, 0.795, Math.cos(a) * 0.228] } as never);
  }
  const pawnGrooveParts = [];
  for (let pIdx = 0; pIdx < 8; pIdx++) {
    const a = (pIdx * Math.PI * 2) / 8;
    pawnGrooveParts.push({
      geo: pawnSkirtNotch,
      pos: [Math.sin(a) * 0.342, 0.115, Math.cos(a) * 0.342] as [number, number, number],
      rot: [0, -a, 0] as [number, number, number],
    });
  }
  const pawnWood = mergeTransformedParts(pawnWoodParts);
  const pawnGroove = mergeTransformedParts(pawnGrooveParts);
  pawnLathe.dispose();
  pawnStud.dispose();
  pawnSkirtNotch.dispose();

  // ---------------- 2. ROOK ----------------
  const rookLathe = new THREE.LatheGeometry(createRookProfile(), latheSegs);
  rookLathe.computeVertexNormals();
  const rookBattleBox = new THREE.BoxGeometry(0.11, 0.2, 0.24);
  const rookEmbrasureGroove = new THREE.BoxGeometry(0.022, 0.18, 0.01);
  const rookMortarRing = new THREE.TorusGeometry(0.276, 0.008, 5, isCompactGeo ? 16 : 20);
  const rookBrickJoint = new THREE.BoxGeometry(0.012, 0.14, 0.012);
  const rookCornerPilaster = new THREE.BoxGeometry(0.038, 0.72, 0.022);
  const rookPlinthNotch = new THREE.BoxGeometry(0.042, 0.11, 0.028);

  const rookWoodParts: Parameters<typeof mergeTransformedParts>[0] = [{ geo: rookLathe }];
  const rookGrooveParts: Parameters<typeof mergeTransformedParts>[0] = [];

  for (let mIdx = 0; mIdx < 4; mIdx++) {
    const angle = (mIdx * Math.PI) / 2;
    const mx = Math.sin(angle) * 0.315;
    const mz = Math.cos(angle) * 0.315;
    rookWoodParts.push({ geo: rookBattleBox, pos: [mx, 1.28, mz], rot: [0, -angle, 0] });
    // Embrasure groove offset along rotated forward vector (+Z rotated by -angle around Y)
    rookGrooveParts.push({
      geo: rookEmbrasureGroove,
      pos: [mx + Math.sin(-angle) * 0.122, 1.28, mz + Math.cos(-angle) * 0.122],
      rot: [0, -angle, 0],
    });
  }
  for (const hy of [0.44, 0.6, 0.76, 0.92]) {
    rookGrooveParts.push({ geo: rookMortarRing, pos: [0, hy, 0], rot: [Math.PI / 2, 0, 0] });
  }
  [0.52, 0.68, 0.84].forEach((vy, rowIdx) => {
    const offsetAngle = rowIdx % 2 === 0 ? 0 : Math.PI / 8;
    for (let bIdx = 0; bIdx < 8; bIdx++) {
      const bAngle = (bIdx * Math.PI * 2) / 8 + offsetAngle;
      rookGrooveParts.push({
        geo: rookBrickJoint,
        pos: [Math.sin(bAngle) * 0.277, vy, Math.cos(bAngle) * 0.277],
        rot: [0, -bAngle, 0],
      });
    }
  });
  for (let fIdx = 0; fIdx < 4; fIdx++) {
    const fAngle = (fIdx * Math.PI) / 2 + Math.PI / 4;
    rookWoodParts.push({
      geo: rookCornerPilaster,
      pos: [Math.sin(fAngle) * 0.28, 0.66, Math.cos(fAngle) * 0.28],
      rot: [0, -fAngle, 0],
    });
  }
  for (let pIdx = 0; pIdx < 8; pIdx++) {
    const pAngle = (pIdx * Math.PI * 2) / 8;
    rookGrooveParts.push({
      geo: rookPlinthNotch,
      pos: [Math.sin(pAngle) * 0.365, 0.165, Math.cos(pAngle) * 0.365],
      rot: [0, -pAngle, 0],
    });
  }

  const rookWood = mergeTransformedParts(rookWoodParts);
  const rookGroove = mergeTransformedParts(rookGrooveParts);
  rookLathe.dispose();
  rookBattleBox.dispose();
  rookEmbrasureGroove.dispose();
  rookMortarRing.dispose();
  rookBrickJoint.dispose();
  rookCornerPilaster.dispose();
  rookPlinthNotch.dispose();

  // ---------------- 3. KNIGHT ----------------
  const knightBase = new THREE.LatheGeometry(createKnightBaseProfile(), latheSegs);
  knightBase.computeVertexNormals();
  const knightNeck = new THREE.CylinderGeometry(0.165, 0.24, 0.7, isCompactGeo ? 14 : 16);
  const knightShoulder = new THREE.SphereGeometry(0.22, 12, 9);
  const knightShoulderFurrow = new THREE.BoxGeometry(0.012, 0.18, 0.16);
  const knightCheek = new THREE.SphereGeometry(0.185, 12, 9);
  const knightMuzzle = new THREE.CylinderGeometry(0.115, 0.19, 0.45, 14);
  const knightMuzzleTip = new THREE.SphereGeometry(0.11, 10, 8);
  const knightMouthNotch = new THREE.BoxGeometry(0.045, 0.025, 0.07);
  const knightNostril = new THREE.BoxGeometry(0.016, 0.03, 0.036);
  const knightEyeSocket = new THREE.SphereGeometry(0.034, 8, 6);
  const knightEyePupil = new THREE.BoxGeometry(0.018, 0.038, 0.045);
  const knightHeadCrown = new THREE.SphereGeometry(0.078, 10, 8);
  const knightEar = new THREE.ConeGeometry(0.045, 0.19, 8);

  const knightWoodParts: Parameters<typeof mergeTransformedParts>[0] = [
    { geo: knightBase },
    { geo: knightNeck, pos: [0, 0.63, -0.06], rot: [-0.24, 0, 0] },
    { geo: knightShoulder, pos: [0, 0.43, 0.02], scale: [1.1, 1.0, 1.25] },
    { geo: knightCheek, pos: [0, 0.83, 0.07], scale: [1.15, 1.0, 1.25] },
    { geo: knightMuzzle, pos: [0, 0.95, 0.16], rot: [0.42, 0, 0] },
    { geo: knightMuzzleTip, pos: [0, 1.05, 0.28] },
    { geo: knightEyeSocket, pos: [-0.105, 0.99, 0.19], rot: [0, 0, 0.35] },
    { geo: knightEyeSocket, pos: [0.105, 0.99, 0.19], rot: [0, 0, -0.35] },
    { geo: knightHeadCrown, pos: [0, 1.12, -0.08] },
    { geo: knightEar, pos: [-0.08, 1.24, -0.02], rot: [0.24, 0, -0.22] },
    { geo: knightEar, pos: [0.08, 1.24, -0.02], rot: [0.24, 0, 0.22] },
  ];

  const knightGrooveParts: Parameters<typeof mergeTransformedParts>[0] = [
    { geo: knightShoulderFurrow, pos: [-0.18, 0.45, 0.02], rot: [0.4, 0, -0.4] },
    { geo: knightShoulderFurrow, pos: [0.18, 0.45, 0.02], rot: [0.4, 0, 0.4] },
    { geo: knightMouthNotch, pos: [0, 1.03, 0.36] },
    { geo: knightNostril, pos: [-0.045, 1.07, 0.33], rot: [0.2, -0.2, 0] },
    { geo: knightNostril, pos: [0.045, 1.07, 0.33], rot: [0.2, 0.2, 0] },
    { geo: knightEyePupil, pos: [-0.105, 0.99, 0.2], rot: [0, 0, 0.35] },
    { geo: knightEyePupil, pos: [0.105, 0.99, 0.2], rot: [0, 0, -0.35] },
  ];

  for (let mIdx = 0; mIdx < 8; mIdx++) {
    const prog = mIdx / 7;
    const scaleW = 0.084 - prog * 0.014;
    const my = 0.52 + prog * 0.6;
    const mz = -0.16 - prog * 0.032;
    const rx = 0.18 + prog * 0.08;
    const maneBox = new THREE.BoxGeometry(scaleW, 0.095, 0.19);
    const maneShadow = new THREE.BoxGeometry(scaleW + 0.006, 0.014, 0.195);

    knightWoodParts.push({ geo: maneBox, pos: [0, my, mz], rot: [rx, 0, 0] });
    // Apply exact rotated local offset [0, -0.048, 0] around X by rx
    knightGrooveParts.push({
      geo: maneShadow,
      pos: [0, my - 0.048 * Math.cos(rx), mz - 0.048 * Math.sin(rx)],
      rot: [rx, 0, 0],
    });

    maneBox.dispose();
    maneShadow.dispose();
  }

  const knightWood = mergeTransformedParts(knightWoodParts);
  const knightGroove = mergeTransformedParts(knightGrooveParts);
  knightBase.dispose();
  knightNeck.dispose();
  knightShoulder.dispose();
  knightShoulderFurrow.dispose();
  knightCheek.dispose();
  knightMuzzle.dispose();
  knightMuzzleTip.dispose();
  knightMouthNotch.dispose();
  knightNostril.dispose();
  knightEyeSocket.dispose();
  knightEyePupil.dispose();
  knightHeadCrown.dispose();
  knightEar.dispose();

  // ---------------- 4. BISHOP ----------------
  const bishopLathe = new THREE.LatheGeometry(createBishopProfile(), latheSegs);
  bishopLathe.computeVertexNormals();
  const bishopSpiralGroove = createBishopSpiralGroove(isCompactGeo ? 12 : 14);
  const bishopTeardropLoop = new THREE.TorusGeometry(0.092, 0.011, 5, 14);
  const bishopMitreSlit = new THREE.BoxGeometry(0.036, 0.3, 0.14);

  const bishopWood = mergeTransformedParts([{ geo: bishopLathe }]);
  const bishopGroove = mergeTransformedParts([
    { geo: bishopSpiralGroove },
    { geo: bishopTeardropLoop, pos: [0, 1.32, 0.19], rot: [0.16, 0, 0], scale: [0.82, 1.38, 0.25] },
    { geo: bishopTeardropLoop, pos: [0, 1.32, -0.19], rot: [-0.16, Math.PI, 0], scale: [0.82, 1.38, 0.25] },
    { geo: bishopMitreSlit, pos: [0.088, 1.39, 0.088], rot: [0.62, 0.4, 0] },
  ]);
  bishopLathe.dispose();
  bishopSpiralGroove.dispose();
  bishopTeardropLoop.dispose();
  bishopMitreSlit.dispose();

  // ---------------- 5. QUEEN ----------------
  const queenBase = new THREE.LatheGeometry(createQueenBaseProfile(), latheSegs);
  queenBase.computeVertexNormals();
  const queenCrown = new THREE.LatheGeometry(createQueenCrownProfile(), latheSegs);
  queenCrown.computeVertexNormals();
  const queenSpindle = new THREE.CylinderGeometry(0.05, 0.05, 0.76, 10);
  const queenRibbons = [0, 1, 2, 3].map((i) => createQueenHelicalRibbon(i, 4, isCompactGeo ? 14 : 16, 6));
  const queenSpire = new THREE.ConeGeometry(0.048, 0.22, 4);
  const queenPearl = new THREE.SphereGeometry(0.088, 10, 8);

  const queenWoodParts: Parameters<typeof mergeTransformedParts>[0] = [
    { geo: queenBase },
    { geo: queenSpindle, pos: [0, 0.76, 0] },
    ...queenRibbons.map((rGeo) => ({ geo: rGeo })),
    { geo: queenCrown },
    { geo: queenPearl, pos: [0, 1.46, 0] },
  ];
  for (let pIdx = 0; pIdx < 6; pIdx++) {
    const angle = (pIdx * Math.PI * 2) / 6;
    queenWoodParts.push({
      geo: queenSpire,
      pos: [Math.cos(angle) * 0.355, 1.48, Math.sin(angle) * 0.355],
      rot: [0.26 * Math.sin(angle), -angle, -0.26 * Math.cos(angle)],
    });
  }
  const queenWood = mergeTransformedParts(queenWoodParts);
  queenBase.dispose();
  queenCrown.dispose();
  queenSpindle.dispose();
  queenRibbons.forEach((g) => g.dispose());
  queenSpire.dispose();
  queenPearl.dispose();

  // ---------------- 6. KING ----------------
  const kingLathe = new THREE.LatheGeometry(createKingProfile(), latheSegs);
  kingLathe.computeVertexNormals();
  const kingVerticalRib = new THREE.BoxGeometry(0.038, 0.58, 0.022);
  const kingChamferCut = new THREE.BoxGeometry(0.038, 0.22, 0.022);
  const kingShadowRib = new THREE.BoxGeometry(0.014, 0.62, 0.008);
  const kingSkirtGroove = new THREE.BoxGeometry(0.045, 0.1, 0.03);
  const kingCrownGroove = new THREE.BoxGeometry(0.025, 0.2, 0.025);
  const kingCrossCollar = new THREE.CylinderGeometry(0.065, 0.08, 0.05, 12);
  const kingCrossPost = new THREE.BoxGeometry(0.076, 0.28, 0.062);
  const kingCrossBar = new THREE.BoxGeometry(0.24, 0.076, 0.062);
  const kingCrossCapTop = new THREE.BoxGeometry(0.1, 0.03, 0.072);
  const kingCrossCapSide = new THREE.BoxGeometry(0.03, 0.1, 0.072);

  const kingWoodParts: Parameters<typeof mergeTransformedParts>[0] = [
    { geo: kingLathe },
    { geo: kingCrossCollar, pos: [0, 1.91, 0] },
    { geo: kingCrossPost, pos: [0, 2.06, 0] },
    { geo: kingCrossBar, pos: [0, 2.09, 0] },
    { geo: kingCrossCapTop, pos: [0, 2.21, 0] },
    { geo: kingCrossCapSide, pos: [-0.13, 2.09, 0] },
    { geo: kingCrossCapSide, pos: [0.13, 2.09, 0] },
  ];
  const kingGrooveParts: Parameters<typeof mergeTransformedParts>[0] = [];

  for (let fIdx = 0; fIdx < 8; fIdx++) {
    const fAngle = (fIdx * Math.PI * 2) / 8;
    const rotY = -fAngle;
    const cx = Math.sin(fAngle) * 0.238;
    const cz = Math.cos(fAngle) * 0.238;

    kingWoodParts.push({ geo: kingVerticalRib, pos: [cx, 0.82, cz], rot: [0, rotY, 0] });

    // Chamfer cut rotated inside facet frame
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    kingWoodParts.push({
      geo: kingChamferCut,
      pos: [cx + sinY * -0.012, 0.82 - 0.32, cz + cosY * -0.012],
      rot: [0.32, rotY, 0],
    });
    kingGrooveParts.push({
      geo: kingShadowRib,
      pos: [cx + sinY * 0.012, 0.82, cz + cosY * 0.012],
      rot: [0, rotY, 0],
    });
  }
  for (let sIdx = 0; sIdx < 8; sIdx++) {
    const sAngle = (sIdx * Math.PI * 2) / 8;
    kingGrooveParts.push({
      geo: kingSkirtGroove,
      pos: [Math.sin(sAngle) * 0.375, 0.175, Math.cos(sAngle) * 0.375],
      rot: [0, -sAngle, 0],
    });
  }
  for (let cIdx = 0; cIdx < 8; cIdx++) {
    const cAngle = (cIdx * Math.PI * 2) / 8;
    kingGrooveParts.push({
      geo: kingCrownGroove,
      pos: [Math.sin(cAngle) * 0.365, 1.62, Math.cos(cAngle) * 0.365],
      rot: [0, -cAngle, 0],
    });
  }

  const kingWood = mergeTransformedParts(kingWoodParts);
  const kingGroove = mergeTransformedParts(kingGrooveParts);
  kingLathe.dispose();
  kingVerticalRib.dispose();
  kingChamferCut.dispose();
  kingShadowRib.dispose();
  kingSkirtGroove.dispose();
  kingCrownGroove.dispose();
  kingCrossCollar.dispose();
  kingCrossPost.dispose();
  kingCrossBar.dispose();
  kingCrossCapTop.dispose();
  kingCrossCapSide.dispose();

  // Translate felt pads slightly upward so positioned at [0, 0.005, 0] directly
  pawnFelt.translate(0, 0.005, 0);
  majorFelt.translate(0, 0.005, 0);
  queenFelt.translate(0, 0.005, 0);
  kingFelt.translate(0, 0.005, 0);

  cachedSelectionRingGeo = new THREE.RingGeometry(0.42, 0.48, 20);

  cachedMergedGeos = {
    p: { wood: pawnWood, groove: pawnGroove, felt: pawnFelt },
    r: { wood: rookWood, groove: rookGroove, felt: majorFelt },
    n: { wood: knightWood, groove: knightGroove, felt: majorFelt },
    b: { wood: bishopWood, groove: bishopGroove, felt: majorFelt },
    q: { wood: queenWood, groove: null, felt: queenFelt },
    k: { wood: kingWood, groove: kingGroove, felt: kingFelt },
  };

  return cachedMergedGeos;
}

// ==================================================================================
// COORDINATE HELPERS
// ==================================================================================
function squareToCoords(square: string): [number, number] {
  if (!square || square.length < 2) return [0, 0];
  const file = square.charCodeAt(0) - 97; // 'a'
  const rank = parseInt(square[1], 10) - 1;
  return [file - 3.5, 3.5 - rank];
}

interface ChessPiece3DProps {
  id: string;
  type: PieceType;
  color: PieceColor;
  square: string;
}

export const ChessPiece3D: React.FC<ChessPiece3DProps> = React.memo(({ type, color, square }) => {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((s) => s.invalidate);

  const isSelected = useGameStore((s) => s.selectedSquare === square);
  const selectSquare = useGameStore((s) => s.selectSquare);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const isMobile = useGameStore((s) => s.isMobile);

  const mats = getPieceMaterials();
  const geos = getPieceMergedGeos();

  const [targetX, targetZ] = useMemo(() => squareToCoords(square), [square]);

  // Reset hover if device type shifts to mobile
  useEffect(() => {
    if (isMobile && hovered) setHovered(false);
  }, [isMobile, hovered]);

  // Wake demand renderer cleanly when piece state, location, selection, hover, or quality changes
  useEffect(() => {
    invalidate();
  }, [invalidate, targetX, targetZ, isSelected, hovered, graphicsQuality]);

  // Early-exit animation damping + automatic demand-loop wakeups until piece settles
  useFrame((_, delta) => {
    const grp = meshRef.current;
    if (!grp) return;

    const targetY = isSelected ? 0.35 : hovered ? 0.12 : 0.02;
    const dx = Math.abs(grp.position.x - targetX);
    const dz = Math.abs(grp.position.z - targetZ);
    const dy = Math.abs(grp.position.y - targetY);
    let animating = false;

    if (dx > 0.0008) {
      grp.position.x = THREE.MathUtils.damp(grp.position.x, targetX, 14, delta);
      animating = true;
    } else if (dx > 0) {
      grp.position.x = targetX;
      animating = true;
    }

    if (dz > 0.0008) {
      grp.position.z = THREE.MathUtils.damp(grp.position.z, targetZ, 14, delta);
      animating = true;
    } else if (dz > 0) {
      grp.position.z = targetZ;
      animating = true;
    }

    if (dy > 0.0008) {
      grp.position.y = THREE.MathUtils.damp(grp.position.y, targetY, 12, delta);
      animating = true;
    } else if (dy > 0) {
      grp.position.y = targetY;
      animating = true;
    }

    if (type === 'n') {
      const targetRot = color === 'w' ? 0 : Math.PI;
      const dr = Math.abs(grp.rotation.y - targetRot);
      if (dr > 0.001) {
        grp.rotation.y = THREE.MathUtils.damp(grp.rotation.y, targetRot, 10, delta);
        animating = true;
      } else if (dr > 0) {
        grp.rotation.y = targetRot;
        animating = true;
      }
    }

    if (animating) {
      invalidate();
    }
  });

  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);

  if (!mats || !geos) return null;

  const pieceGeo = geos[type];
  const useDetailedWood = graphicsQuality === 'high' || graphicsQuality === 'ultra';
  const woodMat = getPieceWoodMaterial(mats, color, useDetailedWood);
  const castShadow = graphicsQuality !== 'low';
  const receiveShadow = graphicsQuality !== 'low';

  return (
    <group
      ref={meshRef}
      position={[targetX, 0.02, targetZ]}
      rotation={[0, type === 'n' && color === 'b' ? Math.PI : 0, 0]}
    >
      {/* Interactive Sculpted Wood Body with O(1) Box3 raycast proxy */}
      <mesh
        geometry={pieceGeo.wood}
        material={woodMat}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        raycast={PIECE_RAYCAST[type]}
        onPointerDown={(e) => {
          if (typeof window !== 'undefined' && window.__lastPinchEndTime && performance.now() - window.__lastPinchEndTime < 350) {
            return;
          }
          pointerDownRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
        }}
        onPointerUp={(e) => {
          const start = pointerDownRef.current;
          pointerDownRef.current = null;
          if (!start) return;

          if (typeof window !== 'undefined' && window.__lastPinchEndTime && performance.now() - window.__lastPinchEndTime < 350) {
            return;
          }

          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          const dt = performance.now() - start.time;
          if (Math.hypot(dx, dy) < 12 && dt < 400) {
            e.stopPropagation();
            selectSquare(square);
          }
        }}
        onPointerOver={
          isMobile
            ? undefined
            : (e) => {
                e.stopPropagation();
                setHovered(true);
                document.body.style.cursor = 'pointer';
              }
        }
        onPointerOut={
          isMobile
            ? undefined
            : () => {
                setHovered(false);
                document.body.style.cursor = 'auto';
              }
        }
      />

      {/* Merged Carved Relief Shadow Grooves (No raycast, no shadow pass overhead) */}
      {pieceGeo.groove && (
        <mesh geometry={pieceGeo.groove} material={mats.shadowGroove} raycast={NO_RAYCAST} />
      )}

      {/* Tournament Emerald Baize Felt Base Pad (No raycast, no shadow pass overhead) */}
      <mesh geometry={pieceGeo.felt} material={mats.emeraldFelt} raycast={NO_RAYCAST} />

      {/* Selection Golden Aura Ring */}
      {isSelected && cachedSelectionRingGeo && (
        <mesh
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={cachedSelectionRingGeo}
          material={mats.selectionRing}
          raycast={NO_RAYCAST}
        />
      )}
    </group>
  );
});
