import React, { useMemo, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ContactShadows } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';

// ==================================================================================
// WALL ARTWORK — Exactly like the provided reference photo:
// "STAY SIMPLE / STAY TRUE" staggered typography in gold metallic foil on textured black canvas
// with floating dark shadowbox frame and dedicated overhead downlight spotlight.
// NO Z-FIGHTING: Canvas is offset with polygonOffset and explicit renderOrder.
// ==================================================================================
interface WallArtworkProps {
  headingLine1: string; // e.g. "STAY"
  headingLine2: string; // e.g. "SIMPLE"
  headingLine3: string; // e.g. "STAY" (indented)
  headingLine4: string; // e.g. "TRUE" (indented)
  position: [number, number, number];
  rotation: [number, number, number];
  width?: number;
  height?: number;
}

// Module-level artwork texture cache to eliminate duplicate canvas renders
const wallArtworkTextureCache = new Map<string, THREE.CanvasTexture>();

const WallArtwork: React.FC<WallArtworkProps> = ({
  headingLine1,
  headingLine2,
  headingLine3,
  headingLine4,
  position,
  rotation,
  width = 3.8,
  height = 5.0,
}) => {
  const canvasTexture = useMemo(() => {
    const cacheKey = `${headingLine1}_${headingLine2}_${headingLine3}_${headingLine4}`;
    if (wallArtworkTextureCache.has(cacheKey)) {
      return wallArtworkTextureCache.get(cacheKey)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1575;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Deep matte black background
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Batched fine vertical linen/ribbed canvas weave texture
    ctx.fillStyle = 'rgba(32, 33, 38, 0.45)';
    for (let x = 0; x < canvas.width; x += 10) {
      ctx.fillRect(x, 0, 2, canvas.height);
    }

    // Horizontal fine cross-weave
    ctx.fillStyle = 'rgba(22, 23, 26, 0.22)';
    for (let y = 0; y < canvas.height; y += 16) {
      ctx.fillRect(0, y, canvas.width, 1.5);
    }

    // 3. Ambient vignette
    const vignette = ctx.createRadialGradient(
      canvas.width * 0.5,
      canvas.height * 0.45,
      120,
      canvas.width * 0.5,
      canvas.height * 0.5,
      820
    );
    vignette.addColorStop(0, 'rgba(32, 33, 38, 0.35)');
    vignette.addColorStop(1, 'rgba(4, 4, 6, 0.88)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3.5 Sharp Golden Boundary Lines (Inner Framing on Canvas)
    const goldBorderGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    goldBorderGrad.addColorStop(0.0, '#cca044');
    goldBorderGrad.addColorStop(0.25, '#fae19d');
    goldBorderGrad.addColorStop(0.5, '#e4bb5a');
    goldBorderGrad.addColorStop(0.75, '#b9872e');
    goldBorderGrad.addColorStop(1.0, '#f2d68a');

    // Outer sharp gold boundary pinstripe
    ctx.strokeStyle = goldBorderGrad;
    ctx.lineWidth = 11;
    ctx.strokeRect(27, 27, canvas.width - 54, canvas.height - 54);

    // Inner fine delicate gold border line
    ctx.lineWidth = 3;
    ctx.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);

    // 4. Staggered Typography Layout:
    const baseFontSize = 122;
    const lineHeight = 146;
    const topStart = 338;
    const leftColX = 139;
    const rightColX = 495;
    const safeRightEdge = 1050;

    // Draw lines with metallic brushed gold gradient and auto-fit protection
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

      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = goldGrad;
      ctx.fillText(text, drawX, y);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    };

    renderGoldLine(headingLine1, leftColX, topStart, false);
    renderGoldLine(headingLine2, leftColX, topStart + lineHeight, false);
    renderGoldLine(headingLine3, rightColX, topStart + lineHeight * 2, true);
    renderGoldLine(headingLine4, rightColX, topStart + lineHeight * 3, true);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    wallArtworkTextureCache.set(cacheKey, texture);
    return texture;
  }, [headingLine1, headingLine2, headingLine3, headingLine4]);

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Outer Floating Shadowbox Frame (4 sleek perimeter bars around the canvas) */}
      {/* Top frame bar */}
      <mesh position={[0, (height + 0.08) / 2, 0.01]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#16171a" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Bottom frame bar */}
      <mesh position={[0, -(height + 0.08) / 2, 0.01]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#16171a" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Left frame bar */}
      <mesh position={[-(width + 0.08) / 2, 0, 0.01]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#16171a" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Right frame bar */}
      <mesh position={[(width + 0.08) / 2, 0, 0.01]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#16171a" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* 1.5 Sharp Golden Colored Boundary (Crisp lustrous bevel moulding directly framing the artwork) */}
      {/* Top golden boundary bar */}
      <mesh position={[0, (height + 0.04) / 2, 0.038]} castShadow>
        <boxGeometry args={[width + 0.08, 0.04, 0.025]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.94}
          roughness={0.16}
          emissive="#6e4d0d"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Bottom golden boundary bar */}
      <mesh position={[0, -(height + 0.04) / 2, 0.038]} castShadow>
        <boxGeometry args={[width + 0.08, 0.04, 0.025]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.94}
          roughness={0.16}
          emissive="#6e4d0d"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Left golden boundary bar */}
      <mesh position={[-(width + 0.04) / 2, 0, 0.038]} castShadow>
        <boxGeometry args={[0.04, height + 0.08, 0.025]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.94}
          roughness={0.16}
          emissive="#6e4d0d"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Right golden boundary bar */}
      <mesh position={[(width + 0.04) / 2, 0, 0.038]} castShadow>
        <boxGeometry args={[0.04, height + 0.08, 0.025]} />
        <meshStandardMaterial
          color="#d4af37"
          metalness={0.94}
          roughness={0.16}
          emissive="#6e4d0d"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Frame Backboard (recessed behind canvas) */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.08, height + 0.08]} />
        <meshStandardMaterial color="#08080a" roughness={0.9} />
      </mesh>

      {/* 2. Textured Canvas Face (Sitting safely in front with polygonOffset to PREVENT ALL BLINKING) */}
      <mesh position={[0, 0, 0.025]} renderOrder={10}>
        <planeGeometry args={[width, height]} />
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

      {/* 3. Dedicated Overhead Downlight Spotlight */}
      <spotLight
        position={[0, height / 2 + 1.2, 1.4]}
        target-position={[0, 0, 0]}
        color="#fff4db"
        intensity={2.2}
        angle={0.58}
        penumbra={0.65}
        distance={7.5}
      />
    </group>
  );
};

// ==================================================================================
// CORNER GALLERY ARTWORK 1: BLACK METAL CHESS SILHOUETTES (Landscape)
// Exact replica from the user's reference photograph (media_1795278173119_16780c08.jpg)
// Landscape aspect ratio, floating shadowbox frame, dedicated overhead museum spotlight.
// ==================================================================================
interface CornerArtworkProps {
  position: [number, number, number];
  rotation: [number, number, number];
  width?: number;
  height?: number;
}

const ChessMetalArtwork: React.FC<CornerArtworkProps> = ({
  position,
  rotation,
  width = 3.4,
  height = 2.7,
}) => {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/artworks/chess-metal-art.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Outer Dark Shadowbox Frame */}
      <mesh position={[0, (height + 0.08) / 2, 0.015]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#111215" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, -(height + 0.08) / 2, 0.015]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#111215" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[-(width + 0.08) / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#111215" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[(width + 0.08) / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#111215" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Frame Backboard */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.08, height + 0.08]} />
        <meshStandardMaterial color="#08080a" roughness={0.9} />
      </mesh>

      {/* 2. Artwork Canvas with zero Z-fighting */}
      <mesh position={[0, 0, 0.025]} renderOrder={10}>
        <planeGeometry args={[width, height]} />
        {texture && (
          <meshBasicMaterial
            map={texture}
            side={THREE.FrontSide}
            depthTest={true}
            depthWrite={true}
            polygonOffset={true}
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        )}
      </mesh>

      {/* 3. Dedicated Overhead Warm Gallery Spotlight */}
      <spotLight
        position={[0, height / 2 + 1.2, 1.4]}
        target-position={[0, 0, 0]}
        color="#fff4db"
        intensity={2.6}
        angle={0.62}
        penumbra={0.7}
        distance={8.0}
      />
    </group>
  );
};

// ==================================================================================
// CORNER GALLERY ARTWORK 2: KING CHESS PIECE EXPRESSIONIST OIL PAINTING (Portrait)
// Exact replica from the user's reference photograph (media_1795278201402_c044ee6b.jpg)
// Portrait aspect ratio, black gallery frame with inner gold reveal, dedicated overhead museum spotlight.
// ==================================================================================
const KingOilPaintingArtwork: React.FC<CornerArtworkProps> = ({
  position,
  rotation,
  width = 2.3,
  height = 3.18,
}) => {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/artworks/king-oil-painting.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Outer Sleek Black Gallery Frame (Matching the photo) */}
      <mesh position={[0, (height + 0.08) / 2, 0.015]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#121316" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, -(height + 0.08) / 2, 0.015]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#121316" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[-(width + 0.08) / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#121316" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[(width + 0.08) / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#121316" metalness={0.4} roughness={0.35} />
      </mesh>

      {/* 1.5 Inner Gold Leaf Reveal Fillet (Matching the luxury framing) */}
      <mesh position={[0, (height + 0.02) / 2, 0.035]} castShadow>
        <boxGeometry args={[width + 0.04, 0.02, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} emissive="#4a350c" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, -(height + 0.02) / 2, 0.035]} castShadow>
        <boxGeometry args={[width + 0.04, 0.02, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} emissive="#4a350c" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-(width + 0.02) / 2, 0, 0.035]} castShadow>
        <boxGeometry args={[0.02, height + 0.04, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} emissive="#4a350c" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[(width + 0.02) / 2, 0, 0.035]} castShadow>
        <boxGeometry args={[0.02, height + 0.04, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} emissive="#4a350c" emissiveIntensity={0.2} />
      </mesh>

      {/* Frame Backboard */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.08, height + 0.08]} />
        <meshStandardMaterial color="#08080a" roughness={0.9} />
      </mesh>

      {/* 2. Vibrant King Oil Painting Canvas with zero Z-fighting */}
      <mesh position={[0, 0, 0.025]} renderOrder={10}>
        <planeGeometry args={[width, height]} />
        {texture && (
          <meshBasicMaterial
            map={texture}
            side={THREE.FrontSide}
            depthTest={true}
            depthWrite={true}
            polygonOffset={true}
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        )}
      </mesh>

      {/* 3. Dedicated Overhead Warm Gallery Spotlight */}
      <spotLight
        position={[0, height / 2 + 1.2, 1.4]}
        target-position={[0, 0, 0]}
        color="#fff4db"
        intensity={2.6}
        angle={0.58}
        penumbra={0.65}
        distance={8.0}
      />
    </group>
  );
};

// ==================================================================================
// CORNER GALLERY ARTWORK 3: CHESS PIECES WATERCOLOR & SPLATTER ART (Square Canvas)
// Exact replica from the user's reference photograph (media_1795278841293_3dc7f7c4.jpg)
// Square 1:1 aspect ratio, floating modern gallery frame, dedicated museum spotlight.
// ==================================================================================
const ChessSplatterArtwork: React.FC<CornerArtworkProps> = ({
  position,
  rotation,
  width = 2.8,
  height = 2.8,
}) => {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/artworks/chess-splatter-art.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Outer Sleek Floating Gallery Frame */}
      <mesh position={[0, (height + 0.08) / 2, 0.015]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#141518" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, -(height + 0.08) / 2, 0.015]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#141518" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[-(width + 0.08) / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#141518" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[(width + 0.08) / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#141518" metalness={0.5} roughness={0.35} />
      </mesh>

      {/* Frame Backboard */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.08, height + 0.08]} />
        <meshStandardMaterial color="#08080a" roughness={0.9} />
      </mesh>

      {/* 2. Splatter Canvas Face with zero Z-fighting */}
      <mesh position={[0, 0, 0.025]} renderOrder={10}>
        <planeGeometry args={[width, height]} />
        {texture && (
          <meshBasicMaterial
            map={texture}
            side={THREE.FrontSide}
            depthTest={true}
            depthWrite={true}
            polygonOffset={true}
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        )}
      </mesh>

      {/* 3. Dedicated Overhead Warm Gallery Spotlight */}
      <spotLight
        position={[0, height / 2 + 1.2, 1.4]}
        target-position={[0, 0, 0]}
        color="#fff4db"
        intensity={2.6}
        angle={0.62}
        penumbra={0.7}
        distance={8.0}
      />
    </group>
  );
};

// ==================================================================================
// CORNER GALLERY ARTWORK 4: TWO KINGS FINE ART OIL PAINTING (Portrait)
// Exact replica from the user's reference photograph (media_1795278854268_02660110.jpg)
// Portrait aspect ratio, black gallery frame with inner gold reveal, dedicated museum spotlight.
// ==================================================================================
const TwoKingsArtwork: React.FC<CornerArtworkProps> = ({
  position,
  rotation,
  width = 2.45,
  height = 3.0,
}) => {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/artworks/two-kings-art.jpg');
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  }, []);

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Outer Sleek Black Gallery Frame */}
      <mesh position={[0, (height + 0.08) / 2, 0.015]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#121316" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, -(height + 0.08) / 2, 0.015]} castShadow>
        <boxGeometry args={[width + 0.16, 0.08, 0.08]} />
        <meshStandardMaterial color="#121316" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[-(width + 0.08) / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#121316" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[(width + 0.08) / 2, 0, 0.015]} castShadow>
        <boxGeometry args={[0.08, height, 0.08]} />
        <meshStandardMaterial color="#121316" metalness={0.4} roughness={0.35} />
      </mesh>

      {/* 1.5 Inner Gold Leaf Reveal Fillet */}
      <mesh position={[0, (height + 0.02) / 2, 0.035]} castShadow>
        <boxGeometry args={[width + 0.04, 0.02, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} emissive="#4a350c" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, -(height + 0.02) / 2, 0.035]} castShadow>
        <boxGeometry args={[width + 0.04, 0.02, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} emissive="#4a350c" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-(width + 0.02) / 2, 0, 0.035]} castShadow>
        <boxGeometry args={[0.02, height + 0.04, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} emissive="#4a350c" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[(width + 0.02) / 2, 0, 0.035]} castShadow>
        <boxGeometry args={[0.02, height + 0.04, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} emissive="#4a350c" emissiveIntensity={0.2} />
      </mesh>

      {/* Frame Backboard */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.08, height + 0.08]} />
        <meshStandardMaterial color="#08080a" roughness={0.9} />
      </mesh>

      {/* 2. Artwork Canvas with zero Z-fighting */}
      <mesh position={[0, 0, 0.025]} renderOrder={10}>
        <planeGeometry args={[width, height]} />
        {texture && (
          <meshBasicMaterial
            map={texture}
            side={THREE.FrontSide}
            depthTest={true}
            depthWrite={true}
            polygonOffset={true}
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        )}
      </mesh>

      {/* 3. Dedicated Overhead Warm Gallery Spotlight */}
      <spotLight
        position={[0, height / 2 + 1.2, 1.4]}
        target-position={[0, 0, 0]}
        color="#fff4db"
        intensity={2.6}
        angle={0.58}
        penumbra={0.65}
        distance={8.0}
      />
    </group>
  );
};

// ==================================================================================
// MODERN REDDISH-BROWN CREDENZA (Detailed, Sleek, Non-Chunky)
// Completely rich reddish-brown tone: top slab, cabinet body, door panels, and blade legs
// ==================================================================================
interface CredenzaProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

const Credenza: React.FC<CredenzaProps> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Slim Floating Top Slab in Rich Reddish-Brown Mahogany with subtle overhang */}
      <mesh position={[0, 0.94, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.8, 0.035, 0.5]} />
        <meshStandardMaterial color="#7a2b1c" roughness={0.32} metalness={0.08} />
      </mesh>

      {/* Main Cabinet Body — Completely Reddish-Brown */}
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.74, 0.54, 0.46]} />
        <meshStandardMaterial color="#632215" roughness={0.38} metalness={0.08} />
      </mesh>

      {/* 4 Cabinet Door Groove Division Lines & Inset Accents */}
      {[-1.18, 0, 1.18].map((gx, idx) => (
        <group key={idx} position={[gx, 0.65, 0.232]}>
          <mesh>
            <boxGeometry args={[0.01, 0.52, 0.004]} />
            <meshStandardMaterial color="#42140b" roughness={0.7} />
          </mesh>
          {/* Subtle vertical reddish-gold metallic finger pull accent */}
          <mesh position={[0, 0.12, 0.003]}>
            <boxGeometry args={[0.016, 0.16, 0.006]} />
            <meshStandardMaterial color="#9e3a22" metalness={0.85} roughness={0.22} />
          </mesh>
        </group>
      ))}

      {/* Sleek Blade Legs in Polished Reddish-Brown Lacquer / Bronze (Slender, Architectural) */}
      {/* Left Blade Unit */}
      <group position={[-1.55, 0.22, 0]}>
        {/* Front post */}
        <mesh position={[0, 0.16, 0.2]} castShadow>
          <boxGeometry args={[0.035, 0.72, 0.035]} />
          <meshStandardMaterial color="#591c10" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Rear post */}
        <mesh position={[0, 0.16, -0.2]} castShadow>
          <boxGeometry args={[0.035, 0.72, 0.035]} />
          <meshStandardMaterial color="#591c10" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Floor runner bar */}
        <mesh position={[0, -0.19, 0]}>
          <boxGeometry args={[0.035, 0.035, 0.52]} />
          <meshStandardMaterial color="#591c10" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Right Blade Unit */}
      <group position={[1.55, 0.22, 0]}>
        {/* Front post */}
        <mesh position={[0, 0.16, 0.2]} castShadow>
          <boxGeometry args={[0.035, 0.72, 0.035]} />
          <meshStandardMaterial color="#591c10" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Rear post */}
        <mesh position={[0, 0.16, -0.2]} castShadow>
          <boxGeometry args={[0.035, 0.72, 0.035]} />
          <meshStandardMaterial color="#591c10" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Floor runner bar */}
        <mesh position={[0, -0.19, 0]}>
          <boxGeometry args={[0.035, 0.035, 0.52]} />
          <meshStandardMaterial color="#591c10" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Detailed Accessories on Top of Credenza */}
      {/* 1. Abstract Gold Ribbon Loop Sculpture on Dark Marble Pedestal (Left side) */}
      <group position={[-1.5, 0.96, 0.02]}>
        {/* Black marble pedestal */}
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.12, 32]} />
          <meshStandardMaterial color="#18181a" roughness={0.2} metalness={0.3} />
        </mesh>
        {/* Slender golden connecting pin */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.06, 16]} />
          <meshStandardMaterial color="#d4b058" metalness={0.92} roughness={0.15} />
        </mesh>
        {/* Polished 24K Gold Ribbon Loop */}
        <mesh position={[0, 0.38, 0]} rotation={[0.4, 0.6, 0.2]} castShadow>
          <torusKnotGeometry args={[0.16, 0.032, 128, 32, 2, 3]} />
          <meshPhysicalMaterial
            color="#dfb858"
            metalness={0.94}
            roughness={0.12}
            clearcoat={0.9}
            clearcoatRoughness={0.1}
          />
        </mesh>
      </group>

      {/* 2. Stack of Vintage Hardcover Architectural Books (Right side) */}
      <group position={[1.4, 0.96, 0.02]}>
        {/* Bottom book (Dark Espresso with gold page edges) */}
        <mesh position={[0, 0.03, 0]} rotation={[0, 0.08, 0]} castShadow>
          <boxGeometry args={[0.46, 0.055, 0.32]} />
          <meshStandardMaterial color="#221712" roughness={0.55} />
        </mesh>
        {/* Gold page trim */}
        <mesh position={[0.22, 0.03, 0]} rotation={[0, 0.08, 0]}>
          <boxGeometry args={[0.02, 0.05, 0.3]} />
          <meshStandardMaterial color="#c6a45c" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Top book (Charcoal / Gold foil spine) */}
        <mesh position={[0.02, 0.085, 0.01]} rotation={[0, -0.05, 0]} castShadow>
          <boxGeometry args={[0.42, 0.048, 0.29]} />
          <meshStandardMaterial color="#363432" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

// ==================================================================================
// SLENDER DESIGNER BRASS FLOOR LAMP (Refined, Non-Chunky)
// ==================================================================================
interface FloorLampProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

const FloorLamp: React.FC<FloorLampProps> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Weighted Brass Disc Base */}
      <mesh position={[0, 0.025, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.3, 0.05, 36]} />
        <meshStandardMaterial color="#c6a45c" metalness={0.88} roughness={0.2} />
      </mesh>

      {/* Slender Vertical Stem */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.016, 2.7, 20]} />
        <meshStandardMaterial color="#c6a45c" metalness={0.88} roughness={0.2} />
      </mesh>

      {/* Elbow Arm Joint */}
      <mesh position={[0, 2.75, 0]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial color="#c6a45c" metalness={0.88} roughness={0.2} />
      </mesh>

      {/* Horizontal Curved Arm Extender */}
      <mesh position={[0.26, 2.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 0.52, 16]} />
        <meshStandardMaterial color="#c6a45c" metalness={0.88} roughness={0.2} />
      </mesh>

      {/* Conical Brushed Brass Lamp Shade */}
      <mesh position={[0.52, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.24, 0.32, 32]} />
        <meshStandardMaterial color="#c6a45c" metalness={0.88} roughness={0.25} />
      </mesh>

      {/* Warm Ambient Downward Light */}
      <pointLight position={[0.52, 2.44, 0]} color="#ffe8b8" intensity={1.5} distance={6.0} />
      <spotLight
        position={[0.52, 2.58, 0]}
        target-position={[0.52, 0, 0]}
        color="#fff0cc"
        intensity={2.2}
        angle={0.65}
        penumbra={0.7}
        distance={6.5}
      />
    </group>
  );
};

// ==================================================================================
// LUXURY ARTISTIC DESIGNER RUG (Warm gold, charcoal marble and rich crimson hues)
// ==================================================================================
const RoyalDesignerRug: React.FC = () => {
  const carpetTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Base Warm Ivory Cream
    ctx.fillStyle = '#f0ece3';
    ctx.fillRect(0, 0, 2048, 2048);

    // 2. Micro woven textile cross-stitch texture (optimized batched rasterization)
    ctx.fillStyle = 'rgba(180, 170, 155, 0.16)';
    for (let i = 0; i < 2048; i += 16) {
      ctx.fillRect(i, 0, 3, 2048);
      ctx.fillRect(0, i, 2048, 3);
    }

    // 3. Woven fringe tassels on ends
    const drawFringes = (yStart: number) => {
      ctx.fillStyle = '#f7f4ed';
      for (let x = 60; x < 1988; x += 10) {
        ctx.fillRect(x, yStart, 4, 30);
      }
    };
    drawFringes(10);
    drawFringes(2008);

    // 4. Outer Dark Espresso Border
    ctx.strokeStyle = '#281a14';
    ctx.lineWidth = 34;
    ctx.strokeRect(55, 55, 1938, 1938);

    // 5. Outer Gold Beaded Trim
    ctx.strokeStyle = '#c6a45c';
    ctx.lineWidth = 8;
    ctx.strokeRect(80, 80, 1888, 1888);

    // 6. Secondary Warm Cognac Brown Border
    ctx.fillStyle = '#4a2216';
    ctx.fillRect(90, 90, 1868, 110);
    ctx.fillRect(90, 1848, 1868, 110);
    ctx.fillRect(90, 90, 110, 1868);
    ctx.fillRect(1848, 90, 110, 1868);

    // Repeating Gold Floral Trefoils in Cognac band
    ctx.strokeStyle = '#d4aa50';
    ctx.lineWidth = 3.5;
    for (let x = 120; x < 1920; x += 44) {
      ctx.strokeRect(x, 118, 24, 52);
      ctx.strokeRect(x, 1876, 24, 52);
    }
    for (let y = 120; y < 1920; y += 44) {
      ctx.strokeRect(118, y, 52, 24);
      ctx.strokeRect(1876, y, 52, 24);
    }

    // 7. Middle Gold Stripe
    ctx.strokeStyle = '#c6a45c';
    ctx.lineWidth = 7;
    ctx.strokeRect(205, 205, 1638, 1638);

    // 8. Main Grand Crimson Red Arabesque Border
    ctx.fillStyle = '#7a1a1a';
    ctx.fillRect(212, 212, 1624, 130);
    ctx.fillRect(212, 1706, 1624, 130);
    ctx.fillRect(212, 212, 130, 1624);
    ctx.fillRect(1706, 212, 130, 1624);

    // Repeating Gold Palmettes
    const drawPalmette = (cx: number, cy: number, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = '#4a2216';
      ctx.strokeStyle = '#d8b056';
      ctx.lineWidth = 3;
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

    for (let x = 270; x < 1780; x += 78) {
      drawPalmette(x, 277, 0);
      drawPalmette(x, 1771, 0);
    }
    for (let y = 270; y < 1780; y += 78) {
      drawPalmette(277, y, Math.PI / 2);
      drawPalmette(1771, y, Math.PI / 2);
    }

    // 9. Inner Gold Border Line
    ctx.strokeStyle = '#c6a45c';
    ctx.lineWidth = 8;
    ctx.strokeRect(348, 348, 1352, 1352);

    // 10. Central Field: Rich Crimson Wine Red
    ctx.fillStyle = '#821a1a';
    ctx.fillRect(356, 356, 1336, 1336);

    // Gold diamond filigree lattice on field
    ctx.strokeStyle = 'rgba(212, 170, 80, 0.22)';
    ctx.lineWidth = 1.5;
    for (let d = -1336; d < 2672; d += 84) {
      ctx.beginPath();
      ctx.moveTo(356 + d, 356);
      ctx.lineTo(356 + d + 1336, 1692);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(356 + d, 1692);
      ctx.lineTo(356 + d + 1336, 356);
      ctx.stroke();
    }

    // 11. Four Corner Spandrels
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

    // 12. Central Royal Medallion (24-point Star with Rosette)
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

    // Central Rosette Core
    ctx.fillStyle = '#6b1414';
    ctx.strokeStyle = '#e2be68';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center Gold Pearl
    ctx.fillStyle = '#c6a45c';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 34, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, []);

  return (
    <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
      <planeGeometry args={[14.8, 14.8]} />
      <meshStandardMaterial map={carpetTexture || undefined} roughness={0.82} metalness={0.06} />
    </mesh>
  );
};

// ==================================================================================
// ARCHITECTURAL GEOMETRIC SQUARE CHANDELIER (Matching User Reference Photo 1)
// Two-tiered cascading hollow square frames in matte black anodized metal
// with continuous integrated warm-white glowing LED diffuser strips.
// Positioned above the board with wide hollow interior so it NEVER acts as a barrier.
// Performance optimized: Zero shader recompile, snappy smooth 60 FPS transitions.
// ==================================================================================
interface HollowSquareProps {
  size: number;
  barWidth: number;
  barHeight: number;
  diffuserHeight: number;
  metalMat: THREE.Material;
  diffuserMat: THREE.Material;
}

const HollowSquare: React.FC<HollowSquareProps> = ({
  size,
  barWidth,
  barHeight,
  diffuserHeight,
  metalMat,
  diffuserMat,
}) => {
  const halfSpan = (size - barWidth) / 2;
  const sideLength = size - 2 * barWidth;

  return (
    <group>
      {/* 1. Front Bar (+Z) */}
      <group position={[0, 0, halfSpan]}>
        <mesh material={metalMat} position={[0, 0, 0]} castShadow>
          <boxGeometry args={[size, barHeight, barWidth]} />
        </mesh>
        <mesh material={diffuserMat} position={[0, -barHeight / 2 - diffuserHeight / 2, 0]}>
          <boxGeometry args={[size, diffuserHeight, barWidth]} />
        </mesh>
        <mesh material={diffuserMat} position={[0, -barHeight / 4, -barWidth / 2 - 0.005]}>
          <boxGeometry args={[size - 2 * barWidth, barHeight / 2, 0.012]} />
        </mesh>
      </group>

      {/* 2. Back Bar (-Z) */}
      <group position={[0, 0, -halfSpan]}>
        <mesh material={metalMat} position={[0, 0, 0]} castShadow>
          <boxGeometry args={[size, barHeight, barWidth]} />
        </mesh>
        <mesh material={diffuserMat} position={[0, -barHeight / 2 - diffuserHeight / 2, 0]}>
          <boxGeometry args={[size, diffuserHeight, barWidth]} />
        </mesh>
        <mesh material={diffuserMat} position={[0, -barHeight / 4, barWidth / 2 + 0.005]}>
          <boxGeometry args={[size - 2 * barWidth, barHeight / 2, 0.012]} />
        </mesh>
      </group>

      {/* 3. Left Bar (-X) */}
      <group position={[-halfSpan, 0, 0]}>
        <mesh material={metalMat} position={[0, 0, 0]} castShadow>
          <boxGeometry args={[barWidth, barHeight, sideLength]} />
        </mesh>
        <mesh material={diffuserMat} position={[0, -barHeight / 2 - diffuserHeight / 2, 0]}>
          <boxGeometry args={[barWidth, diffuserHeight, sideLength]} />
        </mesh>
        <mesh material={diffuserMat} position={[barWidth / 2 + 0.005, -barHeight / 4, 0]}>
          <boxGeometry args={[0.012, barHeight / 2, sideLength]} />
        </mesh>
      </group>

      {/* 4. Right Bar (+X) */}
      <group position={[halfSpan, 0, 0]}>
        <mesh material={metalMat} position={[0, 0, 0]} castShadow>
          <boxGeometry args={[barWidth, barHeight, sideLength]} />
        </mesh>
        <mesh material={diffuserMat} position={[0, -barHeight / 2 - diffuserHeight / 2, 0]}>
          <boxGeometry args={[barWidth, diffuserHeight, sideLength]} />
        </mesh>
        <mesh material={diffuserMat} position={[-barWidth / 2 - 0.005, -barHeight / 4, 0]}>
          <boxGeometry args={[0.012, barHeight / 2, sideLength]} />
        </mesh>
      </group>
    </group>
  );
};

const ArchitecturalChandelier: React.FC = () => {
  const [isOn, setIsOn] = useState(true);
  const currentLvl = useRef(1);
  const cameraPreset = useGameStore((s) => s.cameraPreset);

  const physicalMeshesRef = useRef<THREE.Group>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const upperSpotRef = useRef<THREE.SpotLight>(null);
  const lowerSpotRef = useRef<THREE.SpotLight>(null);

  // Materials created ONCE on mount — NEVER recompiled on click!
  const { metalMat, diffuserMat, cableMat } = useMemo(() => {
    const metalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1a1d'),
      roughness: 0.35,
      metalness: 0.7,
    });

    const diffuserMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fffbf0'),
      emissive: new THREE.Color('#fff5dd'),
      emissiveIntensity: 5.0,
      roughness: 0.12,
      metalness: 0.05,
      toneMapped: false,
    });

    const cableMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#141416'),
      roughness: 0.4,
      metalness: 0.85,
    });

    return { metalMat, diffuserMat, cableMat };
  }, []);

  // Tucked right up against the 9.50m ceiling (lowest bar at 8.63m, safely above camera)
  const upperY = 9.15;
  const lowerY = 8.70;

  // Real-time zero-lag visibility check: Automatically hide physical chandelier when in top view or high-angle overhead orbit
  useFrame(({ camera }, delta: number) => {
    const dx = camera.position.x;
    const dz = camera.position.z;
    const horizDist = Math.hypot(dx, dz);
    const dy = camera.position.y - 1.35;
    const polarAngle = Math.atan2(horizDist, Math.max(0.01, dy));

    // Hide physical meshes when trying top view or viewing board from high overhead
    const isTopView = cameraPreset === 'top' || polarAngle < 1.05 || (camera.position.y > 4.5 && horizDist < 5.8);

    if (physicalMeshesRef.current) {
      physicalMeshesRef.current.visible = !isTopView;
    }

    const target = isOn ? 1 : 0;
    currentLvl.current = THREE.MathUtils.damp(currentLvl.current, target, 24, delta);
    const lvl = currentLvl.current;

    diffuserMat.emissiveIntensity = lvl * 5.0;
    diffuserMat.color.setRGB(
      0.82 + lvl * 0.18,
      0.82 + lvl * 0.16,
      0.84 + lvl * 0.10
    );

    if (pointLightRef.current) pointLightRef.current.intensity = lvl * 2.6;
    if (upperSpotRef.current) upperSpotRef.current.intensity = lvl * 2.6;
    if (lowerSpotRef.current) lowerSpotRef.current.intensity = lvl * 4.2;
  });

  return (
    <group>
      {/* Physical Chandelier Geometry — Instantly hides via ref.current.visible when in top view */}
      <group
        ref={physicalMeshesRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOn((prev) => !prev);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Invisible hit target for smooth, easy clicking */}
        <mesh position={[0, (upperY + lowerY) / 2, 0]}>
          <boxGeometry args={[3.4, 1.2, 3.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* 1. Ceiling Canopy Mount */}
        <group position={[0, 9.48, 0]}>
          <mesh material={metalMat} castShadow>
            <boxGeometry args={[1.8, 0.04, 0.46]} />
          </mesh>
          {[-0.65, 0.65].map((cx, idx) => (
            <React.Fragment key={idx}>
              <mesh material={cableMat} position={[cx, -0.02, -0.12]}>
                <cylinderGeometry args={[0.016, 0.016, 0.04, 16]} />
              </mesh>
              <mesh material={cableMat} position={[cx, -0.02, 0.12]}>
                <cylinderGeometry args={[0.016, 0.016, 0.04, 16]} />
              </mesh>
            </React.Fragment>
          ))}
        </group>

        {/* 2. Top-tier Suspension Cables (from canopy 9.48m down to upperY 9.15m) */}
        {[-0.65, 0.65].map((cx, idx) => (
          <React.Fragment key={idx}>
            <mesh material={cableMat} position={[cx, 9.315, -0.12]}>
              <cylinderGeometry args={[0.0035, 0.0035, 0.33, 12]} />
            </mesh>
            <mesh material={cableMat} position={[cx, 9.315, 0.12]}>
              <cylinderGeometry args={[0.0035, 0.0035, 0.33, 12]} />
            </mesh>
          </React.Fragment>
        ))}

        {/* 3. Upper Square Tier (3.2m x 3.2m) */}
        <group position={[0, upperY, 0]}>
          <HollowSquare
            size={3.2}
            barWidth={0.14}
            barHeight={0.14}
            diffuserHeight={0.024}
            metalMat={metalMat}
            diffuserMat={diffuserMat}
          />
        </group>

        {/* 4. Inter-tier Suspension Cables (from upperY 9.15m down to lowerY 8.70m) */}
        {[-0.85, 0.85].map((cx, idx) => (
          <React.Fragment key={idx}>
            <mesh material={cableMat} position={[cx, 8.925, -0.85]}>
              <cylinderGeometry args={[0.0035, 0.0035, 0.45, 12]} />
            </mesh>
            <mesh material={cableMat} position={[cx, 8.925, 0.85]}>
              <cylinderGeometry args={[0.0035, 0.0035, 0.45, 12]} />
            </mesh>
          </React.Fragment>
        ))}

        {/* 5. Lower Square Tier (2.1m x 2.1m) */}
        <group position={[0, lowerY, 0]}>
          <HollowSquare
            size={2.1}
            barWidth={0.14}
            barHeight={0.14}
            diffuserHeight={0.024}
            metalMat={metalMat}
            diffuserMat={diffuserMat}
          />
        </group>
      </group>

      {/* Central Focused Downlights — Always present so chessboard remains beautifully illuminated */}
      <pointLight
        ref={pointLightRef}
        position={[0, 9.2, 0]}
        color="#ffe9be"
        intensity={2.6}
        distance={20}
        decay={1.8}
      />
      <spotLight
        ref={upperSpotRef}
        position={[0, 9.3, 0]}
        target-position={[0, 1.35, 0]}
        color="#fff6e2"
        intensity={2.6}
        angle={1.1}
        penumbra={0.8}
        distance={16}
      />
      <spotLight
        ref={lowerSpotRef}
        position={[0, 9.1, 0]}
        target-position={[0, 1.35, 0]}
        color="#fff8ed"
        intensity={4.2}
        angle={0.92}
        penumbra={0.7}
        distance={16}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0003}
      />
    </group>
  );
};

// ==================================================================================
// CORNER GOLD RING CHANDELIER (Matching User Reference Photo 2)
// 3 dynamically angled circular rings in brushed champagne gold with glowing
// ultra-radiant golden LED diffuser tubes running directly on the rings.
// NO giant sphere overlays — the rings themselves glow powerfully!
// Performance optimized: Zero shader recompile, snappy smooth 60 FPS transitions.
// ==================================================================================
interface CornerGoldRingChandelierProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

const CornerGoldRingChandelier: React.FC<CornerGoldRingChandelierProps> = ({
  position,
  rotation = [0, 0, 0],
}) => {
  const [isOn, setIsOn] = useState(true);
  const currentLvl = useRef(1);

  const pointLightRef = useRef<THREE.PointLight>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const ceilingLightRef = useRef<THREE.PointLight>(null);

  // Materials created ONCE on mount — NEVER recompiled on click!
  const { goldMat, ledMat, cableMat } = useMemo(() => {
    // Brushed champagne gold metal body
    const goldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d4af37'),
      metalness: 0.88,
      roughness: 0.22,
      emissive: new THREE.Color('#946b10'),
      emissiveIntensity: 0.5,
    });

    // Highly radiant golden LED silicone diffuser tube running directly on the rings
    // toneMapped: false allows the LED to punch through with blazing intense golden luminescence
    const ledMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#ffaa18'),
      emissiveIntensity: 12.0,
      roughness: 0.1,
      metalness: 0.05,
      toneMapped: false,
    });

    // Slender silver steel suspension aircraft cables
    const cableMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c5c7cb'),
      metalness: 0.9,
      roughness: 0.2,
    });

    return { goldMat, ledMat, cableMat };
  }, []);

  // Snappy, clean, 60 FPS smooth transition (~0.12s) without ANY stutter or lag
  useFrame((_, delta: number) => {
    const target = isOn ? 1 : 0;
    currentLvl.current = THREE.MathUtils.damp(currentLvl.current, target, 26, delta);
    const lvl = currentLvl.current;

    // Rings themselves glow with intense, clean luminous power
    ledMat.emissiveIntensity = lvl * 12.0;
    ledMat.color.setRGB(
      0.75 + lvl * 0.25,
      0.72 + lvl * 0.28,
      0.65 + lvl * 0.35
    );

    // Gold metal body carries warm golden ambient reflection
    goldMat.emissiveIntensity = lvl * 0.5;

    // Update real scene lights smoothly
    if (pointLightRef.current) pointLightRef.current.intensity = lvl * 5.5;
    if (spotLightRef.current) spotLightRef.current.intensity = lvl * 6.5;
    if (ceilingLightRef.current) ceilingLightRef.current.intensity = lvl * 3.5;
  });

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        setIsOn((prev) => !prev);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Invisible easy-click sphere so user never misses the thin torus geometry */}
      <mesh position={[0, 7.35, 0]}>
        <sphereGeometry args={[1.7, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* 1. Round Brushed Gold Ceiling Canopy Mount */}
      <mesh material={goldMat} position={[0, 9.46, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.4, 0.08, 32]} />
      </mesh>

      {/* 2. Three Dynamic Intersecting Gold Rings (Glowing directly on the rings!) */}
      {/* Ring 1 (Top / Outer Ring — Large, slightly tilted) */}
      <group position={[0, 7.8, 0]} rotation={[0.22, 0.35, -0.15]}>
        {/* Brushed gold metal casing */}
        <mesh material={goldMat} castShadow>
          <torusGeometry args={[1.3, 0.042, 24, 72]} />
        </mesh>
        {/* Powerful glowing golden LED diffuser tube on top/inner rim */}
        <mesh material={ledMat} position={[0, 0.016, 0]}>
          <torusGeometry args={[1.3, 0.026, 16, 72]} />
        </mesh>
      </group>

      {/* Ring 2 (Middle Ring — Medium, angled crossing) */}
      <group position={[0.08, 7.35, -0.05]} rotation={[-0.32, -0.25, 0.28]}>
        {/* Brushed gold metal casing */}
        <mesh material={goldMat} castShadow>
          <torusGeometry args={[0.92, 0.038, 24, 72]} />
        </mesh>
        {/* Powerful glowing golden LED diffuser tube */}
        <mesh material={ledMat} position={[0, 0.015, 0]}>
          <torusGeometry args={[0.92, 0.024, 16, 72]} />
        </mesh>
      </group>

      {/* Ring 3 (Bottom / Inner Ring — Small, steeply angled) */}
      <group position={[-0.05, 6.9, 0.06]} rotation={[0.42, 0.45, 0.35]}>
        {/* Brushed gold metal casing */}
        <mesh material={goldMat} castShadow>
          <torusGeometry args={[0.62, 0.034, 24, 72]} />
        </mesh>
        {/* Powerful glowing golden LED diffuser tube */}
        <mesh material={ledMat} position={[0, 0.014, 0]}>
          <torusGeometry args={[0.62, 0.022, 16, 72]} />
        </mesh>
      </group>

      {/* 3. Slender Suspension Aircraft Cables */}
      {/* Cable length: 9.42 - 7.8 = 1.62; Midpoint: y = 8.61 */}
      {[-0.55, 0.55].map((cx, idx) => (
        <React.Fragment key={idx}>
          <mesh material={cableMat} position={[cx, 8.61, -0.35]}>
            <cylinderGeometry args={[0.0025, 0.0025, 1.62, 8]} />
          </mesh>
          <mesh material={cableMat} position={[cx, 8.61, 0.35]}>
            <cylinderGeometry args={[0.0025, 0.0025, 1.62, 8]} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Inter-ring suspension cables */}
      {/* Length: 7.8 - 7.35 = 0.45; Midpoint: y = 7.575 */}
      {[-0.45, 0.45].map((cx, idx) => (
        <React.Fragment key={idx}>
          <mesh material={cableMat} position={[cx, 7.575, -0.2]}>
            <cylinderGeometry args={[0.0025, 0.0025, 0.45, 8]} />
          </mesh>
          <mesh material={cableMat} position={[cx, 7.575, 0.2]}>
            <cylinderGeometry args={[0.0025, 0.0025, 0.45, 8]} />
          </mesh>
        </React.Fragment>
      ))}

      {/* 4. Golden Lighting: Mounted permanently, intensity modulated smoothly with 0 lag */}
      <pointLight
        ref={pointLightRef}
        position={[0, 7.3, 0]}
        color="#ffa826"
        intensity={5.0}
        distance={28}
        decay={1.6}
      />
      <pointLight
        ref={ceilingLightRef}
        position={[0, 8.8, 0]}
        color="#ffc866"
        intensity={3.0}
        distance={12}
        decay={2}
      />
      <spotLight
        ref={spotLightRef}
        position={[0, 7.2, 0]}
        target-position={[0, 0, 0]}
        color="#ffa31a"
        intensity={6.5}
        angle={1.15}
        penumbra={0.7}
        distance={24}
      />
    </group>
  );
};
// ==================================================================================
// ARCHITECTURAL WALL FEATURE (Matching reference photo)
// Stucco center wall flanked by rich dark walnut portal columns & brass reveals
// ==================================================================================
interface ArchitecturalWallProps {
  headingLine1: string;
  headingLine2: string;
  headingLine3: string;
  headingLine4: string;
  position: [number, number, number];
  rotation: [number, number, number];
}

const ArchitecturalWall: React.FC<ArchitecturalWallProps> = ({
  headingLine1,
  headingLine2,
  headingLine3,
  headingLine4,
  position,
  rotation,
}) => {
  return (
    <group position={position} rotation={rotation}>
      {/* 1. Main Background Wall (Pearl Ivory Cream Stucco) */}
      <mesh position={[0, 4.75, 0]} receiveShadow>
        <planeGeometry args={[32, 9.5]} />
        <meshStandardMaterial color="#ebe6de" roughness={0.75} />
      </mesh>

      {/* 2. Central Architectural Feature Pillar Wall (Warm cream, proud of main wall) */}
      <mesh position={[0, 4.75, 0.08]} receiveShadow>
        <boxGeometry args={[10.5, 9.5, 0.12]} />
        <meshStandardMaterial color="#f2eee8" roughness={0.65} />
      </mesh>

      {/* 3. Dark Walnut Architectural Portal Frames (Left & Right, matching photo) */}
      {/* Left Walnut Portal Column */}
      <mesh position={[-5.6, 4.75, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 9.5, 0.2]} />
        <meshStandardMaterial color="#2d1c13" roughness={0.4} />
      </mesh>
      {/* Left Portal Inset Gold Reveal Trim */}
      <mesh position={[-5.22, 4.75, 0.2]}>
        <boxGeometry args={[0.04, 9.5, 0.04]} />
        <meshStandardMaterial color="#c6a45c" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Right Walnut Portal Column */}
      <mesh position={[5.6, 4.75, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 9.5, 0.2]} />
        <meshStandardMaterial color="#2d1c13" roughness={0.4} />
      </mesh>
      {/* Right Portal Inset Gold Reveal Trim */}
      <mesh position={[5.22, 4.75, 0.2]}>
        <boxGeometry args={[0.04, 9.5, 0.04]} />
        <meshStandardMaterial color="#c6a45c" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* 4. Dark Walnut Baseboard along floor */}
      <mesh position={[0, 0.22, 0.2]}>
        <boxGeometry args={[32, 0.44, 0.1]} />
        <meshStandardMaterial color="#281810" roughness={0.45} />
      </mesh>

      {/* 5. The Signature Wall Artwork (Centered, floating on the feature wall) */}
      <WallArtwork
        headingLine1={headingLine1}
        headingLine2={headingLine2}
        headingLine3={headingLine3}
        headingLine4={headingLine4}
        position={[0, 5.2, 0.25]}
        rotation={[0, 0, 0]}
        width={3.8}
        height={5.0}
      />

      {/* 6. The Modern Walnut Credenza directly beneath the Artwork */}
      <Credenza position={[0, 0, 0.6]} />

      {/* 7. Designer Brass Floor Lamp standing beside the credenza */}
      <FloorLamp position={[-3.6, 0, 0.8]} rotation={[0, 0.25, 0]} />
    </group>
  );
};

// ==================================================================================
// EUROPEAN OAK HARDWOOD FLOOR (Matching Reference Photo)
// Warm honey-golden amber wide-plank oak flooring with authentic wood grain,
// staggered butt joints, natural knots, and subtle bevel seams across the entire 32m room.
// The Persian/Designer rug sits on top at y = 0.015, preserving the carpet in the center.
// ==================================================================================
const EuropeanOakHardwoodFloor: React.FC = () => {
  const oakTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 16 wide horizontal plank rows
    const numRows = 16;
    const rowHeight = canvas.height / numRows; // 64px per plank row

    // Base oak tones matching user photo: warm golden amber European oak
    const oakTones = [
      '#ba8f5c',
      '#af8452',
      '#b68c58',
      '#a67c49',
      '#c29965',
      '#b28755',
      '#9e7543',
      '#bb9260',
    ];

    // Seeded pseudo-random generator for consistent, seamless appearance
    let seed = 42;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Draw each plank row
    for (let r = 0; r < numRows; r++) {
      const y = r * rowHeight;

      // Staggered vertical end joints for this row
      const offsets = [0];
      const startOffset = ((r * 341) % 400) + 200;
      if (startOffset < 900) offsets.push(startOffset);
      if (startOffset + 475 < 975) offsets.push(startOffset + 475);
      offsets.push(canvas.width);

      for (let p = 0; p < offsets.length - 1; p++) {
        const x1 = offsets[p];
        const x2 = offsets[p + 1];
        const pWidth = x2 - x1;

        // Base color with natural plank-to-plank subtle shade variation
        const baseColor = oakTones[(r * 3 + p) % oakTones.length];
        ctx.fillStyle = baseColor;
        ctx.fillRect(x1, y, pWidth, rowHeight);

        // Subtle gradient across plank width for realistic ambient light
        const plankGrad = ctx.createLinearGradient(x1, y, x1, y + rowHeight);
        plankGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.08)');
        plankGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.0)');
        plankGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.12)');
        ctx.fillStyle = plankGrad;
        ctx.fillRect(x1, y, pWidth, rowHeight);

        // Batched longitudinal oak wood fibers
        const darkFibers = new Path2D();
        const lightFibers = new Path2D();
        const numFibers = 16;
        for (let f = 0; f < numFibers; f++) {
          const fy = y + (f / numFibers) * rowHeight + (random() - 0.5) * 2;
          const targetPath = random() > 0.45 ? darkFibers : lightFibers;
          targetPath.moveTo(x1, fy);

          const waveFreq = 0.016 + random() * 0.012;
          const waveAmp = 1.0 + random() * 2.0;
          const step = 25;
          for (let wx = x1 + step; wx <= x2; wx += step) {
            const wy = fy + Math.sin(wx * waveFreq + r) * waveAmp;
            targetPath.lineTo(wx, wy);
          }
        }
        ctx.strokeStyle = 'rgba(95, 62, 32, 0.18)';
        ctx.lineWidth = 1.0;
        ctx.stroke(darkFibers);

        ctx.strokeStyle = 'rgba(245, 218, 175, 0.10)';
        ctx.lineWidth = 1.0;
        ctx.stroke(lightFibers);

        // Realistic oak cathedral grain arcs on select planks
        if (random() > 0.6) {
          const cathCenter = x1 + pWidth * (0.3 + random() * 0.4);
          const cathY = y + rowHeight * (0.4 + random() * 0.2);
          for (let c = 5; c <= 30; c += 6) {
            ctx.strokeStyle = `rgba(80, 50, 24, ${0.14 + random() * 0.10})`;
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.ellipse(cathCenter, cathY, c * 2.5, c * 0.7, 0, 0, Math.PI);
            ctx.stroke();
          }
        }

        // Natural wood knot with swirling grain halo on occasional planks
        if (random() > 0.78) {
          const knotX = x1 + pWidth * (0.2 + random() * 0.6);
          const knotY = y + rowHeight * (0.3 + random() * 0.4);
          const knotR = 4 + random() * 5;

          ctx.fillStyle = '#422814';
          ctx.beginPath();
          ctx.ellipse(knotX, knotY, knotR, knotR * 0.65, random() * 0.3, 0, Math.PI * 2);
          ctx.fill();

          for (let kr = knotR + 3; kr <= knotR + 12; kr += 3) {
            ctx.strokeStyle = `rgba(70, 42, 20, ${0.16 - (kr - knotR) * 0.01})`;
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.ellipse(knotX, knotY, kr * 1.3, kr * 0.85, random() * 0.2, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Fine oak pores (tactile micro-ticks)
        for (let pCount = 0; pCount < 18; pCount++) {
          const px = x1 + random() * pWidth;
          const py = y + random() * rowHeight;
          ctx.fillStyle = 'rgba(75, 46, 22, 0.22)';
          ctx.fillRect(px, py, 3 + random() * 5, 1);
        }

        // Vertical end butt joint seam between planks in the row
        if (x1 > 0) {
          ctx.strokeStyle = '#2d1b0c';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x1, y + rowHeight);
          ctx.stroke();

          // Highlight bevel edge
          ctx.strokeStyle = 'rgba(255, 230, 190, 0.22)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1 + 1.0, y);
          ctx.lineTo(x1 + 1.0, y + rowHeight);
          ctx.stroke();
        }
      }

      // Horizontal V-groove chamfer seam between plank rows
      ctx.strokeStyle = '#2b190a';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();

      // Top light bevel highlight line
      ctx.strokeStyle = 'rgba(255, 235, 200, 0.20)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(0, y + 2.0);
      ctx.lineTo(canvas.width, y + 2.0);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5); // 5x repeat across 32m room = elegant wide plank scale
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = 16;
    return texture;
  }, []);

  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[32, 32]} />
      <meshStandardMaterial
        map={oakTexture || undefined}
        roughness={0.36}
        metalness={0.04}
      />
    </mesh>
  );
};

// ==================================================================================
// ARCHITECTURAL PARALLEL CEILING STRIP LIGHTS (Connecting the Four Chandeliers ONLY)
// Dual parallel architectural linear profile lights attached to the ceiling,
// connecting the four corner chandeliers (NW, NE, SW, SE) across North, South, East, and West.
// All unnecessary center, mid-room, and diagonal ceiling strips removed.
// - Ultra-high emissive power (intensity 18.0 with toneMapped: false)
// - 3D downward-protruding diffuser bars with multi-sided glowing faces
// - Additive translucent bloom halo for unmistakable radiant illumination
// - Continuously & permanently ON (no toggle/click functionality)
// ==================================================================================
const ArchitecturalParallelCeilingStripLights: React.FC = () => {
  const { housingMat, diffuserMat, haloMat } = useMemo(() => {
    // Satin dark architectural aluminum extrusion channel
    const housingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#141517'),
      roughness: 0.35,
      metalness: 0.8,
    });

    // Blazing ultra-radiant warm off-white silicone/acrylic LED diffuser
    const diffuserMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#fff7e0'),
      emissiveIntensity: 18.0,
      roughness: 0.05,
      metalness: 0.0,
      toneMapped: false,
    });

    // Soft additive bloom glow aura surrounding the strip
    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fffbe8'),
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    return { housingMat, diffuserMat, haloMat };
  }, []);

  const trackWidth = 0.09;
  const trackDepth = 0.038;
  const diffuserWidth = 0.07;
  const diffuserDepth = 0.032;
  const haloWidth = 0.16;
  const haloDepth = 0.065;

  const yHousing = 9.47;
  const yDiffuser = 9.442;
  const yHalo = 9.435;

  // Spacing between the dual parallel tracks = 0.38m (15 inches)
  const offset = 0.19;

  // Helper for straight parallel run along X-axis
  const renderXRun = (key: string, length: number, centerX: number, centerZ: number) => (
    <React.Fragment key={key}>
      {[-offset, offset].map((zOff, i) => (
        <group key={`${key}-${i}`} position={[centerX, 0, centerZ + zOff]}>
          {/* Aluminum Housing */}
          <mesh material={housingMat} position={[0, yHousing, 0]}>
            <boxGeometry args={[length, trackDepth, trackWidth]} />
          </mesh>
          {/* Blazing Off-White LED Diffuser (Extruded below housing for 3D visibility) */}
          <mesh material={diffuserMat} position={[0, yDiffuser, 0]}>
            <boxGeometry args={[length, diffuserDepth, diffuserWidth]} />
          </mesh>
          {/* Soft Additive Bloom Aura */}
          <mesh material={haloMat} position={[0, yHalo, 0]}>
            <boxGeometry args={[length, haloDepth, haloWidth]} />
          </mesh>
        </group>
      ))}
    </React.Fragment>
  );

  // Helper for straight parallel run along Z-axis
  const renderZRun = (key: string, length: number, centerX: number, centerZ: number) => (
    <React.Fragment key={key}>
      {[-offset, offset].map((xOff, i) => (
        <group key={`${key}-${i}`} position={[centerX + xOff, 0, centerZ]}>
          {/* Aluminum Housing */}
          <mesh material={housingMat} position={[0, yHousing, 0]}>
            <boxGeometry args={[trackWidth, trackDepth, length]} />
          </mesh>
          {/* Blazing Off-White LED Diffuser */}
          <mesh material={diffuserMat} position={[0, yDiffuser, 0]}>
            <boxGeometry args={[diffuserWidth, diffuserDepth, length]} />
          </mesh>
          {/* Soft Additive Bloom Aura */}
          <mesh material={haloMat} position={[0, yHalo, 0]}>
            <boxGeometry args={[haloWidth, haloDepth, length]} />
          </mesh>
        </group>
      ))}
    </React.Fragment>
  );

  return (
    <group raycast={() => null}>
      {/* =====================================================================
          PARALLEL STRIP LIGHTS CONNECTING THE FOUR CHANDELIERS ONLY
          ===================================================================== */}
      {/* 1. North Run: connecting NW and NE corner chandeliers (x: -10.5 to +10.5 at z = -10.5) */}
      {renderXRun('north-chandeliers', 21, 0, -10.5)}

      {/* 2. South Run: connecting SW and SE corner chandeliers (x: -10.5 to +10.5 at z = +10.5) */}
      {renderXRun('south-chandeliers', 21, 0, 10.5)}

      {/* 3. West Run: connecting NW and SW corner chandeliers (z: -10.5 to +10.5 at x = -10.5) */}
      {renderZRun('west-chandeliers', 21, -10.5, 0)}

      {/* 4. East Run: connecting NE and SE corner chandeliers (z: -10.5 to +10.5 at x = +10.5) */}
      {renderZRun('east-chandeliers', 21, 10.5, 0)}

      {/* =====================================================================
          Continuous Architectural Illumination along the 4 connecting runs
          ===================================================================== */}
      <pointLight position={[0, 9.1, -10.5]} color="#fffaf0" intensity={5.0} distance={20} decay={1.7} />
      <pointLight position={[0, 9.1, 10.5]} color="#fffaf0" intensity={5.0} distance={20} decay={1.7} />
      <pointLight position={[-10.5, 9.1, 0]} color="#fffaf0" intensity={5.0} distance={20} decay={1.7} />
      <pointLight position={[10.5, 9.1, 0]} color="#fffaf0" intensity={5.0} distance={20} decay={1.7} />
    </group>
  );
};

// ==================================================================================
// COMPLETE ROOM ENVIRONMENT — Ultra-luxurious gallery matching the reference photo
// ==================================================================================
export const RoomEnvironment: React.FC = () => {
  return (
    <group>
      {/* Soft Architectural Gallery Lighting */}
      <hemisphereLight color="#ffffff" groundColor="#dcd4c8" intensity={0.65} />
      <ambientLight color="#fdfaf4" intensity={0.4} />

      {/* Directional Soft Warm Fill Lighting */}
      <directionalLight position={[10, 8, 8]} color="#fff8ee" intensity={0.5} />
      <directionalLight position={[-10, 8, -8]} color="#f0e6d6" intensity={0.35} />

      {/* FLOOR: Complete European Oak Hardwood Flooring (matching reference photo) */}
      <EuropeanOakHardwoodFloor />

      {/* Artistic Luxury Persian/Designer Rug beneath floating board */}
      <RoyalDesignerRug />

      {/* Soft Contact Shadow beneath floating board */}
      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.65}
        scale={13}
        blur={1.6}
        far={5}
        color="#1f2124"
      />

      {/* CEILING: Clean Architectural Stucco (NO blocking beams!) */}
      <mesh position={[0, 9.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[32, 32]} />
        <meshStandardMaterial color="#f7f5f0" roughness={0.85} side={THREE.FrontSide} />
      </mesh>

      {/* Ceiling Recessed Perimeter Cove Moulding with Warm LED Lighting */}
      <mesh position={[0, 9.35, -15.85]}>
        <boxGeometry args={[32, 0.3, 0.2]} />
        <meshStandardMaterial color="#ded8ce" roughness={0.5} />
      </mesh>
      <mesh position={[0, 9.35, 15.85]}>
        <boxGeometry args={[32, 0.3, 0.2]} />
        <meshStandardMaterial color="#ded8ce" roughness={0.5} />
      </mesh>
      <mesh position={[-15.85, 9.35, 0]}>
        <boxGeometry args={[0.2, 0.3, 32]} />
        <meshStandardMaterial color="#ded8ce" roughness={0.5} />
      </mesh>
      <mesh position={[15.85, 9.35, 0]}>
        <boxGeometry args={[0.2, 0.3, 32]} />
        <meshStandardMaterial color="#ded8ce" roughness={0.5} />
      </mesh>

      {/* Off-White Parallel Strip Lights Attached to Ceiling Connecting the Chandeliers */}
      <ArchitecturalParallelCeilingStripLights />

      {/* ==================== FOUR ARCHITECTURAL WALLS ==================== */}
      {/* 1. North Wall (Back) — EXACT Signature Artwork from Reference Photo */}
      <ArchitecturalWall
        headingLine1="STAY"
        headingLine2="SIMPLE"
        headingLine3="STAY"
        headingLine4="TRUE"
        position={[0, 0, -16]}
        rotation={[0, 0, 0]}
      />

      {/* 2. South Wall (Front) */}
      <ArchitecturalWall
        headingLine1="THINK"
        headingLine2="BEYOND"
        headingLine3="THE"
        headingLine4="MOVE"
        position={[0, 0, 16]}
        rotation={[0, Math.PI, 0]}
      />

      {/* 3. West Wall (Left) */}
      <ArchitecturalWall
        headingLine1="MASTER"
        headingLine2="PATIENCE"
        headingLine3="CONQUER"
        headingLine4="MIND"
        position={[-16, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />

      {/* 4. East Wall (Right) */}
      <ArchitecturalWall
        headingLine1="SEE"
        headingLine2="DEEPER"
        headingLine3="PLAY"
        headingLine4="REGAL"
        position={[16, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      />

      {/* Reactive Interactive Floating Bulb in Room Center */}
            {/* Center 2-tiered Geometric Chandelier above chessboard */}
      <ArchitecturalChandelier />

      {/* Four Golden Ring Chandeliers in the 4 Ceiling Corners of the room */}
      {/* 1. North-West Corner */}
      <CornerGoldRingChandelier position={[-10.5, 0, -10.5]} />
      {/* 2. North-East Corner */}
      <CornerGoldRingChandelier position={[10.5, 0, -10.5]} />
      {/* 3. South-West Corner */}
      <CornerGoldRingChandelier position={[-10.5, 0, 10.5]} />
      {/* 4. South-East Corner */}
      <CornerGoldRingChandelier position={[10.5, 0, 10.5]} />

      {/* =====================================================================
          TWO CORNER GALLERY ARTWORKS IN NORTH-WEST CORNER (Matching User Photos)
          Directly in the corner shown in the user's screenshot:
          - West Wall (Left side): Black metal cutout chess silhouettes
          - North Wall (Right side): Vibrant King oil painting on colorful chessboard
          ===================================================================== */}
      {/* 1. West Wall (Left wall of corner in screenshot, facing +X) */}
      <ChessMetalArtwork
        position={[-15.86, 4.9, -10.6]}
        rotation={[0, Math.PI / 2, 0]}
        width={3.4}
        height={2.7}
      />

      {/* 2. North Wall (Right wall of corner in screenshot, facing +Z) */}
      <KingOilPaintingArtwork
        position={[-10.6, 4.9, -15.86]}
        rotation={[0, 0, 0]}
        width={2.3}
        height={3.18}
      />

      {/* =====================================================================
          TWO CORNER GALLERY ARTWORKS IN DIAGONALLY OPPOSITE SOUTH-EAST CORNER
          Diagonally opposite to NW corner, under the SE Corner Chandelier ([10.5, 0, 10.5])
          - East Wall (facing -X): Dynamic Chess Pieces Watercolor & Splatter Art
          - South Wall (facing -Z): Two Kings (White & Gold) Fine Art Oil Painting
          ===================================================================== */}
      {/* 1. East Wall (Left side when facing SE corner, facing -X) */}
      <ChessSplatterArtwork
        position={[15.86, 4.9, 10.6]}
        rotation={[0, -Math.PI / 2, 0]}
        width={2.8}
        height={2.8}
      />

      {/* 2. South Wall (Right side when facing SE corner, facing -Z) */}
      <TwoKingsArtwork
        position={[10.6, 4.9, 15.86]}
        rotation={[0, Math.PI, 0]}
        width={2.45}
        height={3.0}
      />

      {/* =====================================================================
          TWO CORNER GALLERY ARTWORKS IN NORTH-EAST CORNER
          The corner visible in the user's screenshot (blank walls meeting under chandelier).
          - North Wall (facing +Z): King Oil Painting (colorful expressionist)
          - East Wall (facing -X): Chess Metal Art (black silhouettes)
          ===================================================================== */}
      {/* 1. North Wall of NE corner (facing +Z) */}
      <KingOilPaintingArtwork
        position={[10.6, 4.9, -15.86]}
        rotation={[0, 0, 0]}
        width={2.3}
        height={3.18}
      />

      {/* 2. East Wall of NE corner (facing -X) */}
      <ChessMetalArtwork
        position={[15.86, 4.9, -10.6]}
        rotation={[0, -Math.PI / 2, 0]}
        width={3.4}
        height={2.7}
      />

      {/* =====================================================================
          TWO CORNER GALLERY ARTWORKS IN SOUTH-WEST CORNER
          Diagonally opposite to NE corner.
          - South Wall (facing -Z): Two Kings Fine Art Oil Painting
          - West Wall (facing +X): Chess Splatter Watercolor Art
          ===================================================================== */}
      {/* 1. South Wall of SW corner (facing -Z) */}
      <TwoKingsArtwork
        position={[-10.6, 4.9, 15.86]}
        rotation={[0, Math.PI, 0]}
        width={2.45}
        height={3.0}
      />

      {/* 2. West Wall of SW corner (facing +X) */}
      <ChessSplatterArtwork
        position={[-15.86, 4.9, 10.6]}
        rotation={[0, Math.PI / 2, 0]}
        width={2.8}
        height={2.8}
      />
    </group>
  );
};
