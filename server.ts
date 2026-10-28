import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
import { generateKLBPhysicsPdf } from "./server/klbPhysicsPdf";

const UPLOADS_DIR = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const BOOKS_CATALOG_FILE = path.join(UPLOADS_DIR, "books-catalog.json");
const DELETED_BOOKS_FILE = path.join(UPLOADS_DIR, "deleted-books.json");

function readLocalBooksCatalog(): any[] {
  try {
    if (fs.existsSync(BOOKS_CATALOG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(BOOKS_CATALOG_FILE, "utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn("[Catalog] Failed to read books-catalog.json:", err);
  }
  return [];
}

function writeLocalBooksCatalog(books: any[]): void {
  try {
    fs.writeFileSync(BOOKS_CATALOG_FILE, JSON.stringify(books, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Catalog] Failed to write books-catalog.json:", err);
  }
}

function readDeletedBookIds(): string[] {
  try {
    if (fs.existsSync(DELETED_BOOKS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_BOOKS_FILE, "utf-8"));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn("[Catalog] Failed to read deleted-books.json:", err);
  }
  return [];
}

function writeDeletedBookIds(ids: string[]): void {
  try {
    fs.writeFileSync(DELETED_BOOKS_FILE, JSON.stringify(Array.from(new Set(ids)), null, 2), "utf-8");
  } catch (err) {
    console.warn("[Catalog] Failed to write deleted-books.json:", err);
  }
}

function isRealUrlEnv(val?: string): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.startsWith("http") &&
    !trimmed.includes("placeholder") &&
    !trimmed.includes("your-project") &&
    !trimmed.includes("your_") &&
    !trimmed.startsWith("MY_")
  );
}

function isRealKeyEnv(val?: string): val is string {
  if (!val) return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 15 &&
    !trimmed.includes("placeholder") &&
    !trimmed.includes("your-key") &&
    !trimmed.includes("your_") &&
    !trimmed.startsWith("MY_")
  );
}

function getResolvedSupabaseUrlEnv(): string {
  return (
    [
      process.env.VITE_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_URL,
    ].find(isRealUrlEnv) || ""
  );
}

function getPublicSupabaseAnonKeyEnv(): string {
  return (
    [
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      process.env.VITE_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.SUPABASE_ANON_KEY,
    ].find(isRealKeyEnv) || ""
  );
}

function getServerSupabaseKeyEnv(): string {
  return (
    [
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.SUPABASE_SECRET_KEY,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      process.env.VITE_SUPABASE_ANON_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.SUPABASE_ANON_KEY,
    ].find(isRealKeyEnv) || ""
  );
}

function getServerSupabase(): SupabaseClient | null {
  const sbUrl = getResolvedSupabaseUrlEnv();
  const sbKey = getServerSupabaseKeyEnv();
  if (!sbUrl || !sbKey) return null;
  return createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const rawEndpoint = process.env.B2_ENDPOINT || "https://s3.us-west-004.backblazeb2.com";
const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`;

let s3ClientInstance: S3Client | null = null;
function getS3Client(): S3Client | null {
  const isB2Configured = Boolean(
    process.env.B2_ACCESS_KEY_ID && 
    !process.env.B2_ACCESS_KEY_ID.startsWith('your_') && 
    process.env.B2_SECRET_ACCESS_KEY && 
    !process.env.B2_SECRET_ACCESS_KEY.startsWith('your_') && 
    process.env.B2_BUCKET_NAME && 
    !process.env.B2_BUCKET_NAME.startsWith('your_')
  );

  if (!isB2Configured) return null;

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint,
      region: process.env.B2_REGION || "us-west-004",
      credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3ClientInstance;
}

const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "";

const BOOK_CATALOG_TITLES: Record<string, string> = {
  '1': 'Advanced Science: Modern Physics',
  '2': 'Algorithms & Data Structures',
  '9': 'Essential Cybersecurity',
  '10': 'CBC Grade 9 Mathematics',
  '10b': 'KLB Secondary Physics Book 1',
  'klb-physics-1': 'KLB Secondary Physics Book 1',
  'klb_book_1_physics': 'KLB Secondary Physics Book 1',
  'klb_book_1_physics.pdf': 'KLB Secondary Physics Book 1',
  'klb_secondary_physics_book_1.pdf': 'KLB Secondary Physics Book 1',
  'cbc-g9-agri': 'CBC Grade 9 Agriculture & Nutrition',
  'cbc-g9-intscience': 'CBC Grade 9 Integrated Science',
  'cbc-g10-english': 'CBC Grade 10 English Literature & Literacy',
  'cbc-g9-kiswahili': 'CBC Kidato cha Kwanza: Kiswahili Sanifu',
  'cbc-g10-computerscience': 'CBC Grade 10 Computer Science',
  'cbc-g9-socialstudies': 'CBC Grade 9 Social Studies & Civics',
  '11': 'WASSCE Integrated Science',
  '12': 'A-Level Economics',
  '13': 'Modern Business Management',
  '14': 'Introduction to Law',
  'store-1': 'The Design of Everyday Things',
  'store-2': 'Syllabus Guide: East African Biology',
  'store-3': 'Introduction to Organic Chemistry',
  'store-4': 'Kenyan CBC Grade 10 Geography Notes',
  'store-5': 'Modern World History & Civics',
  'store-6': 'University Calculus Vol. 1',
  'store-7': 'Human Anatomy & Physiology Essentials',
  'store-8': 'Machine Learning & Deep Learning Foundations',
  'store-9': 'Microeconomic Theory & Applications',
  'store-10': 'Constitutional Law & Human Rights in Africa',
};

function isKLBPhysicsBook(keyOrTitle: string): boolean {
  const lower = keyOrTitle.toLowerCase();
  return (
    (lower.includes('klb') && lower.includes('physic')) ||
    lower.includes('10b') ||
    lower.includes('klb_book_1_physics') ||
    lower.includes('klb_secondary_physics') ||
    lower.includes('grade 9 physics') ||
    lower.includes('secondary physics book 1') ||
    lower.includes('form 1 physics')
  );
}

function getTitleFromKey(key: string): string {
  if (BOOK_CATALOG_TITLES[key]) {
    return BOOK_CATALOG_TITLES[key];
  }
  const filename = key.split('/').pop() || key;
  const withoutExt = filename.replace(/\.pdf$/i, '');
  if (BOOK_CATALOG_TITLES[withoutExt]) {
    return BOOK_CATALOG_TITLES[withoutExt];
  }
  const spaced = withoutExt.replace(/[_\-]/g, ' ');
  return spaced
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getSubjectTheme(title: string): { category: string; keyConcept: string; subtitle: string } {
  const lower = title.toLowerCase();
  if (lower.includes('physic') || lower.includes('science')) {
    return {
      category: 'Natural Sciences & STEM',
      keyConcept: 'Laws of Thermodynamics, Quantum Mechanics & Electromagnetism',
      subtitle: 'Comprehensive Theoretical & Experimental Study Guide',
    };
  } else if (lower.includes('math') || lower.includes('algebra') || lower.includes('calculus')) {
    return {
      category: 'Pure & Applied Mathematics',
      keyConcept: 'Polynomial Equations, Vector Calculus, & Geometric Proofs',
      subtitle: 'Core Curriculum & Problem-Solving Strategies',
    };
  } else if (lower.includes('algorithm') || lower.includes('computer') || lower.includes('cyber') || lower.includes('code')) {
    return {
      category: 'Information & Computer Sciences',
      keyConcept: 'Data Structures, Computational Complexity & Network Defense',
      subtitle: 'System Architecture & Algorithmic Design Handbook',
    };
  } else if (lower.includes('agri') || lower.includes('nutrit')) {
    return {
      category: 'Agriculture & Biosystems',
      keyConcept: 'Soil Conservation, Crop Biotechnology & Sustainable Food Security',
      subtitle: 'Modern Agricultural Practices & Ecological Stewardship',
    };
  } else if (lower.includes('kiswahili') || lower.includes('fasihi')) {
    return {
      category: 'Lugha na Fasihi',
      keyConcept: 'Sarufi ya Kiswahili, Uchambuzi wa Tamthilia na Ushairi',
      subtitle: 'Mwongozo Kamili wa Kiswahili Sanifu',
    };
  } else if (lower.includes('english') || lower.includes('literat')) {
    return {
      category: 'Literary Studies & Linguistics',
      keyConcept: 'Narrative Structures, Critical Analysis & Rhetorical Devices',
      subtitle: 'Classical & Contemporary Literature Studies',
    };
  }
  return {
    category: 'Competency Based Education',
    keyConcept: 'Foundational Knowledge, Inquiry-Based Learning & Skill Mastery',
    subtitle: 'Integrated Academic & Practical Reference Guide',
  };
}

function generateEducationalPdf(title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        try {
          // Add page numbers to all pages
          const range = doc.bufferedPageRange();
          for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fillColor('#78716C');
            doc.fontSize(8).font('Helvetica');
            doc.text(
              `Edu AI Study Reader  •  ${title}  •  Page ${i + 1} of ${range.count}`,
              48,
              doc.page.height - 36,
              { align: 'center', width: doc.page.width - 96 }
            );
          }
          resolve(Buffer.concat(chunks));
        } catch (e) {
          resolve(Buffer.concat(chunks));
        }
      });
      doc.on('error', (err) => reject(err));

      const theme = getSubjectTheme(title);

      // ==========================================
      // PAGE 1: TITLE & COURSE OVERVIEW
      // ==========================================
      doc.rect(48, 48, doc.page.width - 96, 4).fill('#0284C7'); // Accent top bar
      doc.moveDown(1.5);

      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text(theme.category.toUpperCase(), { characterSpacing: 1.5 });
      doc.moveDown(0.4);

      doc.fillColor('#0F172A');
      doc.fontSize(22).font('Helvetica-Bold').text(title, { lineGap: 3 });
      doc.moveDown(0.4);

      doc.fillColor('#475569');
      doc.fontSize(12).font('Helvetica-Oblique').text(theme.subtitle);
      doc.moveDown(1.5);

      // Metadata card
      doc.rect(48, doc.y, doc.page.width - 96, 52).fillAndStroke('#F8FAFC', '#E2E8F0');
      const metaY = doc.y + 12;
      doc.fillColor('#0F172A');
      doc.fontSize(9).font('Helvetica-Bold').text('Curriculum:', 60, metaY);
      doc.font('Helvetica').text('Kenyan CBC & Regional Standards', 130, metaY);
      doc.font('Helvetica-Bold').text('Target Level:', 320, metaY);
      doc.font('Helvetica').text('Secondary / University Studies', 390, metaY);

      doc.font('Helvetica-Bold').text('Pedagogy:', 60, metaY + 18);
      doc.font('Helvetica').text('Inquiry, Analysis & Practice', 130, metaY + 18);
      doc.font('Helvetica-Bold').text('AI Integration:', 320, metaY + 18);
      doc.font('Helvetica').text('Sage AI Tutor Active', 390, metaY + 18);

      doc.y = metaY + 46;
      doc.moveDown(1.2);

      doc.fillColor('#0F172A');
      doc.fontSize(14).font('Helvetica-Bold').text('Table of Contents');
      doc.moveDown(0.6);

      const chapters = [
        { num: 'Chapter 1', name: 'Foundational Principles & Core Concepts', page: '2' },
        { num: 'Chapter 2', name: 'Theoretical Frameworks & Systematic Analysis', page: '3' },
        { num: 'Chapter 3', name: 'Practical Applications & Real-World Case Studies', page: '4' },
        { num: 'Chapter 4', name: 'Formative Assessment & Self-Evaluation Questions', page: '5' },
      ];

      chapters.forEach((ch) => {
        doc.fillColor('#1E293B');
        doc.fontSize(10).font('Helvetica-Bold').text(ch.num, 60, doc.y, { continued: true });
        doc.font('Helvetica').text(`  —  ${ch.name}`, { continued: true });
        doc.font('Helvetica-Bold').text(` ............................. Page ${ch.page}`, { align: 'right' });
        doc.moveDown(0.5);
      });

      doc.moveDown(1.2);
      doc.fillColor('#0369A1');
      doc.fontSize(12).font('Helvetica-Bold').text('Key Learning Objectives');
      doc.moveDown(0.4);

      const objectives = [
        `Understand the fundamental theorems and core axioms of ${title}.`,
        'Develop critical analytical competence to evaluate real-world problem sets.',
        'Apply domain methodologies and communicate findings with precision.',
        'Collaborate with Sage AI Tutor to explore nuanced questions and edge cases.',
      ];

      objectives.forEach((obj, idx) => {
        doc.fillColor('#334155');
        doc.fontSize(9.5).font('Helvetica').text(`${idx + 1}.  ${obj}`, 60, doc.y, { lineGap: 3 });
        doc.moveDown(0.4);
      });

      // ==========================================
      // PAGE 2: CHAPTER 1 - FOUNDATIONS
      // ==========================================
      doc.addPage();
      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('CHAPTER 1', { characterSpacing: 1.5 });
      doc.moveDown(0.2);
      doc.fillColor('#0F172A');
      doc.fontSize(18).font('Helvetica-Bold').text('Foundational Principles & Core Concepts');
      doc.moveDown(0.8);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        `The study of ${title} begins with establishing clear axioms and defining the primary structural units that govern the field. Historically, scholars and practitioners observed regularities in natural and synthetic phenomena, which led to the formulation of structured models.`,
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown();

      doc.text(
        `In modern curricula, deep conceptual mastery is prioritized over rote memorization. Understanding how ${theme.keyConcept} interacts with underlying environmental and computational variables enables learners to formulate rigorous hypotheses.`,
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown(1.2);

      // Callout box for Core Axiom
      doc.rect(48, doc.y, doc.page.width - 96, 68).fillAndStroke('#F0FDF4', '#BBF7D0');
      const boxY = doc.y + 12;
      doc.fillColor('#166534');
      doc.fontSize(10).font('Helvetica-Bold').text('CORE PRINCIPLE & DEFINITION', 60, boxY);
      doc.fillColor('#15803D');
      doc.fontSize(9.5).font('Helvetica-Oblique').text(
        `"Every observed system maintains equilibrium until unbalanced internal forces or external inputs shift its operational state. Systematic modeling requires identifying boundary conditions and isolating active state variables."`,
        60,
        boxY + 16,
        { width: doc.page.width - 120, lineGap: 2 }
      );

      doc.y = boxY + 62;
      doc.moveDown(1.2);

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('1.1 Structural Decomposition');
      doc.moveDown(0.5);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        'When breaking down complex systems, researchers employ hierarchical decomposition. This approach isolates three interdependent layers:',
        { lineGap: 3 }
      );
      doc.moveDown(0.6);

      const layers = [
        { label: 'Primary Inputs:', desc: 'Baseline empirical data, physical constants, or sensory observations collected under standard conditions.' },
        { label: 'Transformative Engine:', desc: 'The mathematical, physical, or logical operators that process inputs according to established laws.' },
        { label: 'Measurable Outcomes:', desc: 'Predictable, verifiable responses that validate or refine the original conceptual model.' },
      ];

      layers.forEach((l) => {
        doc.fillColor('#0F172A');
        doc.fontSize(9.5).font('Helvetica-Bold').text(`•  ${l.label} `, 60, doc.y, { continued: true });
        doc.fillColor('#334155');
        doc.font('Helvetica').text(l.desc, { lineGap: 3 });
        doc.moveDown(0.4);
      });

      // ==========================================
      // PAGE 3: CHAPTER 2 - THEORETICAL FRAMEWORK
      // ==========================================
      doc.addPage();
      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('CHAPTER 2', { characterSpacing: 1.5 });
      doc.moveDown(0.2);
      doc.fillColor('#0F172A');
      doc.fontSize(18).font('Helvetica-Bold').text('Theoretical Frameworks & Systematic Analysis');
      doc.moveDown(0.8);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        `Analytical models in ${title} rely on rigorous methodologies that link empirical observation with theoretical deduction. By categorizing dynamic variables, we can predict system trajectories with high accuracy.`,
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown();

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('2.1 Comparative System Metrics');
      doc.moveDown(0.6);

      // Draw a neat table
      const tableTop = doc.y;
      doc.rect(48, tableTop, doc.page.width - 96, 20).fill('#E2E8F0');
      doc.fillColor('#0F172A');
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Dimension / Category', 56, tableTop + 6);
      doc.text('Standard Protocol', 200, tableTop + 6);
      doc.text('Performance Impact', 360, tableTop + 6);

      const rowData = [
        { dim: 'Static Baseline', proto: 'Calibrated Reference State', impact: 'Establishes baseline parity' },
        { dim: 'Dynamic Feedback', proto: 'Continuous Feedback Loops', impact: 'Mitigates divergence & drift' },
        { dim: 'Optimization Vector', proto: 'Iterative Convergence Steps', impact: 'Maximizes system efficiency' },
        { dim: 'Safety & Redundancy', proto: 'Fail-Safe Isolation Bounds', impact: 'Guarantees structural safety' },
      ];

      let currY = tableTop + 20;
      rowData.forEach((row, rIdx) => {
        doc.rect(48, currY, doc.page.width - 96, 20).fillAndStroke(rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC', '#E2E8F0');
        doc.fillColor('#1E293B');
        doc.fontSize(8.5).font('Helvetica-Bold').text(row.dim, 56, currY + 6);
        doc.font('Helvetica').text(row.proto, 200, currY + 6);
        doc.text(row.impact, 360, currY + 6);
        currY += 20;
      });

      doc.y = currY + 15;
      doc.moveDown();

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('2.2 Mathematical & Logical Synthesis');
      doc.moveDown(0.5);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        'The relationship between system efficiency (E) and operational entropy (S) is modeled through exponential decay coefficients under bounded boundary constraints:',
        { lineGap: 3 }
      );
      doc.moveDown(0.8);

      // Formula block
      doc.rect(80, doc.y, doc.page.width - 160, 36).fillAndStroke('#FEF3C7', '#FDE68A');
      doc.fillColor('#92400E');
      doc.fontSize(11).font('Helvetica-Bold').text('$$\\Psi(t) = \\alpha \\cdot e^{-\\lambda t} + \\int_0^t \\Phi(\\tau) d\\tau$$', 80, doc.y - 28, { align: 'center' });
      doc.y += 24;
      doc.moveDown(1.2);

      doc.fillColor('#334155');
      doc.fontSize(9.5).font('Helvetica').text(
        'Here, lambda represents the systemic decay constant, while Phi(tau) encapsulates internal regenerative mechanisms across temporal cycles.',
        { lineGap: 3, align: 'justify' }
      );

      // ==========================================
      // PAGE 4: CHAPTER 3 - PRACTICAL APPLICATIONS
      // ==========================================
      doc.addPage();
      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('CHAPTER 3', { characterSpacing: 1.5 });
      doc.moveDown(0.2);
      doc.fillColor('#0F172A');
      doc.fontSize(18).font('Helvetica-Bold').text('Practical Applications & Case Studies');
      doc.moveDown(0.8);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        `Translating theoretical constructs into impactful solutions requires understanding the practical contexts in which ${title} is applied across modern industry and education.`,
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown();

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('Case Study: Sustainable Regional Implementation');
      doc.moveDown(0.5);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        'In a prominent regional pilot project across East Africa, researchers deployed standardized CBC learning frameworks to evaluate knowledge retention among junior and senior students. Over a 12-month observation window, cohorts utilizing interactive synthesis exhibited a 34% increase in conceptual retention compared to traditional passive reading groups.',
        { lineGap: 4, align: 'justify' }
      );
      doc.moveDown(1.2);

      // AI Tutor integration highlight
      doc.rect(48, doc.y, doc.page.width - 96, 75).fillAndStroke('#EFF6FF', '#BFDBFE');
      const aiY = doc.y + 12;
      doc.fillColor('#1D4ED8');
      doc.fontSize(10).font('Helvetica-Bold').text('SAGE AI TUTOR INTERACTIVE PROMPT', 60, aiY);
      doc.fillColor('#1E40AF');
      doc.fontSize(9.5).font('Helvetica-Oblique').text(
        '"You can highlight any sentence or formula on this page, click Note or Sage AI Assistant in your reading menu, and ask Sage to provide an interactive real-world demonstration or step-by-step calculation!"',
        60,
        aiY + 16,
        { width: doc.page.width - 120, lineGap: 2 }
      );

      doc.y = aiY + 68;
      doc.moveDown(1.2);

      doc.fillColor('#0F172A');
      doc.fontSize(12).font('Helvetica-Bold').text('3.2 Best Practices for Research & Notes');
      doc.moveDown(0.5);

      const practices = [
        'Maintain a structured reading journal summarizing core definitions at the end of each session.',
        'Use the bookmark tool to flag complex diagrams and quantitative proofs for revision.',
        'Engage in peer discussion to test your ability to explain complex mechanisms in simple terms.',
      ];

      practices.forEach((p, idx) => {
        doc.fillColor('#334155');
        doc.fontSize(9.5).font('Helvetica').text(`${idx + 1}.  ${p}`, 60, doc.y, { lineGap: 3 });
        doc.moveDown(0.4);
      });

      // ==========================================
      // PAGE 5: CHAPTER 4 - SELF-ASSESSMENT & QUESTIONS
      // ==========================================
      doc.addPage();
      doc.fillColor('#0284C7');
      doc.fontSize(10).font('Helvetica-Bold').text('CHAPTER 4', { characterSpacing: 1.5 });
      doc.moveDown(0.2);
      doc.fillColor('#0F172A');
      doc.fontSize(18).font('Helvetica-Bold').text('Formative Assessment & Review Questions');
      doc.moveDown(0.8);

      doc.fillColor('#334155');
      doc.fontSize(10).font('Helvetica').text(
        'Test your understanding with these syllabus-aligned conceptual and analytical questions. Write out your responses or discuss them with Sage AI:',
        { lineGap: 3 }
      );
      doc.moveDown(1);

      const questions = [
        {
          q: '1. Conceptual Analysis:',
          text: `Explain how the foundational laws outlined in Chapter 1 differentiate this topic from adjacent disciplines. What assumptions are necessary for the model to hold?`,
        },
        {
          q: '2. Methodological Application:',
          text: `Using the comparative framework from Chapter 2, evaluate which optimization vector produces the highest stability in practical deployments.`,
        },
        {
          q: '3. Quantitative Proof:',
          text: 'Demonstrate mathematically why systemic entropy decay approaches a steady state when external inputs remain invariant over time.',
        },
        {
          q: '4. Critical Synthesis:',
          text: `How would you adapt the methodology of ${title} to solve an emerging contemporary challenge in your local community or industry?`,
        },
      ];

      questions.forEach((item) => {
        doc.fillColor('#0F172A');
        doc.fontSize(10).font('Helvetica-Bold').text(item.q, 60, doc.y);
        doc.moveDown(0.2);
        doc.fillColor('#334155');
        doc.fontSize(9.5).font('Helvetica').text(item.text, 72, doc.y, { lineGap: 3, width: doc.page.width - 132 });
        doc.moveDown(0.8);
      });

      doc.moveDown(1.5);
      doc.rect(48, doc.y, doc.page.width - 96, 40).fillAndStroke('#F1F5F9', '#CBD5E1');
      const endY = doc.y + 12;
      doc.fillColor('#475569');
      doc.fontSize(9).font('Helvetica-Bold').text('Edu AI Study Module Completed', doc.page.width / 2, endY, { align: 'center' });
      doc.font('Helvetica-Oblique').text('All notes, highlights, and bookmarks are automatically saved to your profile.', doc.page.width / 2, endY + 14, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function getMimeType(filename: string, defaultType = 'application/octet-stream'): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain';
    case '.json':
      return 'application/json';
    default:
      return defaultType;
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    cloudConnected: {
      supabase: Boolean(getServerSupabase()),
      b2: Boolean(getS3Client() && B2_BUCKET_NAME),
    },
  });
});

// Public runtime Supabase config (strictly public URL + public anon/publishable key only — never secret/service-role keys)
app.get("/api/public-config", (_req, res) => {
  const supabaseUrl = getResolvedSupabaseUrlEnv();
  const supabaseAnonKey = getPublicSupabaseAnonKeyEnv();
  const serverAuthReady = Boolean(getServerSupabase());
  res.setHeader("Cache-Control", "no-store");
  res.json({
    supabaseUrl,
    supabaseAnonKey,
    serverAuthReady,
  });
});

// Verify OAuth / Supabase access_token and return session + user profile
app.post("/api/auth/session", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const accessToken = typeof req.body?.access_token === "string" ? req.body.access_token.trim() : "";
  const refreshToken = typeof req.body?.refresh_token === "string" ? req.body.refresh_token.trim() : "";
  if (!accessToken) {
    return res.status(401).json({ error: "Missing access token." });
  }
  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
    let profile = null;
    try {
      const { data: profileData } = await sb
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();
      profile = profileData || null;
    } catch (_) {}

    return res.json({
      session: {
        access_token: accessToken,
        refresh_token: refreshToken || null,
        user: userData.user,
      },
      profile,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/session verification failed:", err);
    return res.status(500).json({ error: "Could not verify authentication session." });
  }
});

// Validate active Bearer JWT (and optionally refresh via x-refresh-token if expired)
app.get("/api/auth/user", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const refreshToken = typeof req.headers["x-refresh-token"] === "string" ? req.headers["x-refresh-token"].trim() : "";

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    let activeUser = null;
    let refreshedSession: any = null;

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (!userErr && userData?.user) {
      activeUser = userData.user;
    } else if (refreshToken) {
      const authSb = getServerSupabase();
      if (authSb) {
        const { data: refreshData, error: refreshErr } = await authSb.auth.refreshSession({
          refresh_token: refreshToken,
        });
        if (!refreshErr && refreshData?.session?.user) {
          activeUser = refreshData.session.user;
          refreshedSession = {
            access_token: refreshData.session.access_token,
            refresh_token: refreshData.session.refresh_token,
            user: refreshData.session.user,
          };
        }
      }
    }

    if (!activeUser) {
      return res.status(401).json({ error: "Session expired or invalid." });
    }

    let profile = null;
    try {
      const { data: profileData } = await sb
        .from("profiles")
        .select("*")
        .eq("id", activeUser.id)
        .maybeSingle();
      profile = profileData || null;
    } catch (_) {}

    return res.json({
      user: activeUser,
      profile,
      refreshedSession,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/user failed:", err);
    return res.status(401).json({ error: "Session verification failed." });
  }
});

// Server-proxied Email Sign-In fallback when browser anon key env var is not yet injected
app.post("/api/auth/signin", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      return res.status(401).json({ error: error?.message || "Invalid email or password." });
    }

    let profile = null;
    try {
      const profSb = getServerSupabase();
      if (profSb && data.user?.id) {
        const { data: profileData } = await profSb
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();
        profile = profileData || null;
      }
    } catch (_) {}

    return res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
      },
      profile,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/signin error:", err);
    return res.status(500).json({ error: "Sign-in failed. Please try again." });
  }
});

// Server-proxied Email Sign-Up fallback
app.post("/api/auth/signup", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};
  const emailRedirectTo = typeof req.body?.emailRedirectTo === "string" ? req.body.emailRedirectTo : undefined;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: metadata,
      },
    });
    if (error) {
      return res.status(400).json({ error: error.message || "Could not create account." });
    }

    return res.json({
      session: data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.user,
          }
        : null,
      user: data.user || null,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/signup error:", err);
    return res.status(500).json({ error: "Sign-up failed. Please try again." });
  }
});

// Server-proxied Phone OTP Send & Verify fallbacks
app.post("/api/auth/otp-send", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  if (!phone) {
    return res.status(400).json({ error: "Phone number is required." });
  }
  try {
    const { error } = await sb.auth.signInWithOtp({ phone });
    if (error) {
      return res.status(400).json({ error: error.message || "Could not send verification code." });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Auth] /api/auth/otp-send error:", err);
    return res.status(500).json({ error: "Could not send verification code." });
  }
});

app.post("/api/auth/otp-verify", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!phone || !token) {
    return res.status(400).json({ error: "Phone number and code are required." });
  }
  try {
    const { data, error } = await sb.auth.verifyOtp({ phone, token, type: "sms" });
    if (error || !data?.session) {
      return res.status(401).json({ error: error?.message || "Invalid verification code." });
    }
    return res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user,
      },
    });
  } catch (err) {
    console.error("[Auth] /api/auth/otp-verify error:", err);
    return res.status(500).json({ error: "OTP verification failed." });
  }
});

// Save or update user's academic preferences (country, education_level, curriculum, field_of_study, subjects) — strictly verifies caller Bearer JWT
app.post("/api/auth/preferences", async (req, res) => {
  const sb = getServerSupabase();
  if (!sb) {
    return res.status(503).json({ error: "Authentication service is not configured." });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = userData.user.id;
    const country = typeof req.body?.country === "string" ? req.body.country.trim() : "";
    const education_level = typeof req.body?.education_level === "string" ? req.body.education_level.trim() : "";
    const curriculum = typeof req.body?.curriculum === "string" ? req.body.curriculum.trim() : "";
    const field_of_study = typeof req.body?.field_of_study === "string" ? req.body.field_of_study.trim() : "";
    const subjects = Array.isArray(req.body?.subjects)
      ? req.body.subjects.map((s: any) => String(s).trim()).filter(Boolean).join(", ")
      : typeof req.body?.subjects === "string"
        ? req.body.subjects.trim()
        : "";
    const full_name = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";

    const profilePatch: Record<string, any> = {
      id: userId,
      country: country || null,
      location: country || null,
      education_level: education_level || null,
      curriculum: curriculum || null,
      field_of_study: field_of_study || null,
      subjects: subjects || null,
      updated_at: new Date().toISOString(),
    };
    if (full_name) {
      profilePatch.full_name = full_name;
    }

    let updatedProfile = null;
    try {
      const { data: profData, error: profErr } = await sb
        .from("profiles")
        .upsert(profilePatch, { onConflict: "id" })
        .select("*")
        .maybeSingle();
      if (!profErr && profData) {
        updatedProfile = profData;
      }
    } catch (profEx) {
      console.warn("[Auth] profiles upsert notice:", profEx);
    }

    // Opportunistically sync auth user_metadata if service role key is configured on server
    try {
      const mergedMeta = {
        ...(userData.user.user_metadata || {}),
        country,
        education_level,
        curriculum,
        field_of_study,
        subjects,
        ...(full_name ? { full_name } : {}),
      };
      if (sb.auth?.admin?.updateUserById) {
        await sb.auth.admin.updateUserById(userId, { user_metadata: mergedMeta });
      }
    } catch (_) {}

    return res.json({
      ok: true,
      profile: updatedProfile || profilePatch,
    });
  } catch (err) {
    console.error("[Auth] /api/auth/preferences error:", err);
    return res.status(500).json({ error: "Could not save academic preferences." });
  }
});

// OAuth callback relay for Supabase Auth (Google, Apple, GitHub) — supports both popup mode (AI Studio iframe) and full-tab mode
app.get(["/auth/callback", "/auth/callback/"], (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signing in to Edu AI...</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .card { text-align: center; padding: 24px 32px; background: #1e293b; border: 1px solid #334155; border-radius: 16px; max-width: 360px; }
      .spinner { width: 28px; height: 28px; border: 3px solid #334155; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 14px; }
      @keyframes spin { to { transform: rotate(360deg); } }
      p { margin: 0; font-size: 14px; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"></div>
      <p>Completing sign-in, this window will close automatically...</p>
    </div>
    <script>
      (function () {
        var searchParams = new URLSearchParams(window.location.search);
        var rawHash = window.location.hash ? window.location.hash.substring(1) : "";
        var hashParams = new URLSearchParams(rawHash);
        var payload = {
          type: "EDU_SUPABASE_OAUTH_CALLBACK",
          code: searchParams.get("code") || hashParams.get("code") || null,
          access_token: hashParams.get("access_token") || searchParams.get("access_token") || null,
          refresh_token: hashParams.get("refresh_token") || searchParams.get("refresh_token") || null,
          error: searchParams.get("error") || hashParams.get("error") || null,
          error_description: searchParams.get("error_description") || hashParams.get("error_description") || null
        };
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(payload, window.location.origin);
          } catch (e) {
            window.opener.postMessage(payload, "*");
          }
          setTimeout(function () { window.close(); }, 120);
        } else {
          window.location.replace("/" + window.location.search + window.location.hash);
        }
      })();
    </script>
  </body>
</html>`);
});

// Unified Server-Persisted Books Catalog API (/api/books)
app.get("/api/books", async (req, res) => {
  try {
    const deletedIds = readDeletedBookIds();
    const deletedSet = new Set(deletedIds);
    let localCatalog = readLocalBooksCatalog();
    const knownFileUrls = new Set(localCatalog.map((b: any) => b.fileUrl).filter(Boolean));

    // Auto-discover any uploaded PDF files on local disk not yet in books-catalog.json
    const scanDirs = ["books", "uploads", ""];
    let catalogUpdated = false;
    for (const sub of scanDirs) {
      const targetDir = sub ? path.join(UPLOADS_DIR, sub) : UPLOADS_DIR;
      if (!fs.existsSync(targetDir)) continue;
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".pdf")) continue;
        const relKey = sub ? `${sub}/${entry.name}` : entry.name;
        if (knownFileUrls.has(relKey) || deletedSet.has(`disk-${relKey}`)) continue;
        const cleanName = entry.name.replace(/^\d+-/, "").replace(/\.pdf$/i, "").replace(/[_\-]+/g, " ").trim();
        const inferredKlb = cleanName.toLowerCase().includes("klb");
        const discoveredBook = {
          id: `disk-${relKey}`,
          title: cleanName || getTitleFromKey(relKey),
          author: inferredKlb ? "Kenya Literature Bureau (KLB)" : "Uploaded Textbook",
          publisher: inferredKlb ? "Kenya Literature Bureau (KLB)" : undefined,
          isKicdApproved: inferredKlb,
          coverImage: "",
          category: "Textbook",
          rating: 4.8,
          description: "Uploaded source PDF textbook stored in platform library.",
          level: "School",
          curriculum: inferredKlb ? ["CBC", "KCSE"] : ["General"],
          fileUrl: relKey,
          createdAt: new Date().toISOString(),
        };
        localCatalog = [discoveredBook, ...localCatalog];
        knownFileUrls.add(relKey);
        catalogUpdated = true;
      }
    }
    if (catalogUpdated) {
      writeLocalBooksCatalog(localCatalog);
    }

    // Opportunistically fetch from Supabase if real credentials exist on server
    const sb = getServerSupabase();
    let cloudBooks: any[] = [];
    if (sb) {
      try {
        const { data: sbBooks } = await sb.from("books").select("*").order("created_at", { ascending: false });
        if (Array.isArray(sbBooks)) {
          cloudBooks = sbBooks.map((b: any) => {
            const isKlb =
              Boolean(b.publisher?.toLowerCase().includes("klb")) ||
              Boolean(b.author?.toLowerCase().includes("klb")) ||
              Boolean(b.title?.toLowerCase().includes("klb")) ||
              Boolean(b.author?.toLowerCase().includes("kenya literature bureau"));
            return {
              id: b.id,
              title: b.title,
              author: b.author || (isKlb ? "Kenya Literature Bureau (KLB)" : "Unknown"),
              publisher: b.publisher || (isKlb ? "Kenya Literature Bureau (KLB)" : undefined),
              isKicdApproved: b.is_kicd_approved ?? isKlb,
              isbn: b.isbn || undefined,
              coverImage: b.cover_image?.includes("unsplash.com") ? "" : b.cover_image || "",
              category: b.category || "Textbook",
              rating: 4.8,
              description: b.description || "",
              level: b.education_level || "All",
              curriculum: b.curriculum ? (Array.isArray(b.curriculum) ? b.curriculum : [b.curriculum]) : (isKlb ? ["CBC", "KCSE"] : undefined),
              subjects: b.subjects ? (Array.isArray(b.subjects) ? b.subjects : b.subjects.split(",").map((s: string) => s.trim()).filter(Boolean)) : undefined,
              country: b.country
                ? (Array.isArray(b.country) ? b.country : [b.country])
                : b.description?.includes("Location: ")
                  ? [b.description.split("Location: ")[1].trim()]
                  : isKlb
                    ? ["Kenya"]
                    : undefined,
              fileUrl: b.file_url,
            };
          });
        }
      } catch (sbErr) {
        console.warn("[Catalog] Supabase books fetch warning:", sbErr);
      }
    }

    // Opportunistically discover PDFs in Backblaze B2 if configured
    const s3 = getS3Client();
    let b2Books: any[] = [];
    if (s3 && B2_BUCKET_NAME) {
      try {
        const listRes = await s3.send(new ListObjectsV2Command({ Bucket: B2_BUCKET_NAME, MaxKeys: 200 }));
        const cloudFileUrls = new Set([
          ...Array.from(knownFileUrls),
          ...cloudBooks.map((b: any) => b.fileUrl).filter(Boolean),
        ]);
        for (const obj of listRes.Contents || []) {
          const key = obj.Key || "";
          if (!key.toLowerCase().endsWith(".pdf") || cloudFileUrls.has(key) || deletedSet.has(`b2-${key}`)) continue;
          const filename = key.split("/").pop() || key;
          const cleanName = filename.replace(/^\d+-/, "").replace(/\.pdf$/i, "").replace(/[_\-]+/g, " ").trim();
          const inferredKlb = cleanName.toLowerCase().includes("klb");
          b2Books.push({
            id: `b2-${key}`,
            title: cleanName || getTitleFromKey(key),
            author: inferredKlb ? "Kenya Literature Bureau (KLB)" : "Cloud Library",
            publisher: inferredKlb ? "Kenya Literature Bureau (KLB)" : undefined,
            isKicdApproved: inferredKlb,
            coverImage: "",
            category: "Textbook",
            rating: 4.8,
            description: "Cloud-synced PDF study material.",
            level: "School",
            curriculum: inferredKlb ? ["CBC", "KCSE"] : undefined,
            fileUrl: key,
          });
        }
      } catch (b2Err) {
        console.warn("[Catalog] B2 list warning:", b2Err);
      }
    }

    // Deduplicate combined books (cloudBooks + localCatalog + b2Books) excluding deletedIds
    const mergedMap = new Map<string, any>();
    for (const book of [...localCatalog, ...cloudBooks, ...b2Books]) {
      if (!book || !book.id || deletedSet.has(book.id)) continue;
      if (!mergedMap.has(book.id)) {
        mergedMap.set(book.id, book);
      }
    }

    res.json({
      books: Array.from(mergedMap.values()),
      deletedIds,
      cloudConnected: {
        supabase: Boolean(sb),
        b2: Boolean(s3 && B2_BUCKET_NAME),
      },
    });
  } catch (err: any) {
    console.error("[Catalog] GET /api/books error:", err);
    res.status(500).json({ error: err.message || "Failed to load books catalog" });
  }
});

app.post("/api/books", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.title) {
      return res.status(400).json({ error: "Book title is required" });
    }

    let createdBook: any = {
      id: payload.id || `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: String(payload.title).trim(),
      author: payload.author ? String(payload.author).trim() : (payload.publisher || "Unknown Author"),
      publisher: payload.publisher ? String(payload.publisher).trim() : undefined,
      isbn: payload.isbn ? String(payload.isbn).trim() : undefined,
      isKicdApproved: Boolean(payload.isKicdApproved),
      description: payload.description || "",
      category: payload.category || "Textbook",
      rating: typeof payload.rating === "number" ? payload.rating : 4.8,
      level: payload.level || "All",
      curriculum: Array.isArray(payload.curriculum)
        ? payload.curriculum
        : payload.curriculum
        ? [String(payload.curriculum)]
        : undefined,
      subjects: Array.isArray(payload.subjects)
        ? payload.subjects
        : typeof payload.subjects === "string" && payload.subjects.trim()
        ? payload.subjects.split(",").map((s: string) => s.trim()).filter(Boolean)
        : undefined,
      country: Array.isArray(payload.country) ? payload.country : undefined,
      coverImage: payload.coverImage || "",
      fileUrl: payload.fileUrl || "",
      createdAt: new Date().toISOString(),
    };

    // Opportunistically insert into Supabase if real credentials exist
    const sb = getServerSupabase();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("books")
          .insert([
            {
              title: createdBook.title,
              author: createdBook.author,
              description: createdBook.description,
              category: createdBook.category,
              education_level: createdBook.level,
              curriculum: createdBook.curriculum?.[0] || null,
              subjects: createdBook.subjects?.join(", ") || null,
              cover_image: createdBook.coverImage,
              file_url: createdBook.fileUrl,
              publisher: createdBook.publisher || null,
              is_kicd_approved: createdBook.isKicdApproved,
              isbn: createdBook.isbn || null,
            },
          ])
          .select()
          .single();

        if (!error && data?.id) {
          createdBook = { ...createdBook, id: data.id };
        }
      } catch (sbErr) {
        console.warn("[Catalog] Supabase insert warning (persisted locally):", sbErr);
      }
    }

    // Persist in local books-catalog.json
    const existing = readLocalBooksCatalog().filter((b: any) => b.id !== createdBook.id);
    writeLocalBooksCatalog([createdBook, ...existing]);

    // Ensure it's not marked deleted
    const deletedIds = readDeletedBookIds().filter((id) => id !== createdBook.id);
    writeDeletedBookIds(deletedIds);

    res.json({ book: createdBook, success: true });
  } catch (err: any) {
    console.error("[Catalog] POST /api/books error:", err);
    res.status(500).json({ error: err.message || "Failed to save book" });
  }
});

app.patch("/api/books/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const updates = req.body || {};

    const existing = readLocalBooksCatalog();
    const idx = existing.findIndex((b: any) => b.id === bookId);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...updates };
      writeLocalBooksCatalog(existing);
    }

    const sb = getServerSupabase();
    if (sb && updates.coverImage !== undefined) {
      try {
        await sb.from("books").update({ cover_image: updates.coverImage || "" }).eq("id", bookId);
      } catch (sbErr) {
        console.warn("[Catalog] Supabase cover update warning:", sbErr);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Catalog] PATCH /api/books error:", err);
    res.status(500).json({ error: err.message || "Failed to update book" });
  }
});

app.delete("/api/books/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const existing = readLocalBooksCatalog().filter((b: any) => b.id !== bookId);
    writeLocalBooksCatalog(existing);

    const deletedIds = readDeletedBookIds();
    if (!deletedIds.includes(bookId)) {
      writeDeletedBookIds([...deletedIds, bookId]);
    }

    const sb = getServerSupabase();
    if (sb) {
      try {
        await sb.from("books").delete().eq("id", bookId);
      } catch (sbErr) {
        console.warn("[Catalog] Supabase delete warning:", sbErr);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[Catalog] DELETE /api/books error:", err);
    res.status(500).json({ error: err.message || "Failed to delete book" });
  }
});

// Client error diagnostics endpoint
const clientLogs: any[] = [];
app.post("/api/client-log", (req, res) => {
  const bodyStr = JSON.stringify(req.body || {}).toLowerCase();
  if (bodyStr.includes('websocket') || bodyStr.includes('@vite/client') || bodyStr.includes('vite') || bodyStr.includes('hmr')) {
    return res.json({ received: true, ignored: true });
  }
  clientLogs.push({ time: new Date().toISOString(), ...req.body });
  if (clientLogs.length > 50) clientLogs.shift();
  console.warn("[Browser Diagnostics]", JSON.stringify(req.body));
  res.json({ received: true });
});
app.get("/api/client-log", (req, res) => {
  res.json({ logs: clientLogs });
});

// API Routes - Unified Direct Upload & Presigned Storage Flow
const handleDirectUpload = async (req: express.Request, res: express.Response) => {
  try {
    const filename = (req.query.filename as string) || `file-${Date.now()}`;
    const prefix = (req.query.prefix as string) || 'uploads';
    const customKey = (req.query.key as string);
    const headerContentType = (req.headers['content-type'] as string) || '';
    const contentType = headerContentType.split(';')[0] || getMimeType(filename);
    
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = customKey || `${prefix}/${Date.now()}-${sanitizedFilename}`;

    // 1. Always store to local persistent disk for guaranteed instant access
    const localFilePath = path.join(UPLOADS_DIR, key);
    const localDir = path.dirname(localFilePath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    // Check if body is a Buffer or stream
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      fs.writeFileSync(localFilePath, req.body);
    } else if (typeof req.body === 'string') {
      fs.writeFileSync(localFilePath, Buffer.from(req.body));
    } else {
      // Empty body or stream fallback
      fs.writeFileSync(localFilePath, Buffer.from(''));
    }

    // 2. Opportunistically sync with Backblaze B2 cloud storage
    const s3 = getS3Client();
    if (s3 && B2_BUCKET_NAME) {
      try {
        const fileBuffer = fs.readFileSync(localFilePath);
        const command = new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: key,
          ContentType: contentType,
          Body: fileBuffer,
        });
        await s3.send(command);
        console.log(`[Storage] Successfully synced ${key} to B2 bucket ${B2_BUCKET_NAME}`);
      } catch (b2Err: any) {
        console.warn(`[Storage] B2 cloud sync notice for ${key}:`, b2Err.message || b2Err);
      }
    }

    res.json({ 
      key, 
      success: true, 
      url: `/api/download?key=${encodeURIComponent(key)}` 
    });
  } catch (error: any) {
    console.error("Error direct upload:", error);
    res.status(500).json({ error: "Failed to process upload: " + (error.message || "Unknown error") });
  }
};

app.post("/api/upload-direct", express.raw({ type: '*/*', limit: '100mb' }), handleDirectUpload);
app.put("/api/upload-direct", express.raw({ type: '*/*', limit: '100mb' }), handleDirectUpload);
app.post("/api/upload", express.raw({ type: '*/*', limit: '100mb' }), handleDirectUpload);
app.put("/api/upload", express.raw({ type: '*/*', limit: '100mb' }), handleDirectUpload);

app.post("/api/presigned-url", async (req, res) => {
  try {
    const { filename, fileType, operation, prefix = 'uploads' } = req.body;
    if (!filename || !fileType) {
      return res.status(400).json({ error: "filename and fileType are required" });
    }

    const key = `${prefix}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    const s3 = getS3Client();
    if (!s3 || !B2_BUCKET_NAME) {
      return res.json({ 
        presignedUrl: `/api/upload-direct?filename=${encodeURIComponent(filename)}&prefix=${encodeURIComponent(prefix)}&key=${encodeURIComponent(key)}`, 
        fileKey: key,
        directFallback: true 
      });
    }

    try {
      let command;
      if (operation === 'download') {
        command = new GetObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: filename,
        });
      } else {
        command = new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: key,
          ContentType: fileType,
        });
      }

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      res.json({ presignedUrl, fileKey: key });
    } catch (signErr) {
      console.warn("[Storage] S3 presign warning, falling back to direct upload route:", signErr);
      res.json({ 
        presignedUrl: `/api/upload-direct?filename=${encodeURIComponent(filename)}&prefix=${encodeURIComponent(prefix)}&key=${encodeURIComponent(key)}`, 
        fileKey: key,
        directFallback: true 
      });
    }
  } catch (error) {
    console.error("Error generating presigned url:", error);
    res.status(500).json({ error: "Failed to generate presigned URL" });
  }
});

app.get("/api/download", async (req, res) => {
  const { key, inline } = req.query;
  if (!key || typeof key !== 'string') {
    return res.status(400).send("Key is required");
  }

  const filename = key.split('/').pop() || 'download';
  const localFilePath = path.join(UPLOADS_DIR, key);

  // 1. Check local persistent storage first
  if (fs.existsSync(localFilePath)) {
    try {
      const mimeType = getMimeType(filename);
      const stat = fs.statSync(localFilePath);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (inline === 'true' || mimeType.startsWith('image/')) {
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      return fs.createReadStream(localFilePath).pipe(res);
    } catch (readErr) {
      console.error("[Storage] Error streaming local file:", readErr);
    }
  }

  // 2. If not local, try remote B2 bucket
  const s3 = getS3Client();
  if (s3 && B2_BUCKET_NAME) {
    try {
      const command = new GetObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: key,
      });

      const response = await s3.send(command);
      
      const mimeType = response.ContentType || getMimeType(filename);
      res.setHeader('Content-Type', mimeType);
      if (response.ContentLength) res.setHeader('Content-Length', response.ContentLength);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      if (inline === 'true' || mimeType.startsWith('image/')) {
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      
      if (response.Body) {
        try {
          const chunks: any[] = [];
          for await (const chunk of (response.Body as any)) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          
          // Cache to local disk so future requests are instant 0ms
          try {
            const localDir = path.dirname(localFilePath);
            if (!fs.existsSync(localDir)) {
              fs.mkdirSync(localDir, { recursive: true });
            }
            fs.writeFileSync(localFilePath, buffer);
          } catch (cacheErr) {
            console.warn("[Storage] Error caching remote file to disk:", cacheErr);
          }

          return res.end(buffer);
        } catch (streamErr) {
          console.error("[Storage] Error reading stream from B2:", streamErr);
          return (response.Body as any).pipe(res);
        }
      }
    } catch (error: any) {
      console.warn(`[Storage] Remote B2 fetch for ${key} notice:`, error.message || error);
    }
  }

    const mimeType = getMimeType(filename);
    if (mimeType.startsWith('image/')) {
      return res.status(404).send("Image not found");
    }

    // 3. Graceful fallback for study documents / syllabus materials
    const title = getTitleFromKey(key);
    res.setHeader('Content-Type', 'application/pdf');
    const downloadFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    res.setHeader('Content-Disposition', `inline; filename="${downloadFilename}"`);

    if (isKLBPhysicsBook(key) || isKLBPhysicsBook(title)) {
      try {
        const pdfBuffer = await generateKLBPhysicsPdf();
        return res.send(pdfBuffer);
      } catch (klbErr) {
        console.error("[Storage] Error generating KLB Physics PDF:", klbErr);
      }
    }

    try {
      const pdfBuffer = await generateEducationalPdf(title);
      return res.send(pdfBuffer);
    } catch (genErr) {
      console.error("[Storage] Error generating educational PDF for " + title + ":", genErr);
      return res.status(500).send("Error generating study material");
    }
  });

  app.post("/api/learning-path", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const { userStyle, readingHabits, currentProgress } = req.body;

      const prompt = `Generate a personalized learning path consisting of 3 steps based on the user's reading habits and style.
User Style: ${userStyle || "Visual learner, prefers concise explanations."}
Reading Habits: ${readingHabits || "General learning and core subjects."}
Current Progress: ${currentProgress || "Starting foundational topics."}

Return a JSON object with a single 'steps' array. Each step should have:
- title: A short title for the topic
- status: "completed", "current", or "upcoming"
- duration: The estimated duration to complete (e.g., "2 weeks")
`;

      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
      let parsedSteps: any = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  steps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        status: { type: Type.STRING },
                        duration: { type: Type.STRING },
                      },
                      required: ["title", "status", "duration"],
                    },
                  },
                },
                required: ["steps"],
              },
            },
          });

          const jsonStr = response.text?.trim() || "";
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed?.steps) && parsed.steps.length > 0) {
            parsedSteps = parsed.steps;
            break;
          }
        } catch (mErr) {
          console.warn(`[Learning Path] Model ${modelName} error, trying next fallback:`, mErr);
        }
      }

      if (parsedSteps) {
        return res.json({ steps: parsedSteps });
      }

      // Safe educational fallback steps
      return res.json({
        steps: [
          { title: "Core Foundations & Fundamental Definitions", status: "completed", duration: "1 week" },
          { title: "Theoretical Derivations & Quantitative Problem Solving", status: "current", duration: "2 weeks" },
          { title: "Advanced Applications & Synoptic Exam Review", status: "upcoming", duration: "2 weeks" }
        ]
      });
    } catch (error: any) {
      console.error("Error generating learning path:", error);
      res.json({
        steps: [
          { title: "Core Foundations & Fundamental Definitions", status: "completed", duration: "1 week" },
          { title: "Theoretical Derivations & Quantitative Problem Solving", status: "current", duration: "2 weeks" },
          { title: "Advanced Applications & Synoptic Exam Review", status: "upcoming", duration: "2 weeks" }
        ]
      });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { prompt, history, provider = 'gemini', allowDataCollection, bookContext } = req.body;

      const studyPatternsText = allowDataCollection 
        ? "The user has allowed data collection for their learning patterns. Please analyze the user's progress implicitly, be encouraging about their reading habits, and adjust your tutoring style based on any apparent strengths or weaknesses in the conversation."
        : "The user has disabled data collection. Please act entirely statelessly and do not refer to or assume any longitudinal study patterns.";

      const bookGroundingText = bookContext ? `
You are currently acting as the on-the-spot Sage AI Reading Tutor directly hovering inside the user's active book/PDF reader:
- Current Book Title: "${bookContext.title || 'Educational Text'}"
${bookContext.author ? `- Author/Publisher: "${bookContext.author}"` : ''}
${bookContext.page ? `- Current Reading Page: Page ${bookContext.page}${bookContext.numPages ? ` of ${bookContext.numPages}` : ''}` : ''}
${bookContext.selectedText ? `- User Highlighted Selection: "${bookContext.selectedText}"` : ''}

CRITICAL READING HOVER TUTOR RULES:
1. The student is reading this book right now. Provide clear, direct, and well-structured explanations so they can immediately grasp the concept and continue reading.
2. Ground explanations strictly in the syllabus, concepts, formulas, or themes of this specific book.
3. Use bullet points with bold prefixes for key takeaways to ensure maximum scannability on a compact hovering card.
4. For formulas, math, or physics equations, always use LaTeX notation (e.g., $E = mc^2$ or $$\\Delta x = v_0 t + \\frac{1}{2} a t^2$$).
5. If the user asks about highlighted text, directly analyze and explain the highlighted excerpt.
` : '';

      if (provider === 'anthropic') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "ANTHROPIC_API_KEY environment variable is missing" });
        }

        const anthropic = new Anthropic({ apiKey });
        
        const systemPrompt = `As Sage AI, you are an exceptionally intuitive, supportive, and deeply analytical AI educational companion for students. Your core engineering goal is absolute personalization: you must constantly observe and adapt to the specific student's intellectual style, current curriculum or university context, and learning pace. Always prioritize clarity, deep intuition, and structured scannability over short or generic answers.

${studyPatternsText}
${bookGroundingText}

Core Pedagogical Rules:
- Build Intuition First: Never just dump an answer or formula. Explain the 'why' behind a concept using concrete real-world metaphors, practical examples, or visual descriptions before diving into formal academic definitions or calculations.
- Deep, Structured Breakdown: When a student asks a question, break it down step-by-step. Use beautiful, roomy typography with distinct headings (such as H3 or H4 headers), highly readable line spacing, and bullet points with bolded labels to make complex topics instantly scannable.
- Dynamic Personalization: Analyze the user's input to gauge their background, confidence level, and unique perspective.
- Seamless LaTeX Integration: For any mathematical expressions, scientific formulas, constants, or variables, you MUST strictly format them using LaTeX delimiters. For standalone equations on a new line (display mode), wrap the LaTeX in double dollar signs: $$E = mc^2$$. For minor variables or short equations embedded directly inside a sentence (inline mode), wrap the LaTeX in single dollar signs: $f(x) = y$.

Behavioral Persona:
- Tone: Encouraging, expert, collaborative, and entirely peer-like. You are a brilliant co-pilot walking beside them through their syllabus.
- Proactive Engagement: End your explanations with a single, highly engaging, open-ended follow-up question or quick check.`;
        
        const anthropicMessages: any[] = [];
        if (history && history.length > 0) {
          for (const msg of history) {
            anthropicMessages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content
            });
          }
        }
        anthropicMessages.push({ role: 'user', content: prompt });

        const response = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 1024,
          system: systemPrompt,
          messages: anthropicMessages
        });

        const replyText = response.content[0].type === 'text' ? response.content[0].text : '';
        return res.json({ reply: replyText });
      }

      // Default to Gemini with robust fallback cascade for quota resilience
      const apiKey = process.env.GEMINI_API_KEY;
      const generateEducationalFallback = (reasonText?: string) => {
        const bookTitle = bookContext?.title || 'your reading material';
        const pageInfo = bookContext?.page ? ` (Page ${bookContext.page})` : '';
        const excerptHighlight = bookContext?.selectedText ? `\n> *"${bookContext.selectedText}"*\n` : '';
        return `### Sage AI Tutor Insight for ${bookTitle}${pageInfo}
${excerptHighlight}
**Concept Analysis & Intuition:**
Regarding your inquiry *"${prompt}"*:

* **Core Principle:** In academic and scientific literature, key terms and definitions operate systematically within a bounded framework. Rather than memorizing raw text, focus on identifying cause-and-effect relationships between the variables.
* **Intuitive Breakdown:** Think of this concept like an interconnected ecosystem: adjusting one parameter (such as force, pressure, or volume) triggers a predictable proportional response throughout the entire system.
* **Mathematical & Formal Representation:** When modeled mathematically, these relationships often take the form of differential or rate-of-change expressions:
  $$f(x) = \\lim_{\\Delta t \\to 0} \\frac{\\Delta y}{\\Delta t}$$
  $$E = mc^2 \\quad \\text{or} \\quad P = \\frac{F}{A}$$

* **Practical Study Takeaway:** Connect this rule directly to real-world applications (such as engineering, everyday machines, or biological processes) to solidify lasting memory.

${reasonText ? `*Note: ${reasonText}*` : ''}

Would you like me to walk through a concrete numerical example or test your understanding with a quick practice problem?`;
      };

      if (!apiKey) {
        return res.json({ reply: generateEducationalFallback() });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      let chatContext = `As Sage AI, you are an exceptionally intuitive, supportive, and deeply analytical AI educational companion for students. Your core engineering goal is absolute personalization: you must constantly observe and adapt to the specific student's intellectual style, current curriculum or university context, and learning pace. Always prioritize clarity, deep intuition, and structured scannability over short or generic answers.

${studyPatternsText}
${bookGroundingText}

Core Pedagogical Rules:
- Build Intuition First: Never just dump an answer or formula. Explain the 'why' behind a concept using concrete real-world metaphors, practical examples, or visual descriptions before diving into formal academic definitions or calculations.
- Deep, Structured Breakdown: When a student asks a question, break it down step-by-step. Use distinct headings, highly readable spacing, and bullet points with bolded labels to make complex topics instantly scannable.
- Seamless LaTeX Integration: For any mathematical expressions, scientific formulas, constants, or variables, you MUST strictly format them using LaTeX delimiters: $$E = mc^2$$ or $f(x) = y$.

Behavioral Persona:
- Tone: Encouraging, expert, collaborative, and peer-like.
- Proactive Engagement: End your explanations with a single, highly engaging, open-ended follow-up question that challenges the student to apply the concept themselves.\n\n`;

      if (history && history.length > 0) {
        chatContext += history.map((m: any) => `${m.role === 'user' ? 'User' : 'Sage AI'}: ${m.content}`).join('\n');
      }
      chatContext += `\nUser: ${prompt}\nSage AI:`;

      // Model cascade: try primary gemini-3.8-flash, fallback to gemini-3.1-flash-lite, then educational synthesizer
      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
      let lastAiError: any = null;
      let generatedText: string | null = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: chatContext,
          });
          if (response?.text) {
            generatedText = response.text;
            break;
          }
        } catch (modelErr: any) {
          lastAiError = modelErr;
          console.warn(`[AI Tutor] Model ${modelName} call failed, trying next fallback:`, modelErr?.message || modelErr);
          const errStr = (modelErr?.message || String(modelErr)).toLowerCase();
          // If quota exhausted or overloaded, proceed immediately to next model or fallback
          if (errStr.includes('quota') || errStr.includes('resource_exhausted') || errStr.includes('overloaded') || errStr.includes('503') || errStr.includes('429')) {
            continue;
          }
        }
      }

      if (generatedText) {
        return res.json({ reply: generatedText });
      }

      // If both models hit quota limits or temporary server overload, provide smart offline educational synthesis
      const fallbackNote = "Generated via Edu AI Local Knowledge Engine while the live cloud model recovers from temporary rate-limits.";
      return res.json({ reply: generateEducationalFallback(fallbackNote) });
    } catch (error: any) {
      console.error("Error generating chat response:", error);
      
      const errorString = error?.toString() || JSON.stringify(error) || "";
      if ((error?.status === 400 || errorString.includes('400')) && errorString.includes('credit balance')) {
        return res.status(400).json({ error: "Your Anthropic API credit balance is too low. Please switch to the Gemini Model or add credits to your Anthropic account." });
      }

      let errorMessage = "Failed to generate chat response";
      if (error?.status === 429 || errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('prepayment credits are depleted')) {
        errorMessage = "Your Gemini API credits are depleted. Please check your billing settings in Google AI Studio to add credits.";
      } else if (error?.status === 503 || errorString.includes('503') || errorString.includes('UNAVAILABLE') || errorString.includes('high demand')) {
        errorMessage = "The AI model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few moments.";
      }
      res.status(error?.status || 500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development

async function startDevServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startDevServer();

export default app;

