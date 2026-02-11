export type StrokePhase = 'intake' | 'compression' | 'power' | 'exhaust';

export interface EngineSettings {
  rpm: number;
  bore: number; // mm
  stroke: number; // mm
  compressionRatio: number;
  ignitionAdvance: number; // degrees BTDC
  throttle: number; // 0-100%
  airFuelRatio: number;
  valveOverlap: number; // degrees
  speedMultiplier: number; // 0.01-2.0 playback speed
}

export interface CylinderState {
  id: number;
  phase: StrokePhase;
  pistonY: number; // 0 = TDC, 1 = BDC
  crankAngle: number; // degrees for this cylinder
  pressure: number; // relative pressure
  temperature: number; // relative temperature
  intakeValveOpen: number; // 0-1
  exhaustValveOpen: number; // 0-1
  sparkActive: boolean;
  fuelAirMixture: number; // density 0-1
  combustionProgress: number; // 0-1
}

export const FIRING_ORDER = [1, 3, 4, 2];

// Phase offsets for each cylinder in firing order 1-3-4-2
// Each cylinder fires 180° apart (720° / 4 cylinders)
// A cylinder's power stroke begins when its local angle = 360°.
// cylinderAngle = (globalCrankAngle + offset) % 720
// So offset = 360 - (firingPosition * 180) mapped correctly:
//   Cyl 1 fires at global=0°   → offset=360 (0+360=360 ✓)
//   Cyl 3 fires at global=180° → offset=180 (180+180=360 ✓)
//   Cyl 4 fires at global=360° → offset=0   (360+0=360 ✓)
//   Cyl 2 fires at global=540° → offset=540 (540+540=1080%720=360 ✓)
export const CYLINDER_PHASE_OFFSETS: Record<number, number> = {
  1: 360,
  2: 540,
  3: 180,
  4: 0,
};

export const STROKE_COLORS: Record<StrokePhase, string> = {
  intake: '#4FC3F7',
  compression: '#FFB74D',
  power: '#EF5350',
  exhaust: '#78909C',
};

export const STROKE_LABELS: Record<StrokePhase, string> = {
  intake: 'Intake',
  compression: 'Compression',
  power: 'Power',
  exhaust: 'Exhaust',
};

export const DEFAULT_SETTINGS: EngineSettings = {
  rpm: 800,
  bore: 86,
  stroke: 86,
  compressionRatio: 10.5,
  ignitionAdvance: 15,
  throttle: 40,
  airFuelRatio: 14.7,
  valveOverlap: 20,
  speedMultiplier: 0.10,
};
