import { GraphicsQuality } from '../chess/types';

export interface DeviceCapabilityProfile {
  isTouch: boolean;
  isMobileViewport: boolean;
  isLowEndHardware: boolean;
  recommendedQuality: GraphicsQuality;
  cores: number;
  memoryGb: number;
}

/**
 * Evaluates device hardware capabilities cleanly without blocking startup or leaking WebGL contexts.
 * Adapts default graphics tier, canvas resolution budget, and procedural texture sizes
 * across low-budget Androids, older phones, tablets, Desktop-Mode mobile browsers, laptops, and desktops.
 */
export function detectDeviceCapabilities(): DeviceCapabilityProfile {
  if (typeof window === 'undefined') {
    return {
      isTouch: false,
      isMobileViewport: false,
      isLowEndHardware: false,
      recommendedQuality: 'high',
      cores: 4,
      memoryGb: 8,
    };
  }

  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isTouch = maxTouchPoints > 0 || isCoarsePointer || isMobileUA;

  const minDim = Math.min(window.innerWidth, window.innerHeight);
  // Keep touch devices recognized even when mobile browsers enable "Desktop Site" (wider viewport / spoofed UA)
  const isMobileViewport = window.innerWidth <= 768 || (isTouch && window.innerWidth <= 1024) || isMobileUA;

  const cores = navigator.hardwareConcurrency || (isTouch ? 4 : 8);
  const memoryGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 0;

  // Detect constrained / older / low-RAM mobile devices & low-end laptops
  const isLowEndHardware =
    (memoryGb > 0 && memoryGb <= 3) ||
    cores <= 2 ||
    (isTouch && ((memoryGb > 0 && memoryGb <= 4) || cores <= 4 || minDim <= 380));

  let recommendedQuality: GraphicsQuality = 'high';
  if (isLowEndHardware) {
    recommendedQuality = 'low'; // Performance
  } else if (isTouch || isMobileViewport || cores <= 4) {
    recommendedQuality = 'medium'; // Balanced
  } else {
    recommendedQuality = 'high'; // High Quality
  }

  return {
    isTouch,
    isMobileViewport,
    isLowEndHardware,
    recommendedQuality,
    cores,
    memoryGb,
  };
}
