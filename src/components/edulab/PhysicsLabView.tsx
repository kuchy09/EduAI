import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Atom,
  Play,
  Pause,
  RotateCcw,
  StepForward,
  ClipboardCheck,
} from 'lucide-react';
import { PhysicsPracticalId, TrialPayload } from './edulabTypes';

interface PhysicsLabViewProps {
  practicalId: PhysicsPracticalId;
  formula: string;
  onRecordTrial: (payload: TrialPayload) => void;
}

type CircuitTopology = 'single' | 'series' | 'parallel';
type WaveOpticsMode = 'wave' | 'optics';
type MetrologyInstrument = 'vernier' | 'micrometer';

const GRAVITY_PRESETS = [
  { label: 'Nairobi (Equator)', value: 9.78 },
  { label: 'Earth Std', value: 9.81 },
  { label: 'Moon', value: 1.62 },
  { label: 'Mars', value: 3.72 },
  { label: 'Jupiter', value: 24.79 },
];

export function PhysicsLabView({ practicalId, formula, onRecordTrial }: PhysicsLabViewProps) {
  // 1. ELECTRICITY & CIRCUITS STATE
  const [circuitTopology, setCircuitTopology] = useState<CircuitTopology>('series');
  const [switchClosed, setSwitchClosed] = useState<boolean>(true);
  const [sourceVoltage, setSourceVoltage] = useState<number>(12.0);
  const [resistor1, setResistor1] = useState<number>(30);
  const [resistor2, setResistor2] = useState<number>(60);

  const circuitMetrics = useMemo(() => {
    let rEq = resistor1;
    if (circuitTopology === 'series') rEq = resistor1 + resistor2;
    else if (circuitTopology === 'parallel') rEq = (resistor1 * resistor2) / (resistor1 + resistor2);

    const totalCurrent = switchClosed ? sourceVoltage / rEq : 0;
    let i1 = totalCurrent;
    let i2 = 0;
    let v1 = switchClosed ? sourceVoltage : 0;
    let v2 = 0;

    if (circuitTopology === 'series' && switchClosed) {
      i1 = totalCurrent;
      i2 = totalCurrent;
      v1 = totalCurrent * resistor1;
      v2 = totalCurrent * resistor2;
    } else if (circuitTopology === 'parallel' && switchClosed) {
      v1 = sourceVoltage;
      v2 = sourceVoltage;
      i1 = sourceVoltage / resistor1;
      i2 = sourceVoltage / resistor2;
    }

    const totalPower = switchClosed ? sourceVoltage * totalCurrent : 0;
    return { rEq, totalCurrent, i1, i2, v1, v2, totalPower };
  }, [circuitTopology, resistor1, resistor2, sourceVoltage, switchClosed]);

  // 2. MECHANICS (PENDULUM) STATE
  const [pendulumLength, setPendulumLength] = useState<number>(1.0);
  const [gravity, setGravity] = useState<number>(9.81);
  const [releaseAngleDeg, setReleaseAngleDeg] = useState<number>(15);
  const [damping, setDamping] = useState<number>(0.02);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [pendulumRunning, setPendulumRunning] = useState<boolean>(true);
  const [pendulumTelemetry, setPendulumTelemetry] = useState({
    elapsedSec: 0,
    angleDeg: 15,
    oscillations: 0,
    angularVelRad: 0,
  });

  const pendulumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pendulumStateRef = useRef({
    t: 0,
    lastSign: 1,
    halfCrossings: 0,
  });

  const theta0Rad = (releaseAngleDeg * Math.PI) / 180;
  const theoreticalPeriod =
    2 * Math.PI * Math.sqrt(pendulumLength / gravity) * (1 + (theta0Rad * theta0Rad) / 16);
  const theoreticalFreq = 1 / theoreticalPeriod;

  const resetPendulum = useCallback(() => {
    pendulumStateRef.current = { t: 0, lastSign: 1, halfCrossings: 0 };
    setPendulumTelemetry({
      elapsedSec: 0,
      angleDeg: releaseAngleDeg,
      oscillations: 0,
      angularVelRad: 0,
    });
  }, [releaseAngleDeg]);

  const stepPendulum = useCallback(
    (dtSec: number) => {
      const st = pendulumStateRef.current;
      st.t += dtSec;
      const omega = Math.sqrt(gravity / pendulumLength) / (1 + (theta0Rad * theta0Rad) / 16);
      const decay = Math.exp(-damping * st.t);
      const thetaRad = theta0Rad * decay * Math.cos(omega * st.t);
      const omegaInst =
        -theta0Rad * decay * (damping * Math.cos(omega * st.t) + omega * Math.sin(omega * st.t));
      const sign = thetaRad >= 0 ? 1 : -1;
      if (sign !== st.lastSign) {
        st.halfCrossings += 1;
        st.lastSign = sign;
      }
      setPendulumTelemetry({
        elapsedSec: st.t,
        angleDeg: (thetaRad * 180) / Math.PI,
        oscillations: Math.floor(st.halfCrossings / 2),
        angularVelRad: omegaInst,
      });
    },
    [damping, gravity, pendulumLength, theta0Rad]
  );

  useEffect(() => {
    if (practicalId !== 'mechanics') return;
    let rafId = 0;
    let lastTs = performance.now();
    let uiSyncAccum = 0;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      const st = pendulumStateRef.current;
      const omega = Math.sqrt(gravity / pendulumLength) / (1 + (theta0Rad * theta0Rad) / 16);

      if (pendulumRunning) {
        st.t += dt;
        const decay = Math.exp(-damping * st.t);
        const thetaRadNow = theta0Rad * decay * Math.cos(omega * st.t);
        const sign = thetaRadNow >= 0 ? 1 : -1;
        if (sign !== st.lastSign) {
          st.halfCrossings += 1;
          st.lastSign = sign;
        }
        uiSyncAccum += dt;
        if (uiSyncAccum >= 0.05) {
          uiSyncAccum = 0;
          const omegaInst =
            -theta0Rad * decay * (damping * Math.cos(omega * st.t) + omega * Math.sin(omega * st.t));
          setPendulumTelemetry({
            elapsedSec: st.t,
            angleDeg: (thetaRadNow * 180) / Math.PI,
            oscillations: Math.floor(st.halfCrossings / 2),
            angularVelRad: omegaInst,
          });
        }
      }

      const canvas = pendulumCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
              canvas.width = Math.round(rect.width * dpr);
              canvas.height = Math.round(rect.height * dpr);
            }
            ctx.save();
            ctx.scale(dpr, dpr);
            const w = rect.width;
            const h = rect.height;
            const isDark = document.documentElement.classList.contains('dark');
            ctx.clearRect(0, 0, w, h);

            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
            ctx.lineWidth = 1;
            for (let gx = 28; gx < w; gx += 28) {
              ctx.beginPath();
              ctx.moveTo(gx, 0);
              ctx.lineTo(gx, h);
              ctx.stroke();
            }
            for (let gy = 28; gy < h; gy += 28) {
              ctx.beginPath();
              ctx.moveTo(0, gy);
              ctx.lineTo(w, gy);
              ctx.stroke();
            }

            const pivotX = w * 0.5;
            const pivotY = 42;
            const maxRopePx = Math.min(h - 86, w * 0.44);
            const ropePx = 70 + ((pendulumLength - 0.2) / 1.8) * (maxRopePx - 70);
            const decay = Math.exp(-damping * st.t);
            const thetaRad = theta0Rad * decay * Math.cos(omega * st.t);
            const bobX = pivotX + ropePx * Math.sin(thetaRad);
            const bobY = pivotY + ropePx * Math.cos(thetaRad);

            ctx.strokeStyle = isDark ? '#475569' : '#64748b';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(pivotX - 96, pivotY - 12);
            ctx.lineTo(pivotX + 96, pivotY - 12);
            ctx.stroke();

            ctx.save();
            ctx.setLineDash([4, 5]);
            ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.4)';
            ctx.beginPath();
            ctx.moveTo(pivotX, pivotY);
            ctx.lineTo(pivotX, pivotY + ropePx + 22);
            ctx.stroke();
            ctx.restore();

            ctx.strokeStyle = isDark ? '#e2e8f0' : '#334155';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(pivotX, pivotY);
            ctx.lineTo(bobX, bobY);
            ctx.stroke();

            ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
            ctx.beginPath();
            ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
            ctx.fill();

            if (showVectors) {
              const omegaInst =
                -theta0Rad * decay * (damping * Math.cos(omega * st.t) + omega * Math.sin(omega * st.t));
              const vx = omegaInst * pendulumLength * Math.cos(thetaRad) * 24;
              const vy = -omegaInst * pendulumLength * Math.sin(thetaRad) * 24;
              if (Math.hypot(vx, vy) > 4) {
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.moveTo(bobX, bobY);
                ctx.lineTo(bobX + vx, bobY + vy);
                ctx.stroke();
              }
              const fMag = -Math.sin(thetaRad) * (gravity / 9.81) * 42;
              const fx = fMag * Math.cos(thetaRad);
              const fy = -fMag * Math.sin(thetaRad);
              if (Math.hypot(fx, fy) > 4) {
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bobX, bobY);
                ctx.lineTo(bobX + fx, bobY + fy);
                ctx.stroke();
              }
            }

            ctx.fillStyle = '#4f46e5';
            ctx.beginPath();
            ctx.arc(bobX, bobY, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isDark ? '#c7d2fe' : '#312e81';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
            ctx.font = '600 11px ui-monospace, monospace';
            ctx.fillText(`θ = ${((thetaRad * 180) / Math.PI).toFixed(1)}°`, pivotX + 12, pivotY + 34);
            ctx.restore();
          }
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [practicalId, damping, gravity, pendulumLength, pendulumRunning, showVectors, theta0Rad]);

  // 3. WAVES AND OPTICS STATE
  const [waveOpticsMode, setWaveOpticsMode] = useState<WaveOpticsMode>('wave');
  const [waveFreqHz, setWaveFreqHz] = useState<number>(2.5);
  const [waveAmpCm, setWaveAmpCm] = useState<number>(3.0);
  const [waveSpeedMs, setWaveSpeedMs] = useState<number>(10.0);
  const [wavePhase, setWavePhase] = useState<number>(0);

  const wavelengthM = waveSpeedMs / waveFreqHz;

  useEffect(() => {
    if (practicalId !== 'waves' || waveOpticsMode !== 'wave') return;
    const t = setInterval(() => {
      setWavePhase((p) => (p + 0.18 * waveFreqHz) % (Math.PI * 20));
    }, 45);
    return () => clearInterval(t);
  }, [practicalId, waveOpticsMode, waveFreqHz]);

  const [focalLengthCm, setFocalLengthCm] = useState<number>(15);
  const [objectDistCm, setObjectDistCm] = useState<number>(30);
  const objectHeightCm = 4.0;

  const opticsMetrics = useMemo(() => {
    const denom = 1 / focalLengthCm - 1 / objectDistCm;
    const isAtFocal = Math.abs(denom) < 0.002;
    const imageDistCm = isAtFocal ? 999 : 1 / denom;
    const magnification = isAtFocal ? 99 : Math.abs(imageDistCm / objectDistCm);
    const isReal = imageDistCm > 0;
    return { isAtFocal, imageDistCm, magnification, isReal };
  }, [focalLengthCm, objectDistCm]);

  // 4. MAGNETISM STATE
  const [coilTurnsN, setCoilTurnsN] = useState<number>(200);
  const [solenoidCurrentA, setSolenoidCurrentA] = useState<number>(2.5);
  const [ironCoreInserted, setIronCoreInserted] = useState<boolean>(true);
  const [probeDistanceCm, setProbeDistanceCm] = useState<number>(5.0);

  const magnetismMetrics = useMemo(() => {
    const mu0 = 4 * Math.PI * 1e-7;
    const solLenM = 0.15;
    const muR = ironCoreInserted ? 120 : 1;
    const bCoreTesla = mu0 * muR * (coilTurnsN / solLenM) * Math.abs(solenoidCurrentA);
    const bCoreMt = bCoreTesla * 1000;
    const bAtProbeMt = bCoreMt / Math.pow(1 + probeDistanceCm / 3.5, 2);
    const polarity =
      solenoidCurrentA === 0
        ? 'NEUTRAL (NO FIELD)'
        : solenoidCurrentA > 0
        ? 'LEFT: NORTH (N) · RIGHT: SOUTH (S)'
        : 'LEFT: SOUTH (S) · RIGHT: NORTH (N)';
    const compassDeflectionDeg =
      solenoidCurrentA === 0
        ? 0
        : Math.sign(solenoidCurrentA) * Math.min(86, bAtProbeMt * (ironCoreInserted ? 1.6 : 45));
    return { bCoreMt, bAtProbeMt, polarity, compassDeflectionDeg };
  }, [coilTurnsN, solenoidCurrentA, ironCoreInserted, probeDistanceCm]);

  // 5. MEASUREMENTS (VERNIER & MICROMETER) STATE
  const [metroInstrument, setMetroInstrument] = useState<MetrologyInstrument>('vernier');
  const [targetSizeMm, setTargetSizeMm] = useState<number>(14.64);
  const [zeroErrorMm, setZeroErrorMm] = useState<number>(0.0);

  const metroReadings = useMemo(() => {
    const lc = metroInstrument === 'vernier' ? 0.02 : 0.01;
    const observed = Math.max(0, Number((targetSizeMm + zeroErrorMm).toFixed(2)));
    const corrected = Number((observed - zeroErrorMm).toFixed(2));
    if (metroInstrument === 'vernier') {
      const msrMm = Math.floor(observed);
      const frac = observed - msrMm;
      const vsrDiv = Math.round(frac / 0.02) % 50;
      return { lc, observed, corrected, msrMm, subDiv: vsrDiv };
    }
    const sleeveHalfMm = Math.floor(observed * 2) / 2;
    const subDiv = Math.round((observed - sleeveHalfMm) / 0.01) % 50;
    return { lc, observed, corrected, msrMm: sleeveHalfMm, subDiv };
  }, [metroInstrument, targetSizeMm, zeroErrorMm]);

  const triggerRecord = () => {
    if (practicalId === 'circuits') {
      onRecordTrial({
        inputsSummary: `${circuitTopology.toUpperCase()} · V=${sourceVoltage.toFixed(1)} V · R₁=${resistor1} Ω${circuitTopology !== 'single' ? ` · R₂=${resistor2} Ω` : ''}`,
        primaryReading: `I = ${circuitMetrics.totalCurrent.toFixed(3)} A`,
        secondaryReading: `R_eq = ${circuitMetrics.rEq.toFixed(2)} Ω`,
        derivedMetric: `P = ${circuitMetrics.totalPower.toFixed(2)} W`,
      });
    } else if (practicalId === 'mechanics') {
      const measuredG = (4 * Math.PI * Math.PI * pendulumLength) / (theoreticalPeriod * theoreticalPeriod);
      onRecordTrial({
        inputsSummary: `L=${pendulumLength.toFixed(2)} m · θ₀=${releaseAngleDeg}° · g=${gravity.toFixed(2)} m/s²`,
        primaryReading: `T = ${theoreticalPeriod.toFixed(3)} s`,
        secondaryReading: `T² = ${(theoreticalPeriod * theoreticalPeriod).toFixed(3)} s²`,
        derivedMetric: `g_calc = ${measuredG.toFixed(2)} m/s²`,
      });
    } else if (practicalId === 'waves') {
      if (waveOpticsMode === 'wave') {
        onRecordTrial({
          inputsSummary: `Wave Tank · f=${waveFreqHz.toFixed(1)} Hz · v=${waveSpeedMs.toFixed(1)} m/s · A=${waveAmpCm.toFixed(1)} cm`,
          primaryReading: `λ = ${wavelengthM.toFixed(2)} m`,
          secondaryReading: `T = ${(1 / waveFreqHz).toFixed(2)} s`,
          derivedMetric: `v = ${(waveFreqHz * wavelengthM).toFixed(1)} m/s`,
        });
      } else {
        onRecordTrial({
          inputsSummary: `Convex Lens · f=${focalLengthCm} cm · u=${objectDistCm} cm`,
          primaryReading: opticsMetrics.isAtFocal ? 'v = ∞' : `v = ${opticsMetrics.imageDistCm.toFixed(1)} cm`,
          secondaryReading: `m = ${opticsMetrics.magnification.toFixed(2)}×`,
          derivedMetric: opticsMetrics.isReal ? 'Real & Inverted' : 'Virtual & Upright',
        });
      }
    } else if (practicalId === 'magnetism') {
      onRecordTrial({
        inputsSummary: `N=${coilTurnsN} turns · I=${solenoidCurrentA.toFixed(1)} A · Core=${ironCoreInserted ? 'Soft Iron' : 'Air'}`,
        primaryReading: `B_core = ${magnetismMetrics.bCoreMt.toFixed(2)} mT`,
        secondaryReading: `B_probe = ${magnetismMetrics.bAtProbeMt.toFixed(2)} mT`,
        derivedMetric: `Deflection ${magnetismMetrics.compassDeflectionDeg.toFixed(0)}°`,
      });
    } else {
      onRecordTrial({
        inputsSummary: `${metroInstrument === 'vernier' ? 'Vernier Calliper' : 'Micrometer Gauge'} · ZeroErr=${zeroErrorMm >= 0 ? '+' : ''}${zeroErrorMm.toFixed(2)} mm`,
        primaryReading: `Obs = ${metroReadings.observed.toFixed(2)} mm`,
        secondaryReading: `MSR=${metroReadings.msrMm.toFixed(1)} · Div=${metroReadings.subDiv}`,
        derivedMetric: `True = ${metroReadings.corrected.toFixed(2)} mm`,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Telemetry Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Governing Law</div>
          <div className="mt-1 font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formula}
          </div>
        </div>

        {practicalId === 'circuits' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Current (I)</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-sky-600 dark:text-sky-400">
                  {circuitMetrics.totalCurrent.toFixed(3)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">A</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Equivalent Resistance</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {circuitMetrics.rEq.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">Ω</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Power & Switch</div>
              <div className="mt-1 flex items-center justify-between font-mono tabular-nums">
                <span className="text-lg font-bold text-slate-900 dark:text-white">{circuitMetrics.totalPower.toFixed(2)} W</span>
                {!switchClosed ? (
                  <span className="text-xs font-semibold text-slate-500">■ OPEN</span>
                ) : circuitMetrics.totalPower > 10 ? (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">▲ HIGH HEAT</span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">● NOMINAL</span>
                )}
              </div>
            </div>
          </>
        )}

        {practicalId === 'mechanics' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Period (T)</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-sky-600 dark:text-sky-400">
                  {theoreticalPeriod.toFixed(3)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">s</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Frequency · T²</div>
              <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{theoreticalFreq.toFixed(2)} Hz</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{(theoreticalPeriod * theoreticalPeriod).toFixed(3)} s²</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Stopwatch · Cycles</div>
              <div className="mt-1 flex items-center justify-between font-mono tabular-nums">
                <span className="text-lg font-bold text-slate-900 dark:text-white">{pendulumTelemetry.elapsedSec.toFixed(2)} s</span>
                <span className={`text-xs font-semibold ${pendulumRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {pendulumRunning ? '● RUNNING' : '■ PAUSED'} ({pendulumTelemetry.oscillations} N)
                </span>
              </div>
            </div>
          </>
        )}

        {practicalId === 'waves' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {waveOpticsMode === 'wave' ? 'Wavelength (λ)' : 'Image Distance (v)'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-sky-600 dark:text-sky-400">
                  {waveOpticsMode === 'wave'
                    ? wavelengthM.toFixed(2)
                    : opticsMetrics.isAtFocal
                    ? '∞'
                    : opticsMetrics.imageDistCm.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {waveOpticsMode === 'wave' ? 'm' : 'cm'}
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {waveOpticsMode === 'wave' ? 'Period (T = 1/f)' : 'Magnification (m)'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {waveOpticsMode === 'wave'
                    ? (1 / waveFreqHz).toFixed(3)
                    : opticsMetrics.isAtFocal
                    ? '∞'
                    : opticsMetrics.magnification.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {waveOpticsMode === 'wave' ? 's' : '×'}
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Nature / Mode</div>
              <div className="mt-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {waveOpticsMode === 'wave'
                  ? `● TRANSVERSE (v=${waveSpeedMs.toFixed(1)} m/s)`
                  : opticsMetrics.isAtFocal
                  ? '◆ IMAGE AT INFINITY'
                  : opticsMetrics.isReal
                  ? '● REAL & INVERTED'
                  : '▲ VIRTUAL & UPRIGHT'}
              </div>
            </div>
          </>
        )}

        {practicalId === 'magnetism' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Core Flux Density (B)</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-sky-600 dark:text-sky-400">
                  {magnetismMetrics.bCoreMt.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">mT</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Hall Probe at {probeDistanceCm.toFixed(1)} cm</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {magnetismMetrics.bAtProbeMt.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">mT</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Solenoid Polarity</div>
              <div className="mt-1 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {magnetismMetrics.polarity}
              </div>
            </div>
          </>
        )}

        {practicalId === 'measurements' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Observed Reading</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-sky-600 dark:text-sky-400">
                  {metroReadings.observed.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">mm</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Corrected True Value</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {metroReadings.corrected.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">mm</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Scale Breakdown</div>
              <div className="mt-1 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                MSR {metroReadings.msrMm.toFixed(1)} mm + ({metroReadings.subDiv} × {metroReadings.lc.toFixed(2)} mm)
              </div>
            </div>
          </>
        )}
      </div>

      {/* Asymmetric Two-Zone Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT CONTROL DECK */}
        <section className="lg:col-span-4 bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Atom className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                Instrument Controls
              </h2>
            </div>
            <button
              type="button"
              onClick={triggerRecord}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Record Trial</span>
            </button>
          </div>

          {practicalId === 'circuits' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Circuit Topology</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['single', 'series', 'parallel'] as CircuitTopology[]).map((topo) => (
                    <button
                      key={topo}
                      type="button"
                      onClick={() => setCircuitTopology(topo)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-semibold border capitalize cursor-pointer ${
                        circuitTopology === topo
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {topo}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="circuit-voltage" className="font-medium text-slate-700 dark:text-slate-300">Battery EMF (V)</label>
                  <span className="font-mono font-semibold tabular-nums text-sky-600 dark:text-sky-400">{sourceVoltage.toFixed(1)} V</span>
                </div>
                <input id="circuit-voltage" type="range" min={1.5} max={24} step={0.5} value={sourceVoltage} onChange={(e) => setSourceVoltage(parseFloat(e.target.value))} className="w-full accent-sky-600 cursor-pointer" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="circuit-r1" className="font-medium text-slate-700 dark:text-slate-300">Resistor R₁</label>
                  <span className="font-mono font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{resistor1} Ω</span>
                </div>
                <input id="circuit-r1" type="range" min={5} max={200} step={5} value={resistor1} onChange={(e) => setResistor1(parseInt(e.target.value, 10))} className="w-full accent-indigo-600 cursor-pointer" />
              </div>
              {circuitTopology !== 'single' && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label htmlFor="circuit-r2" className="font-medium text-slate-700 dark:text-slate-300">Resistor R₂</label>
                    <span className="font-mono font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{resistor2} Ω</span>
                  </div>
                  <input id="circuit-r2" type="range" min={5} max={200} step={5} value={resistor2} onChange={(e) => setResistor2(parseInt(e.target.value, 10))} className="w-full accent-indigo-600 cursor-pointer" />
                </div>
              )}
              <button
                type="button"
                onClick={() => setSwitchClosed((s) => !s)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer ${switchClosed ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200'}`}
              >
                {switchClosed ? 'Switch: CLOSED (ON)' : 'Switch: OPEN (OFF)'}
              </button>
            </div>
          )}

          {practicalId === 'mechanics' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="pendulum-length" className="font-medium text-slate-700 dark:text-slate-300">String Length (L)</label>
                  <span className="font-mono font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{pendulumLength.toFixed(2)} m</span>
                </div>
                <input id="pendulum-length" type="range" min={0.2} max={2.0} step={0.05} value={pendulumLength} onChange={(e) => setPendulumLength(parseFloat(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="pendulum-gravity" className="font-medium text-slate-700 dark:text-slate-300">Gravity (g)</label>
                  <span className="font-mono font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{gravity.toFixed(2)} m/s²</span>
                </div>
                <input id="pendulum-gravity" type="range" min={1.5} max={25.0} step={0.01} value={gravity} onChange={(e) => setGravity(parseFloat(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {GRAVITY_PRESETS.map((p) => (
                    <button key={p.label} type="button" onClick={() => setGravity(p.value)} className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${Math.abs(gravity - p.value) < 0.02 ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 text-sky-700 dark:text-sky-300' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="pendulum-angle" className="font-medium text-slate-700 dark:text-slate-300">Release Angle (θ₀)</label>
                  <span className="font-mono font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{releaseAngleDeg}°</span>
                </div>
                <input id="pendulum-angle" type="range" min={5} max={45} step={1} value={releaseAngleDeg} onChange={(e) => { setReleaseAngleDeg(parseInt(e.target.value, 10)); pendulumStateRef.current.t = 0; }} className="w-full accent-indigo-600 cursor-pointer" />
              </div>
              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Show Force & Velocity Vectors</span>
                <input type="checkbox" checked={showVectors} onChange={(e) => setShowVectors(e.target.checked)} className="w-4 h-4 accent-indigo-600 cursor-pointer" />
              </label>
              <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex gap-2">
                <button type="button" onClick={() => setPendulumRunning((r) => !r)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold cursor-pointer">
                  {pendulumRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{pendulumRunning ? 'Pause' : 'Resume'}</span>
                </button>
                <button type="button" onClick={() => { setPendulumRunning(false); stepPendulum(0.05); }} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold cursor-pointer">
                  <StepForward className="w-3.5 h-3.5 inline" />
                </button>
                <button type="button" onClick={resetPendulum} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold cursor-pointer">
                  <RotateCcw className="w-3.5 h-3.5 inline" />
                </button>
              </div>
            </div>
          )}

          {practicalId === 'waves' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setWaveOpticsMode('wave')} className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${waveOpticsMode === 'wave' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}`}>
                  Wave Tank
                </button>
                <button type="button" onClick={() => setWaveOpticsMode('optics')} className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${waveOpticsMode === 'optics' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}`}>
                  Convex Lens
                </button>
              </div>
              {waveOpticsMode === 'wave' ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label htmlFor="wave-f" className="font-medium">Frequency (f)</label>
                      <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">{waveFreqHz.toFixed(1)} Hz</span>
                    </div>
                    <input id="wave-f" type="range" min={0.5} max={5.0} step={0.1} value={waveFreqHz} onChange={(e) => setWaveFreqHz(parseFloat(e.target.value))} className="w-full accent-sky-600 cursor-pointer" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label htmlFor="wave-v" className="font-medium">Wave Speed (v)</label>
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{waveSpeedMs.toFixed(1)} m/s</span>
                    </div>
                    <input id="wave-v" type="range" min={2} max={20} step={0.5} value={waveSpeedMs} onChange={(e) => setWaveSpeedMs(parseFloat(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label htmlFor="wave-a" className="font-medium">Amplitude (A)</label>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{waveAmpCm.toFixed(1)} cm</span>
                    </div>
                    <input id="wave-a" type="range" min={1} max={5} step={0.2} value={waveAmpCm} onChange={(e) => setWaveAmpCm(parseFloat(e.target.value))} className="w-full accent-emerald-600 cursor-pointer" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label htmlFor="lens-f" className="font-medium">Focal Length (f)</label>
                      <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">{focalLengthCm} cm</span>
                    </div>
                    <input id="lens-f" type="range" min={8} max={25} step={1} value={focalLengthCm} onChange={(e) => setFocalLengthCm(parseInt(e.target.value, 10))} className="w-full accent-sky-600 cursor-pointer" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <label htmlFor="lens-u" className="font-medium">Object Distance (u)</label>
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{objectDistCm} cm</span>
                    </div>
                    <input id="lens-u" type="range" min={6} max={55} step={1} value={objectDistCm} onChange={(e) => setObjectDistCm(parseInt(e.target.value, 10))} className="w-full accent-indigo-600 cursor-pointer" />
                  </div>
                </>
              )}
            </div>
          )}

          {practicalId === 'magnetism' && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="mag-turns" className="font-medium">Solenoid Turns (N)</label>
                  <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">{coilTurnsN} turns</span>
                </div>
                <input id="mag-turns" type="range" min={50} max={500} step={25} value={coilTurnsN} onChange={(e) => setCoilTurnsN(parseInt(e.target.value, 10))} className="w-full accent-sky-600 cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="mag-i" className="font-medium">Coil Current & Polarity (I)</label>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{solenoidCurrentA >= 0 ? '+' : ''}{solenoidCurrentA.toFixed(1)} A</span>
                </div>
                <input id="mag-i" type="range" min={-5} max={5} step={0.5} value={solenoidCurrentA} onChange={(e) => setSolenoidCurrentA(parseFloat(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="mag-d" className="font-medium">Hall Probe Distance (d)</label>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{probeDistanceCm.toFixed(1)} cm</span>
                </div>
                <input id="mag-d" type="range" min={1} max={15} step={0.5} value={probeDistanceCm} onChange={(e) => setProbeDistanceCm(parseFloat(e.target.value))} className="w-full accent-amber-600 cursor-pointer" />
              </div>
              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Insert Soft-Iron Core (μ_r = 120)</span>
                <input type="checkbox" checked={ironCoreInserted} onChange={(e) => setIronCoreInserted(e.target.checked)} className="w-4 h-4 accent-sky-600 cursor-pointer" />
              </label>
            </div>
          )}

          {practicalId === 'measurements' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setMetroInstrument('vernier')} className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${metroInstrument === 'vernier' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}`}>
                  Vernier (0.02 mm)
                </button>
                <button type="button" onClick={() => setMetroInstrument('micrometer')} className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${metroInstrument === 'micrometer' ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'}`}>
                  Micrometer (0.01 mm)
                </button>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="metro-size" className="font-medium">Specimen Diameter</label>
                  <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">{targetSizeMm.toFixed(2)} mm</span>
                </div>
                <input
                  id="metro-size"
                  type="range"
                  min={metroInstrument === 'vernier' ? 1.0 : 0.5}
                  max={metroInstrument === 'vernier' ? 35.0 : 18.0}
                  step={metroInstrument === 'vernier' ? 0.02 : 0.01}
                  value={Math.min(metroInstrument === 'vernier' ? 35 : 18, targetSizeMm)}
                  onChange={(e) => setTargetSizeMm(parseFloat(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="metro-zero" className="font-medium">Zero Error Calibration</label>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {zeroErrorMm >= 0 ? '+' : ''}{zeroErrorMm.toFixed(2)} mm
                  </span>
                </div>
                <input id="metro-zero" type="range" min={-0.06} max={0.06} step={0.02} value={zeroErrorMm} onChange={(e) => setZeroErrorMm(parseFloat(e.target.value))} className="w-full accent-amber-600 cursor-pointer" />
              </div>
            </div>
          )}
        </section>

        {/* RIGHT APPARATUS STAGE */}
        <section className="lg:col-span-8 bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5">
          {practicalId === 'circuits' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">Interactive DC Schematic & V–I Plot</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Click the schematic switch directly or adjust source EMF and load resistances.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-3">
                  <svg viewBox="0 0 420 270" className="w-full h-[270px]">
                    <rect x="56" y="46" width="308" height="176" rx="10" fill="none" stroke={switchClosed ? '#0284c7' : '#94a3b8'} strokeWidth="3" />
                    {switchClosed && circuitMetrics.totalCurrent > 0 && (
                      <rect x="56" y="46" width="308" height="176" rx="10" fill="none" stroke="#38bdf8" strokeWidth="3" strokeDasharray="6 14">
                        <animate attributeName="stroke-dashoffset" from="200" to="0" dur={`${Math.max(0.35, Math.min(4, 1.4 / Math.max(0.08, circuitMetrics.totalCurrent))).toFixed(2)}s`} repeatCount="indefinite" />
                      </rect>
                    )}
                    <rect x="40" y="106" width="32" height="54" className="fill-slate-50 dark:fill-[#121212]" />
                    <line x1="42" y1="120" x2="70" y2="120" stroke="#4f46e5" strokeWidth="4" />
                    <line x1="49" y1="132" x2="63" y2="132" stroke="#4f46e5" strokeWidth="2.5" />
                    <line x1="42" y1="144" x2="70" y2="144" stroke="#4f46e5" strokeWidth="4" />
                    <text x="16" y="136" className="fill-indigo-600 dark:fill-indigo-400 text-[11px] font-mono font-bold">{sourceVoltage.toFixed(1)}V</text>
                    <g onClick={() => setSwitchClosed((s) => !s)} className="cursor-pointer">
                      <rect x="115" y="28" width="64" height="32" fill="transparent" />
                      <rect x="120" y="40" width="54" height="12" className="fill-slate-50 dark:fill-[#121212]" />
                      <circle cx="124" cy="46" r="4" fill="#0ea5e9" />
                      <circle cx="170" cy="46" r="4" fill="#0ea5e9" />
                      <line x1="124" y1="46" x2={switchClosed ? '170' : '164'} y2={switchClosed ? '46' : '26'} stroke={switchClosed ? '#10b981' : '#f59e0b'} strokeWidth="3" strokeLinecap="round" />
                    </g>
                    <circle cx="290" cy="46" r="20" className="fill-white dark:fill-slate-900" stroke="#0284c7" strokeWidth="2.5" />
                    <text x="290" y="50" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 text-[10px] font-mono font-bold">{circuitMetrics.totalCurrent.toFixed(2)}A</text>
                    {circuitTopology === 'single' && (
                      <g>
                        <rect x="165" y="206" width="90" height="32" rx="6" className="fill-white dark:fill-slate-900" stroke="#4f46e5" strokeWidth="2.2" />
                        <text x="210" y="226" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-[11px] font-mono font-bold">R₁ = {resistor1} Ω</text>
                      </g>
                    )}
                    {circuitTopology === 'series' && (
                      <g>
                        <rect x="112" y="206" width="84" height="32" rx="6" className="fill-white dark:fill-slate-900" stroke="#4f46e5" strokeWidth="2.2" />
                        <text x="154" y="226" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-[11px] font-mono font-bold">R₁ {resistor1}Ω</text>
                        <rect x="228" y="206" width="84" height="32" rx="6" className="fill-white dark:fill-slate-900" stroke="#8b5cf6" strokeWidth="2.2" />
                        <text x="270" y="226" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-[11px] font-mono font-bold">R₂ {resistor2}Ω</text>
                      </g>
                    )}
                    {circuitTopology === 'parallel' && (
                      <g>
                        <line x1="130" y1="222" x2="130" y2="152" stroke={switchClosed ? '#0284c7' : '#94a3b8'} strokeWidth="2.5" />
                        <line x1="290" y1="222" x2="290" y2="152" stroke={switchClosed ? '#0284c7' : '#94a3b8'} strokeWidth="2.5" />
                        <line x1="130" y1="152" x2="290" y2="152" stroke={switchClosed ? '#0284c7' : '#94a3b8'} strokeWidth="2.5" />
                        <rect x="166" y="136" width="88" height="30" rx="6" className="fill-white dark:fill-slate-900" stroke="#4f46e5" strokeWidth="2.2" />
                        <text x="210" y="155" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-[11px] font-mono font-bold">R₁ {resistor1} Ω</text>
                        <rect x="166" y="206" width="88" height="30" rx="6" className="fill-white dark:fill-slate-900" stroke="#8b5cf6" strokeWidth="2.2" />
                        <text x="210" y="225" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-[11px] font-mono font-bold">R₂ {resistor2} Ω</text>
                      </g>
                    )}
                  </svg>
                </div>
                <div className="md:col-span-5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#121212] p-3 flex flex-col justify-between">
                  <div className="text-[11px] font-mono text-slate-500">V–I OHMIC CURVE</div>
                  <svg viewBox="0 0 280 210" className="w-full h-[215px]">
                    <line x1="38" y1="18" x2="38" y2="178" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <line x1="38" y1="178" x2="262" y2="178" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    {(() => {
                      const maxI = Math.max(1.0, Math.ceil((24 / circuitMetrics.rEq) * 1.25 * 10) / 10);
                      const yMaxI = 178 - ((24 / circuitMetrics.rEq) / maxI) * 150;
                      const curX = 38 + (sourceVoltage / 24) * 216;
                      const curY = 178 - (circuitMetrics.totalCurrent / maxI) * 150;
                      return (
                        <>
                          <line x1="38" y1="178" x2={254} y2={Math.max(18, yMaxI)} stroke="#0284c7" strokeWidth="2.2" />
                          <circle cx={curX} cy={curY} r="5.5" fill={switchClosed ? '#10b981' : '#94a3b8'} stroke="#ffffff" strokeWidth="1.5" />
                        </>
                      );
                    })()}
                    <text x="148" y="198" textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">Voltage (0 → 24 V)</text>
                  </svg>
                  <div className="text-[11px] font-mono text-slate-500">Conductance G = {(1 / circuitMetrics.rEq).toFixed(4)} S</div>
                </div>
              </div>
            </div>
          )}

          {practicalId === 'mechanics' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">Simple Pendulum Oscillation & T²–L Graph</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Blue arrow: tangential velocity (v) · Amber arrow: restoring force (−mg sin θ)</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] overflow-hidden">
                  <canvas ref={pendulumCanvasRef} className="w-full h-[290px] block cursor-crosshair" />
                </div>
                <div className="md:col-span-5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#121212] p-3 flex flex-col justify-between">
                  <div className="text-[11px] font-mono text-slate-500">T² vs LENGTH (L)</div>
                  <svg viewBox="0 0 280 210" className="w-full h-[215px]">
                    <line x1="38" y1="18" x2="38" y2="178" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <line x1="38" y1="178" x2="262" y2="178" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    {(() => {
                      const maxL = 2.0;
                      const maxT2 = 20.0;
                      const slope = (4 * Math.PI * Math.PI) / gravity;
                      const lEnd = Math.min(maxL, maxT2 / slope);
                      const x2 = 38 + (lEnd / maxL) * 218;
                      const y2 = 178 - ((lEnd * slope) / maxT2) * 150;
                      const cx = 38 + (pendulumLength / maxL) * 218;
                      const cy = 178 - (Math.min(maxT2, theoreticalPeriod * theoreticalPeriod) / maxT2) * 150;
                      return (
                        <>
                          <line x1="38" y1="178" x2={x2} y2={y2} stroke="#4f46e5" strokeWidth="2.2" />
                          <circle cx={cx} cy={cy} r="5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
                        </>
                      );
                    })()}
                    <text x="148" y="198" textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">Length L (0 → 2.0 m)</text>
                  </svg>
                  <div className="text-[11px] font-mono text-slate-500">Slope = {((4 * Math.PI * Math.PI) / gravity).toFixed(2)} s²/m</div>
                </div>
              </div>
            </div>
          )}

          {practicalId === 'waves' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  {waveOpticsMode === 'wave' ? 'Transverse Mechanical Wave Propagation' : 'Convex Converging Lens Ray Optics'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {waveOpticsMode === 'wave'
                    ? 'Observe how frequency and wave speed determine wavelength λ = v / f.'
                    : 'Trace principal rays parallel to the axis and through optical center O to locate the image.'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-3">
                {waveOpticsMode === 'wave' ? (
                  <svg viewBox="0 0 460 220" className="w-full h-[230px]">
                    <line x1="20" y1="110" x2="440" y2="110" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeDasharray="4 4" />
                    <path
                      d={Array.from({ length: 120 }, (_, i) => {
                        const xM = (i / 119) * 16; // 16 meters window
                        const yVal = waveAmpCm * 13 * Math.sin((2 * Math.PI * xM) / wavelengthM - wavePhase);
                        const px = 20 + (i / 119) * 420;
                        const py = 110 - yVal;
                        return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2.8"
                    />
                    {/* Wavelength caliper marker */}
                    {(() => {
                      const lamPx = Math.min(360, (wavelengthM / 16) * 420);
                      return (
                        <g>
                          <line x1="80" y1="30" x2={80 + lamPx} y2="30" stroke="#10b981" strokeWidth="2" />
                          <text x={80 + lamPx / 2} y="22" textAnchor="middle" className="fill-emerald-600 dark:fill-emerald-400 text-[10px] font-mono font-bold">
                            λ = {wavelengthM.toFixed(2)} m
                          </text>
                        </g>
                      );
                    })()}
                  </svg>
                ) : (
                  <svg viewBox="0 0 480 230" className="w-full h-[230px]">
                    {/* Optical axis */}
                    <line x1="16" y1="115" x2="464" y2="115" stroke="currentColor" className="text-slate-300 dark:text-slate-700" />
                    {/* Convex Lens */}
                    <ellipse cx="240" cy="115" rx="9" ry="78" fill="rgba(56,189,248,0.22)" stroke="#0284c7" strokeWidth="2" />
                    {(() => {
                      const scale = 3.6;
                      const fPx = focalLengthCm * scale;
                      const uPx = objectDistCm * scale;
                      const objX = 240 - uPx;
                      const objH = objectHeightCm * 10;
                      const vPx = opticsMetrics.isAtFocal ? 300 : opticsMetrics.imageDistCm * scale;
                      const imgX = 240 + vPx;
                      const imgH = opticsMetrics.isAtFocal ? objH : -objH * (opticsMetrics.imageDistCm / objectDistCm);
                      return (
                        <>
                          <circle cx={240 - fPx} cy="115" r="3.5" fill="#10b981" />
                          <circle cx={240 + fPx} cy="115" r="3.5" fill="#10b981" />
                          <text x={240 - fPx} y="130" textAnchor="middle" className="fill-emerald-600 text-[9px] font-mono">F</text>
                          <text x={240 + fPx} y="130" textAnchor="middle" className="fill-emerald-600 text-[9px] font-mono">F&apos;</text>
                          {/* Object Arrow */}
                          <line x1={objX} y1="115" x2={objX} y2={115 - objH} stroke="#4f46e5" strokeWidth="3" />
                          {/* Ray 1: Parallel then through F' */}
                          <line x1={objX} y1={115 - objH} x2="240" y2={115 - objH} stroke="#f59e0b" strokeWidth="1.6" />
                          <line x1="240" y1={115 - objH} x2={Math.max(40, Math.min(460, imgX))} y2={115 - imgH} stroke="#f59e0b" strokeWidth="1.6" />
                          {/* Ray 2: Through Center */}
                          <line x1={objX} y1={115 - objH} x2={Math.max(40, Math.min(460, imgX))} y2={115 - imgH} stroke="#0ea5e9" strokeWidth="1.6" />
                          {!opticsMetrics.isAtFocal && imgX > 16 && imgX < 464 && (
                            <line
                              x1={imgX}
                              y1="115"
                              x2={imgX}
                              y2={115 - imgH}
                              stroke={opticsMetrics.isReal ? '#e11d48' : '#10b981'}
                              strokeDasharray={opticsMetrics.isReal ? undefined : '4 4'}
                              strokeWidth="3"
                            />
                          )}
                        </>
                      );
                    })()}
                  </svg>
                )}
              </div>
            </div>
          )}

          {practicalId === 'magnetism' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">Solenoid Electromagnet & Compass Deflection</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Reverse current direction to flip North/South magnetic poles or insert a soft-iron core to amplify flux density.</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-4">
                <svg viewBox="0 0 460 220" className="w-full h-[225px]">
                  {/* Iron Core */}
                  {ironCoreInserted && (
                    <rect x="85" y="92" width="170" height="36" rx="4" fill="#64748b" opacity="0.55" />
                  )}
                  {/* Solenoid Windings */}
                  {Array.from({ length: Math.min(18, Math.max(5, Math.round(coilTurnsN / 28))) }).map((_, idx, arr) => {
                    const x = 94 + (idx / Math.max(1, arr.length - 1)) * 152;
                    return (
                      <ellipse key={idx} cx={x} cy="110" rx="6" ry="28" fill="none" stroke="#d97706" strokeWidth="2.5" />
                    );
                  })}
                  {/* Field Lines when I != 0 */}
                  {solenoidCurrentA !== 0 && (
                    <g fill="none" stroke="#0284c7" strokeDasharray="5 5" strokeOpacity="0.65" strokeWidth="1.5">
                      <ellipse cx="170" cy="110" rx="135" ry="52" />
                      <ellipse cx="170" cy="110" rx="165" ry="76" />
                    </g>
                  )}
                  {/* Compass Probe */}
                  <g transform={`translate(${Math.min(410, 275 + probeDistanceCm * 8)}, 110)`}>
                    <circle cx="0" cy="0" r="24" className="fill-white dark:fill-slate-900" stroke="#475569" strokeWidth="2" />
                    <g transform={`rotate(${magnetismMetrics.compassDeflectionDeg})`}>
                      <polygon points="0,-17 5,0 -5,0" fill="#e11d48" />
                      <polygon points="0,17 5,0 -5,0" fill="#94a3b8" />
                    </g>
                    <text x="0" y="38" textAnchor="middle" className="fill-slate-500 text-[9px] font-mono">Compass</text>
                  </g>
                </svg>
              </div>
            </div>
          )}

          {practicalId === 'measurements' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  {metroInstrument === 'vernier' ? 'Vernier Calliper Scale Alignment (LC = 0.02 mm)' : 'Micrometer Screw Gauge Thimble Alignment (LC = 0.01 mm)'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Read Main Scale before zero mark, add Vernier/Thimble coincidence × least count, and subtract zero error.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-4">
                {metroInstrument === 'vernier' ? (
                  <svg viewBox="0 0 460 190" className="w-full h-[195px]">
                    {/* Main Scale Beam */}
                    <rect x="20" y="38" width="420" height="44" rx="3" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
                    {Array.from({ length: 41 }, (_, mm) => {
                      const x = 35 + mm * 9.5;
                      const isMajor = mm % 10 === 0;
                      const isFive = mm % 5 === 0;
                      return (
                        <g key={mm}>
                          <line x1={x} y1="82" x2={x} y2={isMajor ? 58 : isFive ? 66 : 73} stroke="#1e293b" strokeWidth={isMajor ? 1.6 : 1} />
                          {isMajor && <text x={x} y="53" textAnchor="middle" className="fill-slate-800 text-[10px] font-mono font-bold">{mm}</text>}
                        </g>
                      );
                    })}
                    {/* Sliding Vernier Jaw */}
                    {(() => {
                      const shiftPx = metroReadings.observed * 9.5;
                      return (
                        <g transform={`translate(${shiftPx}, 0)`}>
                          <rect x="35" y="84" width="110" height="44" rx="3" fill="rgba(56,189,248,0.28)" stroke="#0284c7" strokeWidth="1.8" />
                          {Array.from({ length: 11 }, (_, v) => {
                            const vx = 35 + v * 9.31;
                            return (
                              <g key={v}>
                                <line x1={vx} y1="84" x2={vx} y2={v % 5 === 0 ? 104 : 96} stroke="#0369a1" strokeWidth="1.3" />
                                {v % 5 === 0 && <text x={vx} y="118" textAnchor="middle" className="fill-sky-700 dark:fill-sky-300 text-[9px] font-mono">{v}</text>}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}
                    <text x="230" y="162" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-xs font-mono font-semibold">
                      MSR = {metroReadings.msrMm} mm · Vernier Coincidence = div {metroReadings.subDiv} (+{(metroReadings.subDiv * 0.02).toFixed(2)} mm)
                    </text>
                  </svg>
                ) : (
                  <svg viewBox="0 0 460 190" className="w-full h-[195px]">
                    {/* Sleeve / Datum Line */}
                    <rect x="40" y="56" width="210" height="58" rx="4" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.6" />
                    <line x1="48" y1="85" x2="242" y2="85" stroke="#0f172a" strokeWidth="1.8" />
                    {Array.from({ length: 21 }, (_, i) => {
                      const x = 52 + i * 9;
                      return (
                        <g key={i}>
                          <line x1={x} y1="85" x2={x} y2="68" stroke="#0f172a" strokeWidth="1.2" />
                          <line x1={x + 4.5} y1="85" x2={x + 4.5} y2="98" stroke="#475569" strokeWidth="1" />
                          {i % 5 === 0 && <text x={x} y="64" textAnchor="middle" className="fill-slate-800 text-[9px] font-mono">{i}</text>}
                        </g>
                      );
                    })}
                    {/* Thimble Drum */}
                    {(() => {
                      const thimbleX = 52 + metroReadings.observed * 9;
                      return (
                        <g>
                          <rect x={thimbleX} y="42" width="120" height="86" rx="5" fill="rgba(56,189,248,0.28)" stroke="#0284c7" strokeWidth="2" />
                          <text x={thimbleX + 60} y="89" textAnchor="middle" className="fill-sky-700 dark:fill-sky-300 text-xs font-mono font-bold">
                            Div: {metroReadings.subDiv}
                          </text>
                        </g>
                      );
                    })()}
                    <text x="230" y="162" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-xs font-mono font-semibold">
                      Sleeve = {metroReadings.msrMm.toFixed(1)} mm · Thimble = {metroReadings.subDiv} × 0.01 mm = {metroReadings.observed.toFixed(2)} mm
                    </text>
                  </svg>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
