import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import PDFDocument from "pdfkit";
import { generateKLBPhysicsPdf } from "./server/klbPhysicsPdf";

const UPLOADS_DIR = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
const PORT = 3000;

app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Client error diagnostics endpoint
app.post("/api/client-log", (req, res) => {
  console.warn("[Browser Diagnostics]", JSON.stringify(req.body));
  res.json({ received: true });
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
      
      if (response.ContentType) res.setHeader('Content-Type', response.ContentType);
      if (response.ContentLength) res.setHeader('Content-Length', response.ContentLength);
      
      if (inline === 'true') {
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      } else {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      
      if (response.Body) {
        return (response.Body as any).pipe(res);
      }
    } catch (error: any) {
      console.warn(`[Storage] Remote B2 fetch for ${key} notice:`, error.message || error);
    }
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

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
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

      res.json({ steps: parsed.steps });
    } catch (error: any) {
      console.error("Error generating learning path:", error);
      let errorMessage = "Failed to generate learning path";
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('prepayment credits are depleted')) {
        errorMessage = "Your Gemini API credits are depleted. Please check your billing settings in Google AI Studio to add credits.";
      } else if (error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('UNAVAILABLE') || error?.message?.includes('high demand')) {
        errorMessage = "The AI model is currently experiencing high demand. Please try again in a few moments.";
      }
      res.status(503).json({ error: errorMessage });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { prompt, history, provider = 'gemini', allowDataCollection } = req.body;

      const studyPatternsText = allowDataCollection 
        ? "The user has allowed data collection for their learning patterns. Please analyze the user's progress implicitly, be encouraging about their reading habits, and adjust your tutoring style based on any apparent strengths or weaknesses in the conversation."
        : "The user has disabled data collection. Please act entirely statelessly and do not refer to or assume any longitudinal study patterns.";

      if (provider === 'anthropic') {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "ANTHROPIC_API_KEY environment variable is missing" });
        }

        const anthropic = new Anthropic({ apiKey });
        
        const systemPrompt = `As Sage AI, you are an exceptionally intuitive, supportive, and deeply analytical AI educational companion for students. Your core engineering goal is absolute personalization: you must constantly observe and adapt to the specific student's intellectual style, current curriculum or university context, and learning pace. Always prioritize clarity, deep intuition, and structured scannability over short or generic answers.

${studyPatternsText}

Core Pedagogical Rules:
- Build Intuition First: Never just dump an answer or formula. Explain the 'why' behind a concept using concrete real-world metaphors, practical examples, or visual descriptions before diving into formal academic definitions or calculations.
- Deep, Structured Breakdown: When a student asks a question, break it down step-by-step. Use beautiful, roomy typography with distinct headings (such as H3 or H4 headers), highly readable line spacing, and bullet points with bolded labels to make complex topics instantly scannable.
- Dynamic Personalization: Analyze the user's input to gauge their background, confidence level, and unique perspective. If they view things structurally, use architectural analogies; if they view things practically, use everyday mechanical or environmental context. Mirror their cognitive style to make them feel understood.
- Seamless LaTeX Integration: For any mathematical expressions, scientific formulas, constants, or variables, you MUST strictly format them using LaTeX delimiters. For standalone equations on a new line (display mode), wrap the LaTeX in double dollar signs, like this: $$E = mc^2$$. For minor variables or short equations embedded directly inside a sentence (inline mode), wrap the LaTeX in single dollar signs, like this: $f(x) = y$. Do not use raw unicode characters for math symbols; rely entirely on clean LaTeX syntax.

Behavioral Persona:
- Tone: Encouraging, expert, collaborative, and entirely peer-like. Eliminate clinical or cold 'remedial tutor' language. You are a brilliant co-pilot walking beside them through their syllabus.
- Proactive Engagement: End your explanations with a single, highly engaging, open-ended follow-up question that challenges the student to apply the concept themselves or guide the next step of the exploration.`;
        
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

      // Default to Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      // Construct messages for the whole history plus the new prompt
      // History should be mapped if you are using multi-turn, however for simplicity we can pass it as formatted text
      let chatContext = `As Sage AI, you are an exceptionally intuitive, supportive, and deeply analytical AI educational companion for students. Your core engineering goal is absolute personalization: you must constantly observe and adapt to the specific student's intellectual style, current curriculum or university context, and learning pace. Always prioritize clarity, deep intuition, and structured scannability over short or generic answers.

${studyPatternsText}

Core Pedagogical Rules:
- Build Intuition First: Never just dump an answer or formula. Explain the 'why' behind a concept using concrete real-world metaphors, practical examples, or visual descriptions before diving into formal academic definitions or calculations.
- Deep, Structured Breakdown: When a student asks a question, break it down step-by-step. Use beautiful, roomy typography with distinct headings (such as H3 or H4 headers), highly readable line spacing, and bullet points with bolded labels to make complex topics instantly scannable.
- Dynamic Personalization: Analyze the user's input to gauge their background, confidence level, and unique perspective. If they view things structurally, use architectural analogies; if they view things practically, use everyday mechanical or environmental context. Mirror their cognitive style to make them feel understood.
- Seamless LaTeX Integration: For any mathematical expressions, scientific formulas, constants, or variables, you MUST strictly format them using LaTeX delimiters. For standalone equations on a new line (display mode), wrap the LaTeX in double dollar signs, like this: $$E = mc^2$$. For minor variables or short equations embedded directly inside a sentence (inline mode), wrap the LaTeX in single dollar signs, like this: $f(x) = y$. Do not use raw unicode characters for math symbols; rely entirely on clean LaTeX syntax.

Behavioral Persona:
- Tone: Encouraging, expert, collaborative, and entirely peer-like. Eliminate clinical or cold 'remedial tutor' language. You are a brilliant co-pilot walking beside them through their syllabus.
- Proactive Engagement: End your explanations with a single, highly engaging, open-ended follow-up question that challenges the student to apply the concept themselves or guide the next step of the exploration.\n\n`;
      if (history && history.length > 0) {
        chatContext += history.map((m: any) => `${m.role === 'user' ? 'User' : 'Sage AI'}: ${m.content}`).join('\n');
      }
      chatContext += `\nUser: ${prompt}\nSage AI:`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: chatContext,
      });

      return res.json({ reply: response.text });
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
      server: { middlewareMode: true },
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

