import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, EngineSettings, STROKE_COLORS, STROKE_LABELS, StrokePhase, FIRING_ORDER } from './engine/types';
import { getCylinderState, calculateTorque } from './engine/physics';
import { drawEngine } from './engine/renderer';

/* ── Slider Control ─────────────────────────────────── */
function SliderControl({
  label, value, min, max, step, unit, onChange, description,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void; description?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
        <span className="text-sm font-mono text-amber-400 font-bold">{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500"
        style={{ background: `linear-gradient(to right, #f59e0b ${pct}%, #283040 ${pct}%)` }}
      />
      {description && <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{description}</p>}
    </div>
  );
}

/* ── Phase indicator pill ────────────────────────────── */
function PhaseIndicator({ phase, label, active }: { phase: StrokePhase; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all duration-200 ${active ? 'bg-white/10 ring-1 ring-white/20 scale-105' : 'opacity-40'}`}>
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STROKE_COLORS[phase], boxShadow: active ? `0 0 8px ${STROKE_COLORS[phase]}` : 'none' }} />
      <span className="text-[10px] text-gray-300 font-semibold">{label}</span>
    </div>
  );
}

/* ── Main App ────────────────────────────────────────── */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<EngineSettings>({ ...DEFAULT_SETTINGS });
  const [running, setRunning] = useState(true);
  const [crankAngle, setCrankAngle] = useState(0);
  const crankAngleRef = useRef(0);
  const runningRef = useRef(true);
  const settingsRef = useRef(settings);
  const lastTimeRef = useRef(0);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedCylinder, setSelectedCylinder] = useState(1);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const updateSetting = useCallback(<K extends keyof EngineSettings>(key: K, value: EngineSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  /* Step controls */
  const stepAngle = useCallback((deg: number) => {
    crankAngleRef.current = ((crankAngleRef.current + deg) % 720 + 720) % 720;
    setCrankAngle(crankAngleRef.current);
  }, []);

  /* ── Animation loop ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const resizeCanvas = () => {
      const c = canvas.parentElement;
      if (c) { canvas.width = c.clientWidth; canvas.height = c.clientHeight; }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = (ts: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = ts;
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = ts;

      if (runningRef.current) {
        const s = settingsRef.current;
        const dps = s.rpm * 6 * s.speedMultiplier; // degrees / sec
        crankAngleRef.current = (crankAngleRef.current + dps * dt) % 720;
        setCrankAngle(crankAngleRef.current);
      }

      const s = settingsRef.current;
      const angle = crankAngleRef.current;
      const states = [1, 2, 3, 4].map(id => getCylinderState(id, angle, s));
      const torque = calculateTorque(angle, s);
      drawEngine(ctx, canvas, states, angle, s, torque);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resizeCanvas); };
  }, []);

  const currentCylState = getCylinderState(selectedCylinder, crankAngle, settings);
  const torque = calculateTorque(crankAngle, settings);
  const power = (torque * settings.rpm) / 5252;
  const allPhases: StrokePhase[] = ['intake', 'compression', 'power', 'exhaust'];

  const speedLabel = settings.speedMultiplier < 0.05
    ? 'Ultra Slow'
    : settings.speedMultiplier < 0.15
      ? 'Very Slow'
      : settings.speedMultiplier < 0.4
        ? 'Slow'
        : settings.speedMultiplier < 0.8
          ? 'Moderate'
          : settings.speedMultiplier <= 1.2
            ? 'Normal'
            : 'Fast';

  return (
    <div className="flex h-screen bg-[#0d1117] text-white overflow-hidden">
      {/* ── Canvas area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#111820] border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-400 text-sm">⚙</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">4-Cylinder Engine Simulator</h1>
            <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-mono rounded-full border border-amber-500/20">
              1-3-4-2
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInfo(!showInfo)}
              className="px-3 py-1.5 bg-blue-600/15 text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-600/25 transition-colors border border-blue-600/20">
              {showInfo ? 'Hide' : 'Show'} Theory
            </button>
            <button onClick={() => setRunning(!running)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${running ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-green-600/80 hover:bg-green-600 text-white'}`}>
              {running ? '⏸ Pause' : '▶ Start'}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full" />

          {/* Step controls overlay (bottom-left) */}
          <div className="absolute bottom-20 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-xl p-2 border border-white/10">
            <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mr-1">Step</span>
            <button onClick={() => stepAngle(-15)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-bold transition-colors flex items-center justify-center" title="Step back 15°">⏪</button>
            <button onClick={() => stepAngle(-1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-bold transition-colors flex items-center justify-center" title="Step back 1°">◀</button>
            <button onClick={() => { setRunning(false); crankAngleRef.current = 0; setCrankAngle(0); }} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-[9px] font-bold transition-colors flex items-center justify-center" title="Reset to 0°">0°</button>
            <button onClick={() => stepAngle(1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-bold transition-colors flex items-center justify-center" title="Step forward 1°">▶</button>
            <button onClick={() => stepAngle(15)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-xs font-bold transition-colors flex items-center justify-center" title="Step forward 15°">⏩</button>
            <button onClick={() => stepAngle(90)} className="w-8 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-[9px] font-bold transition-colors flex items-center justify-center" title="Step forward 90°">90°</button>
            <button onClick={() => stepAngle(180)} className="w-8 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-[9px] font-bold transition-colors flex items-center justify-center" title="Step forward 180°">180°</button>
          </div>

          {/* Theory overlay */}
          {showInfo && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm overflow-y-auto p-6 z-10">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-2xl font-bold text-amber-400 mb-4">Four-Stroke Engine Physics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> 1. Intake Stroke (0°–180°)
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      Piston moves TDC→BDC. The intake valve opens and the downward motion creates a vacuum
                      drawing the air-fuel mixture into the cylinder. The throttle controls mixture volume.
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-amber-400 font-bold mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> 2. Compression Stroke (180°–360°)
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      Both valves closed. Piston moves BDC→TDC, compressing the mixture. Compression ratio
                      ({settings.compressionRatio}:1) determines efficiency and power.
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> 3. Power Stroke (360°–540°)
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      Spark fires at {settings.ignitionAdvance}° BTDC, igniting the compressed mixture.
                      High-pressure combustion gases force the piston down, converting thermal energy to
                      mechanical rotation via the crankshaft. This is the only stroke producing power.
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <h3 className="text-gray-400 font-bold mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" /> 4. Exhaust Stroke (540°–720°)
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      Exhaust valve opens and the piston moves BDC→TDC, pushing burned gases out.
                      Valve overlap ({settings.valveOverlap}°) at the end improves scavenging.
                    </p>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4">
                  <h3 className="text-amber-400 font-bold mb-2">Firing Order: 1-3-4-2</h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-3">
                    In a 4-cylinder engine, the complete cycle is 720° (two crankshaft revolutions).
                    Each cylinder fires 180° apart. The order 1-3-4-2 ensures:
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center mb-3">
                    {FIRING_ORDER.map((cyl, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-2">
                        <div className="text-amber-400 font-bold">Cyl {cyl}</div>
                        <div className="text-xs text-gray-500">fires at {i * 180}°</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Adjacent cylinders never fire consecutively, reducing thermal stress and balancing crankshaft torsion.
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="text-amber-400 font-bold mb-2">Slider-Crank Mechanism</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Piston position: <code className="text-amber-300 bg-black/30 px-1 rounded text-xs">x = r·cos(θ) + √(L² − r²·sin²(θ))</code> where
                    r = crank radius, L = connecting rod length. The non-linear relationship means the piston dwells
                    longer near TDC — beneficial for combustion.
                  </p>
                </div>
                <button onClick={() => setShowInfo(false)}
                  className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom stats bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#111820] border-t border-gray-800/60 text-[11px] font-mono">
          <div className="flex items-center gap-4">
            <span className="text-gray-500">Crank: <span className="text-white">{(crankAngle % 720).toFixed(0)}°</span></span>
            <span className="text-gray-500">Torque: <span className="text-green-400">{torque.toFixed(1)}</span></span>
            <span className="text-gray-500">Power: <span className="text-amber-400">{power.toFixed(1)} HP</span></span>
            <span className="text-gray-500">Speed: <span className="text-purple-400">{settings.speedMultiplier.toFixed(2)}× ({speedLabel})</span></span>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(cyl => {
              const st = getCylinderState(cyl, crankAngle, settings);
              return (
                <button key={cyl} onClick={() => setSelectedCylinder(cyl)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all ${selectedCylinder === cyl ? 'bg-white/10 ring-1 ring-amber-500/50' : 'hover:bg-white/5'}`}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STROKE_COLORS[st.phase] }} />
                  <span className="text-gray-400">#{cyl}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right Sidebar ── */}
      <div className="w-[310px] bg-[#111820] border-l border-gray-800/60 overflow-y-auto flex flex-col">
        {/* Cylinder status */}
        <div className="p-4 border-b border-gray-800/40">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
            Cylinder #{selectedCylinder} Status
          </h2>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-white/[0.04] rounded-lg p-2">
              <div className="text-[9px] text-gray-600 uppercase">Phase</div>
              <div className="text-sm font-bold" style={{ color: STROKE_COLORS[currentCylState.phase] }}>
                {STROKE_LABELS[currentCylState.phase]}
              </div>
            </div>
            <div className="bg-white/[0.04] rounded-lg p-2">
              <div className="text-[9px] text-gray-600 uppercase">Pressure</div>
              <div className="text-sm font-bold text-white">{currentCylState.pressure.toFixed(1)} bar</div>
            </div>
            <div className="bg-white/[0.04] rounded-lg p-2">
              <div className="text-[9px] text-gray-600 uppercase">Intake Valve</div>
              <div className={`text-sm font-bold ${currentCylState.intakeValveOpen > 0.1 ? 'text-blue-400' : 'text-gray-600'}`}>
                {currentCylState.intakeValveOpen > 0.1 ? `OPEN ${(currentCylState.intakeValveOpen * 100).toFixed(0)}%` : 'CLOSED'}
              </div>
            </div>
            <div className="bg-white/[0.04] rounded-lg p-2">
              <div className="text-[9px] text-gray-600 uppercase">Exhaust Valve</div>
              <div className={`text-sm font-bold ${currentCylState.exhaustValveOpen > 0.1 ? 'text-red-400' : 'text-gray-600'}`}>
                {currentCylState.exhaustValveOpen > 0.1 ? `OPEN ${(currentCylState.exhaustValveOpen * 100).toFixed(0)}%` : 'CLOSED'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {allPhases.map(phase => (
              <PhaseIndicator key={phase} phase={phase} label={STROKE_LABELS[phase]} active={currentCylState.phase === phase} />
            ))}
          </div>
        </div>

        {/* Speed & Motion Controls */}
        <div className="p-4 border-b border-gray-800/40">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>🎬</span> Speed & Motion
          </h2>

          <SliderControl label="Playback Speed" value={settings.speedMultiplier} min={0.01} max={2} step={0.01} unit="×"
            onChange={(v) => updateSetting('speedMultiplier', v)}
            description={`${speedLabel} — controls animation speed independently of RPM`} />

          <SliderControl label="Engine RPM" value={settings.rpm} min={100} max={8000} step={50} unit=" rpm"
            onChange={(v) => updateSetting('rpm', v)}
            description="Actual engine crankshaft speed" />

          {/* Quick speed presets */}
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            <button onClick={() => updateSetting('speedMultiplier', 0.02)}
              className="px-1 py-1.5 bg-purple-600/15 text-purple-400 text-[9px] font-bold rounded-lg hover:bg-purple-600/25 transition-colors border border-purple-600/20 leading-tight">
              0.02×<br/><span className="text-[8px] opacity-60">Ultra</span>
            </button>
            <button onClick={() => updateSetting('speedMultiplier', 0.1)}
              className="px-1 py-1.5 bg-blue-600/15 text-blue-400 text-[9px] font-bold rounded-lg hover:bg-blue-600/25 transition-colors border border-blue-600/20 leading-tight">
              0.1×<br/><span className="text-[8px] opacity-60">V.Slow</span>
            </button>
            <button onClick={() => updateSetting('speedMultiplier', 0.3)}
              className="px-1 py-1.5 bg-cyan-600/15 text-cyan-400 text-[9px] font-bold rounded-lg hover:bg-cyan-600/25 transition-colors border border-cyan-600/20 leading-tight">
              0.3×<br/><span className="text-[8px] opacity-60">Slow</span>
            </button>
            <button onClick={() => updateSetting('speedMultiplier', 1.0)}
              className="px-1 py-1.5 bg-green-600/15 text-green-400 text-[9px] font-bold rounded-lg hover:bg-green-600/25 transition-colors border border-green-600/20 leading-tight">
              1.0×<br/><span className="text-[8px] opacity-60">Normal</span>
            </button>
          </div>
        </div>

        {/* Engine Settings */}
        <div className="p-4 flex-1">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span>⚙️</span> Engine Parameters
          </h2>

          <SliderControl label="Throttle" value={settings.throttle} min={0} max={100} step={1} unit="%"
            onChange={(v) => updateSetting('throttle', v)} description="Air-fuel mixture volume" />

          <SliderControl label="Compression Ratio" value={settings.compressionRatio} min={7} max={14} step={0.5} unit=":1"
            onChange={(v) => updateSetting('compressionRatio', v)} description="Volume ratio BDC:TDC" />

          <SliderControl label="Ignition Advance" value={settings.ignitionAdvance} min={0} max={45} step={1} unit="° BTDC"
            onChange={(v) => updateSetting('ignitionAdvance', v)} description="Spark timing before top dead center" />

          <SliderControl label="Air/Fuel Ratio" value={settings.airFuelRatio} min={10} max={20} step={0.1} unit=":1"
            onChange={(v) => updateSetting('airFuelRatio', v)} description="Stoichiometric = 14.7:1" />

          <SliderControl label="Valve Overlap" value={settings.valveOverlap} min={0} max={60} step={2} unit="°"
            onChange={(v) => updateSetting('valveOverlap', v)} description="Both valves open overlap period" />

          <SliderControl label="Bore" value={settings.bore} min={60} max={110} step={1} unit=" mm"
            onChange={(v) => updateSetting('bore', v)} description="Cylinder diameter" />

          <SliderControl label="Stroke" value={settings.stroke} min={60} max={110} step={1} unit=" mm"
            onChange={(v) => updateSetting('stroke', v)} description="Piston travel distance" />

          {/* Computed values */}
          <div className="mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <h3 className="text-[9px] font-bold text-gray-500 uppercase mb-2">Computed</h3>
            <div className="space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Per-cylinder</span>
                <span className="text-white">{(Math.PI * Math.pow(settings.bore / 20, 2) * (settings.stroke / 10)).toFixed(0)} cc</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total displacement</span>
                <span className="text-amber-400 font-bold">{(4 * Math.PI * Math.pow(settings.bore / 20, 2) * (settings.stroke / 10)).toFixed(0)} cc</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bore/Stroke</span>
                <span className="text-white">
                  {(settings.bore / settings.stroke).toFixed(2)}
                  <span className="text-gray-600 ml-1 text-[9px]">
                    ({settings.bore > settings.stroke ? 'over-sq' : settings.bore < settings.stroke ? 'under-sq' : 'square'})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Piston speed</span>
                <span className="text-white">{((2 * settings.stroke * settings.rpm) / 60000).toFixed(1)} m/s</span>
              </div>
            </div>
          </div>

          {/* Presets */}
          <div className="mt-4">
            <h3 className="text-[9px] font-bold text-gray-500 uppercase mb-2">Presets</h3>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setSettings({ ...DEFAULT_SETTINGS, rpm: 800, throttle: 30, speedMultiplier: 0.10 })}
                className="px-2 py-1.5 bg-blue-600/10 text-blue-400 text-[10px] font-semibold rounded-lg hover:bg-blue-600/20 transition-colors border border-blue-600/15">
                🅿️ Idle
              </button>
              <button onClick={() => setSettings({ ...DEFAULT_SETTINGS, rpm: 3000, throttle: 60, speedMultiplier: 0.15 })}
                className="px-2 py-1.5 bg-green-600/10 text-green-400 text-[10px] font-semibold rounded-lg hover:bg-green-600/20 transition-colors border border-green-600/15">
                🚗 Cruising
              </button>
              <button onClick={() => setSettings({ ...DEFAULT_SETTINGS, rpm: 6000, throttle: 100, ignitionAdvance: 30, compressionRatio: 11, speedMultiplier: 0.25 })}
                className="px-2 py-1.5 bg-red-600/10 text-red-400 text-[10px] font-semibold rounded-lg hover:bg-red-600/20 transition-colors border border-red-600/15">
                🏁 Full Power
              </button>
              <button onClick={() => setSettings({ ...DEFAULT_SETTINGS, rpm: 7500, throttle: 100, compressionRatio: 12.5, ignitionAdvance: 35, bore: 81, stroke: 77, speedMultiplier: 0.30 })}
                className="px-2 py-1.5 bg-purple-600/10 text-purple-400 text-[10px] font-semibold rounded-lg hover:bg-purple-600/20 transition-colors border border-purple-600/15">
                🏎️ Sport
              </button>
              <button onClick={() => setSettings({ ...DEFAULT_SETTINGS, rpm: 2000, throttle: 40, compressionRatio: 9, bore: 95, stroke: 100, speedMultiplier: 0.12 })}
                className="px-2 py-1.5 bg-amber-600/10 text-amber-400 text-[10px] font-semibold rounded-lg hover:bg-amber-600/20 transition-colors border border-amber-600/15">
                🚜 Torque
              </button>
              <button onClick={() => setSettings({ ...DEFAULT_SETTINGS, rpm: 800, throttle: 40, speedMultiplier: 0.04 })}
                className="px-2 py-1.5 bg-violet-600/10 text-violet-400 text-[10px] font-semibold rounded-lg hover:bg-violet-600/20 transition-colors border border-violet-600/15">
                🔬 Study Mode
              </button>
              <button onClick={() => setSettings({ ...DEFAULT_SETTINGS, rpm: 400, throttle: 30, speedMultiplier: 0.015 })}
                className="px-2 py-1.5 bg-pink-600/10 text-pink-400 text-[10px] font-semibold rounded-lg hover:bg-pink-600/20 transition-colors border border-pink-600/15">
                🐌 Ultra Slow
              </button>
              <button onClick={() => { setRunning(false); setSettings({ ...DEFAULT_SETTINGS, rpm: 300, throttle: 40, speedMultiplier: 0.01 }); }}
                className="px-2 py-1.5 bg-teal-600/10 text-teal-400 text-[10px] font-semibold rounded-lg hover:bg-teal-600/20 transition-colors border border-teal-600/15">
                ⏸ Step-by-Step
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-gray-800/40">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {allPhases.map(phase => (
                <div key={phase} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STROKE_COLORS[phase] }} />
                  <span className="text-[9px] text-gray-500">{STROKE_LABELS[phase]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
