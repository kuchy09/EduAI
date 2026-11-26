# EduAI PDF-to-EPUB 3 Conversion & Digital Library Architecture

## 1. System Overview

EduAI preserves every uploaded textbook PDF as the **authoritative source document** while running an asynchronous 12-stage conversion pipeline that builds a **Canonical Book Structure** and a standards-compliant, reflowable **EPUB 3** edition.

```
Admin PDF Upload ─▶ Original PDF stored in B2 (`curriculums/<shelf>/<subject>/<file>.pdf`)
                  │  + SHA-256 checksum, size, MIME type recorded
                  ▼
     Async 12-Stage Pipeline (`server/pdfToEpubPipeline.ts`)
       ├─ Stage 1-4: Validate PDF, extract text + layout + bookmarks, detect scans, OCR fallback
       ├─ Stage 5-7: Detect chapters/sections/exercises, build Canonical Structure, extract PNG figures & MathML
       ├─ Stage 8-10: Generate semantic XHTML (`server/epubBuilder.ts`), package EPUB 3, run EPUBCheck (`server/epubValidator.ts`)
       └─ Stage 11-12: Score quality confidence (`high` / `medium` / `low`), auto-publish high confidence only
                  │
                  ├──▶ Derived EPUB 3 stored in `generated-epubs/<bookId>/v<N>/book.epub`
                  ├──▶ Extracted images stored in `extracted-assets/<bookId>/<filename>.png`
                  └──▶ Canonical Structure persisted (`uploads/.library-pipeline/` + Supabase tables)
                         ├── PDF Reader (react-pdf)
                         ├── Reflowable EPUB 3 Reader (`EpubReader.tsx`)
                         ├── In-book Search & Bookmarks
                         └── Sage AI Tutor (`server/curriculumRag.ts`)
```

---

## 2. Storage & Preservation Invariants

- **Original PDF Path**: `curriculums/<curriculum_shelf>/<subject_category>/<filename>.pdf` (Backblaze B2 private bucket + local disk cache). Never overwritten, deleted, or modified during conversion.
- **Derived EPUB 3 Path**: `generated-epubs/<sanitizedBookId>/v<version>/book.epub`
- **Extracted Asset Path**: `extracted-assets/<sanitizedBookId>/page-<N>-fig-<M>.png`
- Raw B2/disk library scanners (`isDerivedStorageKey` in `shared/b2StoragePaths.ts`) automatically ignore `generated-epubs/` and `extracted-assets/` so derived artifacts are never listed as duplicate books in the library catalog.

---

## 3. Database Schema (`supabase/migrations/20261125000000_pdf_to_epub_pipeline.sql`)

- **`public.books`** (extended): `sha256_checksum`, `mime_type`, `file_size_bytes`, `page_count`, `language`, `processing_status`, `epub_file_key`, `epub_published`, `conversion_confidence`, `conversion_quality_score`, `rights_conversion_allowed`.
- **`book_chapters`** (extended) & **`book_sections`**: Stable IDs, hierarchy levels (`1` chapter, `2` section, `3` subsection), `section_type` (`front_matter`, `chapter`, `section`, `subsection`, `exercise`, `glossary`, `appendix`), `pdf_page_start`, `pdf_page_end`, `epub_href`, `epub_anchor`, `content_ref`.
- **`book_content_blocks`**: Individual canonical blocks (`heading`, `paragraph`, `image`, `table`, `math`, `exercise`, `learning_objective`, `callout`, `list_item`) with MathML/LaTeX, table JSON, and PDF page + EPUB anchor cross-links.
- **`book_extracted_assets`**, **`book_epub_artifacts`**, **`book_processing_jobs`**, **`book_conversion_reports`**, **`admin_audit_logs`**.
- **`reading_progress`** & **`bookmarks`** (extended): Track `active_format` (`pdf` | `epub`), `epub_chapter_href`, `epub_anchor`, `canonical_section_id`, and `page_number`.

All new tables enable Row Level Security (RLS): authenticated learners can read published book structures/progress/bookmarks, while job management and structure editing require admin authorization.

---

## 4. Environment Variables & Optional External Workers

The TypeScript/Node pipeline runs natively inside the Express server (`pdfjs-dist`, pure-Node PNG encoder, `tesseract.js`, `jszip`, `katex`). Optional external tools can be enabled via environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `PDF_OCR_WORKER_URL` | Optional HTTP endpoint (e.g. Python PyMuPDF + Tesseract microservice) accepting `image/png` POST and returning `{ text }` | Falls back to local `tesseract` CLI, then `tesseract.js` |
| `EPUBCHECK_CMD` | Path to Java `epubcheck` wrapper CLI for strict external W3C validation alongside built-in structural validation | `"epubcheck"` (optional; built-in validator always runs) |
| `B2_ENDPOINT` / `B2_KEY_ID` / `B2_APPLICATION_KEY` / `B2_BUCKET_NAME` | Backblaze B2 S3-compatible credentials for storing source PDFs and derived EPUBs/assets | Local disk fallback under `uploads/` |

---

## 5. REST API Endpoints (`server.ts`)

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/books/:id/conversion` | Public/Session | Processing job, quality report, and EPUB publication overview |
| `POST` | `/api/books/:id/reprocess` | Admin | Enqueue non-blocking 12-stage PDF-to-EPUB 3 job + audit log |
| `GET` | `/api/books/:id/toc` | Public/Session | Unified hierarchical Table of Contents mapping PDF pages ↔ EPUB anchors |
| `GET` | `/api/books/:id/structure` | Public/Session | Full `CanonicalBookStructure` JSON |
| `PATCH` | `/api/books/:id/structure` | Admin | Save edited TOC/sections, rebuild & validate EPUB 3, optionally publish |
| `GET` | `/api/books/:id/chapters/:chapterId` | Public/Session | Retrieve canonical blocks for a single chapter |
| `GET` | `/api/books/:id/search?q=...` | Public/Session | Search textbook passages across canonical structure |
| `GET` | `/api/books/:id/pdf` | Public/Session | Stream original authoritative PDF |
| `GET` | `/api/books/:id/epub` | Public/Session (`?preview=true` requires Admin) | Stream published EPUB 3 (returns `404 EPUB_NOT_PUBLISHED` if unpublished) |
| `GET` | `/api/books/:id/assets/:assetName` | Public/Session | Stream extracted PNG diagram/figure |
| `GET/POST` | `/api/books/:id/progress` | Optional Bearer | Load/sync student reading progress (`activeFormat`, `currentPage`, `epubChapterHref`) |
| `GET/POST/DELETE` | `/api/books/:id/bookmarks` | Optional Bearer | Load/create/remove canonical bookmarks across PDF and EPUB 3 |
| `GET` | `/api/admin/audit-logs` | Admin | Inspect conversion and structure edit audit trail |

---

## 6. Quality Confidence & Publication Rules

- **High confidence (`score >= 82`, zero validation errors, zero failed OCR pages)**: Automatically published (`epubPublished = true`). Students see both `PDF` and `EPUB 3` in the Reader switcher.
- **Medium confidence (`55 <= score < 82` and validation passed)**: Marked `needs_review`; admin inspects TOC/warnings in the Admin Dashboard (`EPUB / TOC`) and clicks **Save & Publish EPUB 3** when ready.
- **Low confidence or failed EPUB validation**: Never published; original PDF remains 100% accessible to students.

---

## 7. Running Tests & Verification

```bash
# Run PDF-to-EPUB unit & integration tests
npx tsx --test tests/pdfToEpub.test.ts

# Type-check & production bundle check
npm run build
npm run lint
```
