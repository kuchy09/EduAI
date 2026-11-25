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

export type EduLabNavSection =
  | 'dashboard'
  | 'library'
  | 'chemistry'
  | 'physics'
  | 'biology'
  | 'assistant'
  | 'assessments'
  | 'progress';

export interface AssessmentAttempt {
  id: string;
  discipline: LabCategory | 'mixed';
  title: string;
  score: number;
  total: number;
  percentage: number;
  timestamp: string;
}

export interface PracticalQuestion {
  id: string;
  discipline: LabCategory;
  practicalId: LabExperimentId;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const PRACTICAL_ASSESSMENT_QUESTIONS: PracticalQuestion[] = [
  {
    id: 'chem-q1',
    discipline: 'chemistry',
    practicalId: 'titration',
    prompt: '25.0 cm³ of 0.10 M NaOH exactly neutralizes 20.0 cm³ of dilute HCl using phenolphthalein indicator. What is the molarity of the hydrochloric acid?',
    options: ['0.080 M', '0.125 M', '0.150 M', '0.200 M'],
    correctIndex: 1,
    explanation: 'Mole ratio NaOH : HCl is 1:1. Moles of NaOH = 0.10 × (25.0 / 1000) = 0.0025 mol. Therefore C_a = 0.0025 / (20.0 / 1000) = 0.125 M.',
  },
  {
    id: 'chem-q2',
    discipline: 'chemistry',
    practicalId: 'qualitative',
    prompt: 'When aqueous NH₃ is added dropwise and then in excess to an unknown salt solution, a pale blue precipitate forms that dissolves in excess NH₃ to give a deep royal-blue solution. Which cation is present?',
    options: ['Fe²⁺', 'Zn²⁺', 'Cu²⁺', 'Al³⁺'],
    correctIndex: 2,
    explanation: 'Cu²⁺ forms a pale blue Cu(OH)₂ precipitate that dissolves in excess aqueous ammonia to form the deep blue tetraamminecopper(II) complex, [Cu(NH₃)₄]²⁺.',
  },
  {
    id: 'chem-q3',
    discipline: 'chemistry',
    practicalId: 'gas-prep',
    prompt: 'Which drying agent and collection method are suitable for preparing dry hydrogen chloride gas (HCl) in the laboratory?',
    options: [
      'Calcium oxide (CaO) drying agent with upward delivery',
      'Concentrated H₂SO₄ drying agent with downward delivery (upward displacement of air)',
      'Water trough collection over cold water',
      'Anhydrous CaCl₂ with collection over dilute NaOH',
    ],
    correctIndex: 1,
    explanation: 'HCl is acidic (reacts with basic CaO), denser than air (downward delivery), and highly soluble in water (cannot be collected over water). Concentrated H₂SO₄ dries it cleanly.',
  },
  {
    id: 'chem-q4',
    discipline: 'chemistry',
    practicalId: 'electrolysis',
    prompt: 'A steady current of 2.0 A flows through copper(II) sulfate solution using copper electrodes for 965 seconds. Calculate the mass of copper deposited at the cathode (Cu = 63.5, F = 96,500 C/mol).',
    options: ['0.318 g', '0.635 g', '1.270 g', '2.540 g'],
    correctIndex: 1,
    explanation: 'Q = I · t = 2.0 × 965 = 1,930 C. Moles of Cu²⁺ deposited = Q / (2 × 96,500) = 1,930 / 193,000 = 0.01 mol. Mass = 0.01 × 63.5 = 0.635 g.',
  },
  {
    id: 'phys-q1',
    discipline: 'physics',
    practicalId: 'circuits',
    prompt: 'Two resistors of 6 Ω and 3 Ω are connected in parallel across a 12 V DC cell of negligible internal resistance. What is the total current drawn from the cell?',
    options: ['2.0 A', '4.0 A', '6.0 A', '1.33 A'],
    correctIndex: 2,
    explanation: 'Equivalent resistance R_eq = (6 × 3) / (6 + 3) = 2 Ω. By Ohm’s Law, total current I = V / R_eq = 12 / 2 = 6.0 A.',
  },
  {
    id: 'phys-q2',
    discipline: 'physics',
    practicalId: 'mechanics',
    prompt: 'In a simple pendulum experiment, doubling the string length from L to 4L changes the periodic time T by what factor?',
    options: ['Increases by √2', 'Doubles (2×)', 'Quadruples (4×)', 'Remains unchanged'],
    correctIndex: 1,
    explanation: 'Since T = 2π√(L / g), period T is proportional to √L. Multiplying L by 4 multiplies T by √4 = 2.',
  },
  {
    id: 'phys-q3',
    discipline: 'physics',
    practicalId: 'measurements',
    prompt: 'A micrometer screw gauge has a positive zero error of +0.03 mm. When measuring a wire, the sleeve reads 2.5 mm and the 28th thimble division coincides with the datum line. What is the true diameter?',
    options: ['2.75 mm', '2.78 mm', '2.81 mm', '2.53 mm'],
    correctIndex: 0,
    explanation: 'Observed reading = 2.5 + (28 × 0.01) = 2.78 mm. Subtracting positive zero error: 2.78 − 0.03 = 2.75 mm.',
  },
  {
    id: 'phys-q4',
    discipline: 'physics',
    practicalId: 'waves',
    prompt: 'An object placed 30 cm from a convex lens of focal length 10 cm produces a real image. At what distance v from the lens is the image focused on the screen?',
    options: ['10 cm', '15 cm', '20 cm', '30 cm'],
    correctIndex: 1,
    explanation: 'Using 1/f = 1/u + 1/v: 1/10 = 1/30 + 1/v → 1/v = 3/30 − 1/30 = 2/30 → v = 15 cm.',
  },
  {
    id: 'bio-q1',
    discipline: 'biology',
    practicalId: 'cells',
    prompt: 'A strip of peeled potato tissue is immersed in a concentrated 1.0 M sucrose solution for 40 minutes. What happens to the cells and the water potential gradient?',
    options: [
      'Water enters by osmosis; cells become turgid',
      'Water leaves by osmosis; cytoplasm pulls away from the cell wall (plasmolysis)',
      'Sucrose diffuses rapidly into the vacuole until equilibrium',
      'The cell wall bursts due to high turgor pressure',
    ],
    correctIndex: 1,
    explanation: 'Concentrated sucrose has lower water potential than cell sap, so water leaves down its water potential gradient, causing plasmolysis and flaccidity.',
  },
  {
    id: 'bio-q2',
    discipline: 'biology',
    practicalId: 'microscopy',
    prompt: 'A student views an onion epidermal cell using a ×10 eyepiece and a ×40 objective lens. If the magnified image spans 4.0 mm across the scale, what is the actual cell length in micrometers (µm)?',
    options: ['10 µm', '40 µm', '100 µm', '400 µm'],
    correctIndex: 0,
    explanation: 'Total magnification = 10 × 40 = 400×. Actual size = 4.0 mm / 400 = 0.01 mm = 10 µm.',
  },
  {
    id: 'bio-q3',
    discipline: 'biology',
    practicalId: 'genetics',
    prompt: 'In an ABO blood group cross between a heterozygous type A parent (I^A i) and a heterozygous type B parent (I^B i), what is the probability of an offspring having blood group O?',
    options: ['0%', '25%', '50%', '75%'],
    correctIndex: 1,
    explanation: 'The gametes are (I^A, i) × (I^B, i), giving four genotypes: I^A I^B (AB), I^A i (A), I^B i (B), and ii (O). Thus 1 in 4 (25%) is type O.',
  },
  {
    id: 'bio-q4',
    discipline: 'biology',
    practicalId: 'ecology',
    prompt: 'In a capture–recapture ecology study, 60 grasshoppers are marked and released. Later, 50 are captured, of which 10 carry marks. Estimate the total grasshopper population size N.',
    options: ['120', '240', '300', '600'],
    correctIndex: 2,
    explanation: 'Lincoln–Petersen index: N = (n₁ × n₂) / m₂ = (60 × 50) / 10 = 3,000 / 10 = 300 grasshoppers.',
  },
];

