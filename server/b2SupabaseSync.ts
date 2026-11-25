import fs from "fs";
import path from "path";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSystemBookConfigRow } from "../shared/canonicalBookCovers";
import {
  buildB2CurriculumPath,
  parseB2CurriculumKey,
  resolveSubjectCategory,
  sanitizeB2ObjectKey,
} from "../shared/b2StoragePaths";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(val?: string | null): boolean {
  return Boolean(val && UUID_RE.test(String(val).trim()));
}

export function getMimeTypeFromName(filename: string): string {
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".epub")) return "application/epub+zip";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export function toAsciiS3Meta(val?: string | null): string {
  return String(val || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 256);
}

export async function listAllB2Objects(
  s3: S3Client | null,
  bucketName: string
): Promise<{ objects: any[]; keySet: Set<string> }> {
  const objects: any[] = [];
  const keySet = new Set<string>();
  if (!s3 || !bucketName) return { objects, keySet };

  let continuationToken: string | undefined = undefined;
  let pageCount = 0;
  do {
    const listRes: any = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 250,
        ContinuationToken: continuationToken,
      })
    );
    if (Array.isArray(listRes?.Contents)) {
      for (const obj of listRes.Contents) {
        objects.push(obj);
        if (obj?.Key) keySet.add(String(obj.Key));
      }
    }
    continuationToken = listRes?.IsTruncated ? listRes?.NextContinuationToken : undefined;
    pageCount += 1;
  } while (continuationToken && pageCount < 10);

  return { objects, keySet };
}

function isMissingColumnSchemaError(err: any): boolean {
  const code = String(err?.code || "");
  const msg = String(err?.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find the")
  );
}

export async function upsertBookInSupabase(
  sb: SupabaseClient | null,
  book: {
    id?: string;
    title: string;
    author?: string;
    publisher?: string;
    isbn?: string;
    isKicdApproved?: boolean;
    description?: string;
    category?: string;
    subjectCategory?: string;
    level?: string;
    curriculum?: string | string[];
    subjects?: string | string[];
    country?: string | string[];
    coverImage?: string;
    fileUrl?: string;
    b2Bucket?: string;
    format?: string;
    fileSizeBytes?: number;
  },
  extra?: { b2Synced?: boolean }
): Promise<{ synced: boolean; supabaseId?: string; error?: string }> {
  if (!sb || !book?.title || isSystemBookConfigRow(book)) {
    return { synced: false, error: !sb ? "Supabase not configured" : "Invalid book payload" };
  }

  const title = String(book.title).trim();
  const author = String(book.author || book.publisher || "Unknown Author").trim();
  const curriculumVal = Array.isArray(book.curriculum)
    ? book.curriculum[0] || null
    : book.curriculum
      ? String(book.curriculum).trim() || null
      : null;
  const subjectsVal = Array.isArray(book.subjects)
    ? book.subjects.map((s) => String(s || "").trim()).filter(Boolean).join(", ") || null
    : typeof book.subjects === "string" && book.subjects.trim()
      ? book.subjects.trim()
      : null;
  const countryVal = Array.isArray(book.country)
    ? book.country[0] || null
    : book.country
      ? String(book.country).trim() || null
      : null;
  const fileUrl = book.fileUrl ? String(book.fileUrl).trim() : null;
  const parsedShelf = fileUrl ? parseB2CurriculumKey(fileUrl) : { isCurriculumShelfPath: false, subjectCategory: undefined };
  const subjectCategory =
    (book.subjectCategory && String(book.subjectCategory).trim()) ||
    parsedShelf.subjectCategory ||
    resolveSubjectCategory({
      subjects: subjectsVal,
      category: book.category,
      title,
    }).label;
  const formatVal =
    book.format === "epub" || String(fileUrl || "").toLowerCase().split("?")[0].endsWith(".epub")
      ? "epub"
      : "pdf";

  const corePayload: Record<string, any> = {
    title,
    author,
    description: book.description || "",
    category: book.category || "Textbook",
    education_level: book.level || "All",
    curriculum: curriculumVal,
    subjects: subjectsVal,
    cover_image: book.coverImage || "",
    file_url: fileUrl,
    publisher: book.publisher || null,
    is_kicd_approved: Boolean(book.isKicdApproved),
    isbn: book.isbn || null,
  };

  const extendedPayload: Record<string, any> = {
    ...corePayload,
    ...(countryVal ? { country: countryVal } : {}),
    ...(typeof book.fileSizeBytes === "number" && book.fileSizeBytes > 0
      ? { file_size_bytes: book.fileSizeBytes }
      : {}),
    subject_category: subjectCategory || null,
    b2_bucket: book.b2Bucket || null,
    b2_key: fileUrl,
    book_format: formatVal,
    storage_provider: fileUrl && fileUrl.includes("/") ? "b2" : "supabase",
    ...(extra?.b2Synced ? { synced_to_b2_at: new Date().toISOString() } : {}),
  };

  // Locate existing Supabase row by UUID id, file_url, b2_key, or title
  let existingId: string | undefined;
  if (isUuid(book.id)) {
    existingId = String(book.id);
  } else {
    if (fileUrl) {
      try {
        const { data: byUrl } = await sb
          .from("books")
          .select("id")
          .or(`file_url.eq.${fileUrl.replace(/,/g, "")},b2_key.eq.${fileUrl.replace(/,/g, "")}`)
          .limit(1)
          .maybeSingle();
        if (byUrl?.id) existingId = byUrl.id;
      } catch (_) {
        try {
          const { data: byFileUrl } = await sb.from("books").select("id").eq("file_url", fileUrl).limit(1).maybeSingle();
          if (byFileUrl?.id) existingId = byFileUrl.id;
        } catch (_) {}
      }
    }
    if (!existingId) {
      try {
        const { data: byTitle } = await sb
          .from("books")
          .select("id")
          .eq("title", title)
          .eq("author", author)
          .limit(1)
          .maybeSingle();
        if (byTitle?.id) existingId = byTitle.id;
      } catch (_) {}
    }
  }

  const runWrite = async (payloadToUse: Record<string, any>) => {
    if (existingId) {
      return sb.from("books").update(payloadToUse).eq("id", existingId).select("id").maybeSingle();
    }
    return sb
      .from("books")
      .upsert(payloadToUse, { onConflict: "title,author" })
      .select("id")
      .maybeSingle();
  };

  let res = await runWrite(extendedPayload);
  if (res.error && isMissingColumnSchemaError(res.error)) {
    res = await runWrite(corePayload);
  }

  // Fallback plain insert if upsert constraint is absent on older schema
  if (res.error && String(res.error.message || "").toLowerCase().includes("no unique or exclusion constraint")) {
    const cleanInsert = async (payloadToUse: Record<string, any>) =>
      sb.from("books").insert([payloadToUse]).select("id").maybeSingle();
    res = await cleanInsert(extendedPayload);
    if (res.error && isMissingColumnSchemaError(res.error)) {
      res = await cleanInsert(corePayload);
    }
  }

  if (res.error) {
    return { synced: false, error: res.error.message };
  }

  return { synced: true, supabaseId: res.data?.id || existingId };
}

export function mapSupabaseRowToCatalogBook(
  b: any,
  b2KeySet: Set<string>,
  b2BucketName: string
): any {
  const isKlb =
    Boolean(b.publisher?.toLowerCase().includes("klb")) ||
    Boolean(b.author?.toLowerCase().includes("klb")) ||
    Boolean(b.title?.toLowerCase().includes("klb")) ||
    Boolean(b.author?.toLowerCase().includes("kenya literature bureau"));

  const fileUrl = b.b2_key || b.file_url || "";
  const safeKey = sanitizeB2ObjectKey(fileUrl);
  const parsedShelf = parseB2CurriculumKey(fileUrl);
  const subjectsList = b.subjects
    ? Array.isArray(b.subjects)
      ? b.subjects
      : String(b.subjects)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
    : parsedShelf.subjectCategory
      ? [parsedShelf.subjectCategory]
      : undefined;

  const curriculumList = b.curriculum
    ? Array.isArray(b.curriculum)
      ? b.curriculum
      : [b.curriculum]
    : parsedShelf.curriculumShelf
      ? [parsedShelf.curriculumShelf]
      : isKlb
        ? ["CBC", "KCSE"]
        : undefined;

  const subjectCategory =
    b.subject_category ||
    parsedShelf.subjectCategory ||
    resolveSubjectCategory({
      subjects: subjectsList,
      category: b.category,
      title: b.title,
    }).label;

  const format =
    b.book_format === "epub" || String(fileUrl).toLowerCase().split("?")[0].endsWith(".epub")
      ? "epub"
      : "pdf";

  const inB2 = Boolean(safeKey && b2KeySet.has(safeKey));

  return {
    id: b.id,
    title: b.title,
    author: b.author || (isKlb ? "Kenya Literature Bureau (KLB)" : "Unknown"),
    publisher: b.publisher || (isKlb ? "Kenya Literature Bureau (KLB)" : undefined),
    isKicdApproved: b.is_kicd_approved ?? isKlb,
    isbn: b.isbn || undefined,
    coverImage: b.cover_image || "",
    coverMode: b.cover_mode || undefined,
    pdfCoverPage: b.pdf_cover_page ?? undefined,
    customCover: b.custom_cover || undefined,
    category: b.category || "Textbook",
    subjectCategory,
    rating: 4.8,
    description: b.description || "",
    level: b.education_level || "All",
    curriculum: curriculumList,
    subjects: subjectsList,
    country: b.country
      ? Array.isArray(b.country)
        ? b.country
        : [b.country]
      : b.description?.includes("Location: ")
        ? [b.description.split("Location: ")[1].trim()]
        : isKlb
          ? ["Kenya"]
          : undefined,
    fileUrl,
    b2Bucket: b.b2_bucket || (b2BucketName || undefined),
    format,
    b2Synced: inB2,
    supabaseSynced: true,
    needsShelfMigration: Boolean(fileUrl && (!parsedShelf.isCurriculumShelfPath || !inB2)),
  };
}

export async function resolveBookBinaryBuffer(params: {
  key: string;
  uploadsDir: string;
  s3: S3Client | null;
  b2BucketName: string;
  sb: SupabaseClient | null;
}): Promise<{ buffer: Buffer; source: "disk" | "b2" | "supabase"; contentType: string } | null> {
  const safeKey = sanitizeB2ObjectKey(params.key);
  if (!safeKey) return null;
  const strippedUploadsKey = safeKey.replace(/^uploads\/+/, "");
  const leafName = safeKey.split("/").pop() || safeKey;
  const resolvedUploadsDir = path.resolve(params.uploadsDir);
  const contentType = getMimeTypeFromName(leafName);

  // 1. Local disk
  for (const rel of [safeKey, strippedUploadsKey]) {
    const candidate = path.resolve(resolvedUploadsDir, rel);
    if (candidate.startsWith(resolvedUploadsDir + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const buf = fs.readFileSync(candidate);
      if (buf.length > 0) return { buffer: buf, source: "disk", contentType };
    }
  }

  // 2. Backblaze B2
  if (params.s3 && params.b2BucketName) {
    for (const s3Key of Array.from(new Set([safeKey, strippedUploadsKey]))) {
      try {
        const res = await params.s3.send(new GetObjectCommand({ Bucket: params.b2BucketName, Key: s3Key }));
        if (res.Body) {
          const chunks: any[] = [];
          for await (const chunk of res.Body as any) chunks.push(chunk);
          const buf = Buffer.concat(chunks);
          if (buf.length > 0) {
            return { buffer: buf, source: "b2", contentType: res.ContentType || contentType };
          }
        }
      } catch (_) {}
    }
  }

  // 3. Supabase Storage buckets (handles legacy paths like avatars/178134...-file.pdf or workspace-files)
  if (params.sb) {
    const noAvatarsPrefix = safeKey.replace(/^avatars\/+/, "");
    const noWorkspacePrefix = safeKey.replace(/^workspace-files\/+/, "");
    const variants = Array.from(new Set([safeKey, noAvatarsPrefix, noWorkspacePrefix, strippedUploadsKey, leafName]));
    for (const bucket of ["books", "avatars", "workspace-files", "uploads", "public"]) {
      for (const variant of variants) {
        try {
          const { data: blobData, error } = await params.sb.storage.from(bucket).download(variant);
          if (!error && blobData) {
            const buf = Buffer.from(await blobData.arrayBuffer());
            if (buf.length > 0) {
              return { buffer: buf, source: "supabase", contentType: blobData.type || contentType };
            }
          }
        } catch (_) {}
      }
    }
  }

  return null;
}

export async function syncOrMoveBookToB2Shelf(params: {
  book: any;
  uploadsDir: string;
  s3: S3Client | null;
  b2BucketName: string;
  sb: SupabaseClient | null;
  b2KeySet?: Set<string>;
  deleteOldB2Key?: boolean;
}): Promise<{
  movedOrSynced: boolean;
  newKey: string;
  oldKey: string;
  curriculumShelf: string;
  subjectCategory: string;
  source?: string;
  error?: string;
}> {
  const oldKey = sanitizeB2ObjectKey(params.book?.fileUrl || "");
  const targetPath = buildB2CurriculumPath({
    curriculum: params.book?.curriculum,
    subjects: params.book?.subjects,
    subjectCategoryOverride: params.book?.subjectCategory,
    category: params.book?.category,
    level: params.book?.level,
    title: params.book?.title,
  });

  const leafRaw = (oldKey.split("/").pop() || `${Date.now()}-${params.book?.title || "book"}.pdf`).replace(
    /[^a-zA-Z0-9.\-_]/g,
    "_"
  );
  const newKey = `${targetPath.prefix}/${leafRaw}`;
  const inB2Already = Boolean(oldKey && params.b2KeySet?.has(oldKey));

  if (!params.s3 || !params.b2BucketName) {
    return {
      movedOrSynced: false,
      newKey: oldKey || newKey,
      oldKey,
      curriculumShelf: targetPath.curriculumShelf,
      subjectCategory: targetPath.subjectCategory,
      error: "B2 not configured",
    };
  }

  // Already in exact right B2 shelf & present in B2
  if (oldKey === newKey && inB2Already) {
    await upsertBookInSupabase(
      params.sb,
      {
        ...params.book,
        fileUrl: newKey,
        b2Bucket: params.b2BucketName,
        subjectCategory: targetPath.subjectCategory,
      },
      { b2Synced: true }
    );
    return {
      movedOrSynced: false,
      newKey,
      oldKey,
      curriculumShelf: targetPath.curriculumShelf,
      subjectCategory: targetPath.subjectCategory,
    };
  }

  const s3Meta: Record<string, string> = {
    "edu-curriculum": toAsciiS3Meta(targetPath.curriculumShelf),
    "edu-subject-category": toAsciiS3Meta(targetPath.subjectCategory),
    "edu-title": toAsciiS3Meta(params.book?.title),
    "edu-level": toAsciiS3Meta(params.book?.level || "School"),
  };
  if (params.book?.subjects) {
    const subjStr = Array.isArray(params.book.subjects)
      ? params.book.subjects.join(", ")
      : String(params.book.subjects);
    if (subjStr) s3Meta["edu-subjects"] = toAsciiS3Meta(subjStr);
  }
  if (params.book?.category) s3Meta["edu-category"] = toAsciiS3Meta(params.book.category);

  // Fast server-side copy within B2 if object is already at oldKey in B2
  if (inB2Already && oldKey && oldKey !== newKey) {
    try {
      await params.s3.send(
        new CopyObjectCommand({
          Bucket: params.b2BucketName,
          CopySource: `${params.b2BucketName}/${oldKey.split("/").map(encodeURIComponent).join("/")}`,
          Key: newKey,
          ContentType: getMimeTypeFromName(leafRaw),
          Metadata: s3Meta,
          MetadataDirective: "REPLACE",
        })
      );
      if (params.deleteOldB2Key !== false) {
        await params.s3.send(new DeleteObjectCommand({ Bucket: params.b2BucketName, Key: oldKey })).catch(() => {});
      }
      params.b2KeySet?.add(newKey);
      // Mirror local disk cache path if present
      const resolvedUploadsDir = path.resolve(params.uploadsDir);
      const oldLocal = path.resolve(resolvedUploadsDir, oldKey);
      const newLocal = path.resolve(resolvedUploadsDir, newKey);
      if (
        oldLocal.startsWith(resolvedUploadsDir + path.sep) &&
        newLocal.startsWith(resolvedUploadsDir + path.sep) &&
        fs.existsSync(oldLocal)
      ) {
        fs.mkdirSync(path.dirname(newLocal), { recursive: true });
        fs.copyFileSync(oldLocal, newLocal);
        try {
          fs.unlinkSync(oldLocal);
        } catch (_) {}
      }

      await upsertBookInSupabase(
        params.sb,
        {
          ...params.book,
          fileUrl: newKey,
          b2Bucket: params.b2BucketName,
          subjectCategory: targetPath.subjectCategory,
        },
        { b2Synced: true }
      );

      return {
        movedOrSynced: true,
        newKey,
        oldKey,
        curriculumShelf: targetPath.curriculumShelf,
        subjectCategory: targetPath.subjectCategory,
        source: "b2-copy",
      };
    } catch (copyErr: any) {
      console.warn(`[B2Sync] CopyObject fallback to buffer upload for ${oldKey}:`, copyErr?.message || copyErr);
    }
  }

  // Otherwise locate binary from local disk, B2, or Supabase Storage and upload to new B2 shelf
  const found = oldKey
    ? await resolveBookBinaryBuffer({
        key: oldKey,
        uploadsDir: params.uploadsDir,
        s3: params.s3,
        b2BucketName: params.b2BucketName,
        sb: params.sb,
      })
    : null;

  if (!found || found.buffer.length === 0) {
    return {
      movedOrSynced: false,
      newKey: oldKey || newKey,
      oldKey,
      curriculumShelf: targetPath.curriculumShelf,
      subjectCategory: targetPath.subjectCategory,
      error: "Binary source not found in disk, B2, or Supabase Storage",
    };
  }

  await params.s3.send(
    new PutObjectCommand({
      Bucket: params.b2BucketName,
      Key: newKey,
      Body: found.buffer,
      ContentType: found.contentType,
      Metadata: s3Meta,
    })
  );
  params.b2KeySet?.add(newKey);

  // Save local disk cache at new canonical path and remove stale local copy if moved
  const resolvedUploadsDir = path.resolve(params.uploadsDir);
  const oldLocal = oldKey ? path.resolve(resolvedUploadsDir, oldKey) : "";
  const newLocal = path.resolve(resolvedUploadsDir, newKey);
  if (newLocal.startsWith(resolvedUploadsDir + path.sep)) {
    fs.mkdirSync(path.dirname(newLocal), { recursive: true });
    fs.writeFileSync(newLocal, found.buffer);
  }
  if (
    oldLocal &&
    oldLocal !== newLocal &&
    oldLocal.startsWith(resolvedUploadsDir + path.sep) &&
    fs.existsSync(oldLocal)
  ) {
    try {
      fs.unlinkSync(oldLocal);
    } catch (_) {}
  }

  if (params.deleteOldB2Key !== false && oldKey && oldKey !== newKey && (inB2Already || found.source === "b2")) {
    await params.s3.send(new DeleteObjectCommand({ Bucket: params.b2BucketName, Key: oldKey })).catch(() => {});
  }

  await upsertBookInSupabase(
    params.sb,
    {
      ...params.book,
      fileUrl: newKey,
      b2Bucket: params.b2BucketName,
      subjectCategory: targetPath.subjectCategory,
      fileSizeBytes: found.buffer.length,
    },
    { b2Synced: true }
  );

  return {
    movedOrSynced: true,
    newKey,
    oldKey,
    curriculumShelf: targetPath.curriculumShelf,
    subjectCategory: targetPath.subjectCategory,
    source: found.source,
  };
}
