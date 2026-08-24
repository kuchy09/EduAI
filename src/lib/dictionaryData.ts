// Comprehensive built-in vocabulary for instant offline and STEM/Physics/Academic lookup
export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  category?: string;
  definition: string;
  secondaryDefinition?: string;
  example?: string;
  synonyms?: string[];
  etymology?: string;
}

export const OFFLINE_DICTIONARY: Record<string, DictionaryEntry> = {
  // Physics & STEM
  physics: {
    word: "physics",
    phonetic: "/ˈfɪz.ɪks/",
    partOfSpeech: "noun",
    category: "Science",
    definition: "The branch of science concerned with the nature and properties of matter and energy, encompassing mechanics, heat, light, radiation, sound, electricity, magnetism, and atomic structure.",
    example: "Physics explains why objects fall to the earth and how energy transforms from one form to another.",
    synonyms: ["natural philosophy", "mechanics", "physical science"]
  },
  force: {
    word: "force",
    phonetic: "/fɔːrs/",
    partOfSpeech: "noun / verb",
    category: "Physics",
    definition: "An influence tending to change the motion of a body or produce motion in a stationary body, measured in Newtons (N).",
    secondaryDefinition: "Vector quantity calculated as the product of mass and acceleration (F = m × a).",
    example: "A gravitational force pulls the falling stone towards the center of the Earth.",
    synonyms: ["thrust", "push", "pull", "pressure", "effort"]
  },
  pressure: {
    word: "pressure",
    phonetic: "/ˈpreʃ.ər/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "Continuous physical force exerted on or against an object per unit area over which that force is distributed (P = F / A).",
    example: "Atmospheric pressure decreases as altitude above sea level increases.",
    synonyms: ["compression", "tension", "stress", "force per unit area"]
  },
  density: {
    word: "density",
    phonetic: "/ˈden.sə.ti/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "The degree of compactness of a substance, defined as its mass per unit volume (ρ = m / V).",
    example: "Lead has a high density of 11.3 g/cm³, causing it to sink rapidly in water.",
    synonyms: ["compactness", "solidity", "specific gravity"]
  },
  mass: {
    word: "mass",
    phonetic: "/mæs/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "A fundamental measure of the amount of matter in an object, measured in kilograms (kg) in the SI system, constant regardless of location.",
    example: "The astronaut's mass remains 75 kg whether on the Earth or on the Moon.",
    synonyms: ["matter", "bulk", "substance", "inertia"]
  },
  weight: {
    word: "weight",
    phonetic: "/weɪt/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "The gravitational force exerted on an object's mass (W = m × g), measured in Newtons (N).",
    example: "Due to lower lunar gravity, weight on the Moon is about one-sixth of that on Earth.",
    synonyms: ["heaviness", "gravitational pull", "load"]
  },
  velocity: {
    word: "velocity",
    phonetic: "/vəˈlɒs.ə.ti/",
    partOfSpeech: "noun",
    category: "Kinematics",
    definition: "The speed of something in a given direction; the rate of change of displacement with respect to time.",
    example: "The aircraft maintained a constant velocity of 250 m/s heading due north.",
    synonyms: ["speed", "pace", "momentum", "rate of travel"]
  },
  acceleration: {
    word: "acceleration",
    phonetic: "/əkˌsel.əˈreɪ.ʃən/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "The rate of change of velocity per unit time (a = Δv / Δt), measured in meters per second squared (m/s²).",
    example: "Free fall under Earth's gravity experiences an acceleration of approximately 9.8 m/s².",
    synonyms: ["speeding up", "quickening", "hastening"]
  },
  conduction: {
    word: "conduction",
    phonetic: "/kənˈdʌk.ʃən/",
    partOfSpeech: "noun",
    category: "Thermodynamics",
    definition: "The process by which heat or electricity is directly transmitted through a material substance without movement of the material as a whole.",
    example: "Copper is widely used in cookware because of its exceptional thermal conduction.",
    synonyms: ["transmission", "propagation", "transfer"]
  },
  convection: {
    word: "convection",
    phonetic: "/kənˈvek.ʃən/",
    partOfSpeech: "noun",
    category: "Thermodynamics",
    definition: "The movement caused within a fluid by the tendency of hotter and therefore less dense material to rise, and colder, denser material to sink under the influence of gravity.",
    example: "Sea breezes during daytime are driven by convection currents above the heated land.",
    synonyms: ["thermal circulation", "fluid flow"]
  },
  radiation: {
    word: "radiation",
    phonetic: "/ˌreɪ.diˈeɪ.ʃən/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "The emission or transmission of energy in the form of electromagnetic waves or moving subatomic particles through space or a material medium.",
    example: "Solar radiation travels through the vacuum of space to warm the Earth.",
    synonyms: ["emission", "radiance", "electromagnetic waves"]
  },
  electrostatics: {
    word: "electrostatics",
    phonetic: "/ɪˌlek.troʊˈstæt.ɪks/",
    partOfSpeech: "noun",
    category: "Electricity",
    definition: "The branch of physics that studies electric charges at rest and the forces, fields, and potentials associated with them.",
    example: "Rubbing a balloon against dry wool demonstrates electrostatics by creating an imbalance of electrons.",
    synonyms: ["static electricity", "charge physics"]
  },
  diffusion: {
    word: "diffusion",
    phonetic: "/dɪˈfjuː.ʒən/",
    partOfSpeech: "noun",
    category: "Science",
    definition: "The net movement of particles from a region of higher concentration to a region of lower concentration down a concentration gradient until evenly distributed.",
    example: "The aroma of perfume quickly spreads across the room through molecular diffusion.",
    synonyms: ["dispersion", "spreading", "dissipation", "permeation"]
  },
  capillarity: {
    word: "capillarity",
    phonetic: "/ˌkæp.ɪˈlær.ə.ti/",
    partOfSpeech: "noun",
    category: "Fluid Mechanics",
    definition: "The tendency of a liquid in a narrow tube or absorbent material to rise or fall as a result of surface tension and relative cohesive and adhesive forces.",
    example: "Plant roots draw groundwater upwards through xylem vessels by capillarity.",
    synonyms: ["capillary action", "surface wicking"]
  },
  temperature: {
    word: "temperature",
    phonetic: "/ˈtem.prə.tʃər/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "The degree or intensity of heat present in a substance or object, expressed according to a comparative scale and representing average molecular kinetic energy.",
    example: "Water freezes at 273.15 Kelvin or 0 degrees Celsius at standard atmospheric pressure.",
    synonyms: ["hotness", "coldness", "thermal state"]
  },
  energy: {
    word: "energy",
    phonetic: "/ˈen.ə.dʒi/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "The capacity of a physical system to perform work, existing in various forms such as kinetic, potential, thermal, electrical, and chemical.",
    example: "According to the Law of Conservation of Energy, energy cannot be created or destroyed, only transformed.",
    synonyms: ["power", "force", "dynamism", "work capacity"]
  },
  friction: {
    word: "friction",
    phonetic: "/ˈfrɪk.ʃən/",
    partOfSpeech: "noun",
    category: "Mechanics",
    definition: "The resistance that one surface or object encounters when moving over another.",
    example: "Vehicle brake pads rely on friction to convert kinetic energy into thermal energy and stop the wheels.",
    synonyms: ["resistance", "drag", "abrasion", "traction"]
  },
  hypothesis: {
    word: "hypothesis",
    phonetic: "/haɪˈpɒθ.ə.sɪs/",
    partOfSpeech: "noun",
    category: "Academic",
    definition: "A proposed explanation or supposition made on the basis of limited evidence as a starting point for further investigation or scientific experimentation.",
    example: "The researchers designed a controlled experiment to test their hypothesis regarding thermal conductivity.",
    synonyms: ["theory", "conjecture", "premise", "postulate", "proposition"]
  },
  curriculum: {
    word: "curriculum",
    phonetic: "/kəˈrɪk.jə.ləm/",
    partOfSpeech: "noun",
    category: "Education",
    definition: "The subjects comprising a course of study in a school or college, or the overall educational program outline.",
    example: "The competency-based curriculum emphasizes practical problem solving and scientific inquiry.",
    synonyms: ["syllabus", "course of study", "program", "schedule"]
  },
  algorithm: {
    word: "algorithm",
    phonetic: "/ˈæl.ɡə.rɪ.ðəm/",
    partOfSpeech: "noun",
    category: "Computer Science",
    definition: "A finite, unambiguous sequence of well-defined computer-implementable instructions to solve a class of problems or perform a computation.",
    example: "Binary search is an efficient algorithm with logarithmic time complexity.",
    synonyms: ["procedure", "process", "routine", "formula", "logic"]
  },
  equilibrium: {
    word: "equilibrium",
    phonetic: "/ˌiː.kwɪˈlɪb.ri.əm/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "A state in which opposing forces or influences are balanced, resulting in zero net force and no acceleration.",
    example: "When the upward buoyant force equals the downward gravitational force, the floating ship remains in equilibrium.",
    synonyms: ["balance", "stability", "symmetry", "poise"]
  },
  vector: {
    word: "vector",
    phonetic: "/ˈvek.tər/",
    partOfSpeech: "noun",
    category: "Mathematics / Physics",
    definition: "A quantity having both direction and magnitude, determining the position of one point in space relative to another (e.g., displacement, velocity, force).",
    example: "Force is a vector quantity because specifying its direction is essential to predict movement.",
    synonyms: ["directed quantity", "coordinate"]
  },
  scalar: {
    word: "scalar",
    phonetic: "/ˈskeɪ.lər/",
    partOfSpeech: "noun / adjective",
    category: "Mathematics / Physics",
    definition: "A physical quantity that is completely described by its magnitude alone, with no directional component (e.g., mass, time, temperature, volume).",
    example: "Speed is scalar, whereas velocity includes directional information.",
    synonyms: ["magnitude", "scalar quantity"]
  },
  molecule: {
    word: "molecule",
    phonetic: "/ˈmɒl.ɪ.kjuːl/",
    partOfSpeech: "noun",
    category: "Chemistry / Physics",
    definition: "A group of atoms bonded together, representing the smallest fundamental unit of a chemical compound that can take part in a chemical reaction.",
    example: "A single water molecule consists of two hydrogen atoms covalently bonded to one oxygen atom (H₂O).",
    synonyms: ["particle", "atomic cluster"]
  },
  inertia: {
    word: "inertia",
    phonetic: "/ɪˈnɜː.ʃə/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "The property of matter by which it continues in its existing state of rest or uniform motion in a straight line, unless that state is changed by an external force.",
    example: "Passengers lurch forward when a bus suddenly brakes due to their bodies' inertia.",
    synonyms: ["resistance to change", "inactivity", "sluggishness"]
  },
  magnification: {
    word: "magnification",
    phonetic: "/ˌmæɡ.nɪ.fɪˈkeɪ.ʃən/",
    partOfSpeech: "noun",
    category: "Optics",
    definition: "The degree to which an optical image is enlarged relative to the actual object size, calculated as image height divided by object height (M = hᵢ / hₒ).",
    example: "The convex lens produced a sharp image with a linear magnification of 3.0.",
    synonyms: ["enlargement", "amplification", "scaling factor"]
  },
  reflection: {
    word: "reflection",
    phonetic: "/rɪˈflek.ʃən/",
    partOfSpeech: "noun",
    category: "Optics",
    definition: "The throwing back by a body or surface of light, heat, or sound without absorbing it, governed by the law where angle of incidence equals angle of reflection.",
    example: "Smooth plane mirrors form clear virtual images through regular specular reflection.",
    synonyms: ["rebound", "mirroring", "reverberation", "echoing"]
  },
  refraction: {
    word: "refraction",
    phonetic: "/rɪˈfræk.ʃən/",
    partOfSpeech: "noun",
    category: "Optics",
    definition: "The change in direction and speed of a wave passing from one medium to another of different optical density.",
    example: "A pencil partially submerged in a glass beaker of water appears bent due to refraction.",
    synonyms: ["bending of light", "wave deflection"]
  },
  upthrust: {
    word: "upthrust",
    phonetic: "/ˈʌp.θrʌst/",
    partOfSpeech: "noun",
    category: "Fluid Mechanics",
    definition: "The upward force exerted on an object immersed wholly or partially in a fluid, equal to the weight of the displaced fluid (Archimedes' principle).",
    example: "The upthrust on a boat keeps it buoyant and floating securely on the water surface.",
    synonyms: ["buoyancy", "buoyant force", "lift"]
  },
  insulator: {
    word: "insulator",
    phonetic: "/ˈɪn.sjə.leɪ.tər/",
    partOfSpeech: "noun",
    category: "Electricity / Thermodynamics",
    definition: "A substance or device which does not readily conduct electricity or heat, having very high resistance.",
    example: "Rubber and plastic coating protect technicians as electrical insulators.",
    synonyms: ["non-conductor", "dielectric", "barrier"]
  },
  conductor: {
    word: "conductor",
    phonetic: "/kənˈdʌk.tər/",
    partOfSpeech: "noun",
    category: "Physics",
    definition: "A material or device that transmits heat, electricity, or sound easily due to the presence of free delocalized charge carriers or electrons.",
    example: "Silver and copper are the most conductive metallic electrical conductors.",
    synonyms: ["transmitter", "conduit"]
  }
};

export async function lookupWordDefinition(word: string): Promise<DictionaryEntry> {
  const cleanWord = word.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
  if (!cleanWord) {
    throw new Error("No word provided");
  }

  // 1. Check local offline STEM & Academic dictionary first
  if (OFFLINE_DICTIONARY[cleanWord]) {
    return OFFLINE_DICTIONARY[cleanWord];
  }

  // Check simple plural or tense variations locally (e.g. "pressures" -> "pressure", "forces" -> "force")
  if (cleanWord.endsWith('s') && OFFLINE_DICTIONARY[cleanWord.slice(0, -1)]) {
    return OFFLINE_DICTIONARY[cleanWord.slice(0, -1)];
  }
  if (cleanWord.endsWith('es') && OFFLINE_DICTIONARY[cleanWord.slice(0, -2)]) {
    return OFFLINE_DICTIONARY[cleanWord.slice(0, -2)];
  }
  if (cleanWord.endsWith('ing') && OFFLINE_DICTIONARY[cleanWord.slice(0, -3)]) {
    return OFFLINE_DICTIONARY[cleanWord.slice(0, -3)];
  }
  if (cleanWord.endsWith('ed') && OFFLINE_DICTIONARY[cleanWord.slice(0, -2)]) {
    return OFFLINE_DICTIONARY[cleanWord.slice(0, -2)];
  }

  // 2. If online, fetch from open English dictionary API
  if (navigator.onLine) {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const entry = data[0];
          const phonetic = entry.phonetic || (entry.phonetics && entry.phonetics.find((p: any) => p.text)?.text) || '';
          
          let primaryDef = '';
          let partOfSpeech = '';
          let example = '';
          let synonyms: string[] = [];

          if (entry.meanings && entry.meanings.length > 0) {
            const firstMeaning = entry.meanings[0];
            partOfSpeech = firstMeaning.partOfSpeech || 'noun';
            if (firstMeaning.definitions && firstMeaning.definitions.length > 0) {
              primaryDef = firstMeaning.definitions[0].definition || '';
              example = firstMeaning.definitions[0].example || '';
            }
            if (firstMeaning.synonyms && Array.isArray(firstMeaning.synonyms)) {
              synonyms = firstMeaning.synonyms.slice(0, 5);
            }
          }

          let secondaryDef = '';
          if (entry.meanings.length > 1 && entry.meanings[1].definitions?.[0]?.definition) {
            secondaryDef = `(${entry.meanings[1].partOfSpeech || 'alt'}): ${entry.meanings[1].definitions[0].definition}`;
          }

          return {
            word: entry.word || cleanWord,
            phonetic,
            partOfSpeech,
            category: "General English",
            definition: primaryDef || "A recognized English term.",
            secondaryDefinition: secondaryDef,
            example: example || `The student encountered the term "${cleanWord}" during their chapter study.`,
            synonyms: synonyms.length > 0 ? synonyms : undefined
          };
        }
      }
    } catch (apiErr) {
      console.warn("Dictionary API fetch failed, using fallback:", apiErr);
    }
  }

  // 3. Fallback intelligent heuristic breakdown
  return {
    word: cleanWord,
    phonetic: `/${cleanWord}/`,
    partOfSpeech: "noun / term",
    category: "Academic Context",
    definition: `Academic and reading vocabulary term: "${cleanWord}". Use the Edu AI Tutor for an in-depth contextual explanation based on the current book text.`,
    example: `Understanding "${cleanWord}" reinforces comprehension of key chapter topics.`,
    synonyms: ["concept", "term", "keyword"]
  };
}
