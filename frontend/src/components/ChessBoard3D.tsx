import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { ChessPiece3D } from './ChessPiece3D';
import { mergeTransformedParts, NO_RAYCAST } from '../utils/geometryUtils';

// Files and Ranks
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function squareToXZ(square: string): [number, number] {
  if (!square || square.length < 2) return [0, 0];
  const fIdx = square.charCodeAt(0) - 97;
  const rIdx = parseInt(square[1], 10) - 1;
  return [fIdx - 3.5, 3.5 - rIdx];
}

// ==================================================================================
// MERGED & INSTANCED CHESSBOARD ASSETS (Zero allocations, ~5 total draw calls!)
// Preserves crisp ivory/obsidian squares, inner gold beading, silver architectural bevel
// frame, and outer champagne-gold lip while eliminating 64 box raycasts & 15 static meshes!
// ==================================================================================
const boardAssets = typeof document !== 'undefined' ? (() => {
  const tileBoxGeo = new THREE.BoxGeometry(0.98, 0.12, 0.98);
  const highlightPlaneGeo = new THREE.PlaneGeometry(0.96, 0.96);
  const legalCircleGeo = new THREE.CircleGeometry(0.16, 18);
  const captureRingGeo = new THREE.RingGeometry(0.32, 0.42, 22);
  const hitGridPlaneGeo = new THREE.PlaneGeometry(8.0, 8.0);

  // Merge Silver Architectural Border & Undercarriage (7 meshes -> 1 draw call)
  const nsBorder = new THREE.BoxGeometry(8.96, 0.15, 0.72);
  const ewBorder = new THREE.BoxGeometry(0.72, 0.15, 8.16);
  const underBase = new THREE.BoxGeometry(9.16, 0.16, 9.16);
  const underBevel = new THREE.BoxGeometry(8.4, 0.12, 8.4);
  const frameMergedGeo = mergeTransformedParts([
    { geo: nsBorder, pos: [0, 0.035, -4.44] },
    { geo: nsBorder, pos: [0, 0.035, 4.44] },
    { geo: ewBorder, pos: [-4.44, 0.035, 0] },
    { geo: ewBorder, pos: [4.44, 0.035, 0] },
    { geo: underBase, pos: [0, -0.09, 0] },
    { geo: underBevel, pos: [0, -0.22, 0] },
  ]);
  nsBorder.dispose();
  ewBorder.dispose();
  underBase.dispose();
  underBevel.dispose();

  // Merge Inner Gold Beading & Outer Gold Perimeter Lip (8 meshes -> 1 draw call)
  const nsInnerGold = new THREE.BoxGeometry(8.16, 0.03, 0.08);
  const ewInnerGold = new THREE.BoxGeometry(0.08, 0.03, 8.0);
  const nsOuterGold = new THREE.BoxGeometry(9.16, 0.15, 0.04);
  const ewOuterGold = new THREE.BoxGeometry(0.04, 0.15, 9.16);
  const goldMergedGeo = mergeTransformedParts([
    { geo: nsInnerGold, pos: [0, 0.055, -4.04] },
    { geo: nsInnerGold, pos: [0, 0.055, 4.04] },
    { geo: ewInnerGold, pos: [-4.04, 0.055, 0] },
    { geo: ewInnerGold, pos: [4.04, 0.055, 0] },
    { geo: nsOuterGold, pos: [0, 0.035, -4.82] },
    { geo: nsOuterGold, pos: [0, 0.035, 4.82] },
    { geo: ewOuterGold, pos: [-4.82, 0.035, 0] },
    { geo: ewOuterGold, pos: [4.82, 0.035, 0] },
  ]);
  nsInnerGold.dispose();
  ewInnerGold.dispose();
  nsOuterGold.dispose();
  ewOuterGold.dispose();

  // Shared materials
  const lightSquareMat = new THREE.MeshStandardMaterial({ color: '#f6f4ee', roughness: 0.18, metalness: 0.04 });
  const darkSquareMat = new THREE.MeshStandardMaterial({ color: '#1e2025', roughness: 0.22, metalness: 0.06 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#cfd0cc', roughness: 0.35, metalness: 0.28 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: '#c6a45c', metalness: 0.88, roughness: 0.2 });

  const selectedMat = new THREE.MeshBasicMaterial({ color: '#c6a45c', transparent: true, opacity: 0.5 });
  const lastMoveMat = new THREE.MeshBasicMaterial({ color: '#d4b876', transparent: true, opacity: 0.35 });
  const checkMat = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.7 });
  const legalDotMat = new THREE.MeshBasicMaterial({ color: '#10b981', transparent: true, opacity: 0.88 });
  const captureRingMat = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.9 });
  const hitPlaneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  return {
    tileBoxGeo, highlightPlaneGeo, legalCircleGeo, captureRingGeo, hitGridPlaneGeo,
    frameMergedGeo, goldMergedGeo,
    lightSquareMat, darkSquareMat, frameMat, goldTrimMat,
    selectedMat, lastMoveMat, checkMat, legalDotMat, captureRingMat, hitPlaneMat,
  };
})() : null;

const _localPoint = new THREE.Vector3();

export const ChessBoard3D: React.FC = () => {
  const boardGroupRef = useRef<THREE.Group>(null);
  const lightInstancedRef = useRef<THREE.InstancedMesh>(null);
  const darkInstancedRef = useRef<THREE.InstancedMesh>(null);
  const floatTimeRef = useRef(0);
  const pointerDownRef = useRef<{ x: number; y: number; time: number; square: string } | null>(null);

  const pieces = useGameStore((s) => s.pieces);
  const selectedSquare = useGameStore((s) => s.selectedSquare);
  const legalMoves = useGameStore((s) => s.legalMoves);
  const lastMove = useGameStore((s) => s.lastMove);
  const kingInCheckSquare = useGameStore((s) => s.kingInCheckSquare);
  const showLegalMoves = useGameStore((s) => s.showLegalMoves);
  const selectSquare = useGameStore((s) => s.selectSquare);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const isMobile = useGameStore((s) => s.isMobile);

  // Initialize 32 light + 32 dark instanced square transforms once
  useEffect(() => {
    const dummy = new THREE.Object3D();
    let lightIdx = 0;
    let darkIdx = 0;

    for (let rIdx = 0; rIdx < 8; rIdx++) {
      for (let fIdx = 0; fIdx < 8; fIdx++) {
        const isDark = (fIdx + rIdx) % 2 === 0;
        dummy.position.set(fIdx - 3.5, 0, 3.5 - rIdx);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        if (isDark) {
          darkInstancedRef.current?.setMatrixAt(darkIdx++, dummy.matrix);
        } else {
          lightInstancedRef.current?.setMatrixAt(lightIdx++, dummy.matrix);
        }
      }
    }

    if (lightInstancedRef.current) lightInstancedRef.current.instanceMatrix.needsUpdate = true;
    if (darkInstancedRef.current) darkInstancedRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  // Subtle slow floating levitation without touching Three.Clock.getElapsedTime()
  useFrame((_, delta) => {
    if (!boardGroupRef.current) return;
    floatTimeRef.current += delta;
    boardGroupRef.current.position.y = 1.35 + Math.sin(floatTimeRef.current * 0.85) * 0.035;
  });

  // Resolve exact chess square string from a single raycast hit on the 8x8 plane
  const resolveSquareFromHit = (e: ThreeEvent<PointerEvent>): string | null => {
    if (!boardGroupRef.current) return null;
    _localPoint.copy(e.point);
    boardGroupRef.current.worldToLocal(_localPoint);
    const fIdx = Math.floor(_localPoint.x + 4.0);
    const rIdx = Math.floor(4.0 - _localPoint.z);
    if (fIdx < 0 || fIdx > 7 || rIdx < 0 || rIdx > 7) return null;
    return `${FILES[fIdx]}${RANKS[rIdx]}`;
  };

  // Highlight coordinates for active squares only (avoids 64 idle highlight groups)
  const selectedCoords = useMemo(() => (selectedSquare ? squareToXZ(selectedSquare) : null), [selectedSquare]);
  const lastMoveFromCoords = useMemo(
    () => (lastMove && lastMove.from !== selectedSquare ? squareToXZ(lastMove.from) : null),
    [lastMove, selectedSquare]
  );
  const lastMoveToCoords = useMemo(
    () => (lastMove && lastMove.to !== selectedSquare ? squareToXZ(lastMove.to) : null),
    [lastMove, selectedSquare]
  );
  const checkCoords = useMemo(() => (kingInCheckSquare ? squareToXZ(kingInCheckSquare) : null), [kingInCheckSquare]);

  const legalMarkers = useMemo(() => {
    if (!showLegalMoves || legalMoves.length === 0) return [];
    return legalMoves.map((m) => {
      const [x, z] = squareToXZ(m.to);
      return {
        square: m.to,
        x,
        z,
        isCapture: !!m.captured || !!m.isEnPassant,
      };
    });
  }, [legalMoves, showLegalMoves]);

  if (!boardAssets) return null;

  const shadowsEnabled = graphicsQuality !== 'low';

  return (
    <group ref={boardGroupRef} position={[0, 1.35, 0]}>
      {/* ==================== 64 CHESS SQUARES IN 2 INSTANCED DRAW CALLS ==================== */}
      <instancedMesh
        ref={lightInstancedRef}
        args={[boardAssets.tileBoxGeo, boardAssets.lightSquareMat, 32]}
        receiveShadow={shadowsEnabled}
        frustumCulled={false}
        raycast={NO_RAYCAST}
      />
      <instancedMesh
        ref={darkInstancedRef}
        args={[boardAssets.tileBoxGeo, boardAssets.darkSquareMat, 32]}
        receiveShadow={shadowsEnabled}
        frustumCulled={false}
        raycast={NO_RAYCAST}
      />

      {/* Single 8x8 Raycast Target Plane replacing 64 box raycasts & 256 closures */}
      <mesh
        position={[0, 0.062, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={boardAssets.hitGridPlaneGeo}
        material={boardAssets.hitPlaneMat}
        onPointerDown={(e) => {
          if (typeof window !== 'undefined' && window.__lastPinchEndTime && performance.now() - window.__lastPinchEndTime < 350) {
            return;
          }
          const sq = resolveSquareFromHit(e);
          if (sq) {
            pointerDownRef.current = { x: e.clientX, y: e.clientY, time: performance.now(), square: sq };
          }
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
            selectSquare(start.square);
          }
        }}
        onPointerMove={
          isMobile || !showLegalMoves || legalMarkers.length === 0
            ? undefined
            : (e) => {
                const sq = resolveSquareFromHit(e);
                const isLegal = sq ? legalMarkers.some((m) => m.square === sq) : false;
                document.body.style.cursor = isLegal ? 'pointer' : 'auto';
              }
        }
        onPointerOut={
          isMobile
            ? undefined
            : () => {
                document.body.style.cursor = 'auto';
              }
        }
      />

      {/* ==================== ACTIVE SQUARE HIGHLIGHTS & LEGAL MARKERS ==================== */}
      {selectedCoords && (
        <mesh
          position={[selectedCoords[0], 0.065, selectedCoords[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={boardAssets.highlightPlaneGeo}
          material={boardAssets.selectedMat}
          raycast={NO_RAYCAST}
        />
      )}
      {lastMoveFromCoords && (
        <mesh
          position={[lastMoveFromCoords[0], 0.064, lastMoveFromCoords[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={boardAssets.highlightPlaneGeo}
          material={boardAssets.lastMoveMat}
          raycast={NO_RAYCAST}
        />
      )}
      {lastMoveToCoords && (
        <mesh
          position={[lastMoveToCoords[0], 0.064, lastMoveToCoords[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={boardAssets.highlightPlaneGeo}
          material={boardAssets.lastMoveMat}
          raycast={NO_RAYCAST}
        />
      )}
      {checkCoords && (
        <mesh
          position={[checkCoords[0], 0.066, checkCoords[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={boardAssets.highlightPlaneGeo}
          material={boardAssets.checkMat}
          raycast={NO_RAYCAST}
        />
      )}
      {legalMarkers.map((m) => (
        <mesh
          key={m.square}
          position={[m.x, 0.068, m.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          geometry={m.isCapture ? boardAssets.captureRingGeo : boardAssets.legalCircleGeo}
          material={m.isCapture ? boardAssets.captureRingMat : boardAssets.legalDotMat}
          raycast={NO_RAYCAST}
        />
      ))}

      {/* ==================== MERGED BOARD FRAME, GOLD BEADING & UNDERCARRIAGE ==================== */}
      <mesh
        geometry={boardAssets.frameMergedGeo}
        material={boardAssets.frameMat}
        receiveShadow={shadowsEnabled}
        raycast={NO_RAYCAST}
      />
      <mesh
        geometry={boardAssets.goldMergedGeo}
        material={boardAssets.goldTrimMat}
        raycast={NO_RAYCAST}
      />

      {/* Subtle warm underglow (high/ultra only to save fragment light loop on mobile) */}
      {(graphicsQuality === 'high' || graphicsQuality === 'ultra') && (
        <pointLight position={[0, -0.35, 0]} color="#c6a45c" intensity={0.25} distance={3.0} />
      )}

      {/* ==================== 3D CHESS PIECES ==================== */}
      <group position={[0, 0.06, 0]}>
        {pieces.map((piece) => (
          <ChessPiece3D
            key={piece.id}
            id={piece.id}
            type={piece.type}
            color={piece.color}
            square={piece.square}
          />
        ))}
      </group>
    </group>
  );
};
