export type LabCategory = 'chemistry' | 'physics' | 'biology';

export type ChemistryPracticalId =
  | 'reactions'
  | 'titration'
  | 'gas-prep'
  | 'electrolysis'
  | 'qualitative';

export type PhysicsPracticalId =
  | 'circuits'
  | 'mechanics'
  | 'waves'
  | 'magnetism'
  | 'measurements';

export type BiologyPracticalId =
  | 'cells'
  | 'microscopy'
  | 'genetics'
  | 'physiology'
  | 'ecology';

export type LabExperimentId =
  | ChemistryPracticalId
  | PhysicsPracticalId
  | BiologyPracticalId;

export interface LabTrialRecord {
  id: string;
  category: LabCategory;
  experiment: LabExperimentId;
  timestamp: string;
  inputsSummary: string;
  primaryReading: string;
  secondaryReading: string;
  derivedMetric: string;
}

export interface TrialPayload {
  inputsSummary: string;
  primaryReading: string;
  secondaryReading: string;
  derivedMetric: string;
}

export interface TelemetryCardData {
  label: string;
  value: string;
  unit?: string;
  secondary?: string;
  statusText?: string;
  statusTone?: 'nominal' | 'warning' | 'critical' | 'neutral';
}

export interface PracticalMeta {
  id: LabExperimentId;
  category: LabCategory;
  label: string;
  code: string;
  title: string;
  formula: string;
  objective: string;
}

export const PRACTICALS_CATALOG: PracticalMeta[] = [
  // CHEMISTRY LAB (5)
  {
    id: 'reactions',
    category: 'chemistry',
    label: 'Chemical reactions',
    code: 'CHEMISTRY LAB · REACTION KINETICS',
    title: 'Rates of Chemical Reactions & Collision Bench',
    formula: 'Rate = Δ[Product] / Δt   |   CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑',
    objective: 'Vary reactant concentration, temperature, and surface area to measure gas evolution rate and collision frequency.',
  },
  {
    id: 'titration',
    category: 'chemistry',
    label: 'Titrations',
    code: 'CHEMISTRY LAB · VOLUMETRIC ANALYSIS',
    title: 'Acid–Base Titration & Indicator Bench',
    formula: 'n(H⁺) = C_a · V_a   |   pH = −log₁₀[H⁺]',
    objective: 'Dispense NaOH titrant from a 50.00 cm³ burette to locate the equivalence point and observe indicator color changes.',
  },
  {
    id: 'gas-prep',
    category: 'chemistry',
    label: 'Gas preparation',
    code: 'CHEMISTRY LAB · INORGANIC GASES',
    title: 'Laboratory Gas Preparation, Collection & Confirmatory Tests',
    formula: '2H₂O₂ → 2H₂O + O₂↑   |   Zn + H₂SO₄ → ZnSO₄ + H₂↑',
    objective: 'Select appropriate drying/collection setups based on gas density and solubility, then run chemical confirmatory tests.',
  },
  {
    id: 'electrolysis',
    category: 'chemistry',
    label: 'Electrolysis',
    code: 'CHEMISTRY LAB · ELECTROCHEMISTRY',
    title: "Electrolytic Cell & Faraday's Laws Bench",
    formula: 'Q = I · t   |   m = (Q · M) / (z · F)',
    objective: 'Observe preferential ion discharge at electrodes, gas evolution ratios, and cathode copper deposition mass.',
  },
  {
    id: 'qualitative',
    category: 'chemistry',
    label: 'Qualitative analysis',
    code: 'CHEMISTRY LAB · SALT ANALYSIS',
    title: 'Cation Precipitate & Flame Identification Bench',
    formula: 'Mⁿ⁺(aq) + nOH⁻(aq) → M(OH)ₙ(s)↓',
    objective: 'Add aqueous NaOH and NH₃ dropwise and in excess to identify unknown metal cations by precipitate color and solubility.',
  },

  // PHYSICS LAB (5)
  {
    id: 'circuits',
    category: 'physics',
    label: 'Electricity and circuits',
    code: 'PHYSICS LAB · CURRENT ELECTRICITY',
    title: "Ohm's Law & DC Network Analyzer",
    formula: 'V = I · R_eq   |   P = I² · R_eq',
    objective: 'Measure current, branch voltage drops, equivalent resistance, and power dissipation across single, series, and parallel loads.',
  },
  {
    id: 'mechanics',
    category: 'physics',
    label: 'Mechanics',
    code: 'PHYSICS LAB · OSCILLATIONS & GRAVITY',
    title: 'Simple Pendulum & Gravitational Field Bench',
    formula: 'T = 2π √(L / g)',
    objective: 'Investigate how string length L and gravitational acceleration g govern oscillation period T and T² linearity.',
  },
  {
    id: 'waves',
    category: 'physics',
    label: 'Waves and optics',
    code: 'PHYSICS LAB · WAVES & GEOMETRIC OPTICS',
    title: 'Transverse Wave Tank & Thin Converging Lens Bench',
    formula: 'v = f · λ   |   1/f = 1/u + 1/v',
    objective: 'Explore wavelength-frequency relationships on a ripple wave and trace principal rays through a convex lens.',
  },
  {
    id: 'magnetism',
    category: 'physics',
    label: 'Magnetism',
    code: 'PHYSICS LAB · ELECTROMAGNETISM',
    title: 'Solenoid Magnetic Field & Compass Deflection Bench',
    formula: 'B = μ₀ · μ_r · (N / L) · I',
    objective: 'Control coil turns, current direction, and soft-iron core insertion to inspect field polarity and flux density.',
  },
  {
    id: 'measurements',
    category: 'physics',
    label: 'Measurements',
    code: 'PHYSICS LAB · PRECISION METROLOGY',
    title: 'Vernier Calliper & Micrometer Screw Gauge Bench',
    formula: 'Reading = MSR + (VSR × LC) − Zero Error',
    objective: 'Practice reading main scale and vernier/thimble coincidences to 0.02 mm and 0.01 mm precision with zero-error correction.',
  },

  // BIOLOGY LAB (5)
  {
    id: 'cells',
    category: 'biology',
    label: 'Cell observation',
    code: 'BIOLOGY LAB · CELL PHYSIOLOGY',
    title: 'Cell Observation, Osmosis & Plasmolysis Bench',
    formula: 'Ψ_w = Ψ_s + Ψ_p   |   Ψ_s = −iCRT',
    objective: 'Examine plant and animal cells in hypotonic, isotonic, and hypertonic sucrose solutions to track turgor and plasmolysis.',
  },
  {
    id: 'microscopy',
    category: 'biology',
    label: 'Microscopy',
    code: 'BIOLOGY LAB · LIGHT MICROSCOPY',
    title: 'Compound Light Microscope & Specimen Sizing Lab',
    formula: 'Total Mag = M_eye × M_obj   |   Actual Size = Image / Mag',
    objective: 'Switch objective lenses, adjust coarse/fine focus and condenser iris illumination, and measure cells using an eyepiece graticule.',
  },
  {
    id: 'genetics',
    category: 'biology',
    label: 'Genetics',
    code: 'BIOLOGY LAB · MENDELIAN INHERITANCE',
    title: 'Punnett Square Cross & Cohort Inheritance Simulator',
    formula: 'F₁ Phenotypic & Genotypic Segregation Ratios',
    objective: 'Simulate monohybrid dominance, ABO codominance, and sex-linked crosses alongside Monte Carlo offspring sampling.',
  },
  {
    id: 'physiology',
    category: 'biology',
    label: 'Human physiology',
    code: 'BIOLOGY LAB · CARDIORESPIRATORY SYSTEM',
    title: 'Heart Rate, Spirometry & Altitude Physiology Bench',
    formula: 'CO = HR × SV   |   V_E = RR × V_T',
    objective: 'Measure how exercise intensity and altitude alter heart rate, tidal volume, cardiac output, and blood oxygen saturation.',
  },
  {
    id: 'ecology',
    category: 'biology',
    label: 'Ecology',
    code: 'BIOLOGY LAB · POPULATION ECOLOGY',
    title: 'Quadrat Field Sampling & Predator–Prey Dynamics Lab',
    formula: 'N = (n₁ × n₂) / m₂   |   dN/dt = rN(1 − N/K) − aNP',
    objective: 'Estimate species population density with random quadrats and model cyclic predator–prey food-web equilibrium.',
  },
];
