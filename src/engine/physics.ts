import { CylinderState, StrokePhase, CYLINDER_PHASE_OFFSETS, EngineSettings } from './types';

/**
 * Calculate piston position from crank angle.
 * Uses the slider-crank mechanism formula.
 * Returns 0 at TDC, 1 at BDC.
 */
export function pistonPosition(crankAngleDeg: number, rodRatio: number = 3.5): number {
  const theta = (crankAngleDeg * Math.PI) / 180;
  // Normalized piston position: 0 at TDC, 1 at BDC
  const r = 1; // crank radius normalized
  const l = rodRatio; // connecting rod length / crank radius
  const x = r * Math.cos(theta) + Math.sqrt(l * l - r * r * Math.sin(theta) * Math.sin(theta));
  const xTDC = r + l;
  const xBDC = l - r;
  return 1 - (x - xBDC) / (xTDC - xBDC);
}

/**
 * Determine which stroke phase we're in based on crank angle (0-720°)
 */
export function getStrokePhase(crankAngle720: number): StrokePhase {
  const angle = ((crankAngle720 % 720) + 720) % 720;
  if (angle < 180) return 'intake';
  if (angle < 360) return 'compression';
  if (angle < 540) return 'power';
  return 'exhaust';
}

/**
 * Calculate cylinder pressure (simplified model)
 */
export function calculatePressure(
  crankAngle720: number,
  settings: EngineSettings
): number {
  const angle = ((crankAngle720 % 720) + 720) % 720;
  const phase = getStrokePhase(angle);

  switch (phase) {
    case 'intake':
      return 0.8 + 0.2 * (settings.throttle / 100); // slight vacuum
    case 'compression': {
      const progress = (angle - 180) / 180;
      const maxPressure = settings.compressionRatio;
      return 1 + (maxPressure - 1) * Math.pow(progress, 1.3);
    }
    case 'power': {
      const progress = (angle - 360) / 180;
      if (progress < 0.1) {
        // Rapid pressure rise during combustion
        const combustionProgress = progress / 0.1;
        const peakPressure = settings.compressionRatio * 3 * (settings.throttle / 100);
        return settings.compressionRatio + (peakPressure - settings.compressionRatio) * combustionProgress;
      } else {
        // Expansion
        const expansionProgress = (progress - 0.1) / 0.9;
        const peakPressure = settings.compressionRatio * 3 * (settings.throttle / 100);
        return peakPressure * Math.pow(1 - expansionProgress, 1.3);
      }
    }
    case 'exhaust': {
      const progress = (angle - 540) / 180;
      return 1.5 * (1 - progress) + 1;
    }
  }
}

/**
 * Calculate temperature (simplified)
 */
export function calculateTemperature(
  crankAngle720: number,
  _settings: EngineSettings
): number {
  const angle = ((crankAngle720 % 720) + 720) % 720;
  const phase = getStrokePhase(angle);

  switch (phase) {
    case 'intake': return 0.2;
    case 'compression': {
      const progress = (angle - 180) / 180;
      return 0.2 + 0.3 * progress;
    }
    case 'power': {
      const progress = (angle - 360) / 180;
      if (progress < 0.15) return 0.5 + 0.5 * (progress / 0.15);
      return 1.0 * Math.pow(1 - ((progress - 0.15) / 0.85), 0.8);
    }
    case 'exhaust': {
      const progress = (angle - 540) / 180;
      return 0.4 * (1 - progress);
    }
  }
}

/**
 * Calculate valve positions (0 = closed, 1 = fully open)
 */
export function calculateValves(
  crankAngle720: number,
  settings: EngineSettings
): { intake: number; exhaust: number } {
  const angle = ((crankAngle720 % 720) + 720) % 720;
  const overlap = settings.valveOverlap;

  let intake = 0;
  let exhaust = 0;

  // Intake valve: opens just before TDC (with overlap), closes after BDC
  if (angle < 180 + 30) {
    if (angle < 20) intake = angle / 20; // opening
    else if (angle > 160) intake = (210 - angle) / 50; // closing
    else intake = 1;
  }
  // Open slightly before TDC due to overlap
  if (angle > 720 - overlap) {
    intake = (angle - (720 - overlap)) / overlap;
  }

  // Exhaust valve: opens before BDC of power, closes after TDC
  if (angle > 500 && angle <= 720) {
    if (angle < 540) exhaust = (angle - 500) / 40; // opening
    else if (angle > 700) exhaust = (720 - angle) / 20; // closing  
    else exhaust = 1;
  }
  // Overlap into next cycle
  if (angle < overlap) {
    exhaust = 1 - (angle / overlap);
  }

  return {
    intake: Math.max(0, Math.min(1, intake)),
    exhaust: Math.max(0, Math.min(1, exhaust)),
  };
}

/**
 * Check if spark is active
 */
export function isSparkActive(crankAngle720: number, settings: EngineSettings): boolean {
  const angle = ((crankAngle720 % 720) + 720) % 720;
  const sparkAngle = 360 - settings.ignitionAdvance;
  return angle >= sparkAngle && angle <= sparkAngle + 10;
}

/**
 * Calculate combustion progress (0-1, only during power stroke)
 */
export function getCombustionProgress(crankAngle720: number, settings: EngineSettings): number {
  const angle = ((crankAngle720 % 720) + 720) % 720;
  if (angle < 360 - settings.ignitionAdvance || angle > 540) return 0;
  const start = 360 - settings.ignitionAdvance;
  const duration = 60; // combustion duration in degrees
  const progress = (angle - start) / duration;
  return Math.max(0, Math.min(1, progress));
}

/**
 * Get full cylinder state
 */
export function getCylinderState(
  cylinderId: number,
  globalCrankAngle: number,
  settings: EngineSettings
): CylinderState {
  const offset = CYLINDER_PHASE_OFFSETS[cylinderId];
  const cylinderAngle = ((globalCrankAngle + offset) % 720 + 720) % 720;
  const valves = calculateValves(cylinderAngle, settings);

  return {
    id: cylinderId,
    phase: getStrokePhase(cylinderAngle),
    pistonY: pistonPosition(cylinderAngle),
    crankAngle: cylinderAngle,
    pressure: calculatePressure(cylinderAngle, settings),
    temperature: calculateTemperature(cylinderAngle, settings),
    intakeValveOpen: valves.intake,
    exhaustValveOpen: valves.exhaust,
    sparkActive: isSparkActive(cylinderAngle, settings),
    fuelAirMixture: getStrokePhase(cylinderAngle) === 'intake' ? settings.throttle / 100 : 0,
    combustionProgress: getCombustionProgress(cylinderAngle, settings),
  };
}

/**
 * Calculate engine torque at current crank angle
 */
export function calculateTorque(globalCrankAngle: number, settings: EngineSettings): number {
  let totalTorque = 0;
  for (let cyl = 1; cyl <= 4; cyl++) {
    const state = getCylinderState(cyl, globalCrankAngle, settings);
    if (state.phase === 'power') {
      const angle = ((state.crankAngle % 720) + 720) % 720;
      const progress = (angle - 360) / 180;
      // Torque is pressure * sin(crank angle) approximately
      const crankForce = Math.sin(progress * Math.PI);
      totalTorque += state.pressure * crankForce * (settings.throttle / 100);
    }
  }
  return totalTorque;
}
