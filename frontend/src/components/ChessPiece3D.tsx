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

  // Seamless periodic base gradient (u=0 and u=1024 match pixel-perfectly on turned Lathes!)
  if (isWhite) {
    // Rich natural warm caramel walnut wood centered accurately on #C08244
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    bgGrad.addColorStop(0.0, '#c08244');
    bgGrad.addColorStop(0.25, '#ca8c4d');
    bgGrad.addColorStop(0.5, '#b6783c');
    bgGrad.addColorStop(0.75, '#c68849');
    bgGrad.addColorStop(1.0, '#c08244');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Soft organic vertical tonal bands (wrapping smoothly around circumference)
    for (let b = 0; b < 7; b++) {
      const bx = (b / 7) * 1024;
      const bw = 90 + rand() * 80;
      const alpha = 0.06 + rand() * 0.07;
      ctx.fillStyle = b % 2 === 0 ? `rgba(128, 76, 30, ${alpha})` : `rgba(226, 174, 114, ${alpha})`;
      ctx.fillRect(bx, 0, bw, 1024);
      if (bx + bw > 1024) ctx.fillRect(bx - 1024, 0, bw, 1024);
    }

    // Natural wood grain fibers + cathedral figure following piece vertical axis
    const darkFibers = new Path2D();
    const warmFibers = new Path2D();
    for (let i = 0; i < 210; i++) {
      const x = rand() * 1024;
      const dx1 = (rand() - 0.5) * 28;
      const dx2 = (rand() - 0.5) * 28;
      const target = rand() > 0.36 ? darkFibers : warmFibers;
      for (const wrapOffset of [0, -1024, 1024]) {
        if (wrapOffset !== 0 && x + wrapOffset > -40 && x + wrapOffset < 1064) {
          target.moveTo(x + wrapOffset, 0);
          target.bezierCurveTo(x + wrapOffset + dx1, 340, x + wrapOffset + dx2, 680, x + wrapOffset, 1024);
        } else if (wrapOffset === 0) {
          target.moveTo(x, 0);
          target.bezierCurveTo(x + dx1, 340, x + dx2, 680, x, 1024);
        }
      }
    }
    ctx.strokeStyle = 'rgba(116, 67, 25, 0.24)';
    ctx.lineWidth = 1.6;
    ctx.stroke(darkFibers);

    ctx.strokeStyle = 'rgba(232, 180, 118, 0.20)';
    ctx.lineWidth = 1.5;
    ctx.stroke(warmFibers);

    // Subtle organic wood growth loops / cathedral rings & fine medullary pore flecks
    ctx.strokeStyle = 'rgba(98, 55, 19, 0.16)';
    ctx.lineWidth = 1.3;
    for (let c = 0; c < 4; c++) {
      const cx = 140 + rand() * 744;
      const cy = 180 + c * 220;
      for (let r = 14; r <= 44; r += 10) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.72, r * 2.8, (rand() - 0.5) * 0.08, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const porePath = new Path2D();
    for (let p = 0; p < 180; p++) {
      porePath.rect(rand() * 1024, rand() * 1024, 1.4, 4.2);
    }
    ctx.fillStyle = 'rgba(92, 50, 17, 0.22)';
    ctx.fill(porePath);
  } else {
    // Balanced dark charcoal wood (-2 shades darker from #464646): #343434 primary, #434343 secondary tones, #525252 raised grain, #232323 shadows
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    bgGrad.addColorStop(0.0, '#343434');
    bgGrad.addColorStop(0.24, '#393939');
    bgGrad.addColorStop(0.50, '#2F2F2F');
    bgGrad.addColorStop(0.76, '#373737');
    bgGrad.addColorStop(1.0, '#343434');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // Organic vertical secondary wood tone bands (#434343) & deep shadow streaks (#232323)
    // Seamless wrap across u=0 / u=1024 so turned Lathe pieces show zero vertical seam
    for (let b = 0; b < 18; b++) {
      const x = rand() * 1024;
      const bw = 10 + rand() * 26;
      const dx1 = (rand() - 0.5) * 32;
      const dx2 = (rand() - 0.5) * 32;
      const isSecondary = rand() > 0.36;
      ctx.strokeStyle = isSecondary
        ? `rgba(67, 67, 67, ${(0.58 + rand() * 0.32).toFixed(2)})` // #434343 secondary wood tones
        : `rgba(35, 35, 35, ${(0.65 + rand() * 0.30).toFixed(2)})`; // #232323 deeper shadow grain
      ctx.lineWidth = bw;
      ctx.beginPath();
      for (const wrapOffset of [0, -1024, 1024]) {
        if (wrapOffset === 0 || (x + wrapOffset > -60 && x + wrapOffset < 1084)) {
          ctx.moveTo(x + wrapOffset, 0);
          ctx.bezierCurveTo(x + wrapOffset + dx1, 340, x + wrapOffset + dx2, 680, x + wrapOffset, 1024);
        }
      }
      ctx.stroke();
    }

    // Irregular tapered vertical wood grain fibers (#525252 raised grain, #434343 midtone, #232323 crevices)
    const deepShadowFibers = new Path2D();
    const secondaryFibers = new Path2D();
    const raisedHighlightFibers = new Path2D();
    for (let i = 0; i < 290; i++) {
      const x = rand() * 1024;
      const dx1 = (rand() - 0.5) * 28;
      const dx2 = (rand() - 0.5) * 28;
      const roll = rand();
      const target =
        roll < 0.38 ? deepShadowFibers : roll < 0.68 ? secondaryFibers : raisedHighlightFibers;
      for (const wrapOffset of [0, -1024, 1024]) {
        if (wrapOffset === 0 || (x + wrapOffset > -45 && x + wrapOffset < 1069)) {
          target.moveTo(x + wrapOffset, 0);
          target.bezierCurveTo(x + wrapOffset + dx1, 340, x + wrapOffset + dx2, 680, x + wrapOffset, 1024);
        }
      }
    }

    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(67, 67, 67, 0.85)'; // #434343
    ctx.lineWidth = 2.6;
    ctx.stroke(secondaryFibers);

    ctx.strokeStyle = 'rgba(35, 35, 35, 0.90)'; // #232323 deep grain shadows
    ctx.lineWidth = 2.2;
    ctx.stroke(deepShadowFibers);

    ctx.strokeStyle = 'rgba(82, 82, 82, 0.84)'; // #525252 subtle raised grain highlights
    ctx.lineWidth = 2.1;
    ctx.stroke(raisedHighlightFibers);

    // Natural elongated cathedral heartwood growth loops batched into Path2D
    const cathedralDark = new Path2D();
    const cathedralHi = new Path2D();
    for (let c = 0; c < 6; c++) {
      const cx = 110 + rand() * 804;
      const cy = 120 + c * 155 + (rand() - 0.5) * 40;
      const tilt = (rand() - 0.5) * 0.1;
      for (let r = 12; r <= 48; r += 9) {
        cathedralDark.moveTo(cx + r * 0.65, cy);
        cathedralDark.ellipse(cx, cy, r * 0.65, r * 2.9, tilt, 0, Math.PI * 2);
        if (r >= 20) {
          cathedralHi.moveTo(cx + (r - 2) * 0.65, cy);
          cathedralHi.ellipse(cx, cy, (r - 2) * 0.65, (r - 2) * 2.9, tilt, 0, Math.PI * 2);
        }
      }
    }
    ctx.strokeStyle = 'rgba(35, 35, 35, 0.80)';
    ctx.lineWidth = 1.9;
    ctx.stroke(cathedralDark);

    ctx.strokeStyle = 'rgba(82, 82, 82, 0.68)';
    ctx.lineWidth = 1.4;
    ctx.stroke(cathedralHi);

    // Open charcoal wood pores (#232323) & subtle raised grain flecks (#525252)
    const poreShadowPath = new Path2D();
    const poreHiPath = new Path2D();
    for (let p = 0; p < 240; p++) {
      const px = rand() * 1024;
      const py = rand() * 1024;
      const ph = 5 + rand() * 9;
      poreShadowPath.rect(px, py, 1.8, ph);
      if (p % 3 === 0) {
        poreHiPath.rect(px + 2.0, py + 1.0, 1.3, ph * 0.75);
      }
    }
    ctx.fillStyle = 'rgba(35, 35, 35, 0.85)';
    ctx.fill(poreShadowPath);
    ctx.fillStyle = 'rgba(82, 82, 82, 0.58)';
    ctx.fill(poreHiPath);
  }

  const caps = detectDeviceCapabilities();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = caps.isTouch ? 2 : 4;
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
  for (let i = 0; i < 160; i++) {
    const x = rand() * 1024;
    const dx1 = (rand() - 0.5) * 22;
    const dx2 = (rand() - 0.5) * 22;
    const targetPath = rand() > 0.4 ? valleyPaths : ridgePaths;
    targetPath.moveTo(x, 0);
    targetPath.bezierCurveTo(x + dx1, 340, x + dx2, 680, x, 1024);
  }
  ctx.strokeStyle = 'rgba(24, 24, 24, 0.18)';
  ctx.lineWidth = 1.6;
  ctx.stroke(valleyPaths);

  ctx.strokeStyle = 'rgba(232, 232, 232, 0.14)';
  ctx.lineWidth = 1.4;
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

  // Calibrated satin wood roughness baseline (~0.45 -> ~115..138 in grayscale)
  ctx.fillStyle = '#828282';
  ctx.fillRect(0, 0, 512, 512);

  const roughPath = new Path2D();
  const satinPath = new Path2D();
  for (let i = 0; i < 110; i++) {
    const x = rand() * 512;
    const dx1 = (rand() - 0.5) * 18;
    const dx2 = (rand() - 0.5) * 18;
    const targetPath = rand() > 0.48 ? roughPath : satinPath;
    targetPath.moveTo(x, 0);
    targetPath.bezierCurveTo(x + dx1, 170, x + dx2, 340, x, 512);
  }
  ctx.strokeStyle = 'rgba(175, 175, 175, 0.35)'; // Pores slightly more matte
  ctx.lineWidth = 1.6;
  ctx.stroke(roughPath);

  ctx.strokeStyle = 'rgba(92, 92, 92, 0.28)'; // Polished fibers slightly more satin
  ctx.lineWidth = 1.6;
  ctx.stroke(satinPath);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

const createBlackWoodBumpMap = (res: number): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scale = res / 1024;
  ctx.scale(scale, scale);
  const rand = createWoodPRNG(353);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 1024, 1024);

  const valleyPaths = new Path2D();
  const ridgePaths = new Path2D();
  for (let i = 0; i < 240; i++) {
    const x = rand() * 1024;
    const dx1 = (rand() - 0.5) * 26;
    const dx2 = (rand() - 0.5) * 26;
    const targetPath = rand() > 0.45 ? valleyPaths : ridgePaths;
    for (const wrapOffset of [0, -1024, 1024]) {
      if (wrapOffset === 0 || (x + wrapOffset > -40 && x + wrapOffset < 1064)) {
        targetPath.moveTo(x + wrapOffset, 0);
        targetPath.bezierCurveTo(x + wrapOffset + dx1, 340, x + wrapOffset + dx2, 680, x + wrapOffset, 1024);
      }
    }
  }
  ctx.strokeStyle = 'rgba(18, 18, 18, 0.48)';
  ctx.lineWidth = 2.2;
  ctx.stroke(valleyPaths);

  ctx.strokeStyle = 'rgba(225, 225, 225, 0.42)';
  ctx.lineWidth = 1.9;
  ctx.stroke(ridgePaths);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

const createBlackWoodRoughnessMap = (): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(0.5, 0.5);
  const rand = createWoodPRNG(454);

  // Premium matte baseline (#c0c0c0 -> ~0.75 * 0.94 = ~0.70 effective roughness)
  // with matte open pores (#eaeaea -> ~0.86) and subtle satin grain ridges (#969696 -> ~0.55)
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(0, 0, 512, 512);

  const poreRoughPath = new Path2D();
  const satinRidgePath = new Path2D();
  for (let i = 0; i < 160; i++) {
    const x = rand() * 512;
    const dx1 = (rand() - 0.5) * 20;
    const dx2 = (rand() - 0.5) * 20;
    const targetPath = rand() > 0.45 ? poreRoughPath : satinRidgePath;
    for (const wrapOffset of [0, -512, 512]) {
      if (wrapOffset === 0 || (x + wrapOffset > -30 && x + wrapOffset < 542)) {
        targetPath.moveTo(x + wrapOffset, 0);
        targetPath.bezierCurveTo(x + wrapOffset + dx1, 170, x + wrapOffset + dx2, 340, x + wrapOffset, 512);
      }
    }
  }
  ctx.strokeStyle = 'rgba(236, 236, 236, 0.62)';
  ctx.lineWidth = 2.0;
  ctx.stroke(poreRoughPath);

  ctx.strokeStyle = 'rgba(148, 148, 148, 0.58)';
  ctx.lineWidth = 1.9;
  ctx.stroke(satinRidgePath);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

// Lazily built shared wood materials (whiteMap centered on #C08244, blackMap natural charcoal #343434)
interface PieceMaterials {
  texRes: number;
  whiteMap: THREE.CanvasTexture | null;
  blackMap: THREE.CanvasTexture | null;
  roughMap: THREE.CanvasTexture | null;
  blackRoughMap: THREE.CanvasTexture | null;
  whiteFull: THREE.MeshStandardMaterial | null;
  blackFull: THREE.MeshStandardMaterial | null;
  whiteBalanced: THREE.MeshStandardMaterial | null;
  blackBalanced: THREE.MeshStandardMaterial | null;
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
  const texRes = caps.isLowEndHardware || caps.isMobileViewport || caps.isTouch ? 384 : 512;

  const whiteMap = createWoodDiffuseMap(true, texRes);
  const blackMap = createWoodDiffuseMap(false, texRes);

  // Satin-matte PBR finish calibrated for natural wood highlights without plastic gloss
  const whiteFast = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    map: whiteMap || undefined,
    roughness: 0.46,
    metalness: 0.02,
  });

  const blackFast = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    map: blackMap || undefined,
    roughness: 0.72,
    metalness: 0.02,
  });

  const emeraldFelt = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#143e18'),
    roughness: 0.95,
    metalness: 0.0,
  });

  const shadowGroove = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#222222'),
    roughness: 0.94,
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
    roughMap: null,
    blackRoughMap: null,
    whiteFull: null,
    blackFull: null,
    whiteBalanced: null,
    blackBalanced: null,
    whiteFast,
    blackFast,
    emeraldFelt,
    shadowGroove,
    selectionRing,
  };
  return cachedPieceMaterials;
}

function getPieceWoodMaterial(mats: PieceMaterials, color: PieceColor, quality: string): THREE.MeshStandardMaterial {
  if (quality === 'low') {
    return color === 'w' ? mats.whiteFast : mats.blackFast;
  }
  if (!mats.roughMap) {
    mats.roughMap = createWoodRoughnessMap();
  }
  if (!mats.blackRoughMap) {
    mats.blackRoughMap = createBlackWoodRoughnessMap();
  }
  if (quality === 'medium') {
    if (!mats.whiteBalanced || !mats.blackBalanced) {
      mats.whiteBalanced = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffffff'),
        map: mats.whiteMap || undefined,
        roughnessMap: mats.roughMap || undefined,
        roughness: 0.86,
        metalness: 0.02,
      });
      mats.blackBalanced = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffffff'),
        map: mats.blackMap || undefined,
        roughnessMap: mats.blackRoughMap || undefined,
        roughness: 0.94,
        metalness: 0.02,
      });
    }
    return color === 'w' ? mats.whiteBalanced : mats.blackBalanced;
  }
  if (!mats.whiteFull || !mats.blackFull) {
    const bumpMap = createWoodBumpMap(mats.texRes);
    const blackBumpMap = createBlackWoodBumpMap(mats.texRes);
    mats.whiteFull = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: mats.whiteMap || undefined,
      bumpMap: bumpMap || undefined,
      bumpScale: 0.015,
      roughnessMap: mats.roughMap || undefined,
      roughness: 0.86,
      metalness: 0.02,
    });
    mats.blackFull = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: mats.blackMap || undefined,
      bumpMap: blackBumpMap || undefined,
      bumpScale: 0.026,
      roughnessMap: mats.blackRoughMap || undefined,
      roughness: 0.94,
      metalness: 0.02,
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
  const woodMat = getPieceWoodMaterial(mats, color, graphicsQuality);
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
