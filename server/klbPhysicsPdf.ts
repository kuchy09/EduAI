import PDFDocument from "pdfkit";

export function generateKLBPhysicsPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        try {
          const range = doc.bufferedPageRange();
          for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fillColor('#64748B');
            doc.fontSize(8).font('Helvetica');
            doc.text(
              `KLB Secondary Physics Form 1  •  Kenya Literature Bureau  •  Page ${i + 1} of ${range.count}`,
              48,
              doc.page.height - 34,
              { align: 'center', width: doc.page.width - 96 }
            );
          }
          resolve(Buffer.concat(chunks));
        } catch (e) {
          resolve(Buffer.concat(chunks));
        }
      });
      doc.on('error', (err) => reject(err));

      const primaryColor = '#0369A1'; // Deep Ocean Blue
      const secondaryColor = '#0F172A'; // Deep Slate Black
      const textColor = '#334155'; // Slate Body
      const boxBorder = '#BAE6FD';
      const boxBg = '#F0F9FF';
      const pageWidth = doc.page.width - 96;

      // Helper function for chapter headers
      const addChapterHeader = (chNum: string, chTitle: string) => {
        doc.rect(48, 48, pageWidth, 3).fill(primaryColor);
        doc.moveDown(1.2);
        doc.fillColor(primaryColor);
        doc.fontSize(9.5).font('Helvetica-Bold').text(chNum.toUpperCase(), { characterSpacing: 1.5 });
        doc.moveDown(0.2);
        doc.fillColor(secondaryColor);
        doc.fontSize(16).font('Helvetica-Bold').text(chTitle, { lineGap: 3 });
        doc.moveDown(0.8);
      };

      // Helper for callout box
      const drawCallout = (title: string, content: string, borderColor = boxBorder, bgColor = boxBg, titleColor = '#0284C7') => {
        const startY = doc.y;
        doc.fontSize(9).font('Helvetica-Oblique');
        const textHeight = doc.heightOfString(content, { width: pageWidth - 24, lineGap: 3 });
        const totalHeight = textHeight + 30;

        doc.rect(48, startY, pageWidth, totalHeight).fillAndStroke(bgColor, borderColor);
        doc.fillColor(titleColor);
        doc.fontSize(9).font('Helvetica-Bold').text(title.toUpperCase(), 60, startY + 8);
        doc.fillColor(textColor);
        doc.fontSize(9).font('Helvetica').text(content, 60, startY + 22, { width: pageWidth - 24, lineGap: 3 });
        doc.y = startY + totalHeight + 10;
      };

      // Helper for section header
      const addSectionHeader = (title: string) => {
        doc.fillColor(secondaryColor);
        doc.fontSize(11).font('Helvetica-Bold').text(title);
        doc.moveDown(0.3);
      };

      // =========================================================================
      // PAGE 1: TITLE & OFFICIAL CURRICULUM OVERVIEW
      // =========================================================================
      doc.rect(48, 48, pageWidth, 5).fill('#0284C7');
      doc.moveDown(2);

      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('KENYA LITERATURE BUREAU (KLB)', { characterSpacing: 2 });
      doc.moveDown(0.4);

      doc.fillColor('#0F172A');
      doc.fontSize(22).font('Helvetica-Bold').text('SECONDARY PHYSICS', { lineGap: 2 });
      doc.fontSize(16).font('Helvetica-Bold').text('STUDENT\'S BOOK ONE (FORM 1)', { lineGap: 4 });
      doc.moveDown(0.3);

      doc.fillColor('#475569');
      doc.fontSize(11).font('Helvetica-Oblique').text('Fully Aligned with the Kenyan Secondary & CBC Curriculum Guidelines');
      doc.moveDown(1.2);

      // Metadata card
      doc.rect(48, doc.y, pageWidth, 58).fillAndStroke('#F8FAFC', '#CBD5E1');
      const metaY = doc.y + 10;
      doc.fillColor('#0F172A');
      doc.fontSize(9).font('Helvetica-Bold').text('Publisher:', 60, metaY);
      doc.font('Helvetica').text('Kenya Literature Bureau, Nairobi', 125, metaY);
      doc.font('Helvetica-Bold').text('Approved by:', 300, metaY);
      doc.font('Helvetica').text('KICD (Kenya Inst. of Curriculum Dev.)', 375, metaY);

      doc.font('Helvetica-Bold').text('Level & Pathway:', 60, metaY + 16);
      doc.font('Helvetica').text('Secondary Form 1 / Junior Grade 9-10', 145, metaY + 16);
      doc.font('Helvetica-Bold').text('Series Edition:', 300, metaY + 16);
      doc.font('Helvetica').text('Fourth Revised Edition', 375, metaY + 16);

      doc.font('Helvetica-Bold').text('Interactive Tools:', 60, metaY + 32);
      doc.font('Helvetica').text('Integrated with Edu AI Study & Formula Solver', 150, metaY + 32);

      doc.y = metaY + 54;
      doc.moveDown(1.2);

      doc.fillColor('#0F172A');
      doc.fontSize(13).font('Helvetica-Bold').text('Table of Contents');
      doc.moveDown(0.5);

      const chaptersList = [
        { num: 'Chapter 1', name: 'Introduction to Physics (Branches, Careers & Lab Safety)', page: '2' },
        { num: 'Chapter 2', name: 'Measurement I (Length, Area, Volume, Mass & Density)', page: '3' },
        { num: 'Chapter 3', name: 'Force (Types of Force, Weight, Friction & Surface Tension)', page: '4' },
        { num: 'Chapter 4', name: 'Pressure (Solids, Liquids, Pascal\'s Principle & Atmospheric)', page: '5' },
        { num: 'Chapter 5', name: 'Particulate Nature of Matter (Kinetic Theory, Brownian Motion)', page: '6' },
        { num: 'Chapter 6', name: 'Thermal Expansion (Thermometers, Bimetallic Strips & Water)', page: '7' },
        { num: 'Chapter 7', name: 'Heat Transfer (Conduction, Convection, Radiation & Flasks)', page: '8' },
        { num: 'Chapter 8', name: 'Rectilinear Propagation of Light & Reflection at Plane Surfaces', page: '9' },
        { num: 'Chapter 9', name: 'Electrostatics I (Charges, Gold-Leaf Electroscope & Lightning)', page: '10' },
        { num: 'Chapter 10', name: 'Cells and Simple Circuits (Primary & Secondary Cells, Circuits)', page: '11' },
      ];

      chaptersList.forEach((ch) => {
        doc.fillColor('#1E293B');
        doc.fontSize(9).font('Helvetica-Bold').text(ch.num, 60, doc.y, { continued: true });
        doc.font('Helvetica').text(`  —  ${ch.name}`, { continued: true });
        doc.font('Helvetica-Bold').text(` .......... Pg ${ch.page}`, { align: 'right' });
        doc.moveDown(0.4);
      });

      // =========================================================================
      // PAGE 2: CHAPTER 1 - INTRODUCTION TO PHYSICS
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 1', 'Introduction to Physics');

      drawCallout(
        'Definition of Physics',
        'Physics is the branch of science concerned with the study of matter and its relation to energy. It explores the fundamental rules governing the physical universe, from subatomic particles to galaxies.'
      );

      addSectionHeader('1.1 Main Branches of Physics');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '1. Mechanics: The study of the motion of bodies under the influence of forces (e.g. kinematics, dynamics, gravitation).\n' +
        '2. Electricity and Magnetism: The study of stationary and moving electric charges and their associated magnetic fields.\n' +
        '3. Thermodynamics (Heat): The study of temperature, heat transfer, and the transformation between heat and mechanical work.\n' +
        '4. Geometrical and Physical Optics: The study of the nature, propagation, and behavior of light (reflection, refraction, lenses).\n' +
        '5. Waves: The study of the propagation of energy through oscillations in material media or electromagnetic disturbances.\n' +
        '6. Atomic and Nuclear Physics: The study of the structure of atoms, radioactive decay, and nuclear energy generation.',
        { lineGap: 3 }
      );
      doc.moveDown(0.8);

      addSectionHeader('1.2 Relationship Between Physics and Other Disciplines');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '• Mathematics: Mathematics is the indispensable language and computational toolkit of physics. Formulas and graphs express physical laws with quantitative precision.\n' +
        '• Chemistry: Atomic models, bonding forces, crystal structures, and electrochemistry rely directly on physics principles.\n' +
        '• Biology: Optics in the mammalian eye, microscopes, blood pressure hydrodynamics, and cellular diffusion are grounded in physics.\n' +
        '• Geography & Meteorology: Weather forecasting, atmospheric pressure measurements, hydrological cycles, and seismology use physics.',
        { lineGap: 3 }
      );
      doc.moveDown(0.8);

      addSectionHeader('1.3 Career Opportunities & Laboratory Safety Rules');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        'Career Paths: Civil, Electrical, and Mechanical Engineering; Medicine and Radiology; Aviation and Astronomy; Geophysics and Renewable Energy Systems.\n\n' +
        'Key Laboratory Safety Rules:\n' +
        '1. Never enter the laboratory or handle apparatus without the instructor\'s permission.\n' +
        '2. Report all spills, breakages, or electrical faults immediately to the teacher.\n' +
        '3. Always wash hands thoroughly after practical sessions and ensure all electrical switches are turned off.',
        { lineGap: 3 }
      );

      // =========================================================================
      // PAGE 3: CHAPTER 2 - MEASUREMENT I
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 2', 'Measurement I');

      drawCallout(
        'Fundamental Physical Quantities & SI Units',
        'A physical quantity is a measurable property of a phenomenon or body. Basic (fundamental) quantities cannot be obtained from any other physical quantities. All other quantities are derived.'
      );

      addSectionHeader('2.1 Standard SI Units Table');
      const siTop = doc.y;
      doc.rect(48, siTop, pageWidth, 16).fill('#E2E8F0');
      doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Basic Quantity', 56, siTop + 4);
      doc.text('SI Unit Name', 190, siTop + 4);
      doc.text('Symbol', 320, siTop + 4);
      doc.text('Primary Measuring Instrument', 390, siTop + 4);

      const siData = [
        { q: 'Length', u: 'Metre', s: 'm', i: 'Metre rule, Vernier Callipers' },
        { q: 'Mass', u: 'Kilogram', s: 'kg', i: 'Beam balance, Electronic balance' },
        { q: 'Time', u: 'Second', s: 's', i: 'Stopwatch, Digital timer' },
        { q: 'Electric Current', u: 'Ampere', s: 'A', i: 'Ammeter' },
        { q: 'Thermodynamic Temp.', u: 'Kelvin', s: 'K', i: 'Liquid-in-glass Thermometer' },
        { q: 'Amount of Substance', u: 'Mole', s: 'mol', i: 'Calculated via Avogadro constant' },
      ];

      let siCurrY = siTop + 16;
      siData.forEach((row, idx) => {
        doc.rect(48, siCurrY, pageWidth, 15).fillAndStroke(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC', '#E2E8F0');
        doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold').text(row.q, 56, siCurrY + 3);
        doc.font('Helvetica').text(row.u, 190, siCurrY + 3);
        doc.text(row.s, 320, siCurrY + 3);
        doc.text(row.i, 390, siCurrY + 3);
        siCurrY += 15;
      });

      doc.y = siCurrY + 10;
      doc.moveDown(0.5);

      addSectionHeader('2.2 Density & Measurement of Volume');
      drawCallout(
        'Density Formula & Conversion',
        'Density (rho) is defined as mass per unit volume:\n  Density (rho) = Mass (m) / Volume (V)\nSI Unit: kg/m^3. Alternative Unit: g/cm^3. Conversion: 1 g/cm^3 = 1,000 kg/m^3.'
      );

      doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold').text('Worked Example 2.1:');
      doc.font('Helvetica').text(
        'A rectangular block of brass measures 5 cm by 4 cm by 2 cm and has a mass of 168 g. Calculate its density in: (a) g/cm^3  (b) kg/m^3\n' +
        'Solution:\n' +
        'Volume = 5 cm x 4 cm x 2 cm = 40 cm^3\n' +
        '(a) Density = Mass / Volume = 168 g / 40 cm^3 = 4.20 g/cm^3\n' +
        '(b) Density in kg/m^3 = 4.20 x 1,000 = 4,200 kg/m^3.',
        { lineGap: 2.5 }
      );

      // =========================================================================
      // PAGE 4: CHAPTER 3 - FORCE
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 3', 'Force');

      drawCallout(
        'Definition & Effects of Force',
        'A force is a push or pull exerted on an object. SI Unit: Newton (N). It is a vector quantity (has both magnitude and direction). Effects include changing speed, direction, shape (deformation), or state of motion.'
      );

      addSectionHeader('3.1 Classification of Forces');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '1. Gravitational Force (Weight): The pull of gravity on an object. W = m x g, where g = 10 N/kg on Earth.\n' +
        '2. Tension & Compression: Forces developed in stretched ropes or compressed springs.\n' +
        '3. Upthrust: Upward force exerted by a fluid on an object wholly or partially immersed in it.\n' +
        '4. Frictional Force: Force that opposes relative motion between two surfaces in contact.\n' +
        '5. Electrostatic & Magnetic Forces: Non-contact forces between charges or magnetic poles.',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      addSectionHeader('3.2 Cohesion, Adhesion, Surface Tension & Capillarity');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '• Cohesion: Force of attraction between molecules of the same kind (e.g. water-water molecules).\n' +
        '• Adhesion: Force of attraction between molecules of different kinds (e.g. water-glass molecules).\n' +
        '• Surface Tension: The force per unit length acting on the surface of a liquid perpendicular to an imaginary line drawn on the surface. It causes liquid surfaces to contract into minimum surface area (spherical droplets).\n' +
        '  - Effects of Temperature: Increasing temperature reduces surface tension.\n' +
        '  - Effects of Impurities: Adding soap or detergents weakens surface tension.\n' +
        '• Capillarity: The rise or depression of a liquid in a narrow bore tube. Water rises because adhesion > cohesion (concave meniscus); mercury depresses because cohesion > adhesion (convex meniscus).',
        { lineGap: 3 }
      );

      // =========================================================================
      // PAGE 5: CHAPTER 4 - PRESSURE
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 4', 'Pressure');

      drawCallout(
        'Definition of Pressure',
        'Pressure is defined as force acting perpendicularly per unit area:\n  Pressure (P) = Force (F) / Area (A)\nSI Unit: Pascal (Pa), where 1 Pa = 1 N/m^2.'
      );

      addSectionHeader('4.1 Pressure in Solids & Liquids');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '• Pressure in Solids: Maximum pressure occurs when contact area is minimum (e.g. sharp knife, syringe needle); minimum pressure occurs over a large area (e.g. tractor wide tires, snowshoes).\n' +
        '• Pressure in Liquids Formula: P = rho x g x h\n' +
        '  where rho = liquid density (kg/m^3), g = 10 N/kg, h = depth below surface (m).\n' +
        '• Properties: Liquid pressure increases with depth, is directly proportional to liquid density, and acts equally in all directions at the same depth.',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      addSectionHeader('4.2 Transmission of Pressure in Liquids (Pascal\'s Principle)');
      drawCallout(
        'Pascal\'s Principle & Hydraulic Machines',
        'Pressure applied to an enclosed liquid is transmitted equally and undiminished to all portions of the liquid and the container walls.\n  Formula: F1 / A1 = F2 / A2  =>  F2 = F1 x (A2 / A1)\nApplications: Hydraulic car brakes, hydraulic press, car jack.'
      );

      addSectionHeader('4.3 Atmospheric Pressure & Instruments');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        'Standard atmospheric pressure at sea level = 760 mmHg = 101,325 Pa = 1.013 x 10^5 Pa.\n' +
        '• Instruments: Simple Mercury Barometer, Fortin Barometer, Aneroid Barometer (portable, no liquid), U-tube Manometer.\n' +
        '• Applications: Drinking straw, rubber suction cup, medical syringe, lift pump, force pump, and siphon.',
        { lineGap: 3 }
      );

      // =========================================================================
      // PAGE 6: CHAPTER 5 - PARTICULATE NATURE OF MATTER
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 5', 'Particulate Nature of Matter');

      drawCallout(
        'The Kinetic Theory of Matter',
        'All matter is composed of tiny, discrete particles (atoms or molecules) which are in a state of continuous, random motion. The temperature of a substance is a measure of the average kinetic energy of its particles.'
      );

      addSectionHeader('5.1 States of Matter Comparison');
      const stateTop = doc.y;
      doc.rect(48, stateTop, pageWidth, 16).fill('#E2E8F0');
      doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold');
      doc.text('State', 56, stateTop + 4);
      doc.text('Particle Arrangement', 120, stateTop + 4);
      doc.text('Intermolecular Forces', 280, stateTop + 4);
      doc.text('Motion', 420, stateTop + 4);

      const stateData = [
        { s: 'Solid', a: 'Closely packed in fixed lattice', f: 'Very strong attractive forces', m: 'Vibrate about fixed positions' },
        { s: 'Liquid', a: 'Loosely arranged, small gaps', f: 'Moderate attractive forces', m: 'Slide and roll past each other' },
        { s: 'Gas', a: 'Far apart, large spaces', f: 'Negligible forces of attraction', m: 'Rapid, random linear motion' },
      ];

      let stCurrY = stateTop + 16;
      stateData.forEach((row, idx) => {
        doc.rect(48, stCurrY, pageWidth, 16).fillAndStroke(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC', '#E2E8F0');
        doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold').text(row.s, 56, stCurrY + 4);
        doc.font('Helvetica').text(row.a, 120, stCurrY + 4);
        doc.text(row.f, 280, stCurrY + 4);
        doc.text(row.m, 420, stCurrY + 4);
        stCurrY += 16;
      });

      doc.y = stCurrY + 12;
      doc.moveDown(0.5);

      addSectionHeader('5.2 Experimental Evidence of Particulate Motion');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '1. Brownian Motion: Observed by Robert Brown (1827). Demonstrated in the laboratory using a smoke cell viewed under a microscope. Bright specks of smoke execute continuous, random zigzag movements due to uneven collisions with invisible air molecules.\n' +
        '2. Diffusion: The spontaneous movement of particles from a region of higher concentration to a region of lower concentration until uniformly distributed.\n' +
        '   - Diffusion in Gases: e.g. Diffusion of ammonia (NH3) and hydrogen chloride (HCl) in a glass tube forming a white ring of ammonium chloride nearer the denser HCl end.\n' +
        '   - Diffusion in Liquids: e.g. Dissolution and spreading of potassium permanganate crystal in water.',
        { lineGap: 3 }
      );

      // =========================================================================
      // PAGE 7: CHAPTER 6 - THERMAL EXPANSION
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 6', 'Thermal Expansion');

      drawCallout(
        'Heat vs Temperature',
        '• Temperature: The degree of hotness or coldness of a body. Measured in Kelvin (K) or degrees Celsius (°C).\n• Heat: A form of thermal energy transferred from a body of higher temperature to one of lower temperature. Measured in Joules (J).'
      );

      addSectionHeader('6.1 Thermometers & Thermometric Liquids');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        'Comparison of Mercury and Alcohol:\n' +
        '• Mercury: High boiling point (357°C), good thermal conductor, opaque and easily visible, does not wet glass, expands uniformly.\n' +
        '• Alcohol: Low freezing point (-115°C, suitable for polar regions), higher expansion rate, non-toxic, but wets glass and has lower boiling point (78°C).\n' +
        '• Clinical Thermometer: Features a constriction near the bulb that prevents backflow of mercury when removed from the patient, allowing accurate readings.',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      addSectionHeader('6.2 Applications of Expansion & The Bimetallic Strip');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '• Bimetallic Strip: Made of two different metals (e.g. brass and iron) welded together. On heating, brass expands more than iron, causing the strip to bend towards the iron. Used in thermostats (electric irons, refrigerators, water heaters) and fire alarm switches.\n' +
        '• Other Engineering Applications: Expansion gaps in railway tracks, rollers under long steel bridges, riveting of hot steel plates.',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      addSectionHeader('6.3 Anomalous Expansion of Water (0°C to 4°C)');
      drawCallout(
        'Biological Significance of Water\'s Anomalous Behavior',
        'Water contracts when heated from 0°C to 4°C, reaching maximum density (1,000 kg/m^3) at 4°C, and expands when cooled from 4°C to 0°C.\nImportance: In cold winters, frozen ice floats on top of lakes (acting as an insulating blanket), while dense water remains at 4°C at the bottom, sustaining aquatic life.',
        '#BBF7D0',
        '#F0FDF4',
        '#166534'
      );

      // =========================================================================
      // PAGE 8: CHAPTER 7 - HEAT TRANSFER
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 7', 'Heat Transfer');

      drawCallout(
        'Three Modes of Heat Transfer',
        'Heat energy is naturally transferred through three distinct mechanisms: Conduction (solids), Convection (fluids: liquids & gases), and Radiation (electromagnetic waves through space/vacuum).'
      );

      addSectionHeader('7.1 Conduction, Convection & Radiation Breakdown');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '1. Conduction: Transfer of heat through matter without visible movement of the material as a whole. Occurs via lattice vibrations and free electron diffusion. Good conductors: Copper, Aluminium, Silver. Poor conductors (insulators): Wood, Glass, Plastic, Air.\n' +
        '2. Convection: Transfer of heat through fluids by the actual circulatory movement of the heated fluid due to density differences.\n' +
        '   - Sea Breeze (Daytime): Land heats up faster than water; warm air rises over land, and cool air blows from the sea towards the land.\n' +
        '   - Land Breeze (Nighttime): Land cools faster; warm air over the sea rises, and cool breeze blows from the land towards the sea.\n' +
        '   - Domestic hot water systems and building ventilation chimneys rely on convection.\n' +
        '3. Radiation: Transfer of heat via electromagnetic infrared radiation requiring no material medium.\n' +
        '   - Dull black surfaces are the best absorbers and best emitters of thermal radiation.\n' +
        '   - Highly polished, shiny silver surfaces are the best reflectors and poorest emitters.',
        { lineGap: 3 }
      );
      doc.moveDown(0.8);

      addSectionHeader('7.2 The Vacuum (Thermos) Flask');
      drawCallout(
        'Design of the Vacuum Flask',
        '• Double-walled glass container with a vacuum between walls: Eliminates conduction and convection.\n• Silvered inner surfaces of the walls: Minimizes heat transfer by radiation by reflecting radiant heat.\n• Insulated cork/plastic stopper & pad: Prevents heat loss via conduction and evaporation.'
      );

      // =========================================================================
      // PAGE 9: CHAPTER 8 - RECTILINEAR PROPAGATION & REFLECTION
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 8', 'Rectilinear Propagation of Light & Plane Reflection');

      drawCallout(
        'Rectilinear Propagation of Light',
        'Light is a form of radiant energy that travels in straight lines in a homogeneous transparent medium. Shadows and eclipses (solar and lunar) are direct consequences of rectilinear propagation.'
      );

      addSectionHeader('8.1 The Pinhole Camera & Magnification');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        'A pinhole camera forms an inverted, real image on the screen.\n' +
        'Magnification (M) = Height of Image (hi) / Height of Object (ho) = Image Distance (v) / Object Distance (u).\n' +
        'Factors affecting the image: Increasing pinhole size makes image brighter but blurred; moving object closer increases image size.',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      addSectionHeader('8.2 Laws of Reflection at Plane Surfaces');
      drawCallout(
        'The Two Laws of Reflection',
        '1. The incident ray, the reflected ray, and the normal to the surface at the point of incidence all lie in the same plane.\n2. The angle of incidence (i) is equal to the angle of reflection (r):  Angle i = Angle r.'
      );

      addSectionHeader('8.3 Characteristics of Images in Plane Mirrors');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '1. The image is virtual (cannot be formed on a screen).\n' +
        '2. The image is upright (erect).\n' +
        '3. The image is laterally inverted (left appears right).\n' +
        '4. Image size is equal to object size (Magnification = 1).\n' +
        '5. Image distance behind mirror equals object distance in front of mirror (v = u).\n' +
        '• Applications: Periscopes (two plane mirrors at 45° for submarines and trench observation), kaleidoscopes.',
        { lineGap: 3 }
      );

      // =========================================================================
      // PAGE 10: CHAPTER 9 - ELECTROSTATICS I
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 9', 'Electrostatics I');

      drawCallout(
        'Fundamental Law of Electrostatics',
        'Matter contains positive charges (protons) and negative charges (electrons). Like charges repel each other; unlike charges attract each other.'
      );

      addSectionHeader('9.1 Methods of Charging Bodies');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '1. Charging by Friction: Rubbing transfers electrons from one material to another (e.g. polythene gains electrons and becomes negative; acetate/glass loses electrons and becomes positive).\n' +
        '2. Charging by Contact (Conduction): Touching a neutral body with a charged body shares the charge.\n' +
        '3. Charging by Electrostatic Induction: Bringing a charged body near an insulated conductor, earthing the conductor, and removing the earth wire before removing the charged body gives the conductor an opposite charge.',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      addSectionHeader('9.2 The Gold-Leaf Electroscope & Lightning');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '• Structure: Metal cap, conducting brass rod, delicate gold leaf, metal case with glass windows, insulated ebonite plug, earthed case.\n' +
        '• Uses of Electroscope:\n' +
        '  (a) Detecting the presence of electrostatic charge.\n' +
        '  (b) Identifying the type/sign of charge on a body (using divergence of the leaf).\n' +
        '  (c) Testing whether a material is an electrical conductor or insulator.\n' +
        '• Lightning & Lightning Arrestors: In thunderclouds, friction between water droplets builds massive static charges. Lightning is a giant spark discharge to ground. Lightning arrestors use sharp copper spikes on building roofs to safely bleed ions into the atmosphere and direct surges to earth.',
        { lineGap: 3 }
      );

      // =========================================================================
      // PAGE 11: CHAPTER 10 - CELLS AND SIMPLE CIRCUITS
      // =========================================================================
      doc.addPage();
      addChapterHeader('Chapter 10', 'Cells and Simple Circuits');

      drawCallout(
        'Electric Current & Potential Difference',
        'Electric current (I) is the rate of flow of electric charge (Q):\n  Current (I) = Charge (Q) / Time (t)  =>  Q = I x t\nSI Unit of Current: Ampere (A). SI Unit of Charge: Coulomb (C). Potential difference (voltage V) is measured in Volts (V).'
      );

      addSectionHeader('10.1 Primary vs Secondary Cells');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '• Primary Cells: Convert chemical energy directly into electrical energy; cannot be recharged.\n' +
        '  - Simple Cell Defects:\n' +
        '    1. Polarization: Hydrogen gas bubbles accumulate on copper anode, increasing resistance. Prevented by adding depolarizing agent (potassium dichromate).\n' +
        '    2. Local Action: Impurities in commercial zinc corrode in acid. Prevented by amalgamating zinc with mercury.\n' +
        '  - Dry Cell: Zinc can (anode), carbon rod (cathode), ammonium chloride paste electrolyte, manganese(IV) oxide depolarizer.\n' +
        '• Secondary Cells: Rechargeable accumulators (e.g. Lead-Acid Battery: Lead dioxide positive plate, spongy lead negative plate, dilute sulfuric acid electrolyte).',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      addSectionHeader('10.2 Series and Parallel Circuit Connections');
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(
        '• Series Circuit: Current is identical through all components (I_total = I1 = I2). Total voltage is the sum of individual voltages (V_total = V1 + V2). If one bulb blows, the whole circuit opens.\n' +
        '• Parallel Circuit: Voltage across each branch is identical (V_total = V1 = V2). Total current is divided among branches (I_total = I1 + I2). Bulbs can be switched independently without affecting other branches.',
        { lineGap: 3 }
      );

      // =========================================================================
      // PAGE 12: REVISION TEST & CONSTANTS
      // =========================================================================
      doc.addPage();
      addChapterHeader('Assessment', 'Comprehensive Formative Review & KCSE Practice');

      doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold').text('Section A: Conceptual & Structured Questions');
      doc.font('Helvetica').text(
        '1. Explain why water is not suitable as a thermometric liquid in liquid-in-glass thermometers. (2 marks)\n' +
        '2. A stone of mass 360 g is completely immersed in a Eureka can filled with water. 120 cm^3 of water overflows into a measuring cylinder. Determine the density of the stone in kg/m^3. (3 marks)\n' +
        '3. State Pascal\'s principle of transmission of pressure in liquids and describe one everyday application. (2 marks)\n' +
        '4. Why does a bimetallic strip made of brass and iron bend towards the iron when heated? (2 marks)\n' +
        '5. Distinguish between polarization and local action in a simple electric cell, and state how each defect is minimized. (4 marks)',
        { lineGap: 3 }
      );
      doc.moveDown(0.8);

      doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold').text('Section B: Numerical & Experimental Calculations');
      doc.font('Helvetica').text(
        '6. A hydraulic lift has a small piston of cross-sectional area 0.02 m^2 and a large piston of area 1.5 m^2. Calculate the force required on the small piston to lift a car of mass 1,200 kg. (Take g = 10 N/kg). (4 marks)\n' +
        '7. A pinhole camera of length 20 cm is placed 5.0 m from a tree of height 15 m. Calculate the height of the image formed on the screen. (3 marks)',
        { lineGap: 3 }
      );
      doc.moveDown(1);

      doc.rect(48, doc.y, pageWidth, 46).fillAndStroke('#F1F5F9', '#CBD5E1');
      const endBoxY = doc.y + 8;
      doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold').text('Fundamental Physical Constants for Reference', doc.page.width / 2, endBoxY, { align: 'center' });
      doc.fillColor('#475569').fontSize(8).font('Helvetica').text(
        'Acceleration due to gravity (g) = 10 N/kg (or 9.8 m/s^2)  •  Density of pure water = 1,000 kg/m^3\nAtmospheric Pressure (sea level) = 1.013 x 10^5 Pa (760 mmHg)  •  Speed of light in vacuum = 3.0 x 10^8 m/s',
        doc.page.width / 2,
        endBoxY + 14,
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
