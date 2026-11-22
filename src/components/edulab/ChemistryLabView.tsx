import React, { useState, useEffect, useMemo } from 'react';
import {
  FlaskConical,
  Play,
  Pause,
  RotateCcw,
  Droplets,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Wind,
  TestTube,
} from 'lucide-react';
import { ChemistryPracticalId, TrialPayload } from './edulabTypes';

interface ChemistryLabViewProps {
  practicalId: ChemistryPracticalId;
  formula: string;
  onRecordTrial: (payload: TrialPayload) => void;
}

// =========================================================================
// CHEMISTRY SOLVERS & DATA
// =========================================================================
type AnalyteAcid = 'hcl' | 'ethanoic';
type IndicatorType = 'phenolphthalein' | 'methyl_orange' | 'universal';
type SurfaceForm = 'lump' | 'chips' | 'powder';
type GasType = 'oxygen' | 'carbon_dioxide' | 'hydrogen' | 'chlorine';
type CollectionMethod = 'water' | 'upward' | 'downward';
type ElectrolyteType = 'dilute_h2so4' | 'brine_nacl' | 'cuso4_aq';
type ElectrodeMaterial = 'graphite' | 'copper';
type CationId = 'Cu2+' | 'Fe2+' | 'Fe3+' | 'Zn2+' | 'Ca2+' | 'NH4+';
type QualReagent = 'none' | 'naoh_drop' | 'naoh_excess' | 'nh3_drop' | 'nh3_excess' | 'flame';

function computeTitrationPh(
  acidType: AnalyteAcid,
  acidVolumeCm3: number,
  acidConc: number,
  baseVolumeCm3: number,
  baseConc: number
): number {
  const va = acidVolumeCm3 / 1000;
  const vb = baseVolumeCm3 / 1000;
  const vTotal = va + vb;
  if (vTotal <= 0) return 7;
  const na = acidConc * va;
  const nb = baseConc * vb;
  const kw = 1e-14;

  if (acidType === 'hcl') {
    const excess = na - nb;
    if (Math.abs(excess) < 1e-12) return 7.0;
    if (excess > 0) {
      const ca = excess / vTotal;
      const h = 0.5 * (ca + Math.sqrt(ca * ca + 4 * kw));
      return Math.max(0, Math.min(14, -Math.log10(h)));
    }
    const cb = -excess / vTotal;
    const oh = 0.5 * (cb + Math.sqrt(cb * cb + 4 * kw));
    return Math.max(0, Math.min(14, 14 + Math.log10(oh)));
  }

  const ka = 1.75e-5;
  const caTotal = na / vTotal;
  const cbNa = nb / vTotal;
  let low = 0;
  let high = 14;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (low + high);
    const h = Math.pow(10, -mid);
    const f = h + cbNa - kw / h - (caTotal * ka) / (h + ka);
    if (f > 0) low = mid;
    else high = mid;
  }
  return Math.max(0, Math.min(14, 0.5 * (low + high)));
}

function getIndicatorAppearance(indicator: IndicatorType, ph: number) {
  if (indicator === 'phenolphthalein') {
    if (ph < 8.2) return { fill: 'rgba(226, 232, 240, 0.35)', label: 'Colorless (Acidic/Neutral)', isEndpoint: false };
    if (ph <= 10.0) {
      const t = (ph - 8.2) / 1.8;
      return {
        fill: `rgba(236, 72, 153, ${(0.22 + t * 0.55).toFixed(2)})`,
        label: 'Pale Pink Transition',
        isEndpoint: ph >= 8.2 && ph <= 9.6,
      };
    }
    return { fill: 'rgba(219, 39, 119, 0.78)', label: 'Deep Magenta (Alkaline)', isEndpoint: false };
  }
  if (indicator === 'methyl_orange') {
    if (ph < 3.1) return { fill: 'rgba(239, 68, 68, 0.65)', label: 'Red (Acidic)', isEndpoint: false };
    if (ph <= 4.4) return { fill: 'rgba(249, 115, 22, 0.72)', label: 'Orange Transition', isEndpoint: true };
    return { fill: 'rgba(250, 204, 21, 0.72)', label: 'Yellow (Alkaline)', isEndpoint: false };
  }
  if (ph < 3) return { fill: 'rgba(239, 68, 68, 0.72)', label: 'Strong Acid (Red)', isEndpoint: false };
  if (ph < 5.5) return { fill: 'rgba(249, 115, 22, 0.70)', label: 'Weak Acid (Orange)', isEndpoint: false };
  if (ph < 6.6) return { fill: 'rgba(234, 179, 8, 0.68)', label: 'Mild Acid (Yellow)', isEndpoint: false };
  if (ph <= 7.6) return { fill: 'rgba(16, 185, 129, 0.72)', label: 'Neutral (Green)', isEndpoint: true };
  if (ph < 9.5) return { fill: 'rgba(20, 184, 166, 0.72)', label: 'Weak Alkali (Teal)', isEndpoint: false };
  if (ph < 11.5) return { fill: 'rgba(59, 130, 246, 0.72)', label: 'Alkaline (Blue)', isEndpoint: false };
  return { fill: 'rgba(124, 58, 237, 0.76)', label: 'Strong Alkali (Violet)', isEndpoint: false };
}

const GAS_SPECS: Record<
  GasType,
  {
    name: string;
    formula: string;
    reagents: string;
    equation: string;
    molarMass: number;
    solubility: string;
    recommendedCollection: CollectionMethod;
    collectionReason: string;
    testName: string;
    testObservation: string;
    tint: string;
  }
> = {
  oxygen: {
    name: 'Oxygen',
    formula: 'O₂',
    reagents: 'H₂O₂(aq) + MnO₂(s) catalyst',
    equation: '2H₂O₂(aq) —MnO₂→ 2H₂O(l) + O₂(g)',
    molarMass: 32,
    solubility: 'Slightly soluble',
    recommendedCollection: 'water',
    collectionReason: 'Only slightly soluble in water — cleanly collected over water.',
    testName: 'Glowing wooden splint',
    testObservation: 'Relights a glowing wooden splint with a bright flame.',
    tint: 'rgba(56, 189, 248, 0.22)',
  },
  carbon_dioxide: {
    name: 'Carbon(IV) Oxide',
    formula: 'CO₂',
    reagents: 'CaCO₃(s) marble chips + dilute HCl(aq)',
    equation: 'CaCO₃(s) + 2HCl(aq) → CaCl₂(aq) + H₂O(l) + CO₂(g)',
    molarMass: 44,
    solubility: 'Moderately soluble (acidic)',
    recommendedCollection: 'downward',
    collectionReason: 'Denser than air (Mr = 44 > 29) — collected by downward delivery (upward displacement of air).',
    testName: 'Bubble through limewater Ca(OH)₂',
    testObservation: 'Turns clear limewater milky due to white CaCO₃(s) precipitate.',
    tint: 'rgba(148, 163, 184, 0.28)',
  },
  hydrogen: {
    name: 'Hydrogen',
    formula: 'H₂',
    reagents: 'Zn(s) granules + dilute H₂SO₄(aq)',
    equation: 'Zn(s) + H₂SO₄(aq) → ZnSO₄(aq) + H₂(g)',
    molarMass: 2,
    solubility: 'Insoluble',
    recommendedCollection: 'upward',
    collectionReason: 'Least dense gas (Mr = 2 < 29) — collected by upward delivery or over water.',
    testName: 'Burning wooden splint',
    testObservation: 'Extinguishes burning splint with a sharp "pop" sound.',
    tint: 'rgba(167, 243, 208, 0.24)',
  },
  chlorine: {
    name: 'Chlorine',
    formula: 'Cl₂',
    reagents: 'MnO₂(s) + concentrated HCl(aq) (warm)',
    equation: 'MnO₂(s) + 4HCl(aq) → MnCl₂(aq) + 2H₂O(l) + Cl₂(g)',
    molarMass: 71,
    solubility: 'Soluble in cold water',
    recommendedCollection: 'downward',
    collectionReason: 'Much denser than air (Mr = 71) and soluble in water — must use downward delivery in a fume hood.',
    testName: 'Moist blue litmus paper',
    testObservation: 'Turns moist blue litmus paper red, then bleaches it white.',
    tint: 'rgba(190, 242, 100, 0.35)',
  },
};

const CATION_DATA: Record<
  CationId,
  {
    name: string;
    solutionTint: string;
    naohDrop: { color: string; desc: string };
    naohExcess: { color: string; soluble: boolean; desc: string };
    nh3Drop: { color: string; desc: string };
    nh3Excess: { color: string; soluble: boolean; desc: string };
    flame: { color: string; desc: string };
  }
> = {
  'Cu2+': {
    name: 'Copper(II) ion · Cu²⁺',
    solutionTint: 'rgba(14, 165, 233, 0.35)',
    naohDrop: { color: '#0284c7', desc: 'Pale blue gelatinous Cu(OH)₂ precipitate forms.' },
    naohExcess: { color: '#0284c7', soluble: false, desc: 'Pale blue precipitate remains insoluble in excess NaOH.' },
    nh3Drop: { color: '#0284c7', desc: 'Pale blue Cu(OH)₂ precipitate forms.' },
    nh3Excess: { color: '#1e3a8a', soluble: true, desc: 'Precipitate dissolves to form a deep royal-blue [Cu(NH₃)₄]²⁺ solution.' },
    flame: { color: '#10b981', desc: 'Blue-green flame color confirms Cu²⁺.' },
  },
  'Fe2+': {
    name: 'Iron(II) ion · Fe²⁺',
    solutionTint: 'rgba(134, 239, 172, 0.32)',
    naohDrop: { color: '#15803d', desc: 'Dirty green Fe(OH)₂ precipitate forms.' },
    naohExcess: { color: '#166534', soluble: false, desc: 'Dirty green precipitate insoluble in excess; darkens on standing.' },
    nh3Drop: { color: '#15803d', desc: 'Dirty green Fe(OH)₂ precipitate forms.' },
    nh3Excess: { color: '#166534', soluble: false, desc: 'Insoluble in excess NH₃(aq).' },
    flame: { color: '#f59e0b', desc: 'No characteristic intense flame color (faint gold sparks).' },
  },
  'Fe3+': {
    name: 'Iron(III) ion · Fe³⁺',
    solutionTint: 'rgba(251, 191, 36, 0.35)',
    naohDrop: { color: '#9a3412', desc: 'Reddish-brown gelatinous Fe(OH)₃ precipitate forms.' },
    naohExcess: { color: '#7c2d12', soluble: false, desc: 'Reddish-brown precipitate insoluble in excess NaOH.' },
    nh3Drop: { color: '#9a3412', desc: 'Reddish-brown Fe(OH)₃ precipitate forms.' },
    nh3Excess: { color: '#7c2d12', soluble: false, desc: 'Reddish-brown precipitate remains insoluble in excess NH₃.' },
    flame: { color: '#fbbf24', desc: 'Faint golden glow; wet tests with OH⁻/NH₃ are definitive.' },
  },
  'Zn2+': {
    name: 'Zinc ion · Zn²⁺',
    solutionTint: 'rgba(226, 232, 240, 0.25)',
    naohDrop: { color: '#f8fafc', desc: 'White gelatinous Zn(OH)₂ precipitate forms.' },
    naohExcess: { color: 'rgba(226,232,240,0.2)', soluble: true, desc: 'White precipitate dissolves in excess NaOH → colorless [Zn(OH)₄]²⁻.' },
    nh3Drop: { color: '#f8fafc', desc: 'White gelatinous Zn(OH)₂ precipitate forms.' },
    nh3Excess: { color: 'rgba(226,232,240,0.2)', soluble: true, desc: 'Dissolves in excess NH₃(aq) → colorless [Zn(NH₃)₄]²⁺ complex.' },
    flame: { color: '#38bdf8', desc: 'No persistent brick-red or green flame color.' },
  },
  'Ca2+': {
    name: 'Calcium ion · Ca²⁺',
    solutionTint: 'rgba(226, 232, 240, 0.25)',
    naohDrop: { color: '#f1f5f9', desc: 'White Ca(OH)₂ precipitate forms (from concentrated solution).' },
    naohExcess: { color: '#e2e8f0', soluble: false, desc: 'White precipitate remains insoluble in excess NaOH.' },
    nh3Drop: { color: 'rgba(226,232,240,0.22)', desc: 'No visible precipitate formed (too weakly alkaline).' },
    nh3Excess: { color: 'rgba(226,232,240,0.22)', soluble: true, desc: 'Remains a clear colorless solution with excess NH₃.' },
    flame: { color: '#ea580c', desc: 'Brick-red flame confirms Ca²⁺ ions.' },
  },
  'NH4+': {
    name: 'Ammonium ion · NH₄⁺',
    solutionTint: 'rgba(226, 232, 240, 0.25)',
    naohDrop: { color: 'rgba(226,232,240,0.22)', desc: 'No precipitate. Warm gently: pungent NH₃ gas turns moist red litmus blue.' },
    naohExcess: { color: 'rgba(226,232,240,0.22)', soluble: true, desc: 'Clear solution; effervescence of alkaline NH₃ gas on warming.' },
    nh3Drop: { color: 'rgba(226,232,240,0.22)', desc: 'No reaction with aqueous ammonia.' },
    nh3Excess: { color: 'rgba(226,232,240,0.22)', soluble: true, desc: 'No precipitate formed.' },
    flame: { color: '#a855f7', desc: 'Volatile salt — decomposes without metal flame color.' },
  },
};

export function ChemistryLabView({ practicalId, formula, onRecordTrial }: ChemistryLabViewProps) {
  // 1. CHEMICAL REACTIONS STATE
  const [acidConcRxn, setAcidConcRxn] = useState<number>(1.0); // mol/dm3
  const [tempRxnC, setTempRxnC] = useState<number>(25); // C
  const [surfaceForm, setSurfaceForm] = useState<SurfaceForm>('chips');
  const [rxnRunning, setRxnRunning] = useState<boolean>(true);
  const [rxnTimeSec, setRxnTimeSec] = useState<number>(0);
  const [gasCollectedCm3, setGasCollectedCm3] = useState<number>(0);

  const surfaceFactor = surfaceForm === 'powder' ? 2.6 : surfaceForm === 'chips' ? 1.3 : 0.65;
  const maxGasCm3 = 60.0;
  // Q10 ~ 2 per 10C
  const kRate = 0.45 * acidConcRxn * surfaceFactor * Math.pow(2, (tempRxnC - 25) / 10);
  const instantaneousRate = Math.max(0, kRate * (1 - gasCollectedCm3 / maxGasCm3) * 3.0);

  useEffect(() => {
    if (practicalId !== 'reactions' || !rxnRunning) return;
    const t = setInterval(() => {
      setRxnTimeSec((prev) => Number((prev + 0.2).toFixed(1)));
      setGasCollectedCm3((prev) => {
        if (prev >= maxGasCm3) return maxGasCm3;
        const next = prev + kRate * (1 - prev / maxGasCm3) * 3.0 * 0.2;
        return Math.min(maxGasCm3, Number(next.toFixed(2)));
      });
    }, 200);
    return () => clearInterval(t);
  }, [practicalId, rxnRunning, kRate]);

  // 2. TITRATIONS STATE
  const [analyteAcid, setAnalyteAcid] = useState<AnalyteAcid>('hcl');
  const [indicator, setIndicator] = useState<IndicatorType>('phenolphthalein');
  const [baseConc, setBaseConc] = useState<number>(0.10);
  const [baseAddedCm3, setBaseAddedCm3] = useState<number>(0.0);
  const [autoTitrating, setAutoTitrating] = useState<boolean>(false);

  const equivalenceVolumeCm3 = useMemo(() => (0.1 * 25.0) / baseConc, [baseConc]);
  const currentPh = useMemo(
    () => computeTitrationPh(analyteAcid, 25.0, 0.1, baseAddedCm3, baseConc),
    [analyteAcid, baseAddedCm3, baseConc]
  );
  const indicatorLook = useMemo(
    () => getIndicatorAppearance(indicator, currentPh),
    [indicator, currentPh]
  );

  useEffect(() => {
    if (!autoTitrating || practicalId !== 'titration') return;
    const interval = setInterval(() => {
      setBaseAddedCm3((prev) => {
        if (prev >= 50) {
          setAutoTitrating(false);
          return 50;
        }
        const dist = Math.abs(prev - equivalenceVolumeCm3);
        const step = dist < 2.2 ? 0.1 : 0.4;
        return Math.min(50, Number((prev + step).toFixed(2)));
      });
    }, 110);
    return () => clearInterval(interval);
  }, [autoTitrating, practicalId, equivalenceVolumeCm3]);

  const titrationCurvePoints = useMemo(() => {
    const pts: { v: number; ph: number }[] = [];
    for (let v = 0; v <= 50; v += 0.5) {
      pts.push({ v, ph: computeTitrationPh(analyteAcid, 25.0, 0.1, v, baseConc) });
    }
    return pts;
  }, [analyteAcid, baseConc]);

  // 3. GAS PREPARATION STATE
  const [selectedGas, setSelectedGas] = useState<GasType>('oxygen');
  const [collectionMethod, setCollectionMethod] = useState<CollectionMethod>('water');
  const [confirmatoryTestRan, setConfirmatoryTestRan] = useState<boolean>(false);

  const gasSpec = GAS_SPECS[selectedGas];
  const isCollectionValid =
    collectionMethod === gasSpec.recommendedCollection ||
    (selectedGas === 'hydrogen' && collectionMethod === 'water');

  // 4. ELECTROLYSIS STATE
  const [electrolyte, setElectrolyte] = useState<ElectrolyteType>('cuso4_aq');
  const [electrodeMat, setElectrodeMat] = useState<ElectrodeMaterial>('graphite');
  const [electroCurrentA, setElectroCurrentA] = useState<number>(2.0);
  const [electroDurationMin, setElectroDurationMin] = useState<number>(10);

  const faradayC = 96485;
  const totalChargeC = electroCurrentA * electroDurationMin * 60;
  const electroMetrics = useMemo(() => {
    const molesElectrons = totalChargeC / faradayC;
    if (electrolyte === 'cuso4_aq') {
      const cuMassG = (molesElectrons / 2) * 63.55;
      const o2VolCm3 = electrodeMat === 'graphite' ? (molesElectrons / 4) * 24000 : 0;
      return {
        cathodeProduct: `Copper deposit: ${cuMassG.toFixed(3)} g`,
        anodeProduct:
          electrodeMat === 'copper'
            ? `Copper anode dissolves: −${cuMassG.toFixed(3)} g`
            : `O₂(g) evolved: ${o2VolCm3.toFixed(0)} cm³`,
        cathodeEq: 'Cu²⁺(aq) + 2e⁻ → Cu(s)',
        anodeEq:
          electrodeMat === 'copper'
            ? 'Cu(s) → Cu²⁺(aq) + 2e⁻'
            : '4OH⁻(aq) → 2H₂O(l) + O₂(g) + 4e⁻',
        primaryVal: cuMassG.toFixed(3),
        primaryUnit: 'g Cu',
      };
    }
    if (electrolyte === 'brine_nacl') {
      const h2VolCm3 = (molesElectrons / 2) * 24000;
      const cl2VolCm3 = (molesElectrons / 2) * 24000;
      return {
        cathodeProduct: `H₂(g) evolved: ${h2VolCm3.toFixed(0)} cm³`,
        anodeProduct: `Cl₂(g) evolved: ${cl2VolCm3.toFixed(0)} cm³`,
        cathodeEq: '2H⁺(aq) + 2e⁻ → H₂(g)',
        anodeEq: '2Cl⁻(aq) → Cl₂(g) + 2e⁻',
        primaryVal: h2VolCm3.toFixed(0),
        primaryUnit: 'cm³ H₂',
      };
    }
    const h2VolCm3 = (molesElectrons / 2) * 24000;
    const o2VolCm3 = (molesElectrons / 4) * 24000;
    return {
      cathodeProduct: `H₂(g) evolved: ${h2VolCm3.toFixed(0)} cm³`,
      anodeProduct: `O₂(g) evolved: ${o2VolCm3.toFixed(0)} cm³ (2:1 ratio)`,
      cathodeEq: '4H⁺(aq) + 4e⁻ → 2H₂(g)',
      anodeEq: '4OH⁻(aq) → 2H₂O(l) + O₂(g) + 4e⁻',
      primaryVal: h2VolCm3.toFixed(0),
      primaryUnit: 'cm³ H₂',
    };
  }, [electrolyte, electrodeMat, totalChargeC]);

  // 5. QUALITATIVE ANALYSIS STATE
  const [selectedCation, setSelectedCation] = useState<CationId>('Cu2+');
  const [qualReagent, setQualReagent] = useState<QualReagent>('none');
  const cationInfo = CATION_DATA[selectedCation];

  const currentQualObservation = useMemo(() => {
    if (qualReagent === 'none') {
      return { color: cationInfo.solutionTint, text: `Aqueous sample containing ${cationInfo.name}. Select a reagent test.` };
    }
    if (qualReagent === 'naoh_drop') return { color: cationInfo.naohDrop.color, text: cationInfo.naohDrop.desc };
    if (qualReagent === 'naoh_excess') return { color: cationInfo.naohExcess.color, text: cationInfo.naohExcess.desc };
    if (qualReagent === 'nh3_drop') return { color: cationInfo.nh3Drop.color, text: cationInfo.nh3Drop.desc };
    if (qualReagent === 'nh3_excess') return { color: cationInfo.nh3Excess.color, text: cationInfo.nh3Excess.desc };
    return { color: cationInfo.flame.color, text: cationInfo.flame.desc };
  }, [cationInfo, qualReagent]);

  // TRIAL SNAPSHOT DISPATCHER
  const triggerRecord = () => {
    if (practicalId === 'reactions') {
      onRecordTrial({
        inputsSummary: `[HCl]=${acidConcRxn.toFixed(1)} M · T=${tempRxnC}°C · Surface=${surfaceForm}`,
        primaryReading: `Rate = ${instantaneousRate.toFixed(2)} cm³/s`,
        secondaryReading: `Vol = ${gasCollectedCm3.toFixed(1)} cm³`,
        derivedMetric: `t = ${rxnTimeSec.toFixed(1)} s`,
      });
    } else if (practicalId === 'titration') {
      onRecordTrial({
        inputsSummary: `${analyteAcid === 'hcl' ? '0.10M HCl' : '0.10M CH₃COOH'} (25 cm³) + ${baseConc.toFixed(2)}M NaOH`,
        primaryReading: `V_b = ${baseAddedCm3.toFixed(2)} cm³`,
        secondaryReading: `pH = ${currentPh.toFixed(2)}`,
        derivedMetric: `V_eq = ${equivalenceVolumeCm3.toFixed(2)} cm³`,
      });
    } else if (practicalId === 'gas-prep') {
      onRecordTrial({
        inputsSummary: `${gasSpec.name} (${gasSpec.formula}) · Method: ${collectionMethod}`,
        primaryReading: isCollectionValid ? 'Collection VALID' : 'Method MISMATCH',
        secondaryReading: `Mr = ${gasSpec.molarMass}`,
        derivedMetric: confirmatoryTestRan ? gasSpec.testName : 'Pending test',
      });
    } else if (practicalId === 'electrolysis') {
      onRecordTrial({
        inputsSummary: `${electrolyte.toUpperCase()} (${electrodeMat}) · I=${electroCurrentA.toFixed(1)} A · ${electroDurationMin} min`,
        primaryReading: `${electroMetrics.primaryVal} ${electroMetrics.primaryUnit}`,
        secondaryReading: `Q = ${totalChargeC.toFixed(0)} C`,
        derivedMetric: electroMetrics.anodeProduct,
      });
    } else {
      onRecordTrial({
        inputsSummary: `Sample ${selectedCation} · Test: ${qualReagent}`,
        primaryReading: selectedCation,
        secondaryReading: qualReagent.replace('_', ' ').toUpperCase(),
        derivedMetric: currentQualObservation.text.slice(0, 48),
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Telemetry Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Governing Equation</div>
          <div className="mt-1 font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formula}
          </div>
        </div>

        {practicalId === 'reactions' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Gas Evolution Rate</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  {instantaneousRate.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">cm³/s</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">CO₂ Syringe Volume</div>
              <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                <div>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{gasCollectedCm3.toFixed(1)}</span>
                  <span className="text-xs text-slate-400 ml-1">/ {maxGasCm3} cm³</span>
                </div>
                <span className="text-xs text-slate-500">{rxnTimeSec.toFixed(1)} s</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Kinetic Status</div>
              <div className="mt-1 font-mono text-xs font-semibold">
                {gasCollectedCm3 >= maxGasCm3 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">◆ REACTION COMPLETE</span>
                ) : rxnRunning ? (
                  <span className="text-sky-600 dark:text-sky-400">● EFFERVESCING ({surfaceForm.toUpperCase()})</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">■ PAUSED</span>
                )}
              </div>
            </div>
          </>
        )}

        {practicalId === 'titration' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Flask pH Meter</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  {currentPh.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">pH</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Titre Volume Added</div>
              <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
                <div>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{baseAddedCm3.toFixed(2)}</span>
                  <span className="text-xs text-slate-400 ml-1">cm³</span>
                </div>
                <span className="text-[11px] text-slate-500">V_eq: {equivalenceVolumeCm3.toFixed(1)} cm³</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Indicator State</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                {Math.abs(baseAddedCm3 - equivalenceVolumeCm3) <= 0.35 || indicatorLook.isEndpoint ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>◆ END-POINT REACHED</span>
                  </span>
                ) : baseAddedCm3 > equivalenceVolumeCm3 + 0.35 ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>▲ EXCESS ALKALI</span>
                  </span>
                ) : (
                  <span className="text-sky-600 dark:text-sky-400">● {indicatorLook.label}</span>
                )}
              </div>
            </div>
          </>
        )}

        {practicalId === 'gas-prep' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Target Gas</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400">{gasSpec.formula}</span>
                <span className="text-xs font-mono text-slate-500">Mr = {gasSpec.molarMass}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Solubility Profile</div>
              <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">{gasSpec.solubility}</div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Collection Setup</div>
              <div className="mt-1 font-mono text-xs font-semibold">
                {isCollectionValid ? (
                  <span className="text-emerald-600 dark:text-emerald-400">● SUITABLE APPARATUS</span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400">✖ UNSUITABLE DELIVERY</span>
                )}
              </div>
            </div>
          </>
        )}

        {practicalId === 'electrolysis' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Charge (Q = I·t)</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  {totalChargeC.toFixed(0)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">C</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Cathode Yield (−)</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {electroMetrics.primaryVal}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">{electroMetrics.primaryUnit}</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Anode Reaction (+)</div>
              <div className="mt-1 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">
                {electroMetrics.anodeProduct}
              </div>
            </div>
          </>
        )}

        {practicalId === 'qualitative' && (
          <>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Sample Ion</div>
              <div className="mt-1 text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {cationInfo.name}
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Active Reagent</div>
              <div className="mt-1 text-xs font-mono font-semibold text-slate-900 dark:text-white uppercase">
                {qualReagent === 'none' ? 'Aqueous Sample Only' : qualReagent.replace('_', ' ')}
              </div>
            </div>
            <div className="bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Confirmatory Flame</div>
              <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {cationInfo.flame.desc}
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
              <FlaskConical className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                Instrument Controls
              </h2>
            </div>
            <button
              type="button"
              onClick={triggerRecord}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Record Trial</span>
            </button>
          </div>

          {practicalId === 'reactions' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="rxn-conc" className="font-medium text-slate-700 dark:text-slate-300">
                    Dilute HCl Concentration
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {acidConcRxn.toFixed(1)} mol/dm³
                  </span>
                </div>
                <input
                  id="rxn-conc"
                  type="range"
                  min={0.2}
                  max={2.0}
                  step={0.1}
                  value={acidConcRxn}
                  onChange={(e) => setAcidConcRxn(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="rxn-temp" className="font-medium text-slate-700 dark:text-slate-300">
                    Reaction Temperature
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {tempRxnC} °C
                  </span>
                </div>
                <input
                  id="rxn-temp"
                  type="range"
                  min={15}
                  max={65}
                  step={1}
                  value={tempRxnC}
                  onChange={(e) => setTempRxnC(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  CaCO₃ Surface Area (Particle Size)
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['lump', 'chips', 'powder'] as SurfaceForm[]).map((sf) => (
                    <button
                      key={sf}
                      type="button"
                      onClick={() => setSurfaceForm(sf)}
                      className={`px-2 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        surfaceForm === sf
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {sf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRxnRunning((r) => !r)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {rxnRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{rxnRunning ? 'Pause' : 'Resume'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRxnTimeSec(0);
                    setGasCollectedCm3(0);
                    setRxnRunning(true);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                  Fresh Flask
                </button>
              </div>
            </div>
          )}

          {practicalId === 'titration' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Conical Flask Analyte (25.00 cm³ · 0.10 M)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAnalyteAcid('hcl');
                      setBaseAddedCm3(0);
                      setAutoTitrating(false);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      analyteAcid === 'hcl'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    HCl (Strong)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnalyteAcid('ethanoic');
                      setBaseAddedCm3(0);
                      setAutoTitrating(false);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      analyteAcid === 'ethanoic'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    CH₃COOH (Weak)
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Indicator Selection
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'phenolphthalein', label: 'Phenolphth.' },
                    { id: 'methyl_orange', label: 'Methyl Org.' },
                    { id: 'universal', label: 'Universal' },
                  ].map((ind) => (
                    <button
                      key={ind.id}
                      type="button"
                      onClick={() => setIndicator(ind.id as IndicatorType)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        indicator === ind.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="base-conc" className="font-medium text-slate-700 dark:text-slate-300">
                    Burette NaOH Molarity
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {baseConc.toFixed(2)} mol/dm³
                  </span>
                </div>
                <input
                  id="base-conc"
                  type="range"
                  min={0.05}
                  max={0.20}
                  step={0.01}
                  value={baseConc}
                  onChange={(e) => {
                    setBaseConc(parseFloat(e.target.value));
                    setAutoTitrating(false);
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="base-volume" className="font-medium text-slate-700 dark:text-slate-300">
                    Burette Reading
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                    {baseAddedCm3.toFixed(2)} / 50.00 cm³
                  </span>
                </div>
                <input
                  id="base-volume"
                  type="range"
                  min={0}
                  max={50}
                  step={0.1}
                  value={baseAddedCm3}
                  onChange={(e) => {
                    setAutoTitrating(false);
                    setBaseAddedCm3(parseFloat(e.target.value));
                  }}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[0.1, 1.0, 5.0].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => {
                      setAutoTitrating(false);
                      setBaseAddedCm3((v) => Math.min(50, Number((v + inc).toFixed(2))));
                    }}
                    className="px-2 py-2 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 text-xs font-mono font-semibold hover:bg-sky-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    +{inc.toFixed(1)} cm³
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-white/10 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (baseAddedCm3 >= 50) setBaseAddedCm3(0);
                    setAutoTitrating((a) => !a);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {autoTitrating ? <Pause className="w-3.5 h-3.5" /> : <Droplets className="w-3.5 h-3.5" />}
                  <span>{autoTitrating ? 'Stop Tap' : 'Open Tap'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAutoTitrating(false);
                    setBaseAddedCm3(0);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                  Refill
                </button>
              </div>
            </div>
          )}

          {practicalId === 'gas-prep' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Gas to Prepare
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(GAS_SPECS) as GasType[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setSelectedGas(g);
                        setConfirmatoryTestRan(false);
                      }}
                      className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedGas === g
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {GAS_SPECS[g].name} ({GAS_SPECS[g].formula})
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Collection Method
                </span>
                <div className="space-y-1.5">
                  {[
                    { id: 'water', label: 'Over Water (Pneumatic Trough)' },
                    { id: 'upward', label: 'Upward Delivery (Lighter than Air)' },
                    { id: 'downward', label: 'Downward Delivery (Denser than Air)' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCollectionMethod(m.id as CollectionMethod)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        collectionMethod === m.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmatoryTestRan(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wind className="w-4 h-4" />
                <span>Run Confirmatory Test</span>
              </button>
            </div>
          )}

          {practicalId === 'electrolysis' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Electrolyte Solution
                </span>
                <div className="space-y-1.5">
                  {[
                    { id: 'cuso4_aq', label: 'Aqueous Copper(II) Sulphate · CuSO₄(aq)' },
                    { id: 'brine_nacl', label: 'Concentrated Brine · NaCl(aq)' },
                    { id: 'dilute_h2so4', label: 'Acidified Water · dilute H₂SO₄(aq)' },
                  ].map((el) => (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => setElectrolyte(el.id as ElectrolyteType)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        electrolyte === el.id
                          ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {el.label}
                    </button>
                  ))}
                </div>
              </div>

              {electrolyte === 'cuso4_aq' && (
                <div>
                  <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Electrode Material
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setElectrodeMat('graphite')}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                        electrodeMat === 'graphite'
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Inert Graphite
                    </button>
                    <button
                      type="button"
                      onClick={() => setElectrodeMat('copper')}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                        electrodeMat === 'copper'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Active Copper
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="electro-i" className="font-medium text-slate-700 dark:text-slate-300">
                    DC Current (I)
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                    {electroCurrentA.toFixed(1)} A
                  </span>
                </div>
                <input
                  id="electro-i"
                  type="range"
                  min={0.5}
                  max={5.0}
                  step={0.5}
                  value={electroCurrentA}
                  onChange={(e) => setElectroCurrentA(parseFloat(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="electro-t" className="font-medium text-slate-700 dark:text-slate-300">
                    Electrolysis Duration (t)
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {electroDurationMin} min
                  </span>
                </div>
                <input
                  id="electro-t"
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={electroDurationMin}
                  onChange={(e) => setElectroDurationMin(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {practicalId === 'qualitative' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Cation Salt Solution
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(CATION_DATA) as CationId[]).map((ion) => (
                    <button
                      key={ion}
                      type="button"
                      onClick={() => {
                        setSelectedCation(ion);
                        setQualReagent('none');
                      }}
                      className={`px-2 py-2 rounded-lg text-xs font-mono font-semibold border cursor-pointer ${
                        selectedCation === ion
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {ion}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Reagent Bench Action
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'naoh_drop', label: 'Add NaOH(aq) dropwise' },
                    { id: 'naoh_excess', label: 'Add Excess NaOH(aq)' },
                    { id: 'nh3_drop', label: 'Add NH₃(aq) dropwise' },
                    { id: 'nh3_excess', label: 'Add Excess NH₃(aq)' },
                    { id: 'flame', label: 'Nichrome Wire Flame Test' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setQualReagent(r.id as QualReagent)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between cursor-pointer ${
                        qualReagent === r.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                      }`}
                    >
                      <span>{r.label}</span>
                      {r.id === 'flame' ? <Flame className="w-3.5 h-3.5 text-amber-500" /> : <TestTube className="w-3.5 h-3.5 text-indigo-500" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT APPARATUS STAGE */}
        <section className="lg:col-span-8 bg-white dark:bg-[#18181a] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-5">
          {/* STAGE 1: CHEMICAL REACTIONS */}
          {practicalId === 'reactions' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                    Conical Flask & Gas Syringe Kinetic Curve
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Higher concentration, surface area, and temperature increase effective particle collisions per second.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-3 flex items-center justify-center">
                  <svg viewBox="0 0 260 250" className="w-full h-[250px]">
                    {/* Flask */}
                    <path
                      d="M 68 85 L 92 85 L 92 108 L 122 194 Q 126 204 114 204 L 46 204 Q 34 204 38 194 L 68 108 Z"
                      fill="rgba(255,255,255,0.16)"
                      stroke="#94a3b8"
                      strokeWidth="2"
                    />
                    {/* Acid liquid */}
                    <path
                      d="M 52 152 L 108 152 L 120 194 Q 123 202 113 202 L 47 202 Q 37 202 40 194 Z"
                      fill="rgba(56, 189, 248, 0.25)"
                    />
                    {/* Marble chips/powder */}
                    {surfaceForm === 'lump' && <rect x="70" y="186" width="22" height="12" rx="4" fill="#e2e8f0" stroke="#94a3b8" />}
                    {surfaceForm === 'chips' && (
                      <g fill="#e2e8f0" stroke="#94a3b8">
                        <circle cx="66" cy="193" r="5" />
                        <circle cx="80" cy="195" r="4.5" />
                        <circle cx="94" cy="193" r="5" />
                      </g>
                    )}
                    {surfaceForm === 'powder' && (
                      <rect x="52" y="196" width="56" height="4" rx="2" fill="#e2e8f0" />
                    )}
                    {/* Bubbles */}
                    {rxnRunning && gasCollectedCm3 < maxGasCm3 && (
                      <g fill="#38bdf8">
                        <circle cx="72" cy="182" r="2.5">
                          <animate attributeName="cy" values="192;152" dur={`${Math.max(0.25, 1.4 / Math.max(0.2, kRate)).toFixed(2)}s`} repeatCount="indefinite" />
                        </circle>
                        <circle cx="86" cy="176" r="2.8">
                          <animate attributeName="cy" values="194;152" dur={`${Math.max(0.32, 1.7 / Math.max(0.2, kRate)).toFixed(2)}s`} repeatCount="indefinite" />
                        </circle>
                      </g>
                    )}
                    {/* Delivery Tube & Gas Syringe */}
                    <path d="M 80 85 L 80 56 L 140 56 L 140 86" fill="none" stroke="#94a3b8" strokeWidth="4" />
                    <rect x="140" y="70" width="106" height="32" rx="4" fill="rgba(255,255,255,0.12)" stroke="#64748b" strokeWidth="2" />
                    {(() => {
                      const shift = (gasCollectedCm3 / maxGasCm3) * 80;
                      return (
                        <>
                          <rect x="142" y="72" width={8 + shift} height="28" fill="rgba(79,70,229,0.22)" />
                          <rect x={150 + shift} y="72" width="7" height="28" fill="#4f46e5" />
                          <rect x={157 + shift} y="83" width="28" height="6" fill="#94a3b8" />
                        </>
                      );
                    })()}
                    <text x="193" y="118" textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">
                      CO₂: {gasCollectedCm3.toFixed(1)} cm³
                    </text>
                  </svg>
                </div>

                <div className="md:col-span-7 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#121212] p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>VOLUME OF CO₂ (cm³) vs TIME (s)</span>
                    <span>k = {kRate.toFixed(2)}</span>
                  </div>
                  <svg viewBox="0 0 320 205" className="w-full h-[215px]">
                    <line x1="38" y1="16" x2="38" y2="174" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <line x1="38" y1="174" x2="300" y2="174" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <line x1="38" y1="24" x2="300" y2="24" stroke="#10b981" strokeDasharray="4 4" strokeWidth="1" />
                    <path
                      d={Array.from({ length: 41 }, (_, i) => {
                        const t = (i / 40) * 30;
                        const v = maxGasCm3 * (1 - Math.exp(-(kRate * 0.15) * t));
                        const x = 38 + (t / 30) * 256;
                        const y = 174 - (v / maxGasCm3) * 150;
                        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2.4"
                    />
                    <circle
                      cx={Math.min(294, 38 + (rxnTimeSec / 30) * 256)}
                      cy={174 - (gasCollectedCm3 / maxGasCm3) * 150}
                      r="5"
                      fill="#0ea5e9"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text x="168" y="194" textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">
                      Elapsed Time (0 → 30 s)
                    </text>
                    <text x="12" y="96" textAnchor="middle" transform="rotate(-90 12 96)" className="fill-slate-500 text-[10px] font-mono">
                      Gas (0 → 60 cm³)
                    </text>
                  </svg>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    Steeper initial gradient indicates higher collision frequency.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: TITRATION */}
          {practicalId === 'titration' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                    Volumetric Burette & Live pH Titration Curve
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {analyteAcid === 'hcl'
                      ? 'HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)'
                      : 'CH₃COOH(aq) + NaOH(aq) ⇌ CH₃COONa(aq) + H₂O(l)'}
                  </p>
                </div>
                <div className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  pH {currentPh.toFixed(2)} · V_eq = {equivalenceVolumeCm3.toFixed(2)} cm³
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                <div className="md:col-span-5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-3 flex items-center justify-center">
                  <svg viewBox="0 0 220 290" className="w-full h-[285px]">
                    <rect x="28" y="264" width="164" height="8" rx="3" fill="#475569" />
                    <rect x="44" y="20" width="6" height="246" fill="#64748b" />
                    <rect x="44" y="74" width="66" height="5" fill="#64748b" />
                    <rect x="100" y="18" width="22" height="132" rx="2" fill="rgba(255,255,255,0.18)" stroke="#94a3b8" strokeWidth="1.8" />
                    {(() => {
                      const remainingRatio = Math.max(0, (50 - baseAddedCm3) / 50);
                      const liqH = 122 * remainingRatio;
                      return <rect x="102" y={148 - liqH} width="18" height={liqH} fill="rgba(56, 189, 248, 0.38)" />;
                    })()}
                    {[0, 10, 20, 30, 40, 50].map((mark) => {
                      const y = 26 + (mark / 50) * 122;
                      return (
                        <g key={mark}>
                          <line x1="114" y1={y} x2="122" y2={y} stroke="#64748b" strokeWidth="1" />
                          <text x="126" y={y + 3} className="fill-slate-400 text-[8px] font-mono">{mark}</text>
                        </g>
                      );
                    })}
                    <rect x="107" y="150" width="8" height="18" fill="#94a3b8" />
                    <rect x="97" y="155" width="28" height="6" rx="2" fill={autoTitrating ? '#10b981' : '#f59e0b'} />
                    {autoTitrating && baseAddedCm3 < 50 && (
                      <circle cx="111" cy="178" r="2.5" fill="#38bdf8">
                        <animate attributeName="cy" values="170;214" dur="0.45s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <path d="M 98 186 L 124 186 L 124 202 L 154 252 Q 157 259 148 259 L 74 259 Q 65 259 68 252 L 98 202 Z" fill="rgba(255,255,255,0.12)" stroke="#94a3b8" strokeWidth="2" />
                    {(() => {
                      const fillScale = Math.min(1, 0.42 + (baseAddedCm3 / 50) * 0.48);
                      const topY = 259 - 46 * fillScale;
                      const halfW = 39 - (259 - topY) * 0.42;
                      return (
                        <path
                          d={`M ${111 - halfW} ${topY} L ${111 + halfW} ${topY} L 152 253 Q 154 258 147 258 L 75 258 Q 68 258 70 253 Z`}
                          fill={indicatorLook.fill}
                        />
                      );
                    })()}
                    <rect x="100" y="251" width="22" height="4" rx="2" fill="#e2e8f0" />
                  </svg>
                </div>

                <div className="md:col-span-7 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#121212] p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>TITRATION CURVE (pH vs NaOH VOLUME)</span>
                    <span>V_eq = {equivalenceVolumeCm3.toFixed(1)} cm³</span>
                  </div>
                  <svg viewBox="0 0 360 220" className="w-full h-[230px]">
                    <line x1="40" y1="16" x2="40" y2="184" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    <line x1="40" y1="184" x2="342" y2="184" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1.2" />
                    {(() => {
                      const bandMin = indicator === 'phenolphthalein' ? 8.2 : indicator === 'methyl_orange' ? 3.1 : 6.6;
                      const bandMax = indicator === 'phenolphthalein' ? 10.0 : indicator === 'methyl_orange' ? 4.4 : 7.6;
                      const yTop = 184 - (bandMax / 14) * 162;
                      const yBot = 184 - (bandMin / 14) * 162;
                      return (
                        <rect
                          x="40"
                          y={yTop}
                          width="302"
                          height={Math.max(4, yBot - yTop)}
                          fill={indicator === 'phenolphthalein' ? 'rgba(236,72,153,0.14)' : indicator === 'methyl_orange' ? 'rgba(249,115,22,0.16)' : 'rgba(16,185,129,0.14)'}
                        />
                      );
                    })()}
                    {equivalenceVolumeCm3 <= 50 && (
                      <line
                        x1={40 + (equivalenceVolumeCm3 / 50) * 300}
                        y1="16"
                        x2={40 + (equivalenceVolumeCm3 / 50) * 300}
                        y2="184"
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        strokeWidth="1.2"
                      />
                    )}
                    <path
                      d={titrationCurvePoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${(40 + (pt.v / 50) * 300).toFixed(1)} ${(184 - (pt.ph / 14) * 162).toFixed(1)}`).join(' ')}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2.2"
                    />
                    <circle cx={40 + (baseAddedCm3 / 50) * 300} cy={184 - (currentPh / 14) * 162} r="5.5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
                    <text x="190" y="205" textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">
                      Volume NaOH Added (0 → 50 cm³)
                    </text>
                  </svg>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    {indicatorLook.label}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 3: GAS PREPARATION */}
          {practicalId === 'gas-prep' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  Gas Generator & {collectionMethod === 'water' ? 'Pneumatic Trough' : collectionMethod === 'upward' ? 'Upward Delivery' : 'Downward Delivery'} Bench
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reagents: {gasSpec.reagents} · {gasSpec.equation}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-4">
                <svg viewBox="0 0 460 220" className="w-full h-[220px]">
                  {/* Generator Flask */}
                  <path d="M 65 76 L 85 76 L 85 100 L 116 178 Q 120 186 108 186 L 42 186 Q 30 186 34 178 L 65 100 Z" fill="rgba(255,255,255,0.16)" stroke="#94a3b8" strokeWidth="2" />
                  <path d="M 48 140 L 102 140 L 114 178 Q 116 184 108 184 L 42 184 Q 34 184 36 178 Z" fill="rgba(56,189,248,0.28)" />
                  <circle cx="75" cy="166" r="3" fill="#38bdf8">
                    <animate attributeName="cy" values="175;140" dur="0.9s" repeatCount="indefinite" />
                  </circle>

                  {/* Delivery tube & Collector */}
                  {collectionMethod === 'water' && (
                    <g>
                      <path d="M 75 76 L 75 48 L 250 48 L 250 165 L 285 165" fill="none" stroke="#94a3b8" strokeWidth="4" />
                      {/* Trough */}
                      <rect x="215" y="130" width="170" height="62" rx="4" fill="rgba(56,189,248,0.16)" stroke="#64748b" strokeWidth="2" />
                      {/* Inverted Gas Jar */}
                      <rect x="275" y="54" width="52" height="106" rx="4" fill={gasSpec.tint} stroke="#64748b" strokeWidth="2" />
                      <circle cx="298" cy="140" r="3" fill="#38bdf8">
                        <animate attributeName="cy" values="155;75" dur="1.1s" repeatCount="indefinite" />
                      </circle>
                      <text x="301" y="100" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 text-xs font-mono font-bold">
                        {gasSpec.formula}
                      </text>
                    </g>
                  )}

                  {collectionMethod === 'upward' && (
                    <g>
                      <path d="M 75 76 L 75 48 L 300 48 L 300 92" fill="none" stroke="#94a3b8" strokeWidth="4" />
                      <rect x="272" y="52" width="56" height="118" rx="4" fill={gasSpec.tint} stroke="#64748b" strokeWidth="2" />
                      <text x="300" y="106" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 text-xs font-mono font-bold">
                        {gasSpec.formula} (Light)
                      </text>
                    </g>
                  )}

                  {collectionMethod === 'downward' && (
                    <g>
                      <path d="M 75 76 L 75 48 L 300 48 L 300 175" fill="none" stroke="#94a3b8" strokeWidth="4" />
                      <rect x="272" y="78" width="56" height="114" rx="4" fill={gasSpec.tint} stroke="#64748b" strokeWidth="2" />
                      <text x="300" y="140" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 text-xs font-mono font-bold">
                        {gasSpec.formula} (Dense)
                      </text>
                    </g>
                  )}
                </svg>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className={`p-3 rounded-xl border ${isCollectionValid ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60' : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'}`}>
                  <div className="font-semibold text-slate-900 dark:text-white mb-1">
                    {isCollectionValid ? '● Correct Collection Principle' : '✖ Collection Mismatch'}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{gasSpec.collectionReason}</p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                  <div className="font-semibold text-slate-900 dark:text-white mb-1">
                    Confirmatory Test: {gasSpec.testName}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    {confirmatoryTestRan ? gasSpec.testObservation : 'Click "Run Confirmatory Test" to observe chemical identification.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4: ELECTROLYSIS */}
          {practicalId === 'electrolysis' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  Electrolytic Cell & Ion Migration Apparatus
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cathode (−): {electroMetrics.cathodeEq} · Anode (+): {electroMetrics.anodeEq}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-3">
                <svg viewBox="0 0 420 245" className="w-full h-[245px]">
                  {/* DC Supply */}
                  <rect x="166" y="12" width="88" height="34" rx="6" className="fill-white dark:fill-slate-900" stroke="#4f46e5" strokeWidth="2" />
                  <text x="210" y="33" textAnchor="middle" className="fill-indigo-600 dark:fill-indigo-400 text-xs font-mono font-bold">
                    DC {electroCurrentA.toFixed(1)} A
                  </text>
                  {/* Wires */}
                  <path d="M 166 29 L 132 29 L 132 76" fill="none" stroke="#0284c7" strokeWidth="2.5" />
                  <path d="M 254 29 L 288 29 L 288 76" fill="none" stroke="#e11d48" strokeWidth="2.5" />

                  {/* Beaker */}
                  <rect x="86" y="88" width="248" height="142" rx="8" fill={electrolyte === 'cuso4_aq' ? 'rgba(14, 165, 233, 0.24)' : 'rgba(226, 232, 240, 0.2)'} stroke="#64748b" strokeWidth="2.5" />

                  {/* Cathode (-) */}
                  <rect x="122" y="76" width="20" height="130" rx="3" fill={electrolyte === 'cuso4_aq' ? '#b45309' : '#334155'} stroke="#0284c7" strokeWidth="1.5" />
                  <text x="132" y="68" textAnchor="middle" className="fill-sky-600 dark:fill-sky-400 text-[10px] font-mono font-bold">
                    CATHODE (−)
                  </text>

                  {/* Anode (+) */}
                  <rect x="278" y="76" width="20" height="130" rx="3" fill={electrolyte === 'cuso4_aq' && electrodeMat === 'copper' ? '#d97706' : '#334155'} stroke="#e11d48" strokeWidth="1.5" />
                  <text x="288" y="68" textAnchor="middle" className="fill-rose-600 dark:fill-rose-400 text-[10px] font-mono font-bold">
                    ANODE (+)
                  </text>

                  {/* Ion Flow & Bubbles */}
                  <g>
                    <circle cx="195" cy="145" r="7" fill="#0284c7">
                      <animate attributeName="cx" values="215;146" dur={`${Math.max(0.7, 2.8 / electroCurrentA).toFixed(2)}s`} repeatCount="indefinite" />
                    </circle>
                    <text x="165" y="130" className="fill-sky-600 dark:fill-sky-400 text-[10px] font-mono">
                      Cations (+) →
                    </text>

                    <circle cx="235" cy="182" r="7" fill="#e11d48">
                      <animate attributeName="cx" values="205;274" dur={`${Math.max(0.7, 2.8 / electroCurrentA).toFixed(2)}s`} repeatCount="indefinite" />
                    </circle>
                    <text x="208" y="168" className="fill-rose-600 dark:fill-rose-400 text-[10px] font-mono">
                      ← Anions (−)
                    </text>
                  </g>

                  {electrolyte !== 'cuso4_aq' && (
                    <circle cx="132" cy="150" r="3" fill="#38bdf8">
                      <animate attributeName="cy" values="195;95" dur="0.7s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {(electrolyte !== 'cuso4_aq' || electrodeMat === 'graphite') && (
                    <circle cx="288" cy="150" r="3" fill="#38bdf8">
                      <animate attributeName="cy" values="195;95" dur="0.8s" repeatCount="indefinite" />
                    </circle>
                  )}
                </svg>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                  <div className="text-sky-600 dark:text-sky-400 font-bold mb-1">CATHODE (−) PRODUCT</div>
                  <div>{electroMetrics.cathodeProduct}</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                  <div className="text-rose-600 dark:text-rose-400 font-bold mb-1">ANODE (+) PRODUCT</div>
                  <div>{electroMetrics.anodeProduct}</div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 5: QUALITATIVE ANALYSIS */}
          {practicalId === 'qualitative' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white">
                  Test Tube Precipitate & Flame Spectroscope View
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Observe gelatinous hydroxide precipitates, amphoteric complex solubility, or characteristic flame colors.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#121212] p-4 flex items-center justify-center">
                  <svg viewBox="0 0 200 240" className="w-full h-[230px]">
                    {qualReagent === 'flame' ? (
                      <g>
                        {/* Bunsen Burner + Colored Flame */}
                        <rect x="86" y="158" width="28" height="60" rx="2" fill="#475569" />
                        <rect x="70" y="214" width="60" height="10" rx="3" fill="#334155" />
                        <path
                          d="M 100 42 Q 134 102 114 156 L 86 156 Q 66 102 100 42 Z"
                          fill={currentQualObservation.color}
                          fillOpacity="0.85"
                        />
                        <path d="M 100 88 Q 114 120 106 156 L 94 156 Q 86 120 100 88 Z" fill="#38bdf8" fillOpacity="0.7" />
                        <line x1="36" y1="108" x2="100" y2="108" stroke="#94a3b8" strokeWidth="2.5" />
                      </g>
                    ) : (
                      <g>
                        {/* Test Tube */}
                        <rect x="74" y="34" width="52" height="176" rx="26" fill="rgba(255,255,255,0.14)" stroke="#94a3b8" strokeWidth="2.5" />
                        <path
                          d="M 76 112 L 124 112 L 124 184 Q 124 208 100 208 Q 76 208 76 184 Z"
                          fill={currentQualObservation.color}
                        />
                        {/* Settle precipitate layer if insoluble */}
                        {(qualReagent === 'naoh_drop' ||
                          qualReagent === 'nh3_drop' ||
                          (qualReagent === 'naoh_excess' && !cationInfo.naohExcess.soluble) ||
                          (qualReagent === 'nh3_excess' && !cationInfo.nh3Excess.soluble)) && (
                          <path
                            d="M 78 176 L 122 176 L 122 186 Q 122 206 100 206 Q 78 206 78 186 Z"
                            fill={currentQualObservation.color}
                            stroke="#475569"
                            strokeOpacity="0.35"
                          />
                        )}
                        <text x="100" y="230" textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">
                          {selectedCation} Test Tube
                        </text>
                      </g>
                    )}
                  </svg>
                </div>

                <div className="md:col-span-7 space-y-3">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/5">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold mb-1">
                      Laboratory Observation
                    </div>
                    <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                      {currentQualObservation.text}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121212] text-xs font-mono space-y-1.5 text-slate-600 dark:text-slate-300">
                    <div>• NaOH excess: {cationInfo.naohExcess.soluble ? 'Soluble (amphoteric / clear)' : 'Insoluble precipitate'}</div>
                    <div>• NH₃ excess: {cationInfo.nh3Excess.soluble ? 'Soluble complex formed' : 'Insoluble precipitate'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
