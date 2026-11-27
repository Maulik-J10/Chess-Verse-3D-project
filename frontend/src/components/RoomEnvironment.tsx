import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ContactShadows } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';
import { mergeTransformedParts, NO_RAYCAST } from '../utils/geometryUtils';
import { detectDeviceCapabilities } from '../utils/deviceTier';

// ==================================================================================
// SHARED ROOM CONSTANTS (Expanded 36m x 36m x 16.8m Stately Gallery Architecture)
// Gives generous headroom & wall clearance so camera NEVER exits walls, hits ceiling/strip lights,
// or crops board corners on portrait phones while keeping desktop framing intact.
// ==================================================================================
export const ROOM_HALF_SIZE = 18.0;
export const ROOM_SIZE = 36.0;
export const ROOM_HEIGHT = 16.8;
export const CORNER_CHANDELIER_OFFSET = 12.8;

// Shared texture caches across mounts (prevents CPU re-bakes on navigation/remount)
const wallArtworkTextureCache = new Map<string, THREE.CanvasTexture>();
const rugTextureCache = new Map<number, THREE.CanvasTexture>();
interface OakFloorTextures {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}
const oakTextureCache = new Map<number, OakFloorTextures>();

// Singleton shared materials & merged geometries for WallArtwork frames
const wallArtStatic = typeof document !== 'undefined' ? (() => {
  const frameMat = new THREE.MeshStandardMaterial({ color: '#16171a', metalness: 0.4, roughness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#d4af37',
    metalness: 0.94,
    roughness: 0.16,
    emissive: '#6e4d0d',
    emissiveIntensity: 0.3,
  });
  const backMat = new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.9 });

  const width = 3.8;
  const height = 5.0;

  // Merge all 4 dark shadowbox frame bars into 1 draw call
  const hBar = new THREE.BoxGeometry(width + 0.16, 0.08, 0.08);
  const vBar = new THREE.BoxGeometry(0.08, height, 0.08);
  const outerFrameGeo = mergeTransformedParts([
    { geo: hBar, pos: [0, (height + 0.08) / 2, 0.01] },
    { geo: hBar, pos: [0, -(height + 0.08) / 2, 0.01] },
    { geo: vBar, pos: [-(width + 0.08) / 2, 0, 0.01] },
    { geo: vBar, pos: [(width + 0.08) / 2, 0, 0.01] },
  ]);
  hBar.dispose();
  vBar.dispose();

  // Merge all 4 inner gold reveal bars into 1 draw call
  const ghBar = new THREE.BoxGeometry(width + 0.08, 0.04, 0.025);
  const gvBar = new THREE.BoxGeometry(0.04, height + 0.08, 0.025);
  const goldTrimGeo = mergeTransformedParts([
    { geo: ghBar, pos: [0, (height + 0.04) / 2, 0.038] },
    { geo: ghBar, pos: [0, -(height + 0.04) / 2, 0.038] },
    { geo: gvBar, pos: [-(width + 0.04) / 2, 0, 0.038] },
    { geo: gvBar, pos: [(width + 0.04) / 2, 0, 0.038] },
  ]);
  ghBar.dispose();
  gvBar.dispose();

  const backGeo = new THREE.PlaneGeometry(width + 0.08, height + 0.08);
  const faceGeo = new THREE.PlaneGeometry(width, height);

  return { frameMat, goldMat, backMat, outerFrameGeo, goldTrimGeo, backGeo, faceGeo };
})() : null;

// ==================================================================================
// MAIN CENTRAL WALL ARTWORK — Preserved untouched ("STAY SIMPLE / STAY TRUE" etc.)
// ==================================================================================
interface WallArtworkProps {
  headingLine1: string;
  headingLine2: string;
  headingLine3: string;
  headingLine4: string;
  position: [number, number, number];
  rotation: [number, number, number];
  showAccentSpotLight?: boolean;
}

const WallArtwork: React.FC<WallArtworkProps> = ({
  headingLine1,
  headingLine2,
  headingLine3,
  headingLine4,
  position,
  rotation,
  showAccentSpotLight = false,
}) => {
  const canvasTexture = useMemo(() => {
    const caps = detectDeviceCapabilities();
    const scale = caps.isLowEndHardware ? 0.25 : caps.isTouch ? 0.36 : 0.48;
    const cacheKey = `${headingLine1}_${headingLine2}_${headingLine3}_${headingLine4}_${scale}`;
    if (wallArtworkTextureCache.has(cacheKey)) {
      return wallArtworkTextureCache.get(cacheKey)!;
    }

    const baseW = 1200;
    const baseH = 1575;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(baseW * scale);
    canvas.height = Math.round(baseH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);

    // 1. Deep matte black background
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, 0, baseW, baseH);

    // 2. Lightweight subtle linen weave
    ctx.fillStyle = 'rgba(32, 33, 38, 0.38)';
    for (let x = 0; x < baseW; x += 36) {
      ctx.fillRect(x, 0, 3, baseH);
    }
    ctx.fillStyle = 'rgba(22, 23, 26, 0.22)';
    for (let y = 0; y < baseH; y += 44) {
      ctx.fillRect(0, y, baseW, 2);
    }

    // 3. Ambient vignette
    const vignette = ctx.createRadialGradient(baseW * 0.5, baseH * 0.45, 120, baseW * 0.5, baseH * 0.5, 820);
    vignette.addColorStop(0, 'rgba(32, 33, 38, 0.35)');
    vignette.addColorStop(1, 'rgba(4, 4, 6, 0.88)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, baseW, baseH);

    // 4. Double Gold Boundary Pinstripes
    const goldBorderGrad = ctx.createLinearGradient(0, 0, baseW, baseH);
    goldBorderGrad.addColorStop(0.0, '#cca044');
    goldBorderGrad.addColorStop(0.25, '#fae19d');
    goldBorderGrad.addColorStop(0.5, '#e4bb5a');
    goldBorderGrad.addColorStop(0.75, '#b9872e');
    goldBorderGrad.addColorStop(1.0, '#f2d68a');

    ctx.strokeStyle = goldBorderGrad;
    ctx.lineWidth = 11;
    ctx.strokeRect(27, 27, baseW - 54, baseH - 54);

    ctx.lineWidth = 3;
    ctx.strokeRect(44, 44, baseW - 88, baseH - 88);

    // 5. Staggered Metallic Gold Typography (crisp 1-pass dark offset shadow instead of expensive CPU shadowBlur)
    const baseFontSize = 122;
    const lineHeight = 146;
    const topStart = 338;
    const leftColX = 139;
    const rightColX = 495;
    const safeRightEdge = 1050;

    const renderGoldLine = (text: string, defaultX: number, y: number, isRightCol: boolean) => {
      let lineFontSize = baseFontSize;
      ctx.font = `700 ${lineFontSize}px "Didot", "Bodoni MT", "Playfair Display", "Times New Roman", serif`;
      ctx.letterSpacing = '3px';
      ctx.textBaseline = 'top';

      let textWidth = ctx.measureText(text).width;
      const maxAvailableWidth = safeRightEdge - defaultX;

      if (textWidth > maxAvailableWidth) {
        lineFontSize = Math.floor(lineFontSize * (maxAvailableWidth / textWidth) * 0.95);
        ctx.font = `700 ${lineFontSize}px "Didot", "Bodoni MT", "Playfair Display", "Times New Roman", serif`;
        textWidth = ctx.measureText(text).width;
      }

      let drawX = defaultX;
      if (isRightCol && drawX + textWidth > safeRightEdge) {
        drawX = safeRightEdge - textWidth;
      }

      const goldGrad = ctx.createLinearGradient(drawX - 22, y - 22, drawX + textWidth + 75, y + 150);
      goldGrad.addColorStop(0.0, '#cca044');
      goldGrad.addColorStop(0.25, '#fae19d');
      goldGrad.addColorStop(0.5, '#e4bb5a');
      goldGrad.addColorStop(0.75, '#b9872e');
      goldGrad.addColorStop(1.0, '#f2d68a');

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillText(text, drawX + 4, y + 5);

      ctx.fillStyle = goldGrad;
      ctx.fillText(text, drawX, y);
    };

    renderGoldLine(headingLine1, leftColX, topStart, false);
    renderGoldLine(headingLine2, leftColX, topStart + lineHeight, false);
    renderGoldLine(headingLine3, rightColX, topStart + lineHeight * 2, true);
    renderGoldLine(headingLine4, rightColX, topStart + lineHeight * 3, true);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    wallArtworkTextureCache.set(cacheKey, texture);
    return texture;
  }, [headingLine1, headingLine2, headingLine3, headingLine4]);

  if (!wallArtStatic) return null;

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={wallArtStatic.outerFrameGeo} material={wallArtStatic.frameMat} raycast={NO_RAYCAST} />
      <mesh geometry={wallArtStatic.goldTrimGeo} material={wallArtStatic.goldMat} raycast={NO_RAYCAST} />
      <mesh position={[0, 0, -0.02]} geometry={wallArtStatic.backGeo} material={wallArtStatic.backMat} raycast={NO_RAYCAST} />
      <mesh position={[0, 0, 0.025]} renderOrder={10} geometry={wallArtStatic.faceGeo} raycast={NO_RAYCAST}>
        {canvasTexture && (
          <meshBasicMaterial
            map={canvasTexture}
            side={THREE.FrontSide}
            depthTest={true}
            depthWrite={true}
            polygonOffset={true}
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        )}
      </mesh>
      {showAccentSpotLight && (
        <spotLight
          position={[0, 3.7, 1.4]}
          target-position={[0, 0, 0]}
          color="#fff4db"
          intensity={1.8}
          angle={0.58}
          penumbra={0.65}
          distance={7.5}
        />
      )}
    </group>
  );
};

// ==================================================================================
// MODERN REDDISH-BROWN CREDENZA (Shared geometries & materials across all 4 walls)
// ==================================================================================
const credenzaStatic = typeof document !== 'undefined' ? (() => {
  const topMat = new THREE.MeshStandardMaterial({ color: '#7a2b1c', roughness: 0.32, metalness: 0.08 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#632215', roughness: 0.38, metalness: 0.08 });
  const grooveMat = new THREE.MeshStandardMaterial({ color: '#42140b', roughness: 0.7 });
  const handleMat = new THREE.MeshStandardMaterial({ color: '#9e3a22', metalness: 0.85, roughness: 0.22 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#591c10', metalness: 0.85, roughness: 0.25 });
  const marbleMat = new THREE.MeshStandardMaterial({ color: '#18181a', roughness: 0.2, metalness: 0.3 });
  const goldPinMat = new THREE.MeshStandardMaterial({ color: '#d4b058', metalness: 0.92, roughness: 0.15 });
  const goldKnotMat = new THREE.MeshStandardMaterial({ color: '#dfb858', metalness: 0.9, roughness: 0.16 });
  const bookDarkMat = new THREE.MeshStandardMaterial({ color: '#221712', roughness: 0.55 });
  const bookGreyMat = new THREE.MeshStandardMaterial({ color: '#363432', roughness: 0.5 });

  // Merge all cabinet grooves & pulls
  const groovePart = new THREE.BoxGeometry(0.01, 0.52, 0.004);
  const groovesGeo = mergeTransformedParts([-1.18, 0, 1.18].map((gx) => ({ geo: groovePart, pos: [gx, 0.65, 0.232] })));
  groovePart.dispose();

  const handlePart = new THREE.BoxGeometry(0.016, 0.16, 0.006);
  const handlesGeo = mergeTransformedParts([-1.18, 0, 1.18].map((gx) => ({ geo: handlePart, pos: [gx, 0.77, 0.235] })));
  handlePart.dispose();

  // Merge all blade legs into 1 geometry
  const postPart = new THREE.BoxGeometry(0.035, 0.72, 0.035);
  const runnerPart = new THREE.BoxGeometry(0.035, 0.035, 0.52);
  const legsGeo = mergeTransformedParts([
    { geo: postPart, pos: [-1.55, 0.38, 0.2] },
    { geo: postPart, pos: [-1.55, 0.38, -0.2] },
    { geo: runnerPart, pos: [-1.55, 0.03, 0] },
    { geo: postPart, pos: [1.55, 0.38, 0.2] },
    { geo: postPart, pos: [1.55, 0.38, -0.2] },
    { geo: runnerPart, pos: [1.55, 0.03, 0] },
  ]);
  postPart.dispose();
  runnerPart.dispose();

  const topGeo = new THREE.BoxGeometry(4.8, 0.035, 0.5);
  const bodyGeo = new THREE.BoxGeometry(4.74, 0.54, 0.46);
  const pedestalGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.12, 20);
  const pinGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 12);
  // Optimized TorusKnot segments (24x10 -> 75% fewer triangles while crisp at gallery distance)
  const ribbonKnotGeo = new THREE.TorusKnotGeometry(0.16, 0.032, 24, 10, 2, 3);
  const book1Geo = new THREE.BoxGeometry(0.46, 0.055, 0.32);
  const bookTrimGeo = new THREE.BoxGeometry(0.02, 0.05, 0.3);
  const book2Geo = new THREE.BoxGeometry(0.42, 0.048, 0.29);

  return {
    topMat, bodyMat, grooveMat, handleMat, legMat, marbleMat, goldPinMat, goldKnotMat, bookDarkMat, bookGreyMat,
    groovesGeo, handlesGeo, legsGeo, topGeo, bodyGeo, pedestalGeo, pinGeo, ribbonKnotGeo, book1Geo, bookTrimGeo, book2Geo,
  };
})() : null;

interface CredenzaProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

const Credenza: React.FC<CredenzaProps> = ({ position, rotation = [0, 0, 0] }) => {
  if (!credenzaStatic) return null;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.94, 0]} geometry={credenzaStatic.topGeo} material={credenzaStatic.topMat} raycast={NO_RAYCAST} />
      <mesh position={[0, 0.65, 0]} geometry={credenzaStatic.bodyGeo} material={credenzaStatic.bodyMat} raycast={NO_RAYCAST} />
      <mesh geometry={credenzaStatic.groovesGeo} material={credenzaStatic.grooveMat} raycast={NO_RAYCAST} />
      <mesh geometry={credenzaStatic.handlesGeo} material={credenzaStatic.handleMat} raycast={NO_RAYCAST} />
      <mesh geometry={credenzaStatic.legsGeo} material={credenzaStatic.legMat} raycast={NO_RAYCAST} />

      {/* 1. Gold Ribbon Sculpture on Dark Marble Pedestal */}
      <group position={[-1.5, 0.96, 0.02]}>
        <mesh position={[0, 0.06, 0]} geometry={credenzaStatic.pedestalGeo} material={credenzaStatic.marbleMat} raycast={NO_RAYCAST} />
        <mesh position={[0, 0.15, 0]} geometry={credenzaStatic.pinGeo} material={credenzaStatic.goldPinMat} raycast={NO_RAYCAST} />
        <mesh position={[0, 0.38, 0]} rotation={[0.4, 0.6, 0.2]} geometry={credenzaStatic.ribbonKnotGeo} material={credenzaStatic.goldKnotMat} raycast={NO_RAYCAST} />
      </group>

      {/* 2. Stack of Vintage Architectural Books */}
      <group position={[1.4, 0.96, 0.02]}>
        <mesh position={[0, 0.03, 0]} rotation={[0, 0.08, 0]} geometry={credenzaStatic.book1Geo} material={credenzaStatic.bookDarkMat} raycast={NO_RAYCAST} />
        <mesh position={[0.22, 0.03, 0]} rotation={[0, 0.08, 0]} geometry={credenzaStatic.bookTrimGeo} material={credenzaStatic.goldPinMat} raycast={NO_RAYCAST} />
        <mesh position={[0.02, 0.085, 0.01]} rotation={[0, -0.05, 0]} geometry={credenzaStatic.book2Geo} material={credenzaStatic.bookGreyMat} raycast={NO_RAYCAST} />
      </group>
    </group>
  );
};

// ==================================================================================
// SLENDER DESIGNER BRASS FLOOR LAMP (Merged static parts + warm glowing interior bulb)
// ==================================================================================
const floorLampStatic = typeof document !== 'undefined' ? (() => {
  const brassMat = new THREE.MeshStandardMaterial({ color: '#c6a45c', metalness: 0.88, roughness: 0.2 });
  const shadeGlowMat = new THREE.MeshBasicMaterial({ color: '#fff3d4' });

  const baseG = new THREE.CylinderGeometry(0.28, 0.3, 0.05, 22);
  const stemG = new THREE.CylinderGeometry(0.016, 0.016, 2.7, 12);
  const jointG = new THREE.SphereGeometry(0.028, 12, 10);
  const armG = new THREE.CylinderGeometry(0.014, 0.014, 0.52, 12);
  const shadeG = new THREE.CylinderGeometry(0.14, 0.24, 0.32, 22);

  const mergedLampGeo = mergeTransformedParts([
    { geo: baseG, pos: [0, 0.025, 0] },
    { geo: stemG, pos: [0, 1.4, 0] },
    { geo: jointG, pos: [0, 2.75, 0] },
    { geo: armG, pos: [0.26, 2.75, 0], rot: [0, 0, Math.PI / 2] },
    { geo: shadeG, pos: [0.52, 2.6, 0] },
  ]);
  baseG.dispose();
  stemG.dispose();
  jointG.dispose();
  armG.dispose();
  shadeG.dispose();

  const bulbDiscGeo = new THREE.CircleGeometry(0.21, 16);

  return { brassMat, shadeGlowMat, mergedLampGeo, bulbDiscGeo };
})() : null;

interface FloorLampProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  showLight?: boolean;
}

const FloorLamp: React.FC<FloorLampProps> = ({ position, rotation = [0, 0, 0], showLight = false }) => {
  if (!floorLampStatic) return null;
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={floorLampStatic.mergedLampGeo} material={floorLampStatic.brassMat} raycast={NO_RAYCAST} />
      <mesh position={[0.52, 2.442, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={floorLampStatic.bulbDiscGeo} material={floorLampStatic.shadeGlowMat} raycast={NO_RAYCAST} />
      {showLight && (
        <pointLight position={[0.52, 2.35, 0]} color="#ffe8b8" intensity={1.8} distance={7.0} decay={1.8} />
      )}
    </group>
  );
};

// ==================================================================================
// LUXURY ARTISTIC DESIGNER RUG (Scaled cleanly for mobile/desktop VRAM budget)
// ==================================================================================
const RoyalDesignerRug: React.FC<{ receiveShadow: boolean }> = ({ receiveShadow }) => {
  const carpetTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const caps = detectDeviceCapabilities();
    const res = caps.isLowEndHardware || caps.isTouch ? 512 : 1024;
    if (rugTextureCache.has(res)) {
      return rugTextureCache.get(res)!;
    }
    const scale = res / 2048;

    const canvas = document.createElement('canvas');
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);

    ctx.fillStyle = '#f0ece3';
    ctx.fillRect(0, 0, 2048, 2048);

    const gridStep = res <= 512 ? 48 : 24;
    ctx.fillStyle = 'rgba(180, 170, 155, 0.16)';
    for (let i = 0; i < 2048; i += gridStep) {
      ctx.fillRect(i, 0, 3, 2048);
      ctx.fillRect(0, i, 2048, 3);
    }

    const drawFringes = (yStart: number) => {
      ctx.fillStyle = '#f7f4ed';
      for (let x = 60; x < 1988; x += 20) {
        ctx.fillRect(x, yStart, 4, 30);
      }
    };
    drawFringes(10);
    drawFringes(2008);

    ctx.strokeStyle = '#281a14';
    ctx.lineWidth = 34;
    ctx.strokeRect(55, 55, 1938, 1938);

    ctx.strokeStyle = '#c6a45c';
    ctx.lineWidth = 8;
    ctx.strokeRect(80, 80, 1888, 1888);

    ctx.fillStyle = '#4a2216';
    ctx.fillRect(90, 90, 1868, 110);
    ctx.fillRect(90, 1848, 1868, 110);
    ctx.fillRect(90, 90, 110, 1868);
    ctx.fillRect(1848, 90, 110, 1868);

    ctx.strokeStyle = '#d4aa50';
    ctx.lineWidth = 3.5;
    for (let x = 120; x < 1920; x += 48) {
      ctx.strokeRect(x, 118, 24, 52);
      ctx.strokeRect(x, 1876, 24, 52);
    }
    for (let y = 120; y < 1920; y += 48) {
      ctx.strokeRect(118, y, 52, 24);
      ctx.strokeRect(1876, y, 52, 24);
    }

    ctx.strokeStyle = '#c6a45c';
    ctx.lineWidth = 7;
    ctx.strokeRect(205, 205, 1638, 1638);

    ctx.fillStyle = '#7a1a1a';
    ctx.fillRect(212, 212, 1624, 130);
    ctx.fillRect(212, 1706, 1624, 130);
    ctx.fillRect(212, 212, 130, 1624);
    ctx.fillRect(1706, 212, 130, 1624);

    const drawPalmette = (cx: number, cy: number, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = '#4a2216';
      ctx.beginPath();
      ctx.moveTo(0, -36);
      ctx.lineTo(24, 0);
      ctx.lineTo(0, 36);
      ctx.lineTo(-24, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c6a45c';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    for (let x = 270; x < 1780; x += 82) {
      drawPalmette(x, 277, 0);
      drawPalmette(x, 1771, 0);
    }
    for (let y = 270; y < 1780; y += 82) {
      drawPalmette(277, y, Math.PI / 2);
      drawPalmette(1771, y, Math.PI / 2);
    }

    ctx.strokeStyle = '#c6a45c';
    ctx.lineWidth = 8;
    ctx.strokeRect(348, 348, 1352, 1352);

    ctx.fillStyle = '#821a1a';
    ctx.fillRect(356, 356, 1336, 1336);

    ctx.strokeStyle = 'rgba(212, 170, 80, 0.22)';
    ctx.lineWidth = 1.5;
    for (let d = -1336; d < 2672; d += 96) {
      ctx.beginPath();
      ctx.moveTo(356 + d, 356);
      ctx.lineTo(356 + d + 1336, 1692);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(356 + d, 1692);
      ctx.lineTo(356 + d + 1336, 356);
      ctx.stroke();
    }

    const drawSpandrel = (cx: number, cy: number, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = '#4a2216';
      ctx.strokeStyle = '#c6a45c';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 260, 0, Math.PI / 2);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    drawSpandrel(356, 356, 0);
    drawSpandrel(1692, 356, Math.PI / 2);
    drawSpandrel(1692, 1692, Math.PI);
    drawSpandrel(356, 1692, -Math.PI / 2);

    const centerX = 1024;
    const centerY = 1024;

    ctx.fillStyle = '#4a2216';
    ctx.strokeStyle = '#c6a45c';
    ctx.lineWidth = 7;
    ctx.beginPath();
    const points = 24;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? 320 : 220;
      const angle = (i * Math.PI) / points;
      const px = centerX + Math.cos(angle) * r;
      const py = centerY + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6b1414';
    ctx.strokeStyle = '#e2be68';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#c6a45c';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 34, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    rugTextureCache.set(res, texture);
    return texture;
  }, []);

  return (
    <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={receiveShadow} raycast={NO_RAYCAST}>
      <planeGeometry args={[14.8, 14.8]} />
      <meshStandardMaterial map={carpetTexture || undefined} roughness={0.82} metalness={0.06} />
    </mesh>
  );
};

// ==================================================================================
// CORNER GOLD RING CHANDELIER (Merged gold + LED meshes: 3 draw calls per corner!)
// ==================================================================================
const cornerChandelierStatic = typeof document !== 'undefined' ? (() => {
  const canopyGeo = new THREE.CylinderGeometry(0.38, 0.4, 0.08, 18);
  const ring1Geo = new THREE.TorusGeometry(1.3, 0.042, 10, 28);
  const led1Geo = new THREE.TorusGeometry(1.3, 0.026, 8, 28);
  const ring2Geo = new THREE.TorusGeometry(0.92, 0.038, 10, 26);
  const led2Geo = new THREE.TorusGeometry(0.92, 0.024, 8, 26);
  const ring3Geo = new THREE.TorusGeometry(0.62, 0.034, 10, 24);
  const led3Geo = new THREE.TorusGeometry(0.62, 0.022, 8, 24);
  const hitSphereGeo = new THREE.SphereGeometry(1.7, 8, 8);
  const cableMat = new THREE.MeshStandardMaterial({ color: '#c5c7cb', metalness: 0.9, roughness: 0.2 });

  const goldGeo = mergeTransformedParts([
    { geo: canopyGeo, pos: [0, ROOM_HEIGHT - 0.04, 0] },
    { geo: ring1Geo, pos: [0, 8.4, 0], rot: [0.22, 0.35, -0.15] },
    { geo: ring2Geo, pos: [0.08, 7.95, -0.05], rot: [-0.32, -0.25, 0.28] },
    { geo: ring3Geo, pos: [-0.05, 7.5, 0.06], rot: [0.42, 0.45, 0.35] },
  ]);

  const ledGeo = mergeTransformedParts([
    { geo: led1Geo, pos: [0, 8.416, 0], rot: [0.22, 0.35, -0.15] },
    { geo: led2Geo, pos: [0.08, 7.965, -0.05], rot: [-0.32, -0.25, 0.28] },
    { geo: led3Geo, pos: [-0.05, 7.514, 0.06], rot: [0.42, 0.45, 0.35] },
  ]);

  canopyGeo.dispose();
  ring1Geo.dispose();
  ring2Geo.dispose();
  ring3Geo.dispose();
  led1Geo.dispose();
  led2Geo.dispose();
  led3Geo.dispose();

  // Rings sit at y = 8.4 / 7.95 / 7.5; canopy mounts cleanly on ceiling y = ROOM_HEIGHT - 0.04
  const topLen = ROOM_HEIGHT - 0.08 - 8.4;
  const topMid = 8.4 + topLen / 2;
  const topCable = new THREE.CylinderGeometry(0.004, 0.004, topLen, 5);
  const midCable = new THREE.CylinderGeometry(0.004, 0.004, 0.45, 5);

  const cablesGeo = mergeTransformedParts([
    { geo: topCable, pos: [-0.55, topMid, -0.35] },
    { geo: topCable, pos: [-0.55, topMid, 0.35] },
    { geo: topCable, pos: [0.55, topMid, -0.35] },
    { geo: topCable, pos: [0.55, topMid, 0.35] },
    { geo: midCable, pos: [-0.45, 8.175, -0.2] },
    { geo: midCable, pos: [-0.45, 8.175, 0.2] },
    { geo: midCable, pos: [0.45, 8.175, -0.2] },
    { geo: midCable, pos: [0.45, 8.175, 0.2] },
  ]);
  topCable.dispose();
  midCable.dispose();

  return { goldGeo, ledGeo, hitSphereGeo, cableMat, cablesGeo };
})() : null;

interface CornerGoldRingChandelierProps {
  position: [number, number, number];
  showLight: boolean;
}

const CornerGoldRingChandelier: React.FC<CornerGoldRingChandelierProps> = ({ position, showLight }) => {
  const [isOn, setIsOn] = useState(true);
  const isMobile = useGameStore((s) => s.isMobile);
  const currentLvl = useRef(1);
  const isAnimatingRef = useRef(false);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const { invalidate } = useThree();

  const { goldMat, ledMat } = useMemo(() => {
    const goldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d4af37'),
      metalness: 0.88,
      roughness: 0.22,
      emissive: new THREE.Color('#946b10'),
      emissiveIntensity: 0.5,
    });

    const ledMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#ffaa18'),
      emissiveIntensity: 12.0,
      roughness: 0.1,
      metalness: 0.05,
      toneMapped: false,
    });

    return { goldMat, ledMat };
  }, []);

  useEffect(() => {
    return () => {
      goldMat.dispose();
      ledMat.dispose();
    };
  }, [goldMat, ledMat]);

  useFrame((_, delta: number) => {
    if (!isAnimatingRef.current) return;

    const target = isOn ? 1 : 0;
    currentLvl.current = THREE.MathUtils.damp(currentLvl.current, target, 26, delta);
    const lvl = currentLvl.current;

    ledMat.emissiveIntensity = lvl * 12.0;
    ledMat.color.setRGB(0.75 + lvl * 0.25, 0.72 + lvl * 0.28, 0.65 + lvl * 0.35);
    goldMat.emissiveIntensity = lvl * 0.5;

    if (pointLightRef.current) {
      pointLightRef.current.intensity = lvl * 4.5;
    }

    if (Math.abs(lvl - target) < 0.002) {
      currentLvl.current = target;
      ledMat.emissiveIntensity = target * 12.0;
      goldMat.emissiveIntensity = target * 0.5;
      if (pointLightRef.current) pointLightRef.current.intensity = target * 4.5;
      isAnimatingRef.current = false;
    } else {
      invalidate();
    }
  });

  if (!cornerChandelierStatic) return null;

  return (
    <group position={position}>
      {/* Desktop click target only (eliminates overhead mobile pointer raycasting on ceiling fixtures) */}
      {!isMobile && (
        <mesh
          position={[0, 7.95, 0]}
          geometry={cornerChandelierStatic.hitSphereGeo}
          onClick={(e) => {
            e.stopPropagation();
            isAnimatingRef.current = true;
            setIsOn((prev) => !prev);
            invalidate();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Merged Canopy & 3 Gold Rings (1 draw call) */}
      <mesh material={goldMat} geometry={cornerChandelierStatic.goldGeo} raycast={NO_RAYCAST} />

      {/* Merged 3 Glowing LED Diffuser Rings (1 draw call) */}
      <mesh material={ledMat} geometry={cornerChandelierStatic.ledGeo} raycast={NO_RAYCAST} />

      {/* Suspension Cables (1 draw call) */}
      <mesh material={cornerChandelierStatic.cableMat} geometry={cornerChandelierStatic.cablesGeo} raycast={NO_RAYCAST} />

      {/* Consolidated single warm golden illumination per chandelier on High/Ultra */}
      {showLight && (
        <pointLight
          ref={pointLightRef}
          position={[0, 7.8, 0]}
          color="#ffa826"
          intensity={isOn ? 4.5 : 0}
          distance={26}
          decay={1.6}
        />
      )}
    </group>
  );
};

// ==================================================================================
// ARCHITECTURAL WALL FEATURE (Scaled smoothly to 36m width x 14.6m height)
// ==================================================================================
const wallArchStatic = typeof document !== 'undefined' ? (() => {
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ebe6de', roughness: 0.78 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#f2eee8', roughness: 0.68 });
  const walnutMat = new THREE.MeshStandardMaterial({ color: '#2d1c13', roughness: 0.42 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#c6a45c', metalness: 0.85, roughness: 0.25 });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#281810', roughness: 0.45 });

  const backWallGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT);
  const pillarGeo = new THREE.BoxGeometry(10.5, ROOM_HEIGHT, 0.12);

  const colSingle = new THREE.BoxGeometry(0.7, ROOM_HEIGHT, 0.2);
  const columnsGeo = mergeTransformedParts([
    { geo: colSingle, pos: [-5.6, ROOM_HEIGHT / 2, 0.12] },
    { geo: colSingle, pos: [5.6, ROOM_HEIGHT / 2, 0.12] },
  ]);
  colSingle.dispose();

  const trimSingle = new THREE.BoxGeometry(0.04, ROOM_HEIGHT, 0.04);
  const goldTrimsGeo = mergeTransformedParts([
    { geo: trimSingle, pos: [-5.22, ROOM_HEIGHT / 2, 0.2] },
    { geo: trimSingle, pos: [5.22, ROOM_HEIGHT / 2, 0.2] },
  ]);
  trimSingle.dispose();

  const baseboardGeo = new THREE.BoxGeometry(ROOM_SIZE, 0.44, 0.1);

  return { wallMat, pillarMat, walnutMat, goldMat, baseMat, backWallGeo, pillarGeo, columnsGeo, goldTrimsGeo, baseboardGeo };
})() : null;

interface ArchitecturalWallProps {
  headingLine1: string;
  headingLine2: string;
  headingLine3: string;
  headingLine4: string;
  position: [number, number, number];
  rotation: [number, number, number];
  showWallSpot?: boolean;
  showLampLight?: boolean;
}

const ArchitecturalWall: React.FC<ArchitecturalWallProps> = ({
  headingLine1,
  headingLine2,
  headingLine3,
  headingLine4,
  position,
  rotation,
  showWallSpot = false,
  showLampLight = false,
}) => {
  if (!wallArchStatic) return null;

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, ROOM_HEIGHT / 2, 0]} geometry={wallArchStatic.backWallGeo} material={wallArchStatic.wallMat} raycast={NO_RAYCAST} />
      <mesh position={[0, ROOM_HEIGHT / 2, 0.08]} geometry={wallArchStatic.pillarGeo} material={wallArchStatic.pillarMat} raycast={NO_RAYCAST} />
      <mesh geometry={wallArchStatic.columnsGeo} material={wallArchStatic.walnutMat} raycast={NO_RAYCAST} />
      <mesh geometry={wallArchStatic.goldTrimsGeo} material={wallArchStatic.goldMat} raycast={NO_RAYCAST} />
      <mesh position={[0, 0.22, 0.2]} geometry={wallArchStatic.baseboardGeo} material={wallArchStatic.baseMat} raycast={NO_RAYCAST} />

      {/* Main Central Wall Artwork (Untouched position [0, 5.2, 0.25]) */}
      <WallArtwork
        headingLine1={headingLine1}
        headingLine2={headingLine2}
        headingLine3={headingLine3}
        headingLine4={headingLine4}
        position={[0, 5.2, 0.25]}
        rotation={[0, 0, 0]}
        showAccentSpotLight={showWallSpot}
      />

      <Credenza position={[0, 0, 0.6]} />
      <FloorLamp position={[-3.6, 0, 0.8]} rotation={[0, 0.25, 0]} showLight={showLampLight} />
    </group>
  );
};

// ==================================================================================
// EUROPEAN OAK HARDWOOD FLOOR (Realistic satin natural oak planks + bevel bump/roughness)
// ==================================================================================
const EuropeanOakHardwoodFloor: React.FC<{ receiveShadow: boolean; detailedMaterial: boolean }> = ({
  receiveShadow,
  detailedMaterial,
}) => {
  const floorTextures = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const caps = detectDeviceCapabilities();
    const res = caps.isLowEndHardware || caps.isTouch ? 512 : 1024;
    if (oakTextureCache.has(res)) {
      return oakTextureCache.get(res)!;
    }
    const auxRes = res <= 512 ? 256 : 512;
    const scale = res / 1024;
    const auxScale = auxRes / 1024;

    const canvas = document.createElement('canvas');
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = auxRes;
    bumpCanvas.height = auxRes;
    const bCtx = bumpCanvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = auxRes;
    roughCanvas.height = auxRes;
    const rCtx = roughCanvas.getContext('2d');

    if (!ctx || !bCtx || !rCtx) return null;

    ctx.scale(scale, scale);
    bCtx.scale(auxScale, auxScale);
    rCtx.scale(auxScale, auxScale);

    bCtx.fillStyle = '#828282';
    bCtx.fillRect(0, 0, 1024, 1024);
    rCtx.fillStyle = '#929292'; // Natural satin ~0.57 baseline modulated per plank
    rCtx.fillRect(0, 0, 1024, 1024);

    const numRows = 16;
    const rowHeight = 1024 / numRows;

    // Natural smoked / satin European oak palette (avoids artificial bright yellow-orange tones)
    const oakTones = [
      '#9b7b56',
      '#8d6d49',
      '#a38460',
      '#846543',
      '#947551',
      '#7b5d3d',
      '#9e7e59',
      '#8a6b48',
    ];

    let seed = 137;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const fibersPerPlank = res <= 512 ? 8 : 16;
    for (let r = 0; r < numRows; r++) {
      const y = r * rowHeight;
      // Staggered irregular plank joints across tile boundaries
      const j1 = 160 + Math.floor(random() * 240);
      const j2 = j1 + 290 + Math.floor(random() * 220);
      const offsets = [0, j1];
      if (j2 < 910) offsets.push(j2);
      offsets.push(1024);

      for (let p = 0; p < offsets.length - 1; p++) {
        const x1 = offsets[p];
        const x2 = offsets[p + 1];
        const pWidth = x2 - x1;

        const baseHex = oakTones[(r * 5 + p * 3) % oakTones.length];
        ctx.fillStyle = baseHex;
        ctx.fillRect(x1, y, pWidth, rowHeight);

        // Soft lengthwise tone variation per plank
        const plankGrad = ctx.createLinearGradient(x1, y, x2, y + rowHeight);
        plankGrad.addColorStop(0.0, 'rgba(255, 242, 224, 0.05)');
        plankGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.0)');
        plankGrad.addColorStop(1.0, 'rgba(24, 14, 6, 0.09)');
        ctx.fillStyle = plankGrad;
        ctx.fillRect(x1, y, pWidth, rowHeight);

        // Per-plank satin roughness variation
        const rTone = Math.round(134 + random() * 34);
        rCtx.fillStyle = `rgb(${rTone},${rTone},${rTone})`;
        rCtx.fillRect(x1, y, pWidth, rowHeight);

        // Organic undulating wood grain fibers (baked into both diffuse and bump/roughness)
        const darkFibers = new Path2D();
        const lightFibers = new Path2D();
        for (let f = 0; f < fibersPerPlank; f++) {
          const fy = y + 3 + (f / fibersPerPlank) * (rowHeight - 6) + (random() - 0.5) * 2.2;
          const targetPath = random() > 0.42 ? darkFibers : lightFibers;
          targetPath.moveTo(x1, fy);
          const waveFreq = 0.011 + random() * 0.01;
          const waveAmp = 1.2 + random() * 2.2;
          const phase = random() * Math.PI * 2;
          for (let wx = x1 + 36; wx <= x2; wx += 36) {
            targetPath.lineTo(wx, Math.max(y + 1, Math.min(y + rowHeight - 1, fy + Math.sin(wx * waveFreq + phase) * waveAmp)));
          }
        }
        ctx.strokeStyle = 'rgba(68, 43, 20, 0.16)';
        ctx.lineWidth = 1.05;
        ctx.stroke(darkFibers);

        ctx.strokeStyle = 'rgba(236, 205, 162, 0.09)';
        ctx.lineWidth = 1.0;
        ctx.stroke(lightFibers);

        bCtx.strokeStyle = 'rgba(65, 65, 65, 0.25)';
        bCtx.lineWidth = 1.1;
        bCtx.stroke(darkFibers);
        rCtx.strokeStyle = 'rgba(182, 182, 182, 0.22)';
        rCtx.lineWidth = 1.1;
        rCtx.stroke(darkFibers);

        // Subtle cathedral growth arcs (curved heartwood bands)
        if (random() > 0.48 && pWidth > 180) {
          const cathCenter = x1 + pWidth * (0.25 + random() * 0.5);
          const cathY = y + rowHeight * (0.35 + random() * 0.3);
          for (let c = 8; c <= 30; c += 7) {
            ctx.strokeStyle = 'rgba(62, 38, 17, 0.13)';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.ellipse(cathCenter, cathY, c * 3.2, c * 0.65, 0, 0, Math.PI);
            ctx.stroke();
          }
        }

        // Feathered realistic wood knots (graduated concentric rings, zero harsh cartoon blobs)
        if (random() > 0.72 && pWidth > 160) {
          const knotX = x1 + pWidth * (0.22 + random() * 0.56);
          const knotY = y + rowHeight * (0.28 + random() * 0.44);
          const knotR = 5 + random() * 4.5;
          const kGrad = ctx.createRadialGradient(knotX, knotY, 0.5, knotX, knotY, knotR * 1.6);
          kGrad.addColorStop(0.0, 'rgba(48, 28, 12, 0.72)');
          kGrad.addColorStop(0.45, 'rgba(72, 44, 20, 0.42)');
          kGrad.addColorStop(1.0, 'rgba(90, 56, 28, 0.0)');
          ctx.fillStyle = kGrad;
          ctx.beginPath();
          ctx.ellipse(knotX, knotY, knotR * 1.8, knotR * 0.85, (random() - 0.5) * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }

        // Micro-beveled V-groove end joints (natural shadow + slight top specular edge)
        if (x1 > 0) {
          ctx.strokeStyle = 'rgba(34, 20, 9, 0.52)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x1, y + 1);
          ctx.lineTo(x1, y + rowHeight - 1);
          ctx.stroke();

          bCtx.strokeStyle = '#383838';
          bCtx.lineWidth = 2.2;
          bCtx.beginPath();
          bCtx.moveTo(x1, y);
          bCtx.lineTo(x1, y + rowHeight);
          bCtx.stroke();

          rCtx.strokeStyle = '#d4d4d4';
          rCtx.lineWidth = 2.2;
          rCtx.beginPath();
          rCtx.moveTo(x1, y);
          rCtx.lineTo(x1, y + rowHeight);
          rCtx.stroke();
        }
      }

      // Horizontal beveled V-groove plank seam + faint highlight edge
      ctx.strokeStyle = 'rgba(32, 18, 8, 0.52)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(248, 224, 188, 0.09)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y + 1.4);
      ctx.lineTo(1024, y + 1.4);
      ctx.stroke();

      bCtx.strokeStyle = '#363636';
      bCtx.lineWidth = 2.2;
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(1024, y);
      bCtx.stroke();

      rCtx.strokeStyle = '#d4d4d4';
      rCtx.lineWidth = 2.2;
      rCtx.beginPath();
      rCtx.moveTo(0, y);
      rCtx.lineTo(1024, y);
      rCtx.stroke();
    }

    const setupRepeatingTex = (c: HTMLCanvasElement, srgb: boolean) => {
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4.5, 4.5);
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = caps.isTouch ? 2 : 8;
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const result: OakFloorTextures = {
      map: setupRepeatingTex(canvas, true),
      bumpMap: setupRepeatingTex(bumpCanvas, false),
      roughnessMap: setupRepeatingTex(roughCanvas, false),
    };
    oakTextureCache.set(res, result);
    return result;
  }, []);

  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={receiveShadow} raycast={NO_RAYCAST}>
      <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
      <meshStandardMaterial
        map={floorTextures?.map}
        bumpMap={detailedMaterial ? floorTextures?.bumpMap : undefined}
        bumpScale={detailedMaterial ? 0.008 : 0}
        roughnessMap={detailedMaterial ? floorTextures?.roughnessMap : undefined}
        roughness={0.54}
        metalness={0.02}
      />
    </mesh>
  );
};

// ==================================================================================
// WHITE PARALLEL CEILING STRIP LIGHTS (Connecting the 4 Golden Chandeliers ONLY)
// Flush-mounted along ceiling height y = ROOM_HEIGHT - 0.06m (14.54m), safely above
// max camera elevation (13.7m) so they NEVER cross the board or obstruct top-down /
// vertical orbit views, NEVER flicker or disappear, and remain visually connected to
// all 4 golden chandeliers. Rendered via ONLY 3 InstancedMesh draw calls!
// ==================================================================================
const stripLightAssets = typeof document !== 'undefined' ? (() => {
  const length = CORNER_CHANDELIER_OFFSET * 2; // 25.6m span between corner chandeliers
  const trackWidth = 0.09;
  const trackDepth = 0.038;
  const diffuserWidth = 0.07;
  const diffuserDepth = 0.032;
  const haloWidth = 0.16;
  const haloDepth = 0.065;

  const housingGeo = new THREE.BoxGeometry(length, trackDepth, trackWidth);
  const diffuserGeo = new THREE.BoxGeometry(length, diffuserDepth, diffuserWidth);
  const haloGeo = new THREE.BoxGeometry(length, haloDepth, haloWidth);

  const housingMat = new THREE.MeshStandardMaterial({ color: '#141517', roughness: 0.35, metalness: 0.8 });
  const diffuserMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#fff7e0',
    emissiveIntensity: 18.0,
    roughness: 0.05,
    metalness: 0.0,
    toneMapped: false,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: '#fffbe8',
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return { housingGeo, diffuserGeo, haloGeo, housingMat, diffuserMat, haloMat };
})() : null;

const STRIP_TRACK_TRANSFORMS: { x: number; z: number; rotY: number }[] = (() => {
  const offset = 0.19;
  const c = CORNER_CHANDELIER_OFFSET;
  return [
    // North parallel rails
    { x: 0, z: -c - offset, rotY: 0 },
    { x: 0, z: -c + offset, rotY: 0 },
    // South parallel rails
    { x: 0, z: c - offset, rotY: 0 },
    { x: 0, z: c + offset, rotY: 0 },
    // West parallel rails
    { x: -c - offset, z: 0, rotY: Math.PI / 2 },
    { x: -c + offset, z: 0, rotY: Math.PI / 2 },
    // East parallel rails
    { x: c - offset, z: 0, rotY: Math.PI / 2 },
    { x: c + offset, z: 0, rotY: Math.PI / 2 },
  ];
})();

const ArchitecturalParallelCeilingStripLights: React.FC = () => {
  const housingRef = useRef<THREE.InstancedMesh>(null);
  const diffuserRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const yHousing = ROOM_HEIGHT - 0.03;
    const yDiffuser = ROOM_HEIGHT - 0.058;
    const yHalo = ROOM_HEIGHT - 0.065;

    STRIP_TRACK_TRANSFORMS.forEach((t, idx) => {
      dummy.rotation.set(0, t.rotY, 0);
      dummy.scale.set(1, 1, 1);

      dummy.position.set(t.x, yHousing, t.z);
      dummy.updateMatrix();
      housingRef.current?.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(t.x, yDiffuser, t.z);
      dummy.updateMatrix();
      diffuserRef.current?.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(t.x, yHalo, t.z);
      dummy.updateMatrix();
      haloRef.current?.setMatrixAt(idx, dummy.matrix);
    });

    if (housingRef.current) housingRef.current.instanceMatrix.needsUpdate = true;
    if (diffuserRef.current) diffuserRef.current.instanceMatrix.needsUpdate = true;
    if (haloRef.current) haloRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  if (!stripLightAssets) return null;

  return (
    <group>
      <instancedMesh
        ref={housingRef}
        args={[stripLightAssets.housingGeo, stripLightAssets.housingMat, 8]}
        frustumCulled={false}
        raycast={NO_RAYCAST}
      />
      <instancedMesh
        ref={diffuserRef}
        args={[stripLightAssets.diffuserGeo, stripLightAssets.diffuserMat, 8]}
        frustumCulled={false}
        raycast={NO_RAYCAST}
      />
      <instancedMesh
        ref={haloRef}
        args={[stripLightAssets.haloGeo, stripLightAssets.haloMat, 8]}
        frustumCulled={false}
        raycast={NO_RAYCAST}
      />
    </group>
  );
};

// Merged perimeter ceiling & cove moulding (2 draw calls instead of 5)
const ceilingStatic = typeof document !== 'undefined' ? (() => {
  const ceilingGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.85, side: THREE.FrontSide });

  const cEdge = ROOM_HALF_SIZE - 0.15;
  const cY = ROOM_HEIGHT - 0.15;
  const nsBar = new THREE.BoxGeometry(ROOM_SIZE, 0.3, 0.2);
  const ewBar = new THREE.BoxGeometry(0.2, 0.3, ROOM_SIZE);
  const coveGeo = mergeTransformedParts([
    { geo: nsBar, pos: [0, cY, -cEdge] },
    { geo: nsBar, pos: [0, cY, cEdge] },
    { geo: ewBar, pos: [-cEdge, cY, 0] },
    { geo: ewBar, pos: [cEdge, cY, 0] },
  ]);
  nsBar.dispose();
  ewBar.dispose();

  const coveMat = new THREE.MeshStandardMaterial({ color: '#ded8ce', roughness: 0.5 });
  return { ceilingGeo, ceilingMat, coveGeo, coveMat };
})() : null;

// ==================================================================================
// COMPLETE ROOM ENVIRONMENT
// ==================================================================================
export const RoomEnvironment: React.FC = () => {
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const { invalidate } = useThree();
  const keyLightRef = useRef<THREE.DirectionalLight>(null);

  const shadowsEnabled = graphicsQuality !== 'low';
  const showCornerLights = graphicsQuality === 'high' || graphicsQuality === 'ultra';
  const showUltraAccents = graphicsQuality === 'ultra';
  const shadowSize = graphicsQuality === 'ultra' ? 2048 : graphicsQuality === 'high' ? 1024 : 512;

  // Dispose and reallocate shadow render target whenever resolution changes so Three.js never
  // renders a smaller shadowMap viewport into a larger texture (which shifts/corrupts floor shadows).
  useEffect(() => {
    const light = keyLightRef.current;
    if (!light) return;
    if (light.shadow.map && light.shadow.map.width !== shadowSize) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.needsUpdate = true;
    invalidate();
  }, [shadowSize, shadowsEnabled, invalidate]);

  return (
    <group>
      {/* Consolidated Adaptive Gallery Lighting (3 lights on low, 4 on medium, 8 on high, 17 on ultra) */}
      <hemisphereLight color="#ffffff" groundColor="#dcd4c8" intensity={showCornerLights ? 0.72 : 0.94} />
      <ambientLight color="#fdfaf4" intensity={showCornerLights ? 0.42 : 0.56} />

      {/* Primary Overhead Chessboard Key Light — Replaces central white chandelier light while removing its obstructing body */}
      <directionalLight
        ref={keyLightRef}
        position={[2.4, 13.5, 3.2]}
        color="#fff7e8"
        intensity={showCornerLights ? 1.35 : 1.55}
        castShadow={shadowsEnabled}
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={1}
        shadow-camera-far={22}
        shadow-camera-left={-7.5}
        shadow-camera-right={7.5}
        shadow-camera-top={7.5}
        shadow-camera-bottom={-7.5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.015}
      />

      {/* Soft Counter-Fill Key for Balanced Piece Modeling (skipped on low Performance tier to minimize PBR fragment loop) */}
      {graphicsQuality !== 'low' && (
        <directionalLight position={[-6, 10, -5]} color="#f2e8d8" intensity={0.42} />
      )}

      {/* Floor & Luxury Rug */}
      <EuropeanOakHardwoodFloor receiveShadow={shadowsEnabled} detailedMaterial={graphicsQuality !== 'low'} />
      <RoyalDesignerRug receiveShadow={shadowsEnabled} />

      {/* Cached Floor Contact Shadow — strictly limited below board top surface (far=1.26) so piece silhouettes NEVER bleed onto rug */}
      {graphicsQuality !== 'low' && (
        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.55}
          scale={13}
          blur={1.8}
          far={1.26}
          frames={1}
          resolution={graphicsQuality === 'medium' ? 128 : graphicsQuality === 'high' ? 256 : 512}
          color="#1f2124"
        />
      )}

      {/* Ceiling & Perimeter Cove Moulding */}
      {ceilingStatic && (
        <>
          <mesh
            position={[0, ROOM_HEIGHT, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            geometry={ceilingStatic.ceilingGeo}
            material={ceilingStatic.ceilingMat}
            raycast={NO_RAYCAST}
          />
          <mesh geometry={ceilingStatic.coveGeo} material={ceilingStatic.coveMat} raycast={NO_RAYCAST} />
        </>
      )}

      {/* White Parallel Ceiling Strip Lights Connecting All Four Golden Chandeliers */}
      <ArchitecturalParallelCeilingStripLights />

      {/* ==================== FOUR ARCHITECTURAL WALLS ==================== */}
      <ArchitecturalWall
        headingLine1="STAY"
        headingLine2="SIMPLE"
        headingLine3="STAY"
        headingLine4="TRUE"
        position={[0, 0, -ROOM_HALF_SIZE]}
        rotation={[0, 0, 0]}
        showWallSpot={showUltraAccents}
        showLampLight={showUltraAccents}
      />
      <ArchitecturalWall
        headingLine1="THINK"
        headingLine2="BEYOND"
        headingLine3="THE"
        headingLine4="MOVE"
        position={[0, 0, ROOM_HALF_SIZE]}
        rotation={[0, Math.PI, 0]}
        showWallSpot={showUltraAccents}
        showLampLight={showUltraAccents}
      />
      <ArchitecturalWall
        headingLine1="MASTER"
        headingLine2="PATIENCE"
        headingLine3="CONQUER"
        headingLine4="MIND"
        position={[-ROOM_HALF_SIZE, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        showWallSpot={showUltraAccents}
        showLampLight={showUltraAccents}
      />
      <ArchitecturalWall
        headingLine1="SEE"
        headingLine2="DEEPER"
        headingLine3="PLAY"
        headingLine4="REGAL"
        position={[ROOM_HALF_SIZE, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        showWallSpot={showUltraAccents}
        showLampLight={showUltraAccents}
      />

      {/* Clean, Plain Uninterrupted Walls Flanking Central Artwork */}

      {/* Four Golden Ring Chandeliers Preserved in All 4 Corners */}
      <CornerGoldRingChandelier position={[-CORNER_CHANDELIER_OFFSET, 0, -CORNER_CHANDELIER_OFFSET]} showLight={showCornerLights} />
      <CornerGoldRingChandelier position={[CORNER_CHANDELIER_OFFSET, 0, -CORNER_CHANDELIER_OFFSET]} showLight={showCornerLights} />
      <CornerGoldRingChandelier position={[-CORNER_CHANDELIER_OFFSET, 0, CORNER_CHANDELIER_OFFSET]} showLight={showCornerLights} />
      <CornerGoldRingChandelier position={[CORNER_CHANDELIER_OFFSET, 0, CORNER_CHANDELIER_OFFSET]} showLight={showCornerLights} />
    </group>
  );
};
