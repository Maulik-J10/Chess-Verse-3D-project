import React, { useState, useEffect, useRef, memo } from 'react';

interface PreloaderProps {
  onFinish?: () => void;
}

// ================= MEMOIZED LEFT WHITE KING FIGURE =================
const WhiteKingFigure = memo(() => (
  <div className="flex flex-col items-center animate-fade-in pointer-events-none select-none">
    <div className="relative drop-shadow-[0_10px_25px_rgba(212,175,55,0.25)]">
      <svg
        className="w-14 h-24 sm:w-32 sm:h-56 filter drop-shadow-md"
        viewBox="0 0 100 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="whiteKingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#f3ede2" />
            <stop offset="100%" stopColor="#ded5c4" />
          </linearGradient>
          <linearGradient id="goldAccentGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#cca044" />
            <stop offset="50%" stopColor="#fae19d" />
            <stop offset="100%" stopColor="#b9872e" />
          </linearGradient>
        </defs>

        {/* Cross on top */}
        <rect x="47" y="10" width="6" height="22" rx="2" fill="url(#goldAccentGrad)" />
        <rect x="39" y="16" width="22" height="6" rx="2" fill="url(#goldAccentGrad)" />
        <circle cx="50" cy="11" r="2.5" fill="#fffbe8" />

        {/* Crown bulb */}
        <ellipse cx="50" cy="34" rx="14" ry="7" fill="url(#whiteKingGrad)" />
        <ellipse cx="50" cy="34" rx="13" ry="5" fill="none" stroke="url(#goldAccentGrad)" strokeWidth="1.5" />

        {/* Crown body (coronet) */}
        <path
          d="M32 46 C34 38, 44 37, 50 40 C56 37, 66 38, 68 46 C66 48, 34 48, 32 46 Z"
          fill="url(#whiteKingGrad)"
        />
        <path
          d="M30 46 Q50 48 70 46 L68 56 Q50 60 32 56 Z"
          fill="url(#whiteKingGrad)"
          stroke="#baa888"
          strokeWidth="1"
        />
        {/* Crown gold collar band */}
        <rect x="29" y="55" width="42" height="5" rx="2.5" fill="url(#goldAccentGrad)" />

        {/* King Head / Neck */}
        <path
          d="M34 60 C32 75, 36 90, 30 112 L70 112 C64 90, 68 75, 66 60 Z"
          fill="url(#whiteKingGrad)"
        />
        {/* Subtle gold inlay chest line */}
        <path d="M50 63 L50 110" stroke="url(#goldAccentGrad)" strokeWidth="2" strokeDasharray="3 3" opacity="0.75" />

        {/* Upper Pedestal Ring */}
        <rect x="24" y="112" width="52" height="6" rx="2" fill="url(#goldAccentGrad)" />

        {/* Tiered Base */}
        <path
          d="M26 118 L20 138 C18 142, 82 142, 80 138 L74 118 Z"
          fill="url(#whiteKingGrad)"
        />
        <ellipse cx="50" cy="138" rx="32" ry="5" fill="#ded5c4" />
        <rect x="14" y="139" width="72" height="9" rx="3" fill="url(#goldAccentGrad)" />
      </svg>
      <div className="absolute -bottom-2 inset-x-0 h-4 bg-[#c6a45c]/25 blur-md rounded-full" />
    </div>
    <span className="text-[10px] font-serif tracking-widest text-[#d4af37] uppercase font-bold mt-2">
      White King
    </span>
  </div>
));
WhiteKingFigure.displayName = 'WhiteKingFigure';

// ================= MEMOIZED RIGHT BLACK KING FIGURE =================
const BlackKingFigure = memo(() => (
  <div className="flex flex-col items-center animate-fade-in pointer-events-none select-none">
    <div className="relative drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)]">
      <svg
        className="w-14 h-24 sm:w-32 sm:h-56 filter drop-shadow-md"
        viewBox="0 0 100 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="blackKingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#303138" />
            <stop offset="50%" stopColor="#1e1f24" />
            <stop offset="100%" stopColor="#121316" />
          </linearGradient>
        </defs>

        {/* Cross on top */}
        <rect x="47" y="10" width="6" height="22" rx="2" fill="url(#goldAccentGrad)" />
        <rect x="39" y="16" width="22" height="6" rx="2" fill="url(#goldAccentGrad)" />
        <circle cx="50" cy="11" r="2.5" fill="#fae19d" />

        {/* Crown bulb */}
        <ellipse cx="50" cy="34" rx="14" ry="7" fill="url(#blackKingGrad)" />
        <ellipse cx="50" cy="34" rx="13" ry="5" fill="none" stroke="url(#goldAccentGrad)" strokeWidth="1.5" />

        {/* Crown body (coronet) */}
        <path
          d="M32 46 C34 38, 44 37, 50 40 C56 37, 66 38, 68 46 C66 48, 34 48, 32 46 Z"
          fill="url(#blackKingGrad)"
        />
        <path
          d="M30 46 Q50 48 70 46 L68 56 Q50 60 32 56 Z"
          fill="url(#blackKingGrad)"
          stroke="#44464d"
          strokeWidth="1"
        />
        {/* Crown gold collar band */}
        <rect x="29" y="55" width="42" height="5" rx="2.5" fill="url(#goldAccentGrad)" />

        {/* King Head / Neck */}
        <path
          d="M34 60 C32 75, 36 90, 30 112 L70 112 C64 90, 68 75, 66 60 Z"
          fill="url(#blackKingGrad)"
        />
        {/* Subtle gold inlay chest line */}
        <path d="M50 63 L50 110" stroke="url(#goldAccentGrad)" strokeWidth="2" strokeDasharray="3 3" opacity="0.65" />

        {/* Upper Pedestal Ring */}
        <rect x="24" y="112" width="52" height="6" rx="2" fill="url(#goldAccentGrad)" />

        {/* Tiered Base */}
        <path
          d="M26 118 L20 138 C18 142, 82 142, 80 138 L74 118 Z"
          fill="url(#blackKingGrad)"
        />
        <ellipse cx="50" cy="138" rx="32" ry="5" fill="#18191c" />
        <rect x="14" y="139" width="72" height="9" rx="3" fill="url(#goldAccentGrad)" />
      </svg>
      <div className="absolute -bottom-2 inset-x-0 h-4 bg-black/60 blur-md rounded-full" />
    </div>
    <span className="text-[10px] font-serif tracking-widest text-[#a39c8f] uppercase font-bold mt-2">
      Black King
    </span>
  </div>
));
BlackKingFigure.displayName = 'BlackKingFigure';

export const Preloader: React.FC<PreloaderProps> = ({ onFinish }) => {
  const [isFading, setIsFading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const startTime = performance.now();
    const duration = 1400; // Brisk GPU-composited entry without React state thrash during 3D startup

    let rafId = 0;
    let fadeTimer = 0;
    let doneTimer = 0;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${pct / 100})`;
      }
      if (pctRef.current) {
        pctRef.current.textContent = `${pct}%`;
      }
      if (pct >= 100) {
        if (statusRef.current) {
          statusRef.current.textContent = 'Ready';
        }
        fadeTimer = window.setTimeout(() => {
          setIsFading(true);
          doneTimer = window.setTimeout(() => {
            setIsDone(true);
            sessionStorage.setItem('chessverse3d_preloaded', 'true');
            if (onFinish) onFinish();
          }, 320);
        }, 80);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  if (isDone) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0d0e12] select-none transition-opacity duration-350 ease-out will-change-opacity ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(ellipse at center, #1c1a16 0%, #0d0e12 75%, #070709 100%)',
      }}
    >
      {/* Central Brand Container with Two Flanking Kings */}
      <div className="relative flex items-center justify-center gap-2 sm:gap-14 max-w-4xl px-2 sm:px-4 w-full">
        {/* ================= LEFT: MAJESTIC WHITE KING ================= */}
        <WhiteKingFigure />

        {/* ================= CENTER: TITLE & PROGRESS ================= */}
        <div className="flex flex-col items-center text-center px-1 sm:px-2 z-10 min-w-0">
          {/* Royal Insignia Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:px-3.5 sm:py-1 rounded-full bg-[#181613] border border-[#c6a45c]/40 text-[#c6a45c] text-[9px] sm:text-[10px] font-serif font-bold tracking-[0.2em] sm:tracking-[0.25em] uppercase mb-2 sm:mb-4 shadow-sm">
            <span className="text-[#fae19d]">✦</span>
            <span>ROYAL 3D CHESS</span>
            <span className="text-[#fae19d]">✦</span>
          </div>

          {/* Game Title: ChessVerse3D */}
          <h1 className="text-2xl sm:text-6xl font-serif font-black tracking-wider text-white mb-1 sm:mb-2 drop-shadow-[0_4px_20px_rgba(200,160,70,0.35)] truncate">
            Chess<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#cca044] via-[#fae19d] to-[#caa048]">Verse</span><span className="text-[#fff4d1]">3D</span>
          </h1>

          {/* Subtitle */}
          <p className="text-[10px] sm:text-sm font-serif italic text-[#a39c8f] tracking-[0.12em] sm:tracking-[0.2em] uppercase mb-4 sm:mb-8 max-w-[280px] sm:max-w-none">
            "Think Beyond The Board. See Beyond The Move."
          </p>

          {/* Sleek Golden Loading Bar — Fully GPU-Composited scaleX Animation */}
          <div className="w-56 sm:w-72 flex flex-col items-center gap-2">
            <div className="w-full h-1.5 rounded-full bg-white/10 border border-[#c6a45c]/35 overflow-hidden p-[1px] relative shadow-inner">
              <div
                ref={barRef}
                className="h-full w-full rounded-full bg-gradient-to-r from-[#b9872e] via-[#fae19d] to-[#cca044] origin-left will-change-transform"
                style={{
                  transform: 'scaleX(0)',
                }}
              />
            </div>

            {/* Percentage & status */}
            <div className="flex items-center justify-between w-full text-[10px] font-mono text-[#c6a45c] px-0.5">
              <span ref={statusRef} className="tracking-wider uppercase font-serif font-semibold text-[#8a8479]">
                Entering Arena...
              </span>
              <span ref={pctRef} className="font-bold">0%</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT: MAJESTIC BLACK KING ================= */}
        <BlackKingFigure />
      </div>
    </div>
  );
};

