import { CylinderState, EngineSettings, STROKE_COLORS, STROKE_LABELS, CYLINDER_PHASE_OFFSETS } from './types';

// --- Layout constants ---
const CYL_W = 100;
const CYL_H = 170;
const WALL_T = 8;
const HEAD_H = 22;
const PISTON_H = 32;
const CRANK_R = 36;
const ROD_LEN = 110;
const CYL_GAP = 24;

// --- Particle system for effects ---
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  r: number; g: number; b: number; a: number;
}

const particles: Particle[] = [];
let lastParticleTime = 0;

function spawnParticle(x: number, y: number, vx: number, vy: number, size: number, r: number, g: number, b: number, life: number) {
  if (particles.length > 300) return;
  particles.push({ x, y, vx, vy, life, maxLife: life, size, r, g, b, a: 1 });
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.a = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  for (const p of particles) {
    ctx.globalAlpha = p.a * 0.7;
    ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * p.a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Helper drawing functions ---

function metalGradient(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _h: number, baseR: number, baseG: number, baseB: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  const f = 0.6;
  g.addColorStop(0, `rgb(${baseR * f},${baseG * f},${baseB * f})`);
  g.addColorStop(0.2, `rgb(${baseR},${baseG},${baseB})`);
  g.addColorStop(0.45, `rgb(${Math.min(255, baseR * 1.3)},${Math.min(255, baseG * 1.3)},${Math.min(255, baseB * 1.3)})`);
  g.addColorStop(0.55, `rgb(${Math.min(255, baseR * 1.4)},${Math.min(255, baseG * 1.4)},${Math.min(255, baseB * 1.4)})`);
  g.addColorStop(0.8, `rgb(${baseR},${baseG},${baseB})`);
  g.addColorStop(1, `rgb(${baseR * f},${baseG * f},${baseB * f})`);
  return g;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// --- Main draw ---

export function drawEngine(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  cylinderStates: CylinderState[],
  globalCrankAngle: number,
  settings: EngineSettings,
  torque: number
) {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // dt estimation for particles
  const now = performance.now();
  const dt = Math.min((now - lastParticleTime) / 1000, 0.05);
  lastParticleTime = now;
  updateParticles(dt);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f1923');
  bg.addColorStop(0.5, '#162030');
  bg.addColorStop(1, '#0d1520');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const totalW = 4 * CYL_W + 3 * CYL_GAP + 2 * WALL_T * 4;
  const startX = (W - totalW) / 2;
  const cylTopY = 100;
  const crankCY = cylTopY + HEAD_H + CYL_H + ROD_LEN + CRANK_R + 30;

  // Spawn particles for each cylinder
  cylinderStates.forEach((state, idx) => {
    const cx = startX + idx * (CYL_W + 2 * WALL_T + CYL_GAP) + (CYL_W + 2 * WALL_T) / 2;
    const cy = cylTopY;

    // Exhaust smoke
    if (state.phase === 'exhaust' && state.exhaustValveOpen > 0.2 && Math.random() < 0.3) {
      const evx = cx + (CYL_W / 2) - 12;
      spawnParticle(
        evx + (Math.random() - 0.5) * 6, cy - 5,
        (Math.random() - 0.3) * 20, -30 - Math.random() * 40,
        3 + Math.random() * 4, 140, 140, 155, 1.2 + Math.random() * 0.8
      );
    }

    // Intake air
    if (state.phase === 'intake' && state.intakeValveOpen > 0.2 && Math.random() < 0.25) {
      const ivx = cx - (CYL_W / 2) + 12;
      spawnParticle(
        ivx + (Math.random() - 0.5) * 6, cy + 10,
        (Math.random() - 0.5) * 10, 20 + Math.random() * 30,
        2 + Math.random() * 3, 79, 195, 247, 0.8 + Math.random() * 0.6
      );
    }

    // Combustion sparks
    if (state.combustionProgress > 0 && state.combustionProgress < 0.5 && Math.random() < 0.4) {
      spawnParticle(
        cx + (Math.random() - 0.5) * CYL_W * 0.6, cy + HEAD_H + 10,
        (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40,
        1 + Math.random() * 2, 255, 200 + Math.random() * 55, 0, 0.4 + Math.random() * 0.4
      );
    }
  });

  // Draw crankshaft first (behind cylinders)
  drawCrankshaft(ctx, crankCY, globalCrankAngle, cylinderStates, startX);

  // Draw each cylinder
  cylinderStates.forEach((state, idx) => {
    const cx = startX + idx * (CYL_W + 2 * WALL_T + CYL_GAP) + (CYL_W + 2 * WALL_T) / 2;
    drawCylinderUnit(ctx, cx, cylTopY, state, crankCY, settings);
  });

  // Draw particles on top
  drawParticles(ctx);

  // Draw flywheel
  const fwX = startX + totalW + 50;
  drawFlywheel(ctx, fwX, crankCY, globalCrankAngle, torque);

  // Draw info overlay
  drawInfoOverlay(ctx, W, H, cylinderStates, globalCrankAngle, settings, torque);

  // 4-stroke cycle bar
  drawCycleBar(ctx, W, H, globalCrankAngle);
}

// --- Cylinder unit ---

function drawCylinderUnit(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  state: CylinderState,
  crankCY: number,
  _settings: EngineSettings
) {
  const innerL = cx - CYL_W / 2;
  const innerR = cx + CYL_W / 2;
  const outerL = innerL - WALL_T;
  const outerR = innerR + WALL_T;
  const headTop = topY;
  const headBot = topY + HEAD_H;
  const cylBot = headBot + CYL_H;

  const pistonTravel = CYL_H - PISTON_H;
  const pistonTopY = headBot + state.pistonY * pistonTravel;
  const pistonBotY = pistonTopY + PISTON_H;

  // ===== Cylinder block (walls) =====
  // Left wall
  ctx.fillStyle = metalGradient(ctx, outerL, headBot, WALL_T, CYL_H, 85, 95, 110);
  ctx.fillRect(outerL, headBot, WALL_T, CYL_H);
  // Right wall
  ctx.fillStyle = metalGradient(ctx, innerR, headBot, WALL_T, CYL_H, 85, 95, 110);
  ctx.fillRect(innerR, headBot, WALL_T, CYL_H);

  // Cooling fins on outside
  ctx.strokeStyle = 'rgba(100,115,135,0.5)';
  ctx.lineWidth = 1.5;
  for (let y = headBot + 8; y < cylBot - 5; y += 12) {
    // Left fins
    ctx.beginPath();
    ctx.moveTo(outerL - 6, y);
    ctx.lineTo(outerL, y);
    ctx.stroke();
    // Right fins
    ctx.beginPath();
    ctx.moveTo(outerR, y);
    ctx.lineTo(outerR + 6, y);
    ctx.stroke();
  }

  // Cylinder bore interior
  ctx.fillStyle = '#1a2030';
  ctx.fillRect(innerL, headBot, CYL_W, CYL_H);

  // Cylinder liner honing marks
  ctx.strokeStyle = 'rgba(80,100,120,0.12)';
  ctx.lineWidth = 0.5;
  for (let y = headBot; y < cylBot; y += 4) {
    ctx.beginPath();
    ctx.moveTo(innerL + 1, y);
    ctx.lineTo(innerR - 1, y);
    ctx.stroke();
  }

  // ===== Combustion chamber gas =====
  const chamberH = pistonTopY - headBot;
  if (chamberH > 1) {
    let chamberColor: string;
    switch (state.phase) {
      case 'intake':
        chamberColor = `rgba(70,180,240,${0.05 + state.intakeValveOpen * 0.15})`;
        break;
      case 'compression': {
        const t = state.pressure / 15;
        chamberColor = `rgba(${180 + t * 75},${150 + t * 50},${60},${0.15 + t * 0.3})`;
        break;
      }
      case 'power':
        chamberColor = `rgba(${200 + state.combustionProgress * 55},${80 - state.combustionProgress * 40},${20},${0.2 + state.combustionProgress * 0.5})`;
        break;
      case 'exhaust':
        chamberColor = `rgba(120,120,130,${0.1 + state.exhaustValveOpen * 0.15})`;
        break;
      default:
        chamberColor = 'rgba(30,30,40,0.1)';
    }
    ctx.fillStyle = chamberColor;
    ctx.fillRect(innerL + 1, headBot + 1, CYL_W - 2, chamberH - 1);
  }

  // ===== Combustion flame =====
  if (state.combustionProgress > 0 && state.combustionProgress < 0.85) {
    const intensity = state.combustionProgress < 0.2
      ? state.combustionProgress / 0.2
      : Math.max(0, 1 - (state.combustionProgress - 0.2) / 0.65);

    // Main radial flame
    const flameR = CYL_W * 0.5 * intensity;
    const flameCY = headBot + 8;
    const grad = ctx.createRadialGradient(cx, flameCY, 0, cx, flameCY, flameR);
    grad.addColorStop(0, `rgba(255,255,220,${intensity * 0.9})`);
    grad.addColorStop(0.15, `rgba(255,220,100,${intensity * 0.8})`);
    grad.addColorStop(0.4, `rgba(255,120,20,${intensity * 0.6})`);
    grad.addColorStop(0.7, `rgba(200,40,0,${intensity * 0.3})`);
    grad.addColorStop(1, 'rgba(100,10,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.rect(innerL + 1, headBot + 1, CYL_W - 2, chamberH > 0 ? chamberH : 30);
    ctx.fill();

    // Outer glow on cylinder walls
    ctx.shadowColor = `rgba(255,150,30,${intensity * 0.6})`;
    ctx.shadowBlur = 20 * intensity;
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.beginPath();
    ctx.moveTo(cx, flameCY);
    ctx.lineTo(cx, flameCY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ===== Cylinder Head =====
  // Head body
  ctx.fillStyle = metalGradient(ctx, outerL - 4, headTop, CYL_W + 2 * WALL_T + 8, HEAD_H, 100, 110, 125);
  roundRect(ctx, outerL - 4, headTop, CYL_W + 2 * WALL_T + 8, HEAD_H, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,155,175,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Head bolts (4 bolts)
  const boltPositions = [outerL + 2, innerL + 8, innerR - 8, outerR - 2];
  boltPositions.forEach(bx => {
    ctx.fillStyle = '#8090a0';
    ctx.beginPath();
    ctx.arc(bx, headTop + HEAD_H / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#607080';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Hex pattern on bolt
    ctx.beginPath();
    ctx.moveTo(bx - 1.5, headTop + HEAD_H / 2 - 1);
    ctx.lineTo(bx + 1.5, headTop + HEAD_H / 2 - 1);
    ctx.moveTo(bx - 1.5, headTop + HEAD_H / 2 + 1);
    ctx.lineTo(bx + 1.5, headTop + HEAD_H / 2 + 1);
    ctx.stroke();
  });

  // Head gasket line
  ctx.strokeStyle = 'rgba(180,140,80,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerL, headBot);
  ctx.lineTo(innerR, headBot);
  ctx.stroke();

  // ===== Valves =====
  drawValve(ctx, cx - CYL_W / 2 + 16, headTop, headBot, state.intakeValveOpen, true, 'intake');
  drawValve(ctx, cx + CYL_W / 2 - 16, headTop, headBot, state.exhaustValveOpen, false, 'exhaust');

  // ===== Spark Plug (center, detailed) =====
  drawSparkPlug(ctx, cx, headTop, headBot, state.sparkActive, state.combustionProgress);

  // ===== Piston =====
  drawPiston(ctx, cx, pistonTopY, CYL_W - 4, PISTON_H, state);

  // ===== Connecting Rod =====
  const wristPinY = pistonBotY - 8;
  const crankAngleRad = (state.crankAngle * Math.PI) / 180;
  const crankPinX = cx + Math.sin(crankAngleRad) * CRANK_R;
  const crankPinY = crankCY - Math.cos(crankAngleRad) * CRANK_R;
  drawConnectingRod(ctx, cx, wristPinY, crankPinX, crankPinY);

  // ===== Bottom of cylinder block =====
  ctx.fillStyle = metalGradient(ctx, outerL, cylBot, CYL_W + 2 * WALL_T, 6, 80, 90, 105);
  ctx.fillRect(outerL, cylBot, CYL_W + 2 * WALL_T, 6);

  // ===== Labels =====
  // Cylinder number
  ctx.fillStyle = '#e0e8f0';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`#${state.id}`, cx, cylBot + 12);

  // Phase label with glow
  const pc = STROKE_COLORS[state.phase];
  ctx.shadowColor = pc;
  ctx.shadowBlur = 6;
  ctx.fillStyle = pc;
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillText(STROKE_LABELS[state.phase].toUpperCase(), cx, cylBot + 30);
  ctx.shadowBlur = 0;

  // Pressure mini-bar
  const barX = cx - CYL_W / 2;
  const barY = cylBot + 44;
  const barW = CYL_W;
  const barH = 5;
  ctx.fillStyle = '#1a2030';
  roundRect(ctx, barX, barY, barW, barH, 2);
  ctx.fill();
  const pFrac = Math.min(1, state.pressure / 35);
  const pg = ctx.createLinearGradient(barX, barY, barX + barW * pFrac, barY);
  pg.addColorStop(0, '#22c55e');
  pg.addColorStop(0.5, '#eab308');
  pg.addColorStop(1, '#ef4444');
  ctx.fillStyle = pg;
  roundRect(ctx, barX, barY, barW * pFrac, barH, 2);
  ctx.fill();
  ctx.fillStyle = '#8899aa';
  ctx.font = '8px monospace';
  ctx.fillText(`${state.pressure.toFixed(1)} bar`, cx, barY + 13);

  // Temperature mini-bar
  const tBarY = barY + 18;
  ctx.fillStyle = '#1a2030';
  roundRect(ctx, barX, tBarY, barW, barH, 2);
  ctx.fill();
  const tFrac = state.temperature;
  const tg = ctx.createLinearGradient(barX, tBarY, barX + barW * tFrac, tBarY);
  tg.addColorStop(0, '#3b82f6');
  tg.addColorStop(0.6, '#f97316');
  tg.addColorStop(1, '#ef4444');
  ctx.fillStyle = tg;
  roundRect(ctx, barX, tBarY, barW * tFrac, barH, 2);
  ctx.fill();
  ctx.fillStyle = '#8899aa';
  ctx.font = '8px monospace';
  ctx.fillText('temp', cx, tBarY + 13);

  ctx.textBaseline = 'alphabetic';
}

// --- Valve ---

function drawValve(
  ctx: CanvasRenderingContext2D,
  vx: number,
  headTop: number,
  headBot: number,
  openAmount: number,
  _isIntake: boolean,
  type: 'intake' | 'exhaust'
) {
  const isOpen = openAmount > 0.05;
  const openY = openAmount * 8;
  const baseColor = type === 'intake' ? [79, 195, 247] : [239, 83, 80];
  const dimColor = [90, 100, 110];
  const color = isOpen ? baseColor : dimColor;

  // Valve spring housing (above head)
  ctx.fillStyle = `rgb(${70},${80},${95})`;
  roundRect(ctx, vx - 7, headTop - 28, 14, 28, 2);
  ctx.fill();

  // Spring coils
  const springTop = headTop - 25;
  const springBot = headTop - 4;
  const springLen = springBot - springTop;
  const compressedLen = springLen - openY * 0.5;
  const coils = 5;
  ctx.strokeStyle = isOpen ? `rgb(${baseColor[0]},${baseColor[1]},${baseColor[2]})` : '#7a8a9a';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < coils; i++) {
    const y = springTop + (compressedLen / coils) * i + compressedLen / coils * 0.5;
    ctx.beginPath();
    ctx.moveTo(vx - 5, y);
    ctx.bezierCurveTo(vx - 5, y - 2, vx + 5, y - 2, vx + 5, y);
    ctx.bezierCurveTo(vx + 5, y + 2, vx - 5, y + 2, vx - 5, y);
    ctx.stroke();
  }

  // Spring retainer
  ctx.fillStyle = '#a0aab5';
  ctx.fillRect(vx - 6, springTop - 2, 12, 3);

  // Valve stem
  ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  ctx.fillRect(vx - 1.5, headTop - 4, 3, (headBot - headTop) + 4 + openY);

  // Valve head (tulip shape)
  const vheadY = headBot + openY;
  ctx.beginPath();
  ctx.moveTo(vx - 13, vheadY);
  ctx.quadraticCurveTo(vx - 13, vheadY + 4, vx - 7, vheadY + 5);
  ctx.lineTo(vx - 1.5, vheadY + 5);
  ctx.lineTo(vx - 1.5, vheadY);
  ctx.closePath();
  ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  ctx.fill();
  // Mirror right half
  ctx.beginPath();
  ctx.moveTo(vx + 13, vheadY);
  ctx.quadraticCurveTo(vx + 13, vheadY + 4, vx + 7, vheadY + 5);
  ctx.lineTo(vx + 1.5, vheadY + 5);
  ctx.lineTo(vx + 1.5, vheadY);
  ctx.closePath();
  ctx.fill();

  // Valve seat ring
  ctx.strokeStyle = 'rgba(200,180,120,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(vx - 13, headBot);
  ctx.lineTo(vx + 13, headBot);
  ctx.stroke();

  // Label
  ctx.fillStyle = isOpen ? `rgb(${baseColor[0]},${baseColor[1]},${baseColor[2]})` : '#556';
  ctx.font = 'bold 8px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(type === 'intake' ? 'IN' : 'EX', vx, headTop - 32);
}

// --- Spark Plug ---

function drawSparkPlug(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headTop: number,
  headBot: number,
  sparkActive: boolean,
  _combustionProgress: number
) {
  // Terminal nut (top)
  ctx.fillStyle = '#b0b8c0';
  roundRect(ctx, cx - 4, headTop - 34, 8, 8, 1);
  ctx.fill();
  ctx.strokeStyle = '#8090a0';
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Wire connection nub
  ctx.fillStyle = '#c0c8d0';
  ctx.beginPath();
  ctx.arc(cx, headTop - 34, 3, 0, Math.PI * 2);
  ctx.fill();

  // Ceramic insulator (white/cream)
  const insulatorGrad = ctx.createLinearGradient(cx - 4, headTop - 26, cx + 4, headTop - 26);
  insulatorGrad.addColorStop(0, '#d4cfc4');
  insulatorGrad.addColorStop(0.3, '#f0ece0');
  insulatorGrad.addColorStop(0.7, '#f5f0e4');
  insulatorGrad.addColorStop(1, '#d4cfc4');
  ctx.fillStyle = insulatorGrad;
  roundRect(ctx, cx - 4, headTop - 26, 8, 18, 2);
  ctx.fill();
  ctx.strokeStyle = '#b0a890';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Ceramic ribs
  ctx.strokeStyle = 'rgba(160,150,130,0.3)';
  ctx.lineWidth = 0.8;
  for (let y = headTop - 23; y < headTop - 10; y += 4) {
    ctx.beginPath();
    ctx.moveTo(cx - 4, y);
    ctx.lineTo(cx + 4, y);
    ctx.stroke();
  }

  // Metal hex shell (through head)
  ctx.fillStyle = metalGradient(ctx, cx - 5, headTop - 8, 10, 14, 140, 145, 155);
  ctx.fillRect(cx - 5, headTop - 8, 10, 14);
  ctx.strokeStyle = '#8090a0';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(cx - 5, headTop - 8, 10, 14);

  // Hex nut detail
  ctx.strokeStyle = 'rgba(80,90,100,0.4)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - 3, headTop - 6);
  ctx.lineTo(cx + 3, headTop - 6);
  ctx.moveTo(cx - 3, headTop - 2);
  ctx.lineTo(cx + 3, headTop - 2);
  ctx.moveTo(cx - 3, headTop + 2);
  ctx.lineTo(cx + 3, headTop + 2);
  ctx.stroke();

  // Center electrode tip
  ctx.fillStyle = '#d0d5dd';
  ctx.fillRect(cx - 1, headTop + 6, 2, 8);

  // Ground electrode (L-shaped)
  ctx.fillStyle = '#b0b8c0';
  ctx.fillRect(cx + 2, headTop + 6, 5, 2);
  ctx.fillRect(cx + 5, headTop + 6, 2, 7);

  // Electrode gap marker
  ctx.fillStyle = '#90a0b0';
  ctx.beginPath();
  ctx.arc(cx + 5, headBot - HEAD_H + 13, 1, 0, Math.PI * 2);
  ctx.fill();

  // Spark effect!
  if (sparkActive) {
    const sparkBaseY = headBot - 4;

    // Outer glow
    ctx.shadowColor = 'rgba(100,150,255,0.8)';
    ctx.shadowBlur = 25;

    // Multiple lightning branches
    for (let branch = 0; branch < 3; branch++) {
      ctx.strokeStyle = branch === 0 ? '#ffffff' : `rgba(150,200,255,${0.7 - branch * 0.2})`;
      ctx.lineWidth = branch === 0 ? 2.5 : 1.5;
      ctx.beginPath();

      const startX = cx - 1 + branch;
      ctx.moveTo(startX, sparkBaseY);

      let py = sparkBaseY;
      const segments = 5 + branch * 2;
      const totalDrop = 14 + branch * 4;
      for (let i = 0; i < segments; i++) {
        const nx = startX + (Math.random() - 0.5) * (10 + branch * 5);
        py += totalDrop / segments;
        ctx.lineTo(nx, py);
      }
      ctx.stroke();
    }

    // Bright flash at gap
    const flashGrad = ctx.createRadialGradient(cx, sparkBaseY + 5, 0, cx, sparkBaseY + 5, 12);
    flashGrad.addColorStop(0, 'rgba(200,220,255,0.9)');
    flashGrad.addColorStop(0.3, 'rgba(100,150,255,0.5)');
    flashGrad.addColorStop(1, 'rgba(50,80,200,0)');
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.arc(cx, sparkBaseY + 5, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }
}

// --- Piston ---

function drawPiston(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  w: number,
  h: number,
  _state: CylinderState
) {
  const left = cx - w / 2;

  // Piston body with metallic gradient
  const pg = ctx.createLinearGradient(left, topY, left + w, topY);
  pg.addColorStop(0, '#4a5568');
  pg.addColorStop(0.15, '#8a95a5');
  pg.addColorStop(0.35, '#b0bac5');
  pg.addColorStop(0.5, '#c8d0d8');
  pg.addColorStop(0.65, '#b0bac5');
  pg.addColorStop(0.85, '#8a95a5');
  pg.addColorStop(1, '#4a5568');
  ctx.fillStyle = pg;
  roundRect(ctx, left + 2, topY, w - 4, h, 3);
  ctx.fill();

  // Piston crown (flat top with slight dome)
  const crownGrad = ctx.createLinearGradient(left, topY, left + w, topY);
  crownGrad.addColorStop(0, '#5a6578');
  crownGrad.addColorStop(0.5, '#9aa5b5');
  crownGrad.addColorStop(1, '#5a6578');
  ctx.fillStyle = crownGrad;
  ctx.beginPath();
  ctx.moveTo(left + 4, topY + 3);
  ctx.quadraticCurveTo(cx, topY - 2, left + w - 4, topY + 3);
  ctx.lineTo(left + w - 4, topY + 6);
  ctx.lineTo(left + 4, topY + 6);
  ctx.closePath();
  ctx.fill();

  // Piston ring grooves
  const ringColors = ['#606a78', '#555f6c', '#606a78'];
  const ringYs = [topY + 5, topY + 10, topY + 15];
  ringColors.forEach((col, i) => {
    // Groove
    ctx.strokeStyle = '#3a4050';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(left + 3, ringYs[i]);
    ctx.lineTo(left + w - 3, ringYs[i]);
    ctx.stroke();

    // Ring (metallic)
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(left + 2, ringYs[i]);
    ctx.lineTo(left + w - 2, ringYs[i]);
    ctx.stroke();

    // Ring highlight
    ctx.strokeStyle = `rgba(180,190,200,${0.3 - i * 0.05})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.3, ringYs[i] - 0.5);
    ctx.lineTo(left + w * 0.6, ringYs[i] - 0.5);
    ctx.stroke();
  });

  // Skirt details
  ctx.strokeStyle = 'rgba(60,70,85,0.3)';
  ctx.lineWidth = 0.5;
  for (let y = topY + 20; y < topY + h - 4; y += 3) {
    ctx.beginPath();
    ctx.moveTo(left + 5, y);
    ctx.lineTo(left + w - 5, y);
    ctx.stroke();
  }

  // Wrist pin bore
  const wpY = topY + h - 9;
  // Pin bore shadow
  ctx.fillStyle = '#2a3040';
  ctx.beginPath();
  ctx.arc(cx, wpY, 6, 0, Math.PI * 2);
  ctx.fill();
  // Wrist pin
  const wpGrad = ctx.createRadialGradient(cx - 1, wpY - 1, 0, cx, wpY, 5);
  wpGrad.addColorStop(0, '#c0c8d0');
  wpGrad.addColorStop(0.6, '#8a95a5');
  wpGrad.addColorStop(1, '#606a78');
  ctx.fillStyle = wpGrad;
  ctx.beginPath();
  ctx.arc(cx, wpY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Outline
  ctx.strokeStyle = 'rgba(140,155,175,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, left + 2, topY, w - 4, h, 3);
  ctx.stroke();
}

// --- Connecting Rod (I-beam) ---

function drawConnectingRod(
  ctx: CanvasRenderingContext2D,
  smallEndX: number,
  smallEndY: number,
  bigEndX: number,
  bigEndY: number
) {
  const dx = bigEndX - smallEndX;
  const dy = bigEndY - smallEndY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(smallEndX, smallEndY);
  ctx.rotate(angle);

  // Rod I-beam profile
  const rodGrad = ctx.createLinearGradient(0, -5, 0, 5);
  rodGrad.addColorStop(0, '#6a7585');
  rodGrad.addColorStop(0.3, '#a0aab5');
  rodGrad.addColorStop(0.5, '#b8c2cc');
  rodGrad.addColorStop(0.7, '#a0aab5');
  rodGrad.addColorStop(1, '#6a7585');
  ctx.fillStyle = rodGrad;

  // I-beam shape
  ctx.beginPath();
  // Small end flange
  ctx.moveTo(0, -6);
  ctx.lineTo(12, -6);
  ctx.lineTo(12, -3);
  // Web (narrow middle)
  ctx.lineTo(len - 15, -3);
  // Big end flange
  ctx.lineTo(len - 15, -7);
  ctx.lineTo(len, -7);
  ctx.lineTo(len, 7);
  ctx.lineTo(len - 15, 7);
  ctx.lineTo(len - 15, 3);
  // Web
  ctx.lineTo(12, 3);
  ctx.lineTo(12, 6);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();

  // Rod outline
  ctx.strokeStyle = 'rgba(140,155,175,0.4)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Web center line highlight
  ctx.strokeStyle = 'rgba(180,190,200,0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(len - 15, 0);
  ctx.stroke();

  // Oil hole in the middle
  ctx.fillStyle = '#3a4050';
  ctx.beginPath();
  ctx.arc(len * 0.45, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Small end bearing
  const seGrad = ctx.createRadialGradient(smallEndX - 0.5, smallEndY - 0.5, 0, smallEndX, smallEndY, 6);
  seGrad.addColorStop(0, '#c0c8d0');
  seGrad.addColorStop(0.7, '#8090a0');
  seGrad.addColorStop(1, '#5a6575');
  ctx.fillStyle = seGrad;
  ctx.beginPath();
  ctx.arc(smallEndX, smallEndY, 6, 0, Math.PI * 2);
  ctx.fill();

  // Big end bearing
  const beGrad = ctx.createRadialGradient(bigEndX - 0.5, bigEndY - 0.5, 0, bigEndX, bigEndY, 8);
  beGrad.addColorStop(0, '#c0c8d0');
  beGrad.addColorStop(0.7, '#8090a0');
  beGrad.addColorStop(1, '#5a6575');
  ctx.fillStyle = beGrad;
  ctx.beginPath();
  ctx.arc(bigEndX, bigEndY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,155,175,0.4)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Big end cap bolts
  const boltAngle = Math.atan2(bigEndY - smallEndY, bigEndX - smallEndX);
  for (const side of [-1, 1]) {
    const bx = bigEndX + Math.cos(boltAngle + Math.PI / 2) * 6 * side;
    const by = bigEndY + Math.sin(boltAngle + Math.PI / 2) * 6 * side;
    ctx.fillStyle = '#7a8595';
    ctx.beginPath();
    ctx.arc(bx, by, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Crankshaft ---

function drawCrankshaft(
  ctx: CanvasRenderingContext2D,
  centerY: number,
  globalAngle: number,
  states: CylinderState[],
  startX: number
) {
  const firstCX = startX + (CYL_W + 2 * WALL_T) / 2;
  const lastCX = startX + 3 * (CYL_W + 2 * WALL_T + CYL_GAP) + (CYL_W + 2 * WALL_T) / 2;

  // Main shaft (journals)
  const shaftGrad = ctx.createLinearGradient(0, centerY - 6, 0, centerY + 6);
  shaftGrad.addColorStop(0, '#5a6575');
  shaftGrad.addColorStop(0.3, '#8a95a5');
  shaftGrad.addColorStop(0.5, '#a0aab5');
  shaftGrad.addColorStop(0.7, '#8a95a5');
  shaftGrad.addColorStop(1, '#5a6575');
  ctx.fillStyle = shaftGrad;
  roundRect(ctx, firstCX - 30, centerY - 5, lastCX - firstCX + 60, 10, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,155,175,0.3)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Main bearing journals
  for (let i = 0; i < 5; i++) {
    const jx = firstCX - 15 + i * ((lastCX - firstCX + 30) / 4);
    const jGrad = ctx.createRadialGradient(jx, centerY, 0, jx, centerY, 9);
    jGrad.addColorStop(0, '#b0bac5');
    jGrad.addColorStop(0.6, '#8090a0');
    jGrad.addColorStop(1, '#5a6575');
    ctx.fillStyle = jGrad;
    ctx.beginPath();
    ctx.arc(jx, centerY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,155,175,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Crank throws for each cylinder
  states.forEach((state, index) => {
    const cylCX = startX + index * (CYL_W + 2 * WALL_T + CYL_GAP) + (CYL_W + 2 * WALL_T) / 2;
    const crankAngleRad = (state.crankAngle * Math.PI) / 180;
    const pinX = cylCX + Math.sin(crankAngleRad) * CRANK_R;
    const pinY = centerY - Math.cos(crankAngleRad) * CRANK_R;

    // Crank web
    const webGrad = ctx.createLinearGradient(cylCX, centerY, pinX, pinY);
    webGrad.addColorStop(0, '#7a8595');
    webGrad.addColorStop(0.5, '#95a0b0');
    webGrad.addColorStop(1, '#7a8595');
    ctx.strokeStyle = webGrad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cylCX, centerY);
    ctx.lineTo(pinX, pinY);
    ctx.stroke();

    // Web edge highlight
    ctx.strokeStyle = 'rgba(160,175,190,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cylCX, centerY);
    ctx.lineTo(pinX, pinY);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Counterweight (opposite to crank pin)
    const cwAngle = crankAngleRad + Math.PI;
    const cwX = cylCX + Math.sin(cwAngle) * CRANK_R * 0.55;
    const cwY = centerY - Math.cos(cwAngle) * CRANK_R * 0.55;

    // Semi-circular counterweight
    ctx.save();
    ctx.translate(cwX, cwY);
    ctx.rotate(-cwAngle + Math.PI / 2);
    const cwGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    cwGrad.addColorStop(0, '#6a7585');
    cwGrad.addColorStop(0.7, '#4a5568');
    cwGrad.addColorStop(1, '#3a4050');
    ctx.fillStyle = cwGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,115,130,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // Crank pin journal
    const cpGrad = ctx.createRadialGradient(pinX - 0.5, pinY - 0.5, 0, pinX, pinY, 6);
    cpGrad.addColorStop(0, '#c0c8d0');
    cpGrad.addColorStop(0.6, '#8a95a5');
    cpGrad.addColorStop(1, '#5a6575');
    ctx.fillStyle = cpGrad;
    ctx.beginPath();
    ctx.arc(pinX, pinY, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Keyway / TDC marker on front
  const keyAngleRad = (globalAngle * Math.PI) / 180;
  const keyX = firstCX - 20 + Math.sin(keyAngleRad) * 7;
  const keyY = centerY - Math.cos(keyAngleRad) * 7;
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(keyX, keyY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // TDC label
  ctx.fillStyle = '#8899aa';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TDC', firstCX - 20, centerY + 18);
}

// --- Flywheel ---

function drawFlywheel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  torque: number
) {
  const R = 38;

  // Flywheel body
  const fwGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, R);
  fwGrad.addColorStop(0, '#5a6575');
  fwGrad.addColorStop(0.4, '#4a5568');
  fwGrad.addColorStop(0.8, '#3a4555');
  fwGrad.addColorStop(1, '#2a3545');
  ctx.fillStyle = fwGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,115,130,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ring gear teeth
  const teeth = 40;
  for (let i = 0; i < teeth; i++) {
    const a = ((i * (360 / teeth) + angle) * Math.PI) / 180;
    ctx.strokeStyle = 'rgba(90,105,120,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
    ctx.lineTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4));
    ctx.stroke();
  }

  // Spokes
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 + angle * 0.5) * Math.PI) / 180;
    ctx.strokeStyle = 'rgba(70,85,100,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
    ctx.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
    ctx.stroke();
  }

  // Center hub
  const hubGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, 8);
  hubGrad.addColorStop(0, '#b0bac5');
  hubGrad.addColorStop(0.5, '#8090a0');
  hubGrad.addColorStop(1, '#5a6575');
  ctx.fillStyle = hubGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,155,170,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Rotation marker
  const markerA = (angle * Math.PI) / 180;
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(markerA) * (R - 10), cy + Math.sin(markerA) * (R - 10), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Torque arc
  if (torque > 0.5) {
    const alpha = Math.min(1, torque / 12);
    ctx.strokeStyle = `rgba(34,197,94,${alpha})`;
    ctx.lineWidth = 3;
    const arcStart = (angle * Math.PI) / 180;
    const arcEnd = arcStart + Math.min(0.8, torque / 10);
    ctx.beginPath();
    ctx.arc(cx, cy, R + 10, arcStart, arcEnd);
    ctx.stroke();

    // Arrow head
    const ahx = cx + Math.cos(arcEnd) * (R + 10);
    const ahy = cy + Math.sin(arcEnd) * (R + 10);
    ctx.fillStyle = `rgba(34,197,94,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(ahx, ahy);
    ctx.lineTo(ahx + Math.cos(arcEnd + 0.6) * 7, ahy + Math.sin(arcEnd + 0.6) * 7);
    ctx.lineTo(ahx + Math.cos(arcEnd - 0.7) * 7, ahy + Math.sin(arcEnd - 0.7) * 7);
    ctx.closePath();
    ctx.fill();
  }

  // Label
  ctx.fillStyle = '#8899aa';
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Flywheel', cx, cy + R + 18);
}

// --- Info Overlay ---

function drawInfoOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  _H: number,
  _states: CylinderState[],
  globalAngle: number,
  settings: EngineSettings,
  torque: number
) {
  // Title area with subtle background
  ctx.fillStyle = 'rgba(15,25,35,0.7)';
  roundRect(ctx, 10, 8, 260, 65, 8);
  ctx.fill();

  ctx.fillStyle = '#e0e8f0';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('4-Cylinder Engine', 20, 30);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('Firing Order: 1 → 3 → 4 → 2', 20, 48);

  ctx.fillStyle = '#8899aa';
  ctx.font = '11px monospace';
  ctx.fillText(`${settings.rpm} RPM  •  ${settings.throttle}% Throttle`, 20, 65);

  // Stats box top right
  ctx.fillStyle = 'rgba(15,25,35,0.7)';
  roundRect(ctx, W - 200, 8, 190, 65, 8);
  ctx.fill();

  const power = (torque * settings.rpm) / 5252;
  ctx.fillStyle = '#8899aa';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Crank: ${(globalAngle % 720).toFixed(0)}° / 720°`, W - 18, 28);
  ctx.fillStyle = '#22c55e';
  ctx.fillText(`Torque: ${torque.toFixed(1)} (rel)`, W - 18, 45);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`Power: ${power.toFixed(1)} (rel HP)`, W - 18, 62);
  ctx.textAlign = 'left';
}

// --- Cycle bar ---

function drawCycleBar(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  globalAngle: number
) {
  const barH = 36;
  const barY = H - barH - 12;
  const margin = 20;
  const barW = W - 2 * margin;

  // Background
  ctx.fillStyle = 'rgba(15,25,35,0.85)';
  roundRect(ctx, margin - 4, barY - 18, barW + 8, barH + 30, 8);
  ctx.fill();

  // Title
  ctx.fillStyle = '#8899aa';
  ctx.font = 'bold 9px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CYLINDER #1 — FOUR-STROKE CYCLE', W / 2, barY - 5);

  const phases: Array<{ label: string; range: string; color: string }> = [
    { label: 'INTAKE', range: '0°–180°', color: STROKE_COLORS.intake },
    { label: 'COMPRESSION', range: '180°–360°', color: STROKE_COLORS.compression },
    { label: 'POWER', range: '360°–540°', color: STROKE_COLORS.power },
    { label: 'EXHAUST', range: '540°–720°', color: STROKE_COLORS.exhaust },
  ];

  const secW = barW / 4;
  phases.forEach((p, i) => {
    const x = margin + i * secW;

    // Section fill
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.2;
    if (i === 0) {
      roundRect(ctx, x, barY, secW, barH, i === 0 ? 4 : 0);
    } else if (i === 3) {
      roundRect(ctx, x, barY, secW, barH, 0);
    } else {
      ctx.fillRect(x, barY, secW, barH);
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    // Dividers
    if (i > 0) {
      ctx.strokeStyle = 'rgba(100,120,140,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, barY);
      ctx.lineTo(x, barY + barH);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = p.color;
    ctx.font = 'bold 9px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.label, x + secW / 2, barY + 14);
    ctx.fillStyle = 'rgba(150,160,175,0.7)';
    ctx.font = '8px monospace';
    ctx.fillText(p.range, x + secW / 2, barY + 27);
  });

  // Outline
  ctx.strokeStyle = 'rgba(100,120,140,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, margin, barY, barW, barH, 4);
  ctx.stroke();

  // Position marker for cylinder 1 (use its phase offset)
  const cyl1Angle = ((globalAngle + CYLINDER_PHASE_OFFSETS[1]) % 720 + 720) % 720;
  const markerX = margin + (cyl1Angle / 720) * barW;

  // Marker line
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(markerX, barY);
  ctx.lineTo(markerX, barY + barH);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Marker triangle
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(markerX, barY - 2);
  ctx.lineTo(markerX - 4, barY - 8);
  ctx.lineTo(markerX + 4, barY - 8);
  ctx.closePath();
  ctx.fill();

  // Angle label on marker
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${cyl1Angle.toFixed(0)}°`, markerX, barY + barH + 11);
}
