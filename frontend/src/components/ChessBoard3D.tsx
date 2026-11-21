import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { ChessPiece3D } from './ChessPiece3D';

// Files and Ranks
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

// Module-level singleton geometries shared across all 64 squares (zero allocation on render)
const tileBoxGeo = typeof document !== 'undefined' ? new THREE.BoxGeometry(0.98, 0.12, 0.98) : null;
const highlightPlaneGeo = typeof document !== 'undefined' ? new THREE.PlaneGeometry(0.96, 0.96) : null;
const legalCircleGeo = typeof document !== 'undefined' ? new THREE.CircleGeometry(0.16, 20) : null;
const captureRingGeo = typeof document !== 'undefined' ? new THREE.RingGeometry(0.32, 0.42, 24) : null;

export const ChessBoard3D: React.FC = () => {
  const boardGroupRef = useRef<THREE.Group>(null);
  const pointerDownPosRef = useRef<Map<string, { x: number; y: number; time: number }>>(new Map());

  const pieces = useGameStore((s) => s.pieces);
  const selectedSquare = useGameStore((s) => s.selectedSquare);
  const legalMoves = useGameStore((s) => s.legalMoves);
  const lastMove = useGameStore((s) => s.lastMove);
  const kingInCheckSquare = useGameStore((s) => s.kingInCheckSquare);
  const showLegalMoves = useGameStore((s) => s.showLegalMoves);
  const selectSquare = useGameStore((s) => s.selectSquare);

  // Subtle slow floating levitation animation
  useFrame(({ clock }) => {
    if (boardGroupRef.current) {
      const t = clock.getElapsedTime();
      boardGroupRef.current.position.y = 1.35 + Math.sin(t * 0.85) * 0.035;
    }
  });

  // High-contrast, pristine materials for the board
  const { lightSquareMat, darkSquareMat, frameMat, goldTrimMat } = useMemo(() => {
    // Light squares: Warm pristine ivory alabaster
    const light = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f6f4ee'),
      roughness: 0.18,
      metalness: 0.04,
    });

    // Dark squares: Rich obsidian charcoal / dark smoked stone
    const dark = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e2025'),
      roughness: 0.22,
      metalness: 0.06,
    });

    // Outer Frame: Brushed pearl silver / architectural grey
    const frame = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#cfd0cc'),
      roughness: 0.35,
      metalness: 0.28,
    });

    // Champagne gold inlay trim
    const gold = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c6a45c'),
      metalness: 0.88,
      roughness: 0.2,
    });

    return {
      lightSquareMat: light,
      darkSquareMat: dark,
      frameMat: frame,
      goldTrimMat: gold,
    };
  }, []);

  // Quick lookup for legal moves
  const legalDestMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (showLegalMoves) {
      legalMoves.forEach((m) => {
        map.set(m.to, !!m.captured || !!m.isEnPassant);
      });
    }
    return map;
  }, [legalMoves, showLegalMoves]);

  return (
    <group ref={boardGroupRef} position={[0, 1.35, 0]}>
      {/* ==================== 64 CHESS SQUARES (CRISP BLACK & WHITE) ==================== */}
      <group position={[0, 0, 0]}>
        {RANKS.map((rank, rIdx) => {
          return FILES.map((file, fIdx) => {
            const square = `${file}${rank}`;
            // Standard chess coloring: a1 (0,0) is dark
            const isDark = (fIdx + rIdx) % 2 === 0;

            const x = fIdx - 3.5;
            const z = 3.5 - rIdx;

            const isSelected = selectedSquare === square;
            const isLegalDest = legalDestMap.has(square);
            const isCaptureDest = legalDestMap.get(square) === true;
            const isLastMoveSquare =
              lastMove && (lastMove.from === square || lastMove.to === square);
            const isKingInCheck = kingInCheckSquare === square;

            return (
              <group key={square} position={[x, 0, z]}>
                {/* Physical square tile: 0.98 x 0.12 x 0.98 */}
                <mesh
                  receiveShadow
                  geometry={tileBoxGeo || undefined}
                  material={isDark ? darkSquareMat : lightSquareMat}
                  onPointerDown={(e) => {
                    pointerDownPosRef.current.set(square, {
                      x: e.clientX,
                      y: e.clientY,
                      time: performance.now(),
                    });
                  }}
                  onPointerUp={(e) => {
                    const start = pointerDownPosRef.current.get(square);
                    if (start) {
                      pointerDownPosRef.current.delete(square);
                      const dx = e.clientX - start.x;
                      const dy = e.clientY - start.y;
                      const dt = performance.now() - start.time;
                      if (Math.hypot(dx, dy) < 14 && dt < 500) {
                        e.stopPropagation();
                        selectSquare(square);
                      }
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectSquare(square);
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    if (isLegalDest) document.body.style.cursor = 'pointer';
                  }}
                  onPointerOut={() => {
                    document.body.style.cursor = 'auto';
                  }}
                />

                {/* Selected square golden glow */}
                {isSelected && (
                  <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={highlightPlaneGeo || undefined}>
                    <meshBasicMaterial color="#c6a45c" transparent opacity={0.5} />
                  </mesh>
                )}

                {/* Last move indicator (subtle amber/gold highlight) */}
                {isLastMoveSquare && !isSelected && (
                  <mesh position={[0, 0.064, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={highlightPlaneGeo || undefined}>
                    <meshBasicMaterial color="#d4b876" transparent opacity={0.35} />
                  </mesh>
                )}

                {/* King in Check indicator (pulsing red warning aura) */}
                {isKingInCheck && (
                  <mesh position={[0, 0.066, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={highlightPlaneGeo || undefined}>
                    <meshBasicMaterial color="#ef4444" transparent opacity={0.7} />
                  </mesh>
                )}

                {/* Legal move: Empty square emerald dot */}
                {isLegalDest && !isCaptureDest && (
                  <mesh position={[0, 0.068, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={legalCircleGeo || undefined}>
                    <meshBasicMaterial color="#10b981" transparent opacity={0.88} />
                  </mesh>
                )}

                {/* Legal move: Capture target ruby ring */}
                {isLegalDest && isCaptureDest && (
                  <mesh position={[0, 0.068, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={captureRingGeo || undefined}>
                    <meshBasicMaterial color="#ef4444" transparent opacity={0.9} />
                  </mesh>
                )}
              </group>
            );
          });
        })}
      </group>

      {/* ==================== BORDER AROUND SQUARES (NO OVERLAY COVERING THE SQUARES) ==================== */}
      {/* 1. Inner Gold Beading Inlay around perimeter of squares */}
      {/* North */}
      <mesh position={[0, 0.055, -4.04]} material={goldTrimMat}>
        <boxGeometry args={[8.16, 0.03, 0.08]} />
      </mesh>
      {/* South */}
      <mesh position={[0, 0.055, 4.04]} material={goldTrimMat}>
        <boxGeometry args={[8.16, 0.03, 0.08]} />
      </mesh>
      {/* West */}
      <mesh position={[-4.04, 0.055, 0]} material={goldTrimMat}>
        <boxGeometry args={[0.08, 0.03, 8.0]} />
      </mesh>
      {/* East */}
      <mesh position={[4.04, 0.055, 0]} material={goldTrimMat}>
        <boxGeometry args={[0.08, 0.03, 8.0]} />
      </mesh>

      {/* 2. Outer Architectural Board Border (Silver / Grey with bevel) */}
      {/* North frame section */}
      <mesh position={[0, 0.035, -4.44]} receiveShadow material={frameMat}>
        <boxGeometry args={[8.96, 0.15, 0.72]} />
      </mesh>
      {/* South frame section */}
      <mesh position={[0, 0.035, 4.44]} receiveShadow material={frameMat}>
        <boxGeometry args={[8.96, 0.15, 0.72]} />
      </mesh>
      {/* West frame section */}
      <mesh position={[-4.44, 0.035, 0]} receiveShadow material={frameMat}>
        <boxGeometry args={[0.72, 0.15, 8.16]} />
      </mesh>
      {/* East frame section */}
      <mesh position={[4.44, 0.035, 0]} receiveShadow material={frameMat}>
        <boxGeometry args={[0.72, 0.15, 8.16]} />
      </mesh>

      {/* 3. Outer Gold Perimeter Lip */}
      <mesh position={[0, 0.035, -4.82]} material={goldTrimMat}>
        <boxGeometry args={[9.16, 0.15, 0.04]} />
      </mesh>
      <mesh position={[0, 0.035, 4.82]} material={goldTrimMat}>
        <boxGeometry args={[9.16, 0.15, 0.04]} />
      </mesh>
      <mesh position={[-4.82, 0.035, 0]} material={goldTrimMat}>
        <boxGeometry args={[0.04, 0.15, 9.16]} />
      </mesh>
      <mesh position={[4.82, 0.035, 0]} material={goldTrimMat}>
        <boxGeometry args={[0.04, 0.15, 9.16]} />
      </mesh>

      {/* 4. Solid Structural Undercarriage Base (positioned safely BELOW the squares at y = -0.09) */}
      <mesh position={[0, -0.09, 0]} receiveShadow material={frameMat}>
        <boxGeometry args={[9.16, 0.16, 9.16]} />
      </mesh>

      {/* 5. Underside Architectural Bevel */}
      <mesh position={[0, -0.22, 0]} material={frameMat}>
        <boxGeometry args={[8.4, 0.12, 8.4]} />
      </mesh>

      {/* Subtle warm underglow */}
      <pointLight position={[0, -0.35, 0]} color="#c6a45c" intensity={0.25} distance={3.0} />

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
