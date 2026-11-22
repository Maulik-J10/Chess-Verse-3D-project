import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PieceColor, PieceType } from '../chess/types';
import { useGameStore } from '../store/gameStore';

// ==================================================================================
// ULTRA-REALISTIC HANDCRAFTED WOODEN CHESS PIECES (EXACT REPLICA)
// Faithful replica of the handcrafted artisan wooden chess set from reference photo:
// - Queen: Breathtaking openwork spiral / helical twisted column stem with sharp spires
// - King: Majestic cross finial, architectural chiseled facet panels & geometric grooves
// - Bishop: Egg-shaped mitre with carved oval teardrop loop & sweeping diagonal spiral groove
// - Knight: Stylized carved wooden stallion with comb mane ridges & anatomical furrows
// - Rook: Medieval castle tower with carved ashlar stone masonry brickwork & buttresses
// - Pawn: Spherical head with studded/beaded collar ring & fluted/paneled lower skirt
//
// White: Select Natural Light Boxwood / Aged Maple (Warm honey-amber grain & pores)
// Black: Deep Gabon Ebony / Roasted Dark Walnut (Rich espresso timber grain & warm highlights)
// Base: Tournament emerald green billiard baize felt pad underneath all pieces
// ==================================================================================

// Generate high-resolution procedural diffuse wood color map (1024x1024) - OPTIMIZED BATCHED RASTERIZATION
const createWoodDiffuseMap = (isWhite: boolean): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (isWhite) {
    // 1. Warm Antique Ivory / Natural Light Boxwood / Maple Base
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
    bgGrad.addColorStop(0, '#f4e7d1');
    bgGrad.addColorStop(0.35, '#ebd6b7');
    bgGrad.addColorStop(0.7, '#e0caa7');
    bgGrad.addColorStop(1, '#ecd8be');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. Annual Growth Ring Undulations (Cathedral grain curves)
    ctx.fillStyle = 'rgba(195, 160, 115, 0.08)';
    for (let r = 0; r < 6; r++) {
      ctx.beginPath();
      const cy = r * 190 + 50;
      ctx.ellipse(512, cy, 600, 140, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Batched Wood Grain Fibers (Combined Path2D for 30x faster rasterization)
    const darkFibers = new Path2D();
    const lightFibers = new Path2D();
    for (let i = 0; i < 700; i++) {
      const x = Math.random() * 1024;
      const targetPath = Math.random() > 0.4 ? darkFibers : lightFibers;
      targetPath.moveTo(x, 0);
      targetPath.bezierCurveTo(
        x + (Math.random() - 0.5) * 24, 340,
        x + (Math.random() - 0.5) * 24, 680,
        x + (Math.random() - 0.5) * 16, 1024
      );
    }
    ctx.strokeStyle = 'rgba(165, 125, 78, 0.12)';
    ctx.lineWidth = 1.6;
    ctx.stroke(darkFibers);

    ctx.strokeStyle = 'rgba(255, 248, 230, 0.16)';
    ctx.lineWidth = 1.8;
    ctx.stroke(lightFibers);

    // 4. Hardwood Vessel Element Pores
    ctx.fillStyle = 'rgba(135, 95, 55, 0.18)';
    for (let p = 0; p < 700; p++) {
      const px = Math.random() * 1024;
      const py = Math.random() * 1024;
      ctx.fillRect(px, py, 1.2, 3.5);
    }
  } else {
    // 1. One More Shade Darker Deep Obsidian / Jet Ebony (#161616) Hardwood Base
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
    bgGrad.addColorStop(0, '#131313');
    bgGrad.addColorStop(0.35, '#161616');
    bgGrad.addColorStop(0.7, '#1a1a1a');
    bgGrad.addColorStop(1, '#141414');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. Subtle Cathedral Grain Bands
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let r = 0; r < 6; r++) {
      ctx.beginPath();
      const cy = r * 190 + 50;
      ctx.ellipse(512, cy, 600, 140, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Batched Deep Carbon & Soft Anthracite Micro-Fibers
    const darkFibers = new Path2D();
    const lightFibers = new Path2D();
    for (let i = 0; i < 700; i++) {
      const x = Math.random() * 1024;
      const targetPath = Math.random() > 0.4 ? darkFibers : lightFibers;
      targetPath.moveTo(x, 0);
      targetPath.bezierCurveTo(
        x + (Math.random() - 0.5) * 22, 340,
        x + (Math.random() - 0.5) * 22, 680,
        x + (Math.random() - 0.5) * 14, 1024
      );
    }
    ctx.strokeStyle = 'rgba(4, 4, 4, 0.22)';
    ctx.lineWidth = 1.6;
    ctx.stroke(darkFibers);

    ctx.strokeStyle = 'rgba(60, 60, 60, 0.16)';
    ctx.lineWidth = 1.8;
    ctx.stroke(lightFibers);

    // 4. Hardwood Vessel Element Pores
    ctx.fillStyle = 'rgba(3, 3, 3, 0.35)';
    for (let p = 0; p < 700; p++) {
      const px = Math.random() * 1024;
      const py = Math.random() * 1024;
      ctx.fillRect(px, py, 1.2, 3.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

// Generate physical wood grain Bump & Micro-Pore Map (Tactile Surface Depth) - OPTIMIZED BATCHED
const createWoodBumpMap = (): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Neutral 50% gray base
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 1024, 1024);

  // 2. Batched longitudinal fiber valleys
  const valleyPaths = new Path2D();
  const ridgePaths = new Path2D();
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 1024;
    const targetPath = Math.random() > 0.4 ? valleyPaths : ridgePaths;
    targetPath.moveTo(x, 0);
    targetPath.bezierCurveTo(
      x + (Math.random() - 0.5) * 20, 340,
      x + (Math.random() - 0.5) * 20, 680,
      x + (Math.random() - 0.5) * 12, 1024
    );
  }
  ctx.strokeStyle = 'rgba(20, 20, 20, 0.12)';
  ctx.lineWidth = 1.4;
  ctx.stroke(valleyPaths);

  ctx.strokeStyle = 'rgba(235, 235, 235, 0.10)';
  ctx.lineWidth = 1.4;
  ctx.stroke(ridgePaths);

  // 3. Batched horizontal faint groove rings
  const ringsPath = new Path2D();
  for (let y = 0; y < 1024; y += 16) {
    ringsPath.moveTo(0, y);
    ringsPath.lineTo(1024, y);
  }
  ctx.strokeStyle = 'rgba(50, 50, 50, 0.03)';
  ctx.lineWidth = 1.0;
  ctx.stroke(ringsPath);

  // 4. High-frequency wood pore indentations
  ctx.fillStyle = 'rgba(10, 10, 10, 0.28)';
  for (let p = 0; p < 800; p++) {
    const px = Math.random() * 1024;
    const py = Math.random() * 1024;
    ctx.fillRect(px, py, 1.2, 3.0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

// Generate physical wood Roughness Variation Map (Refined Matte Finish) - OPTIMIZED BATCHED
const createWoodRoughnessMap = (): THREE.CanvasTexture | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base soft matte wood roughness ~0.90
  ctx.fillStyle = '#e6e6e6';
  ctx.fillRect(0, 0, 512, 512);

  // Batched subtle natural wood fiber roughness variations
  const roughPath = new Path2D();
  const smoothPath = new Path2D();
  for (let i = 0; i < 250; i++) {
    const x = Math.random() * 512;
    const targetPath = Math.random() > 0.5 ? roughPath : smoothPath;
    targetPath.moveTo(x, 0);
    targetPath.bezierCurveTo(
      x + (Math.random() - 0.5) * 16, 170,
      x + (Math.random() - 0.5) * 16, 340,
      x + (Math.random() - 0.5) * 10, 512
    );
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.6;
  ctx.stroke(roughPath);

  ctx.strokeStyle = 'rgba(185, 185, 185, 0.12)';
  ctx.lineWidth = 1.6;
  ctx.stroke(smoothPath);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

// Cached Textures
const whiteWoodMap = typeof document !== 'undefined' ? createWoodDiffuseMap(true) : null;
const blackWoodMap = typeof document !== 'undefined' ? createWoodDiffuseMap(false) : null;
const woodBumpMap = typeof document !== 'undefined' ? createWoodBumpMap() : null;
const woodRoughnessMap = typeof document !== 'undefined' ? createWoodRoughnessMap() : null;

// PBR Realistic Solid Wood Materials (Soft Handcrafted Matte Finish)
const whiteWoodMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#f0e2cc'), // Select natural light boxwood / honey maple
  map: whiteWoodMap || undefined,
  bumpMap: woodBumpMap || undefined,
  bumpScale: 0.012, // Subtle tactile wood grain depth
  roughnessMap: woodRoughnessMap || undefined,
  roughness: 0.64, // Soft matte finish (zero harsh plastic glare or specular shine)
  metalness: 0.0,
});

const blackWoodMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#ffffff'), // Pure 1:1 reproduction of the Coal Black (#232323) wood map
  map: blackWoodMap || undefined,
  bumpMap: woodBumpMap || undefined,
  bumpScale: 0.012, // Subtle tactile wood grain depth
  roughnessMap: woodRoughnessMap || undefined,
  roughness: 0.58, // Velvety soft matte finish with elegant diffuse edge roll-off
  metalness: 0.0,
});

// Tournament Emerald Forest Green Billiard Baize Felt Base Pad
const emeraldFeltMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#143e18'),
  roughness: 0.95,
  metalness: 0.0,
});

// Chiseled shadow groove material for physical carved reliefs & mortar cuts
const shadowGrooveMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#050505'), // Deep carbon black for sharp carved relief contrast
  roughness: 0.95,
  metalness: 0.0,
});

interface ChessPiece3DProps {
  id: string;
  type: PieceType;
  color: PieceColor;
  square: string;
  isFloatingBoard?: boolean;
}

// Convert chess square ('e4') to 3D world coordinates
function squareToCoords(square: string): [number, number, number] {
  if (!square || square.length < 2) return [0, 0, 0];
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1], 10) - 1;
  const x = file - 3.5;
  const z = 3.5 - rank;
  return [x, 0, z];
}

// ==================================================================================
// PIECE PROFILES & PROCEDURAL HELICAL GEOMETRIES
// ==================================================================================

// 1. Pawn Lathe Profile (Height: 1.08, Base Radius: 0.38)
const createPawnProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(0.38, 0));
  pts.push(new THREE.Vector2(0.38, 0.04));
  pts.push(new THREE.Vector2(0.355, 0.065));
  pts.push(new THREE.Vector2(0.34, 0.085)); // Scotia recess
  pts.push(new THREE.Vector2(0.36, 0.115)); // Torus bead
  pts.push(new THREE.Vector2(0.325, 0.14)); // Step fillet
  pts.push(new THREE.Vector2(0.28, 0.185)); // Concave ogee
  pts.push(new THREE.Vector2(0.22, 0.26));
  pts.push(new THREE.Vector2(0.17, 0.39));
  pts.push(new THREE.Vector2(0.135, 0.53)); // Slender waist
  pts.push(new THREE.Vector2(0.155, 0.67));
  pts.push(new THREE.Vector2(0.20, 0.74));
  pts.push(new THREE.Vector2(0.235, 0.78)); // Decorative collar band
  pts.push(new THREE.Vector2(0.175, 0.81));
  pts.push(new THREE.Vector2(0.21, 0.84));
  pts.push(new THREE.Vector2(0.135, 0.865));

  // Naturally rounded sphere head
  const cy = 1.01;
  const r = 0.188;
  for (let i = 0; i <= 16; i++) {
    const a = -0.92 + (i / 16) * (Math.PI / 2 + 0.92);
    pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), cy + r * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, cy + r));
  return pts;
};

// 2. Rook Castle Bastion Lathe Profile (Height: 1.38, Base Radius: 0.42)
const createRookProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(0.42, 0));
  pts.push(new THREE.Vector2(0.42, 0.05));
  pts.push(new THREE.Vector2(0.395, 0.08));
  pts.push(new THREE.Vector2(0.38, 0.12));
  pts.push(new THREE.Vector2(0.34, 0.165));
  pts.push(new THREE.Vector2(0.31, 0.23));
  pts.push(new THREE.Vector2(0.285, 0.46));
  pts.push(new THREE.Vector2(0.275, 0.72));
  pts.push(new THREE.Vector2(0.27, 0.96));
  pts.push(new THREE.Vector2(0.30, 1.03));
  pts.push(new THREE.Vector2(0.37, 1.085)); // Flared corbel moulding
  pts.push(new THREE.Vector2(0.38, 1.13));
  pts.push(new THREE.Vector2(0.375, 1.18));
  pts.push(new THREE.Vector2(0.37, 1.38)); // Top of battlements
  pts.push(new THREE.Vector2(0.265, 1.38));
  pts.push(new THREE.Vector2(0.265, 1.09)); // Inner turret wall
  pts.push(new THREE.Vector2(0, 1.09)); // Inner roof deck
  return pts;
};

// 3. Bishop Lathe Profile (Height: 1.72, Base Radius: 0.42)
const createBishopProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(0.42, 0));
  pts.push(new THREE.Vector2(0.42, 0.05));
  pts.push(new THREE.Vector2(0.39, 0.08));
  pts.push(new THREE.Vector2(0.37, 0.12));
  pts.push(new THREE.Vector2(0.33, 0.17));
  pts.push(new THREE.Vector2(0.28, 0.25));
  pts.push(new THREE.Vector2(0.215, 0.40));
  pts.push(new THREE.Vector2(0.155, 0.60)); // Slender waist
  pts.push(new THREE.Vector2(0.175, 0.80));
  pts.push(new THREE.Vector2(0.235, 0.91));
  pts.push(new THREE.Vector2(0.27, 0.955)); // Double collar bead 1
  pts.push(new THREE.Vector2(0.215, 0.995));
  pts.push(new THREE.Vector2(0.245, 1.035)); // Double collar bead 2
  pts.push(new THREE.Vector2(0.165, 1.075));

  // Proper ovoid mitre-shaped head curve
  pts.push(new THREE.Vector2(0.225, 1.13));
  pts.push(new THREE.Vector2(0.27, 1.25)); // Widest point of mitre
  pts.push(new THREE.Vector2(0.265, 1.38));
  pts.push(new THREE.Vector2(0.22, 1.49));
  pts.push(new THREE.Vector2(0.14, 1.58));
  pts.push(new THREE.Vector2(0.07, 1.615));

  // Apex ball finial
  const fcy = 1.675;
  const fr = 0.076;
  for (let i = 0; i <= 12; i++) {
    const a = -0.72 + (i / 12) * (Math.PI / 2 + 0.72);
    pts.push(new THREE.Vector2(Math.max(0, fr * Math.cos(a)), fcy + fr * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, fcy + fr));
  return pts;
};

// 4. Queen Base Trumpet Profile (y: 0 -> 0.38)
const createQueenBaseProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(0.44, 0));
  pts.push(new THREE.Vector2(0.44, 0.06));
  pts.push(new THREE.Vector2(0.41, 0.10));
  pts.push(new THREE.Vector2(0.38, 0.145));
  pts.push(new THREE.Vector2(0.33, 0.205));
  pts.push(new THREE.Vector2(0.28, 0.29));
  pts.push(new THREE.Vector2(0.225, 0.38));
  pts.push(new THREE.Vector2(0, 0.38));
  return pts;
};

// 4. Queen Crown & Capital Profile (y: 1.14 -> 1.46)
const createQueenCrownProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 1.14));
  pts.push(new THREE.Vector2(0.23, 1.14));
  pts.push(new THREE.Vector2(0.265, 1.185)); // Turned collar ring
  pts.push(new THREE.Vector2(0.22, 1.225));
  pts.push(new THREE.Vector2(0.25, 1.285));
  pts.push(new THREE.Vector2(0.315, 1.38));
  pts.push(new THREE.Vector2(0.365, 1.46)); // Flared coronet rim
  pts.push(new THREE.Vector2(0.315, 1.46));
  pts.push(new THREE.Vector2(0.18, 1.35));
  pts.push(new THREE.Vector2(0, 1.33));
  return pts;
};

// Helical Ribbon Geometry for Queen's Openwork Spiral Stem
const createQueenHelicalRibbon = (strandIndex: number, totalStrands: number = 4): THREE.BufferGeometry => {
  const points: THREE.Vector3[] = [];
  const startY = 0.38;
  const endY = 1.14;
  const height = endY - startY;
  const steps = 36;
  const baseAngle = (strandIndex * Math.PI * 2) / totalStrands;
  const totalTurns = 1.18 * Math.PI * 2; // ~1.18 graceful twists

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = startY + t * height;
    // Elegant concave waist curve: r ~0.205 at ends, ~0.16 at waist (t=0.5)
    const r = 0.16 + 0.045 * Math.pow(2 * t - 1, 2);
    const angle = baseAngle + t * totalTurns;
    const x = Math.sin(angle) * r;
    const z = Math.cos(angle) * r;
    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 32, 0.044, 12, false);
  geo.computeVertexNormals();
  return geo;
};

// 5. King Lathe Profile (Height: 2.22, Base Radius: 0.46)
const createKingProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(0.46, 0));
  pts.push(new THREE.Vector2(0.46, 0.06));
  pts.push(new THREE.Vector2(0.43, 0.10));
  pts.push(new THREE.Vector2(0.40, 0.145));
  pts.push(new THREE.Vector2(0.35, 0.205));
  pts.push(new THREE.Vector2(0.30, 0.29));
  pts.push(new THREE.Vector2(0.245, 0.54));
  pts.push(new THREE.Vector2(0.205, 0.84)); // Majestic waist
  pts.push(new THREE.Vector2(0.235, 1.14));
  pts.push(new THREE.Vector2(0.315, 1.30));
  pts.push(new THREE.Vector2(0.355, 1.35)); // Capital collar
  pts.push(new THREE.Vector2(0.275, 1.40));
  pts.push(new THREE.Vector2(0.305, 1.45));
  pts.push(new THREE.Vector2(0.265, 1.50));

  // Imperial crown cup & dome
  pts.push(new THREE.Vector2(0.345, 1.57));
  pts.push(new THREE.Vector2(0.395, 1.70));
  pts.push(new THREE.Vector2(0.375, 1.725));
  pts.push(new THREE.Vector2(0.325, 1.745));
  pts.push(new THREE.Vector2(0.265, 1.77));
  pts.push(new THREE.Vector2(0.185, 1.85)); // Crown cushion dome
  pts.push(new THREE.Vector2(0.085, 1.89));
  pts.push(new THREE.Vector2(0, 1.90));
  return pts;
};

// 6. Knight Pedestal Base Profile
const createKnightBaseProfile = (): THREE.Vector2[] => {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(0.42, 0));
  pts.push(new THREE.Vector2(0.42, 0.05));
  pts.push(new THREE.Vector2(0.39, 0.09));
  pts.push(new THREE.Vector2(0.36, 0.14));
  pts.push(new THREE.Vector2(0.30, 0.20));
  pts.push(new THREE.Vector2(0.25, 0.25));
  pts.push(new THREE.Vector2(0.23, 0.28));
  pts.push(new THREE.Vector2(0, 0.28));
  return pts;
};

// Sweeping Spiral Diagonal Groove Curve for Bishop's Stem
const createBishopSpiralGroove = (): THREE.BufferGeometry => {
  const points: THREE.Vector3[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = 0.90 - t * 0.58; // from 0.90 down to 0.32
    // Stem profile radius at y:
    const r = 0.165 + 0.13 * Math.pow(t, 1.35); // flares outward towards base
    const angle = 0.25 + t * 1.85; // sweeps around ~105 degrees
    points.push(new THREE.Vector3(Math.sin(angle) * (r + 0.005), y, Math.cos(angle) * (r + 0.005)));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 24, 0.016, 8, false);
  geo.computeVertexNormals();
  return geo;
};

// ==================================================================================
// MODULE-LEVEL SINGLETON GEOMETRIES (SHARED ACROSS ALL 32 CHESS PIECES)
// Created exactly once at bundle evaluation; prevents re-allocating 800+ geometry
// buffers during piece rendering and guarantees 100% smooth, instant board setup.
// ==================================================================================
const geoCache = typeof document !== 'undefined' ? {
  // Felt pads
  pawnFelt: new THREE.CylinderGeometry(0.375, 0.375, 0.01, 32),
  majorFelt: new THREE.CylinderGeometry(0.415, 0.415, 0.01, 32),
  queenFelt: new THREE.CylinderGeometry(0.435, 0.435, 0.01, 32),
  kingFelt: new THREE.CylinderGeometry(0.455, 0.455, 0.01, 32),

  // Pawn
  pawnLathe: (() => {
    const geo = new THREE.LatheGeometry(createPawnProfile(), 48);
    geo.computeVertexNormals();
    return geo;
  })(),
  pawnStud: new THREE.SphereGeometry(0.026, 12, 10),
  pawnSkirtNotch: new THREE.BoxGeometry(0.032, 0.075, 0.025),

  // Rook
  rookLathe: (() => {
    const geo = new THREE.LatheGeometry(createRookProfile(), 48);
    geo.computeVertexNormals();
    return geo;
  })(),
  rookBattleBox: new THREE.BoxGeometry(0.11, 0.20, 0.24),
  rookEmbrasureGroove: new THREE.BoxGeometry(0.022, 0.18, 0.01),
  rookMortarRing: new THREE.TorusGeometry(0.276, 0.008, 8, 36),
  rookBrickJoint: new THREE.BoxGeometry(0.012, 0.14, 0.012),
  rookCornerPilaster: new THREE.BoxGeometry(0.038, 0.72, 0.022),
  rookPlinthNotch: new THREE.BoxGeometry(0.042, 0.11, 0.028),

  // Knight
  knightBase: (() => {
    const geo = new THREE.LatheGeometry(createKnightBaseProfile(), 48);
    geo.computeVertexNormals();
    return geo;
  })(),
  knightNeck: new THREE.CylinderGeometry(0.165, 0.24, 0.70, 28),
  knightShoulder: new THREE.SphereGeometry(0.22, 24, 18),
  knightShoulderFurrow: new THREE.BoxGeometry(0.012, 0.18, 0.16),
  knightCheek: new THREE.SphereGeometry(0.185, 24, 18),
  knightMuzzle: new THREE.CylinderGeometry(0.115, 0.19, 0.45, 24),
  knightMuzzleTip: new THREE.SphereGeometry(0.11, 20, 16),
  knightMouthNotch: new THREE.BoxGeometry(0.045, 0.025, 0.07),
  knightNostril: new THREE.BoxGeometry(0.016, 0.03, 0.036),
  knightEyeSocket: new THREE.SphereGeometry(0.034, 14, 10),
  knightEyePupil: new THREE.BoxGeometry(0.018, 0.038, 0.045),
  knightCombManeBox: [0, 1, 2, 3, 4, 5, 6, 7].map((mIdx) => {
    const scaleW = 0.084 - (mIdx / 7) * 0.014;
    return new THREE.BoxGeometry(scaleW, 0.095, 0.19);
  }),
  knightCombManeShadow: [0, 1, 2, 3, 4, 5, 6, 7].map((mIdx) => {
    const scaleW = 0.084 - (mIdx / 7) * 0.014;
    return new THREE.BoxGeometry(scaleW + 0.006, 0.014, 0.195);
  }),
  knightHeadCrown: new THREE.SphereGeometry(0.078, 18, 14),
  knightEar: new THREE.ConeGeometry(0.045, 0.19, 14),

  // Bishop
  bishopLathe: (() => {
    const geo = new THREE.LatheGeometry(createBishopProfile(), 48);
    geo.computeVertexNormals();
    return geo;
  })(),
  bishopSpiralGroove: createBishopSpiralGroove(),
  bishopTeardropLoop: new THREE.TorusGeometry(0.092, 0.011, 8, 24),
  bishopMitreSlit: new THREE.BoxGeometry(0.036, 0.30, 0.14),

  // Queen
  queenBase: (() => {
    const geo = new THREE.LatheGeometry(createQueenBaseProfile(), 48);
    geo.computeVertexNormals();
    return geo;
  })(),
  queenCrown: (() => {
    const geo = new THREE.LatheGeometry(createQueenCrownProfile(), 48);
    geo.computeVertexNormals();
    return geo;
  })(),
  queenSpindle: new THREE.CylinderGeometry(0.05, 0.05, 0.76, 14),
  queenRibbons: [0, 1, 2, 3].map((i) => createQueenHelicalRibbon(i, 4)),
  queenSpire: new THREE.ConeGeometry(0.048, 0.22, 4),
  queenPearl: new THREE.SphereGeometry(0.088, 18, 14),

  // King
  kingLathe: (() => {
    const geo = new THREE.LatheGeometry(createKingProfile(), 48);
    geo.computeVertexNormals();
    return geo;
  })(),
  kingVerticalRib: new THREE.BoxGeometry(0.038, 0.58, 0.022),
  kingChamferCut: new THREE.BoxGeometry(0.038, 0.22, 0.022),
  kingShadowRib: new THREE.BoxGeometry(0.014, 0.62, 0.008),
  kingSkirtGroove: new THREE.BoxGeometry(0.045, 0.10, 0.03),
  kingCrownGroove: new THREE.BoxGeometry(0.025, 0.20, 0.025),
  kingCrossCollar: new THREE.CylinderGeometry(0.065, 0.08, 0.05, 18),
  kingCrossPost: new THREE.BoxGeometry(0.076, 0.28, 0.062),
  kingCrossBar: new THREE.BoxGeometry(0.24, 0.076, 0.062),
  kingCrossCapTop: new THREE.BoxGeometry(0.10, 0.03, 0.072),
  kingCrossCapSide: new THREE.BoxGeometry(0.03, 0.10, 0.072),
} : null;

// ==================================================================================
// PIECE GEOMETRY COMPONENT (Zero allocation on render, instant shared singletons)
// ==================================================================================
function PieceGeometry({ type, mat }: { type: PieceType; mat: THREE.Material }) {
  if (!geoCache) return null;

  switch (type) {
    case 'p': { // ================= PAWN =================
      return (
        <group>
          {/* Emerald Green Baize Felt Pad */}
          <mesh geometry={geoCache.pawnFelt} material={emeraldFeltMaterial} position={[0, 0.005, 0]} />
          {/* Lathe-Turned Hardwood Pawn Body */}
          <mesh geometry={geoCache.pawnLathe} material={mat} castShadow receiveShadow />

          {/* DECORATIVE STUDDED COLLAR RING (10 studs sharing single geometry) */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((sIdx) => {
            const angle = (sIdx * Math.PI * 2) / 10;
            const sx = Math.sin(angle) * 0.228;
            const sz = Math.cos(angle) * 0.228;
            return (
              <mesh key={sIdx} geometry={geoCache.pawnStud} material={mat} position={[sx, 0.795, sz]} castShadow receiveShadow />
            );
          })}

          {/* LOWER SKIRT VERTICAL PANEL CUTS (8 notches sharing single geometry) */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((pIdx) => {
            const angle = (pIdx * Math.PI * 2) / 8;
            const px = Math.sin(angle) * 0.342;
            const pz = Math.cos(angle) * 0.342;
            return (
              <mesh
                key={pIdx}
                geometry={geoCache.pawnSkirtNotch}
                material={shadowGrooveMaterial}
                position={[px, 0.115, pz]}
                rotation={[0, -angle, 0]}
              />
            );
          })}
        </group>
      );
    }
    case 'r': { // ================= ROOK =================
      return (
        <group>
          {/* Emerald Green Baize Felt Pad */}
          <mesh geometry={geoCache.majorFelt} material={emeraldFeltMaterial} position={[0, 0.005, 0]} />
          {/* Lathe-Turned Tower Body */}
          <mesh geometry={geoCache.rookLathe} material={mat} castShadow receiveShadow />

          {/* 4 Crenellated Square Battlements */}
          {[0, 1, 2, 3].map((mIdx) => {
            const angle = (mIdx * Math.PI) / 2;
            const mx = Math.sin(angle) * 0.315;
            const mz = Math.cos(angle) * 0.315;
            return (
              <group key={mIdx} position={[mx, 1.28, mz]} rotation={[0, -angle, 0]}>
                <mesh geometry={geoCache.rookBattleBox} material={mat} castShadow receiveShadow />
                <mesh geometry={geoCache.rookEmbrasureGroove} material={shadowGrooveMaterial} position={[0, 0, 0.122]} />
              </group>
            );
          })}

          {/* 4 Horizontal Mortar Course Rings */}
          {[0.44, 0.60, 0.76, 0.92].map((hy, cIdx) => (
            <mesh key={cIdx} geometry={geoCache.rookMortarRing} material={shadowGrooveMaterial} position={[0, hy, 0]} rotation={[Math.PI / 2, 0, 0]} />
          ))}

          {/* Staggered Vertical Brick Mortar Joints */}
          {[0.52, 0.68, 0.84].map((vy, rowIdx) => {
            const offsetAngle = rowIdx % 2 === 0 ? 0 : Math.PI / 8;
            return (
              <group key={rowIdx}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((bIdx) => {
                  const bAngle = (bIdx * Math.PI * 2) / 8 + offsetAngle;
                  const bx = Math.sin(bAngle) * 0.277;
                  const bz = Math.cos(bAngle) * 0.277;
                  return (
                    <mesh
                      key={bIdx}
                      geometry={geoCache.rookBrickJoint}
                      material={shadowGrooveMaterial}
                      position={[bx, vy, bz]}
                      rotation={[0, -bAngle, 0]}
                    />
                  );
                })}
              </group>
            );
          })}

          {/* 4 Vertical Corner Pilasters */}
          {[0, 1, 2, 3].map((fIdx) => {
            const fAngle = (fIdx * Math.PI) / 2 + Math.PI / 4;
            const fx = Math.sin(fAngle) * 0.28;
            const fz = Math.cos(fAngle) * 0.28;
            return (
              <mesh
                key={fIdx}
                geometry={geoCache.rookCornerPilaster}
                material={mat}
                position={[fx, 0.66, fz]}
                rotation={[0, -fAngle, 0]}
                castShadow
                receiveShadow
              />
            );
          })}

          {/* Lower Buttress Notches */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((pIdx) => {
            const pAngle = (pIdx * Math.PI * 2) / 8;
            const px = Math.sin(pAngle) * 0.365;
            const pz = Math.cos(pAngle) * 0.365;
            return (
              <mesh
                key={pIdx}
                geometry={geoCache.rookPlinthNotch}
                material={shadowGrooveMaterial}
                position={[px, 0.165, pz]}
                rotation={[0, -pAngle, 0]}
              />
            );
          })}
        </group>
      );
    }
    case 'n': { // ================= KNIGHT =================
      return (
        <group>
          {/* Emerald Green Baize Felt Pad */}
          <mesh geometry={geoCache.majorFelt} material={emeraldFeltMaterial} position={[0, 0.005, 0]} />
          {/* Turned Hardwood Pedestal Base */}
          <mesh geometry={geoCache.knightBase} material={mat} castShadow receiveShadow />

          {/* 1. Arched Muscular Neck */}
          <mesh geometry={geoCache.knightNeck} material={mat} position={[0, 0.63, -0.06]} rotation={[-0.24, 0, 0]} castShadow receiveShadow />
          {/* 2. Lower Shoulder Blend */}
          <mesh geometry={geoCache.knightShoulder} material={mat} position={[0, 0.43, 0.02]} scale={[1.1, 1.0, 1.25]} castShadow receiveShadow />
          {/* Left & Right Shoulder Furrows */}
          {[-0.18, 0.18].map((sx, i) => (
            <mesh key={i} geometry={geoCache.knightShoulderFurrow} material={shadowGrooveMaterial} position={[sx, 0.45, 0.02]} rotation={[0.4, 0, i === 0 ? -0.4 : 0.4]} />
          ))}
          {/* 3. Defined Cheek & Jowl Volume */}
          <mesh geometry={geoCache.knightCheek} material={mat} position={[0, 0.83, 0.07]} scale={[1.15, 1.0, 1.25]} castShadow receiveShadow />
          {/* 4. Sculpted Tapered Snout / Muzzle */}
          <mesh geometry={geoCache.knightMuzzle} material={mat} position={[0, 0.95, 0.16]} rotation={[0.42, 0, 0]} castShadow receiveShadow />
          {/* 5. Rounded Muzzle Tip with Carved Lip */}
          <mesh geometry={geoCache.knightMuzzleTip} material={mat} position={[0, 1.05, 0.28]} castShadow receiveShadow />
          <mesh geometry={geoCache.knightMouthNotch} material={shadowGrooveMaterial} position={[0, 1.03, 0.36]} />
          {/* 6. Flared Carved Nostrils */}
          {[-0.045, 0.045].map((nx, i) => (
            <mesh key={i} geometry={geoCache.knightNostril} material={shadowGrooveMaterial} position={[nx, 1.07, 0.33]} rotation={[0.2, i === 0 ? -0.2 : 0.2, 0]} />
          ))}
          {/* 7. Expressive Carved Eye Sockets */}
          {[-0.105, 0.105].map((ex, i) => (
            <group key={i} position={[ex, 0.99, 0.19]} rotation={[0, 0, i === 0 ? 0.35 : -0.35]}>
              <mesh geometry={geoCache.knightEyeSocket} material={mat} castShadow receiveShadow />
              <mesh geometry={geoCache.knightEyePupil} material={shadowGrooveMaterial} position={[0, 0, 0.01]} />
            </group>
          ))}
          {/* 8. CARVED WOODEN COMB MANE RIDGES */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((mIdx) => {
            const prog = mIdx / 7;
            const my = 0.52 + prog * 0.60;
            const mz = -0.16 - prog * 0.032;
            return (
              <group key={mIdx} position={[0, my, mz]} rotation={[0.18 + prog * 0.08, 0, 0]}>
                <mesh geometry={geoCache.knightCombManeBox[mIdx]} material={mat} castShadow receiveShadow />
                <mesh geometry={geoCache.knightCombManeShadow[mIdx]} material={shadowGrooveMaterial} position={[0, -0.048, 0]} />
              </group>
            );
          })}
          <mesh geometry={geoCache.knightHeadCrown} material={mat} position={[0, 1.12, -0.08]} castShadow receiveShadow />
          {/* 9. Alert Ears */}
          <mesh geometry={geoCache.knightEar} material={mat} position={[-0.08, 1.24, -0.02]} rotation={[0.24, 0, -0.22]} castShadow receiveShadow />
          <mesh geometry={geoCache.knightEar} material={mat} position={[0.08, 1.24, -0.02]} rotation={[0.24, 0, 0.22]} castShadow receiveShadow />
        </group>
      );
    }
    case 'b': { // ================= BISHOP =================
      return (
        <group>
          {/* Emerald Green Baize Felt Pad */}
          <mesh geometry={geoCache.majorFelt} material={emeraldFeltMaterial} position={[0, 0.005, 0]} />
          {/* Seamless Lathe-Turned Bishop Body */}
          <mesh geometry={geoCache.bishopLathe} material={mat} castShadow receiveShadow />
          {/* Sweeping Spiral Diagonal Groove */}
          <mesh geometry={geoCache.bishopSpiralGroove} material={shadowGrooveMaterial} />
          {/* Carved Teardrop Loops (Front & Back) */}
          <group position={[0, 1.32, 0.19]} rotation={[0.16, 0, 0]}>
            <mesh geometry={geoCache.bishopTeardropLoop} material={shadowGrooveMaterial} scale={[0.82, 1.38, 0.25]} />
          </group>
          <group position={[0, 1.32, -0.19]} rotation={[-0.16, Math.PI, 0]}>
            <mesh geometry={geoCache.bishopTeardropLoop} material={shadowGrooveMaterial} scale={[0.82, 1.38, 0.25]} />
          </group>
          {/* Diagonal Slit Cut */}
          <mesh
            geometry={geoCache.bishopMitreSlit}
            material={shadowGrooveMaterial}
            position={[0.088, 1.39, 0.088]}
            rotation={[0.62, 0.40, 0]}
          />
        </group>
      );
    }
    case 'q': { // ================= QUEEN =================
      return (
        <group>
          {/* Emerald Green Baize Felt Pad */}
          <mesh geometry={geoCache.queenFelt} material={emeraldFeltMaterial} position={[0, 0.005, 0]} />
          {/* 1. Flared Trumpet Base Pedestal */}
          <mesh geometry={geoCache.queenBase} material={mat} castShadow receiveShadow />
          {/* 2. Central Slender Spindle Core */}
          <mesh geometry={geoCache.queenSpindle} material={mat} position={[0, 0.76, 0]} castShadow receiveShadow />
          {/* 3. 4-Strand Helical Spiral Openwork Column */}
          {geoCache.queenRibbons.map((rGeo, idx) => (
            <mesh key={idx} geometry={rGeo} material={mat} castShadow receiveShadow />
          ))}
          {/* 4. Upper Turned Collar & Flared Coronet Bowl */}
          <mesh geometry={geoCache.queenCrown} material={mat} castShadow receiveShadow />
          {/* 5. 6 Sharp Triangular Carved Wooden Coronet Spires */}
          {[0, 1, 2, 3, 4, 5].map((pIdx) => {
            const angle = (pIdx * Math.PI * 2) / 6;
            const px = Math.cos(angle) * 0.355;
            const pz = Math.sin(angle) * 0.355;
            return (
              <group
                key={pIdx}
                position={[px, 1.48, pz]}
                rotation={[0.26 * Math.sin(angle), -angle, -0.26 * Math.cos(angle)]}
              >
                <mesh geometry={geoCache.queenSpire} material={mat} castShadow receiveShadow />
              </group>
            );
          })}
          {/* Central Polished Wooden Pearl Finial */}
          <mesh geometry={geoCache.queenPearl} material={mat} position={[0, 1.46, 0]} castShadow receiveShadow />
        </group>
      );
    }
    case 'k': { // ================= KING =================
      return (
        <group>
          {/* Emerald Green Baize Felt Pad */}
          <mesh geometry={geoCache.kingFelt} material={emeraldFeltMaterial} position={[0, 0.005, 0]} />
          {/* Lathe-Turned King Body */}
          <mesh geometry={geoCache.kingLathe} material={mat} castShadow receiveShadow />

          {/* Chiseled Facet Panels Along Column (8 facets) */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((fIdx) => {
            const fAngle = (fIdx * Math.PI * 2) / 8;
            const fx = Math.sin(fAngle) * 0.238;
            const fz = Math.cos(fAngle) * 0.238;
            return (
              <group key={fIdx} position={[fx, 0.82, fz]} rotation={[0, -fAngle, 0]}>
                <mesh geometry={geoCache.kingVerticalRib} material={mat} position={[0, 0, 0]} castShadow receiveShadow />
                <mesh geometry={geoCache.kingChamferCut} material={mat} position={[0, -0.32, -0.012]} rotation={[0.32, 0, 0]} castShadow receiveShadow />
                <mesh geometry={geoCache.kingShadowRib} material={shadowGrooveMaterial} position={[0, 0, 0.012]} />
              </group>
            );
          })}

          {/* 8 Vertical Facet Grooves Around Lower Skirt */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((sIdx) => {
            const sAngle = (sIdx * Math.PI * 2) / 8;
            const sx = Math.sin(sAngle) * 0.375;
            const sz = Math.cos(sAngle) * 0.375;
            return (
              <mesh
                key={sIdx}
                geometry={geoCache.kingSkirtGroove}
                material={shadowGrooveMaterial}
                position={[sx, 0.175, sz]}
                rotation={[0, -sAngle, 0]}
              />
            );
          })}

          {/* 8 Vertical Panel Grooves Around Crown Cup */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((cIdx) => {
            const cAngle = (cIdx * Math.PI * 2) / 8;
            const cx = Math.sin(cAngle) * 0.365;
            const cz = Math.cos(cAngle) * 0.365;
            return (
              <mesh
                key={cIdx}
                geometry={geoCache.kingCrownGroove}
                material={shadowGrooveMaterial}
                position={[cx, 1.62, cz]}
                rotation={[0, -cAngle, 0]}
              />
            );
          })}

          {/* Handcrafted Wooden Cross Finial */}
          <mesh geometry={geoCache.kingCrossCollar} material={mat} position={[0, 1.91, 0]} castShadow receiveShadow />
          <mesh geometry={geoCache.kingCrossPost} material={mat} position={[0, 2.06, 0]} castShadow receiveShadow />
          <mesh geometry={geoCache.kingCrossBar} material={mat} position={[0, 2.09, 0]} castShadow receiveShadow />
          <mesh geometry={geoCache.kingCrossCapTop} material={mat} position={[0, 2.21, 0]} castShadow receiveShadow />
          <mesh geometry={geoCache.kingCrossCapSide} material={mat} position={[-0.13, 2.09, 0]} castShadow receiveShadow />
          <mesh geometry={geoCache.kingCrossCapSide} material={mat} position={[0.13, 2.09, 0]} castShadow receiveShadow />
        </group>
      );
    }
    default:
      return null;
  }
}

export const ChessPiece3D: React.FC<ChessPiece3DProps> = ({ type, color, square }) => {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const selectedSquare = useGameStore((s) => s.selectedSquare);
  const selectSquare = useGameStore((s) => s.selectSquare);

  const isSelected = selectedSquare === square;

  // Solid Hardwood Material: Select Light Boxwood (White) vs Deep Roasted Walnut (Black)
  const material = color === 'w' ? whiteWoodMaterial : blackWoodMaterial;

  const [targetX, , targetZ] = useMemo(() => squareToCoords(square), [square]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.position.x = THREE.MathUtils.damp(meshRef.current.position.x, targetX, 14, delta);
    meshRef.current.position.z = THREE.MathUtils.damp(meshRef.current.position.z, targetZ, 14, delta);

    let targetY = 0.02;
    if (isSelected) targetY = 0.35;
    else if (hovered) targetY = 0.12;
    meshRef.current.position.y = THREE.MathUtils.damp(meshRef.current.position.y, targetY, 12, delta);

    if (type === 'n') {
      const targetRot = color === 'w' ? 0 : Math.PI;
      meshRef.current.rotation.y = THREE.MathUtils.damp(meshRef.current.rotation.y, targetRot, 10, delta);
    }
  });

  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);

  return (
    <group
      ref={meshRef}
      position={[targetX, 0.02, targetZ]}
      onPointerDown={(e) => {
        if (typeof window !== 'undefined' && window.__lastPinchEndTime && performance.now() - window.__lastPinchEndTime < 350) {
          return;
        }
        pointerDownRef.current = {
          x: e.clientX,
          y: e.clientY,
          time: performance.now(),
        };
      }}
      onPointerUp={(e) => {
        const start = pointerDownRef.current;
        pointerDownRef.current = null;
        if (!start) return;

        // If pinch gesture occurred recently, never select pieces accidentally
        if (typeof window !== 'undefined' && window.__lastPinchEndTime && performance.now() - window.__lastPinchEndTime < 350) {
          return;
        }

        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        const dt = performance.now() - start.time;
        // Tap detection: only select square if movement is small (< 12px) and short (< 400ms)
        // Deliberate drags/pinches rotate & zoom camera without accidentally selecting or moving pieces!
        if (Math.hypot(dx, dy) < 12 && dt < 400) {
          e.stopPropagation();
          selectSquare(square);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <PieceGeometry type={type} mat={material} />
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.48, 36]} />
          <meshBasicMaterial color="#d4af37" transparent opacity={0.88} />
        </mesh>
      )}
    </group>
  );
};
