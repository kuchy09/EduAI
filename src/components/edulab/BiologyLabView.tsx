import React, { useState, useMemo } from 'react';
import {
  Dna,
  Microscope,
  ClipboardCheck,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { BiologyPracticalId, TrialPayload } from './edulabTypes';

interface BiologyLabViewProps {
  practicalId: BiologyPracticalId;
  formula: string;
  onRecordTrial: (payload: TrialPayload) => void;
}

type OsmosisCellType = 'plant' | 'rbc';
type MicroscopeSlide = 'onion' | 'stomata' | 'cheek' | 'paramecium';
type GeneticTraitId = 'seed_shape' | 'flower_color' | 'sex_linked';
type ActivityLevel = 'rest' | 'jog' | 'sprint';
type EcologyMode = 'quadrat' | 'predator_prey';

function computeOsmosisMetrics(cellType: OsmosisCellType, extMolarity: number) {
  const RT = 2477.57;
  const cellBaseMolarity = 0.30;
  const solutionPsiKpa = -extMolarity * RT;
  const cellSolutePsiKpa = -cellBaseMolarity * RT;

  if (cellType === 'plant') {
    if (extMolarity < cellBaseMolarity) {
      const turgorKpa = Math.max(0, solutionPsiKpa - cellSolutePsiKpa);
      const expansion = 1 + 0.14 * ((cellBaseMolarity - extMolarity) / cellBaseMolarity);
      return {
        solutionPsiKpa,
        turgorKpa,
        relativeVolPct: expansion * 100,
        plasmolysisPct: 0,
        stateLabel: 'TURGID (HYPOTONIC)',
        tone: 'nominal' as const,
      };
    }
    if (Math.abs(extMolarity - cellBaseMolarity) < 0.02) {
      return {
        solutionPsiKpa,
        turgorKpa: 0,
        relativeVolPct: 100,
        plasmolysisPct: 0,
        stateLabel: 'INCIPIENT FLACCID (ISOTONIC)',
        tone: 'balanced' as const,
      };
    }
    const shrinkRatio = Math.max(0.62, cellBaseMolarity / Math.max(0.30, extMolarity));
    return {
      solutionPsiKpa,
      turgorKpa: 0,
      relativeVolPct: shrinkRatio * 100,
      plasmolysisPct: Math.min(100, ((1 - shrinkRatio) / 0.38) * 100),
      stateLabel: 'PLASMOLYSED (HYPERTONIC)',
      tone: 'warning' as const,
    };
  }

  if (extMolarity < 0.15) {
    return {
      solutionPsiKpa,
      turgorKpa: 0,
      relativeVolPct: 145,
      plasmolysisPct: 0,
      stateLabel: 'HAEMOLYSED (LYSED)',
      tone: 'critical' as const,
    };
  }
  if (extMolarity < cellBaseMolarity - 0.02) {
    return {
      solutionPsiKpa,
      turgorKpa: 0,
      relativeVolPct: 100 + ((cellBaseMolarity - extMolarity) / 0.15) * 28,
      plasmolysisPct: 0,
      stateLabel: 'SWOLLEN (HYPOTONIC)',
      tone: 'nominal' as const,
    };
  }
  if (Math.abs(extMolarity - cellBaseMolarity) <= 0.02) {
    return {
      solutionPsiKpa,
      turgorKpa: 0,
      relativeVolPct: 100,
      plasmolysisPct: 0,
      stateLabel: 'NORMAL BICONCAVE (ISOTONIC)',
      tone: 'balanced' as const,
    };
  }
  const crenateRatio = Math.max(0.58, cellBaseMolarity / extMolarity);
  return {
    solutionPsiKpa,
    turgorKpa: 0,
    relativeVolPct: crenateRatio * 100,
    plasmolysisPct: ((1 - crenateRatio) / 0.42) * 100,
    stateLabel: 'CRENATED (HYPERTONIC)',
    tone: 'warning' as const,
  };
}

const SLIDE_SPECS: Record<
  MicroscopeSlide,
  { name: string; actualUm: number; stain: string; structures: string }
> = {
  onion: { name: 'Onion Bulb Epidermis', actualUm: 180, stain: 'Iodine (Yellow-Brown)', structures: 'Cell wall, nucleus, large central vacuole' },
  stomata: { name: 'Dicot Leaf Lower Epidermis', actualUm: 52, stain: 'Unstained Chlorophyll', structures: 'Guard cells, stomatal pore, chloroplasts' },
  cheek: { name: 'Human Cheek Epithelium', actualUm: 65, stain: 'Methylene Blue', structures: 'Plasma membrane, dark blue nucleus, cytoplasm' },
  paramecium: { name: 'Paramecium caudatum', actualUm: 210, stain: 'Methyl Cellulose', structures: 'Oral groove, contractile vacuole, cilia' },
};

const GENETIC_TRAITS: Record<
  GeneticTraitId,
  {
    name: string;
    domLabel: string;
    recLabel: string;
    p1Options: string[];
    p2Options: string[];
    splitGametes: (g: string) => [string, string];
    classifyPhenotype: (pair: string) => { label: string; isDom: boolean };
  }
> = {
  seed_shape: {
    name: 'Pea Seed Coat (R = Round, r = Wrinkled)',
    domLabel: 'Round Seed',
    recLabel: 'Wrinkled Seed',
    p1Options: ['RR', 'Rr', 'rr'],
    p2Options: ['RR', 'Rr', 'rr'],
    splitGametes: (g) => [g[0], g[1]],
    classifyPhenotype: (p) =>
      p.includes('R') ? { label: 'Round', isDom: true } : { label: 'Wrinkled', isDom: false },
  },
  flower_color: {
    name: 'Pea Petal Color (P = Purple, p = White)',
    domLabel: 'Purple Petal',
    recLabel: 'White Petal',
    p1Options: ['PP', 'Pp', 'pp'],
    p2Options: ['PP', 'Pp', 'pp'],
    splitGametes: (g) => [g[0], g[1]],
    classifyPhenotype: (p) =>
      p.includes('P') ? { label: 'Purple', isDom: true } : { label: 'White', isDom: false },
  },
  sex_linked: {
    name: 'Sex-Linked Clotting (XH = Normal, Xh = Affected)',
    domLabel: 'Normal Clotting',
    recLabel: 'Affected',
    p1Options: ['XHXH', 'XHXh', 'XhXh'],
    p2Options: ['XHY', 'XhY'],
    splitGametes: (g) =>
      g.length === 4 ? [g.slice(0, 2), g.slice(2, 4)] : [g.slice(0, 2), 'Y'],
    classifyPhenotype: (p) => {
      if (p.includes('Y')) {
        return p.includes('XH')
          ? { label: 'Normal Male', isDom: true }
          : { label: 'Affected Male', isDom: false };
      }
      if (p === 'XhXh') return { label: 'Affected Female', isDom: false };
      if (p === 'XHXh') return { label: 'Carrier Female', isDom: true };
      return { label: 'Normal Female', isDom: true };
    },
  },
};

const INITIAL_QUADRATS = [
  12, 8, 15, 4, 9,
  6, 14, 11, 13, 7,
  10, 16, 5, 9, 12,
  8, 7, 14, 11, 6,
  13, 9, 10, 8, 15,
];

export function BiologyLabView({ practicalId, formula, onRecordTrial }: BiologyLabViewProps) {
  // 1. CELL OBSERVATION STATE
  const [osmosisCellType, setOsmosisCellType] = useState<OsmosisCellType>('plant');
  const [sucroseMolarity, setSucroseMolarity] = useState<number>(0.30);
  const [showOrganelleLabels, setShowOrganelleLabels] = useState<boolean>(true);
  const osmosisMetrics = useMemo(
    () => computeOsmosisMetrics(osmosisCellType, sucroseMolarity),
    [osmosisCellType, sucroseMolarity]
  );

  // 2. MICROSCOPY STATE
  const [slide, setSlide] = useState<MicroscopeSlide>('onion');
  const [objectiveMag, setObjectiveMag] = useState<4 | 10 | 40 | 100>(40);
  const [focusOffset, setFocusOffset] = useState<number>(0); // -10 to +10 (0 is sharp focus)
  const [condenserLight, setCondenserLight] = useState<number>(80); // %

  const totalMagnification = 10 * objectiveMag; // 10x eyepiece
  const slideSpec = SLIDE_SPECS[slide];
  const imageApparentUm = slideSpec.actualUm * totalMagnification;
  const focusBlurPx = Math.abs(focusOffset) * 0.6;

  // 3. GENETICS STATE
  const [traitId, setTraitId] = useState<GeneticTraitId>('seed_shape');
  const [parent1Geno, setParent1Geno] = useState<string>('Rr');
  const [parent2Geno, setParent2Geno] = useState<string>('Rr');
  const [sampledCohort, setSampledCohort] = useState<Record<string, number> | null>(null);

  const traitSpec = GENETIC_TRAITS[traitId];
  const punnett = useMemo(() => {
    const g1 = traitSpec.splitGametes(parent1Geno);
    const g2 = traitSpec.splitGametes(parent2Geno);
    const cells: { row: number; col: number; geno: string; pheno: string; isDom: boolean }[] = [];
    const phenoCounts: Record<string, number> = {};

    g1.forEach((a1, r) => {
      g2.forEach((a2, c) => {
        const pairArr = [a1, a2].sort((x, y) => {
          if (x === 'Y') return 1;
          if (y === 'Y') return -1;
          return x.localeCompare(y);
        });
        const geno = pairArr.join('');
        const cls = traitSpec.classifyPhenotype(geno);
        cells.push({ row: r, col: c, geno, pheno: cls.label, isDom: cls.isDom });
        phenoCounts[cls.label] = (phenoCounts[cls.label] || 0) + 1;
      });
    });
    return { g1, g2, cells, phenoCounts };
  }, [traitSpec, parent1Geno, parent2Geno]);

  const handleSampleCohort = () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      const pick = punnett.cells[Math.floor(Math.random() * 4)];
      counts[pick.pheno] = (counts[pick.pheno] || 0) + 1;
    }
    setSampledCohort(counts);
  };

  // 4. HUMAN PHYSIOLOGY STATE
  const [activity, setActivity] = useState<ActivityLevel>('rest');
  const [altitudeM, setAltitudeM] = useState<number>(1795); // Nairobi baseline 1795 m!

  const physioMetrics = useMemo(() => {
    const baseHr = activity === 'rest' ? 68 : activity === 'jog' ? 128 : 176;
    const altHrBump = Math.round((altitudeM / 1000) * 6);
    const heartRate = Math.min(205, baseHr + altHrBump);
    const strokeVolMl = activity === 'rest' ? 72 : activity === 'jog' ? 102 : 118;
    const cardiacOutputLMin = (heartRate * strokeVolMl) / 1000;
    const respRate = (activity === 'rest' ? 14 : activity === 'jog' ? 28 : 44) + Math.round((altitudeM / 1000) * 2.5);
    const tidalVolL = activity === 'rest' ? 0.50 : activity === 'jog' ? 1.45 : 2.35;
    const minuteVentLMin = respRate * tidalVolL;
    const spo2Pct = Math.max(82, Math.min(99, 98.8 - (altitudeM / 1000) * 3.1 - (activity === 'sprint' ? 1.8 : 0)));
    return { heartRate, strokeVolMl, cardiacOutputLMin, respRate, tidalVolL, minuteVentLMin, spo2Pct };
  }, [activity, altitudeM]);

  // 5. ECOLOGY STATE
  const [ecologyMode, setEcologyMode] = useState<EcologyMode>('quadrat');
  const [sampledQuadrats, setSampledQuadrats] = useState<number[]>([0, 6, 12, 18, 24]);
  const [preyBirthRate, setPreyBirthRate] = useState<number>(0.45);
  const [predationRate, setPredationRate] = useState<number>(0.015);
  const [carryingCap, setCarryingCap] = useState<number>(180);

  const quadratStats = useMemo(() => {
    const counts = sampledQuadrats.map((idx) => INITIAL_QUADRATS[idx]);
    const meanPerQuadrat = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    // Each quadrat is 1 m x 1 m across a 25 m^2 habitat grid (scaled to 1000 m^2 savannah plot)
    const estimatedSavannahTotal = meanPerQuadrat * 1000;
    return { sampledCount: counts.length, meanPerQuadrat, estimatedSavannahTotal };
  }, [sampledQuadrats]);

  const lotkaSeries = useMemo(() => {
    const pts: { step: number; prey: number; pred: number }[] = [];
    let prey = 60;
    let pred = 18;
    const predDeath = 0.25;
    const conv = 0.008;
    const dt = 0.25;
    for (let s = 0; s <= 60; s++) {
      pts.push({ step: s, prey, pred });
      const dPrey = (preyBirthRate * prey * (1 - prey / carryingCap) - predationRate * prey * pred) * dt;
      const dPred = (conv * prey * pred - predDeath * pred) * dt;
      prey = Math.max(4, Math.min(carryingCap, prey + dPrey));
      pred = Math.max(2, Math.min(120, pred + dPred));
    }
    return pts;
  }, [preyBirthRate, predationRate, carryingCap]);

  // RECORD TRIAL DISPATCHER
  const triggerRecord = () => {
    if (practicalId === 'cells') {
      onRecordTrial({
        inputsSummary: `${osmosisCellType === 'plant' ? 'Plant Cell' : 'Red Blood Cell'} · [Sucrose]=${sucroseMolarity.toFixed(2)} M`,
        primaryReading: `Vol = ${osmosisMetrics.relativeVolPct.toFixed(1)}%`,
        secondaryReading: `Ψ_sol = ${osmosisMetrics.solutionPsiKpa.toFixed(0)} kPa`,
        derivedMetric: osmosisMetrics.stateLabel,
      });
    } else if (practicalId === 'microscopy') {
      onRecordTrial({
        inputsSummary: `${slideSpec.name} · 10× × ${objectiveMag}× (${totalMagnification}×) · Focus=${focusOffset}`,
        primaryReading: `Actual = ${slideSpec.actualUm} μm`,
        secondaryReading: `Image = ${(imageApparentUm / 1000).toFixed(2)} mm`,
        derivedMetric: Math.abs(focusOffset) <= 1 ? 'Sharp Focus' : 'Out of Focus',
      });
    } else if (practicalId === 'genetics') {
      const ratioStr = Object.entries(punnett.phenoCounts)
        .map(([k, v]) => `${k}:${v}`)
        .join(' / ');
      onRecordTrial({
        inputsSummary: `${traitId.replace('_', ' ')} · Cross ${parent1Geno} × ${parent2Geno}`,
        primaryReading: ratioStr,
        secondaryReading: sampledCohort
          ? Object.entries(sampledCohort).map(([k, v]) => `${k}=${v}`).join(', ')
          : 'Theoretical F₁',
        derivedMetric: 'n=4 Punnett Grid',
      });
    } else if (practicalId === 'physiology') {
      onRecordTrial({
        inputsSummary: `${activity.toUpperCase()} · Altitude=${altitudeM} m`,
        primaryReading: `HR = ${physioMetrics.heartRate} bpm`,
        secondaryReading: `CO = ${physioMetrics.cardiacOutputLMin.toFixed(2)} L/min`,
        derivedMetric: `V_E=${physioMetrics.minuteVentLMin.toFixed(1)} L/m · SpO₂ ${physioMetrics.spo2Pct.toFixed(1)}%`,
      });
    } else {
      if (ecologyMode === 'quadrat') {
        onRecordTrial({
          inputsSummary: `Quadrat Sampling (${quadratStats.sampledCount}×1 m² quadrats)`,
          primaryReading: `Mean = ${quadratStats.meanPerQuadrat.toFixed(1)} /m²`,
          secondaryReading: 'Habitat = 1,000 m²',
          derivedMetric: `Est. N = ${Math.round(quadratStats.estimatedSavannahTotal).toLocaleString()}`,
        });
      } else {
        const last = lotkaSeries[lotkaSeries.length - 1];
        onRecordTrial({
          inputsSummary: `Predator-Prey · r=${preyBirthRate.toFixed(2)} · a=${predationRate.toFixed(3)} · K=${carryingCap}`,
          primaryReading: `Prey_end = ${last.prey.toFixed(0)}`,
          secondaryReading: `Pred_end = ${last.pred.toFixed(0)}`,
          derivedMetric: '60-step dynamic balance',
        });
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Telemetry Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Biological Principle</div>
          <div className="mt-1 font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formula}
          </div>
        </div>

        {practicalId === 'cells' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Relative Cell Volume</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {osmosisMetrics.relativeVolPct.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">%</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Water Potential (Ψ_sol)</div>
              <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                <div>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{osmosisMetrics.solutionPsiKpa.toFixed(0)}</span>
                  <span className="text-xs text-slate-400 ml-1">kPa</span>
                </div>
                <span className="text-xs text-slate-500">Ψ_p +{osmosisMetrics.turgorKpa.toFixed(0)}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Cell Status</div>
              <div className="mt-1 font-mono text-xs font-semibold">
                {osmosisMetrics.tone === 'critical' ? (
                  <span className="text-rose-600 dark:text-rose-400">✖ {osmosisMetrics.stateLabel}</span>
                ) : osmosisMetrics.tone === 'warning' ? (
                  <span className="text-amber-600 dark:text-amber-400">▲ {osmosisMetrics.stateLabel}</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">● {osmosisMetrics.stateLabel}</span>
                )}
              </div>
            </div>
          </>
        )}

        {practicalId === 'microscopy' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Magnification</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {totalMagnification}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">× (10× × {objectiveMag}×)</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Actual Cell Diameter</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {slideSpec.actualUm}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">μm</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Optical Resolution</div>
              <div className="mt-1 font-mono text-xs font-semibold">
                {Math.abs(focusOffset) <= 1 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">● IN FOCUS · LIGHT {condenserLight}%</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">▲ OUT OF FOCUS ({focusOffset > 0 ? `+${focusOffset}` : focusOffset})</span>
                )}
              </div>
            </div>
          </>
        )}

        {practicalId === 'genetics' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Parental Cross</div>
              <div className="mt-1 text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {parent1Geno} × {parent2Geno}
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Expected F₁ Ratio</div>
              <div className="mt-1 text-xs font-mono font-semibold text-slate-900 dark:text-white">
                {Object.entries(punnett.phenoCounts).map(([k, v]) => `${k}: ${v}/4 (${v * 25}%)`).join(' · ')}
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Sampled 100-Offspring</div>
              <div className="mt-1 text-xs font-mono text-slate-600 dark:text-slate-300">
                {sampledCohort
                  ? Object.entries(sampledCohort).map(([k, v]) => `${k}: ${v}`).join(' · ')
                  : 'Click "Simulate 100 F₁" below'}
              </div>
            </div>
          </>
        )}

        {practicalId === 'physiology' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Heart Rate · Cardiac Output</div>
              <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                <div>
                  <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{physioMetrics.heartRate}</span>
                  <span className="text-xs text-slate-400 ml-1">bpm</span>
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{physioMetrics.cardiacOutputLMin.toFixed(1)} L/min</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Minute Ventilation (V_E)</div>
              <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                <div>
                  <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">{physioMetrics.minuteVentLMin.toFixed(1)}</span>
                  <span className="text-xs text-slate-400 ml-1">L/min</span>
                </div>
                <span className="text-xs text-slate-500">{physioMetrics.respRate}/min</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Blood O₂ Saturation (SpO₂)</div>
              <div className="mt-1 font-mono text-sm font-bold">
                <span className={physioMetrics.spo2Pct < 90 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                  {physioMetrics.spo2Pct < 90 ? '▲ HYPOXIC' : '● NOMINAL'} {physioMetrics.spo2Pct.toFixed(1)}%
                </span>
              </div>
            </div>
          </>
        )}

        {practicalId === 'ecology' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {ecologyMode === 'quadrat' ? 'Mean Density' : 'Prey Equilibrium'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {ecologyMode === 'quadrat'
                    ? quadratStats.meanPerQuadrat.toFixed(1)
                    : lotkaSeries[lotkaSeries.length - 1].prey.toFixed(0)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {ecologyMode === 'quadrat' ? '/m²' : 'zebras'}
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                {ecologyMode === 'quadrat' ? 'Estimated 1,000 m² Total' : 'Predator Equilibrium'}
              </div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {ecologyMode === 'quadrat'
                    ? Math.round(quadratStats.estimatedSavannahTotal).toLocaleString()
                    : lotkaSeries[lotkaSeries.length - 1].pred.toFixed(0)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">
                  {ecologyMode === 'quadrat' ? 'plants' : 'lions'}
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Sampling Method</div>
              <div className="mt-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {ecologyMode === 'quadrat'
                  ? `● ${quadratStats.sampledCount}/25 QUADRATS THROWN`
                  : `● CARRYING CAP K=${carryingCap}`}
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
              {practicalId === 'microscopy' ? (
                <Microscope className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Dna className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                Instrument Controls
              </h2>
            </div>
            <button
              type="button"
              onClick={triggerRecord}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Record Trial</span>
            </button>
          </div>

          {practicalId === 'cells' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setOsmosisCellType('plant')} className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${osmosisCellType === 'plant' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                  Plant Cell
                </button>
                <button type="button" onClick={() => setOsmosisCellType('rbc')} className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${osmosisCellType === 'rbc' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                  Red Blood Cell
                </button>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="sucrose-m" className="font-medium">Sucrose Concentration</label>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{sucroseMolarity.toFixed(2)} mol/dm³</span>
                </div>
                <input id="sucrose-m" type="range" min={0} max={0.8} step={0.02} value={sucroseMolarity} onChange={(e) => setSucroseMolarity(parseFloat(e.target.value))} className="w-full accent-emerald-600 cursor-pointer" />
              </div>
              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Show Organelle Callouts</span>
                <input type="checkbox" checked={showOrganelleLabels} onChange={(e) => setShowOrganelleLabels(e.target.checked)} className="w-4 h-4 accent-emerald-600 cursor-pointer" />
              </label>
              <button type="button" onClick={() => setSucroseMolarity(0.3)} className="w-full py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Isotonic (0.30 M)
              </button>
            </div>
          )}

          {practicalId === 'microscopy' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium mb-1.5">Prepared Slide Specimen</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(SLIDE_SPECS) as MicroscopeSlide[]).map((s) => (
                    <button key={s} type="button" onClick={() => setSlide(s)} className={`px-2 py-2 rounded-lg text-[11px] font-semibold border capitalize cursor-pointer ${slide === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-xs font-medium mb-1.5">Objective Nosepiece (with 10× Eyepiece)</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {([4, 10, 40, 100] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setObjectiveMag(m)} className={`py-2 rounded-lg text-xs font-mono font-bold border cursor-pointer ${objectiveMag === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                      {m}×
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="micro-focus" className="font-medium">Fine Focus Knob (0 = Sharp)</label>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{focusOffset}</span>
                </div>
                <input id="micro-focus" type="range" min={-8} max={8} step={1} value={focusOffset} onChange={(e) => setFocusOffset(parseInt(e.target.value, 10))} className="w-full accent-emerald-600 cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="micro-light" className="font-medium">Diaphragm Illumination</label>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{condenserLight}%</span>
                </div>
                <input id="micro-light" type="range" min={25} max={100} step={5} value={condenserLight} onChange={(e) => setCondenserLight(parseInt(e.target.value, 10))} className="w-full accent-amber-600 cursor-pointer" />
              </div>
            </div>
          )}

          {practicalId === 'genetics' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium mb-1.5">Inheritance Model</span>
                <div className="space-y-1.5">
                  {(Object.keys(GENETIC_TRAITS) as GeneticTraitId[]).map((tid) => (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => {
                        setTraitId(tid);
                        setParent1Geno(GENETIC_TRAITS[tid].p1Options[1]);
                        setParent2Geno(GENETIC_TRAITS[tid].p2Options[tid === 'sex_linked' ? 0 : 1]);
                        setSampledCohort(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer ${traitId === tid ? 'bg-emerald-600 text-white border-emerald-600 font-semibold' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}
                    >
                      {GENETIC_TRAITS[tid].name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] font-mono text-slate-400 mb-1">Parent 1</span>
                  <div className="flex flex-col gap-1">
                    {traitSpec.p1Options.map((g) => (
                      <button key={g} type="button" onClick={() => { setParent1Geno(g); setSampledCohort(null); }} className={`py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer ${parent1Geno === g ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block text-[11px] font-mono text-slate-400 mb-1">Parent 2</span>
                  <div className="flex flex-col gap-1">
                    {traitSpec.p2Options.map((g) => (
                      <button key={g} type="button" onClick={() => { setParent2Geno(g); setSampledCohort(null); }} className={`py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer ${parent2Geno === g ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" onClick={handleSampleCohort} className="w-full py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" /> Simulate 100 Offspring Sample
              </button>
            </div>
          )}

          {practicalId === 'physiology' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium mb-1.5">Physical Activity State</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['rest', 'jog', 'sprint'] as ActivityLevel[]).map((act) => (
                    <button key={act} type="button" onClick={() => setActivity(act)} className={`py-2 rounded-lg text-xs font-semibold border capitalize cursor-pointer ${activity === act ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                      {act}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <label htmlFor="phys-alt" className="font-medium">Elevation / Altitude</label>
                  <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">{altitudeM} m</span>
                </div>
                <input id="phys-alt" type="range" min={0} max={4500} step={50} value={altitudeM} onChange={(e) => setAltitudeM(parseInt(e.target.value, 10))} className="w-full accent-sky-600 cursor-pointer" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: 'Mombasa (0m)', val: 0 },
                    { label: 'Nairobi (1795m)', val: 1795 },
                    { label: 'Mt. Kenya (4000m)', val: 4000 },
                  ].map((p) => (
                    <button key={p.label} type="button" onClick={() => setAltitudeM(p.val)} className="px-2 py-1 rounded-md text-[11px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {practicalId === 'ecology' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setEcologyMode('quadrat')} className={`px-2 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${ecologyMode === 'quadrat' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                  Quadrat Sampling
                </button>
                <button type="button" onClick={() => setEcologyMode('predator_prey')} className={`px-2 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${ecologyMode === 'predator_prey' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
                  Predator–Prey
                </button>
              </div>
              {ecologyMode === 'quadrat' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Click cells in the 5×5 savanna grid or throw 5 random quadrats to estimate population density.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const picks = new Set<number>();
                      while (picks.size < 5) picks.add(Math.floor(Math.random() * 25));
                      setSampledQuadrats(Array.from(picks));
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Throw 5 Random Quadrats
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="eco-r" className="font-medium">Zebra Birth Rate (r)</label>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{preyBirthRate.toFixed(2)}</span>
                    </div>
                    <input id="eco-r" type="range" min={0.15} max={0.8} step={0.05} value={preyBirthRate} onChange={(e) => setPreyBirthRate(parseFloat(e.target.value))} className="w-full accent-emerald-600 cursor-pointer" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="eco-a" className="font-medium">Lion Predation Rate (a)</label>
                      <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{predationRate.toFixed(3)}</span>
                    </div>
                    <input id="eco-a" type="range" min={0.005} max={0.03} step={0.002} value={predationRate} onChange={(e) => setPredationRate(parseFloat(e.target.value))} className="w-full accent-amber-600 cursor-pointer" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="eco-k" className="font-medium">Grassland Carrying Cap (K)</label>
                      <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">{carryingCap}</span>
                    </div>
                    <input id="eco-k" type="range" min={80} max={280} step={20} value={carryingCap} onChange={(e) => setCarryingCap(parseInt(e.target.value, 10))} className="w-full accent-sky-600 cursor-pointer" />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* RIGHT APPARATUS STAGE */}
        <section className="lg:col-span-8 bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5">
          {practicalId === 'cells' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">Cell Osmosis & Organelle Viewport</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Net water moves from higher water potential to lower water potential across the cell membrane.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-3">
                  <svg viewBox="0 0 280 245" className="w-full h-[245px]">
                    <circle cx="140" cy="122" r="106" fill={osmosisCellType === 'plant' ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)'} stroke="#64748b" strokeWidth="2" />
                    {osmosisCellType === 'plant' ? (
                      <g>
                        <rect x="64" y="64" width="152" height="116" rx="16" fill="none" stroke="#059669" strokeWidth="5.5" />
                        {(() => {
                          const scale = Math.max(0.62, Math.min(1.0, osmosisMetrics.relativeVolPct / 100));
                          const pw = 140 * scale;
                          const ph = 104 * scale;
                          const px = 140 - pw / 2;
                          const py = 122 - ph / 2;
                          return (
                            <>
                              <rect x={px} y={py} width={pw} height={ph} rx={12 * scale} fill="rgba(52,211,153,0.25)" stroke="#10b981" strokeWidth="2" />
                              <rect x={140 - pw * 0.35} y={122 - ph * 0.33} width={pw * 0.7} height={ph * 0.66} rx={10 * scale} fill="rgba(56,189,248,0.45)" stroke="#0284c7" strokeWidth="1.5" />
                              <circle cx={px + pw - 14} cy={py + 16} r="6.5" fill="#6366f1" />
                              {showOrganelleLabels && (
                                <g className="fill-slate-600 dark:fill-slate-300 text-[9px] font-mono">
                                  <text x="140" y="56" textAnchor="middle">Cell Wall (Cellulose)</text>
                                  <text x="140" y="125" textAnchor="middle" className="font-bold">Sap Vacuole</text>
                                </g>
                              )}
                            </>
                          );
                        })()}
                      </g>
                    ) : osmosisMetrics.tone === 'critical' ? (
                      <path d="M 92 86 Q 116 66 142 78 M 172 88 Q 198 114 184 152 M 162 172 Q 124 184 98 158 M 84 136 Q 76 112 92 86" fill="none" stroke="#e11d48" strokeWidth="4" strokeDasharray="8 6" />
                    ) : (
                      <circle cx="140" cy="122" r={54 * Math.max(0.6, Math.min(1.22, osmosisMetrics.relativeVolPct / 100))} fill="rgba(225,29,72,0.72)" stroke="#be123c" strokeWidth="2.5" strokeDasharray={sucroseMolarity > 0.34 ? '7 4' : undefined} />
                    )}
                  </svg>
                </div>
                <div className="md:col-span-6 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#121212] p-3 flex flex-col justify-between">
                  <div className="text-[11px] font-mono text-slate-500">VOLUME (%) vs SUCROSE MOLARITY</div>
                  <svg viewBox="0 0 320 205" className="w-full h-[210px]">
                    <line x1="42" y1="16" x2="42" y2="174" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <line x1="42" y1="174" x2="300" y2="174" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <path
                      d={Array.from({ length: 41 }, (_, i) => {
                        const m = (i / 40) * 0.8;
                        const vol = Math.min(148, Math.max(55, computeOsmosisMetrics(osmosisCellType, m).relativeVolPct));
                        return `${i === 0 ? 'M' : 'L'} ${(42 + (m / 0.8) * 252).toFixed(1)} ${(174 - ((vol - 50) / 100) * 146).toFixed(1)}`;
                      }).join(' ')}
                      fill="none"
                      stroke={osmosisCellType === 'plant' ? '#10b981' : '#e11d48'}
                      strokeWidth="2.4"
                    />
                    <circle
                      cx={42 + (sucroseMolarity / 0.8) * 252}
                      cy={174 - ((Math.min(148, Math.max(55, osmosisMetrics.relativeVolPct)) - 50) / 100) * 146}
                      r="5.5"
                      fill="#0ea5e9"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text x="170" y="196" textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">Sucrose (0.00 → 0.80 M)</text>
                  </svg>
                  <div className="text-[11px] font-mono text-slate-500">Isotonic point: 0.30 mol/dm³</div>
                </div>
              </div>
            </div>
          )}

          {practicalId === 'microscopy' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">{slideSpec.name} · Optical Viewport ({totalMagnification}×)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Stain: {slideSpec.stain} · Visible: {slideSpec.structures}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-950 p-4 flex flex-col items-center">
                <div
                  className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-slate-700 flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: `rgba(241, 245, 249, ${condenserLight / 100})`,
                    filter: `blur(${focusBlurPx.toFixed(1)}px)`,
                  }}
                >
                  <svg viewBox="0 0 200 200" className="w-full h-full" style={{ transform: `scale(${Math.min(2.2, 0.55 + Math.log10(totalMagnification) * 0.45).toFixed(2)})` }}>
                    {slide === 'onion' && (
                      <g stroke="#92400e" strokeWidth="2.2" fill="rgba(253,224,71,0.35)">
                        <rect x="20" y="30" width="80" height="45" />
                        <rect x="100" y="30" width="80" height="45" />
                        <rect x="20" y="75" width="80" height="45" />
                        <rect x="100" y="75" width="80" height="45" />
                        <rect x="20" y="120" width="80" height="45" />
                        <rect x="100" y="120" width="80" height="45" />
                        <circle cx="52" cy="52" r="5" fill="#78350f" />
                        <circle cx="145" cy="95" r="5" fill="#78350f" />
                        <circle cx="70" cy="142" r="5" fill="#78350f" />
                      </g>
                    )}
                    {slide === 'stomata' && (
                      <g>
                        <ellipse cx="100" cy="100" rx="28" ry="18" fill="rgba(34,197,94,0.45)" stroke="#15803d" strokeWidth="3" />
                        <ellipse cx="100" cy="100" rx="8" ry="13" fill="#0f172a" />
                        <circle cx="84" cy="95" r="2.5" fill="#166534" />
                        <circle cx="116" cy="105" r="2.5" fill="#166534" />
                      </g>
                    )}
                    {slide === 'cheek' && (
                      <g>
                        <path d="M 55 85 Q 85 55 130 75 Q 155 110 120 140 Q 75 150 55 115 Z" fill="rgba(59,130,246,0.28)" stroke="#2563eb" strokeWidth="2" />
                        <circle cx="98" cy="105" r="10" fill="#1d4ed8" />
                      </g>
                    )}
                    {slide === 'paramecium' && (
                      <g>
                        <ellipse cx="100" cy="100" rx="52" ry="22" fill="rgba(20,184,166,0.35)" stroke="#0f766e" strokeWidth="2.5" />
                        <circle cx="82" cy="100" r="8" fill="#0f766e" />
                        <circle cx="122" cy="98" r="6" fill="none" stroke="#0f766e" strokeWidth="1.5" />
                      </g>
                    )}
                  </svg>
                  {/* Eyepiece Graticule Ruler Overlay */}
                  <div className="absolute inset-x-6 top-1/2 h-px bg-slate-900/60 pointer-events-none" />
                </div>
                <div className="mt-3 text-xs font-mono text-slate-300 tabular-nums">
                  Eyepiece Apparent Size: {(imageApparentUm / 1000).toFixed(2)} mm · Actual Specimen: {slideSpec.actualUm} μm
                </div>
              </div>
            </div>
          )}

          {practicalId === 'genetics' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">2×2 Punnett Square Inheritance Grid</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{traitSpec.name}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 max-w-md mx-auto text-center">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 font-mono text-xs text-slate-500 flex items-center justify-center">
                  P₁ \ P₂
                </div>
                {punnett.g2.map((gam, idx) => (
                  <div key={`g2-${idx}`} className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    {gam}
                  </div>
                ))}
                {punnett.g1.map((gam1, rIdx) => (
                  <React.Fragment key={`r-${rIdx}`}>
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                      {gam1}
                    </div>
                    {[0, 1].map((cIdx) => {
                      const cell = punnett.cells.find((c) => c.row === rIdx && c.col === cIdx)!;
                      return (
                        <div
                          key={`cell-${rIdx}-${cIdx}`}
                          className={`p-3 rounded-xl border ${
                            cell.isDom
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
                              : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                          }`}
                        >
                          <div className="font-mono text-base font-bold text-slate-900 dark:text-white">{cell.geno}</div>
                          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">{cell.pheno}</div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {practicalId === 'physiology' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">Simulated ECG & Spirometer Trace</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Stroke Volume: {physioMetrics.strokeVolMl} mL · Tidal Volume: {physioMetrics.tidalVolL.toFixed(2)} L</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-950 p-3">
                  <div className="text-[10px] font-mono text-rose-400 mb-1">ECG LEAD II ({physioMetrics.heartRate} BPM)</div>
                  <svg viewBox="0 0 460 90" className="w-full h-[85px]">
                    <path
                      d={Array.from({ length: Math.max(2, Math.round(physioMetrics.heartRate / 28)) }, (_, b) => {
                        const x0 = b * (440 / Math.max(2, Math.round(physioMetrics.heartRate / 28)));
                        return `M ${x0} 55 L ${x0 + 18} 55 L ${x0 + 23} 48 L ${x0 + 28} 55 L ${x0 + 34} 62 L ${x0 + 39} 16 L ${x0 + 44} 70 L ${x0 + 50} 55 L ${x0 + 64} 44 L ${x0 + 76} 55`;
                      }).join(' ')}
                      fill="none"
                      stroke="#fb7185"
                      strokeWidth="2.2"
                    />
                  </svg>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-950 p-3">
                  <div className="text-[10px] font-mono text-sky-400 mb-1">SPIROMETER TIDAL TRACE (V_T = {physioMetrics.tidalVolL.toFixed(2)} L · {physioMetrics.respRate} breaths/min)</div>
                  <svg viewBox="0 0 460 95" className="w-full h-[90px]">
                    <path
                      d={Array.from({ length: 100 }, (_, i) => {
                        const x = 10 + (i / 99) * 440;
                        const cycles = physioMetrics.respRate / 7;
                        const y = 50 - physioMetrics.tidalVolL * 15 * Math.sin((i / 99) * Math.PI * 2 * cycles);
                        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.4"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {practicalId === 'ecology' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  {ecologyMode === 'quadrat' ? '5×5 Grassland Quadrat Plot (1 m² per cell)' : 'Savannah Predator–Prey Population Oscillations'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ecologyMode === 'quadrat'
                    ? 'Click grid cells to toggle sampled quadrats and compute estimated population across a 1,000 m² habitat.'
                    : 'Emerald curve: Zebra prey · Amber curve: Lion predators.'}
                </p>
              </div>
              {ecologyMode === 'quadrat' ? (
                <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
                  {INITIAL_QUADRATS.map((count, idx) => {
                    const isSampled = sampledQuadrats.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setSampledQuadrats((prev) =>
                            prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
                          )
                        }
                        className={`h-14 rounded-xl border font-mono text-xs font-bold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                          isSampled
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-50 dark:bg-[#121212] border-slate-200 dark:border-white/10 text-slate-500 hover:border-emerald-400'
                        }`}
                      >
                        <span>{isSampled ? count : '?'}</span>
                        <span className="text-[9px] opacity-75">Q{idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#121212] p-3">
                  <svg viewBox="0 0 360 215" className="w-full h-[225px]">
                    <line x1="36" y1="16" x2="36" y2="184" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <line x1="36" y1="184" x2="342" y2="184" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <path
                      d={lotkaSeries.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${(36 + (pt.step / 60) * 300).toFixed(1)} ${(184 - (pt.prey / carryingCap) * 155).toFixed(1)}`).join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.4"
                    />
                    <path
                      d={lotkaSeries.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${(36 + (pt.step / 60) * 300).toFixed(1)} ${(184 - (pt.pred / carryingCap) * 155).toFixed(1)}`).join(' ')}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.2"
                      strokeDasharray="4 3"
                    />
                    <text x="190" y="204" textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">Time Generations (0 → 60)</text>
                  </svg>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
