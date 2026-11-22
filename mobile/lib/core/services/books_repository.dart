import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
import '../models/book.dart';
import 'offline_vault_service.dart';

class BooksRepository {
  BooksRepository({
    required this.supabase,
    required this.vault,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  static const globalBookCoversRowId = '00000000-0000-4000-8000-00000000c001';
  static const globalBookCoversRowTitle = '__EDU_GLOBAL_BOOK_COVERS_V1__';

  final SupabaseClient supabase;
  final OfflineVaultService vault;
  final http.Client _http;

  String get _currentUserId => supabase.auth.currentUser?.id ?? 'anonymous';

  Future<List<MobileBook>> fetchCatalog() async {
    final collected = <String, MobileBook>{};
    final vaultEntries = await vault.loadManifest();

    // 1. Fetch from Edu AI API server if API_BASE_URL was provided via --dart-define
    if (AppConfig.hasApiBaseUrl) {
      try {
        final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
        final res = await _http
            .get(Uri.parse('$base/api/books'))
            .timeout(const Duration(seconds: 8));
        if (res.statusCode == 200) {
          final decoded = jsonDecode(res.body);
          if (decoded is Map<String, dynamic> && decoded['books'] is List) {
            for (final item in decoded['books'] as List) {
              if (item is Map<String, dynamic>) {
                final book = MobileBook.fromJson(item);
                collected[book.id] = _mergeProgress(book, vaultEntries[book.id]);
              }
            }
          }
        }
      } catch (_) {
        // Fall through to direct Supabase / offline vault
      }
    }

    // 2. Fetch directly from Supabase `books` table
    try {
      final rows = await supabase
          .from('books')
          .select()
          .order('created_at', ascending: false);

      for (final row in rows) {
        final id = row['id']?.toString() ?? '';
        final title = row['title']?.toString() ?? '';
        if (id == globalBookCoversRowId || title == globalBookCoversRowTitle) {
          continue;
        }
        final book = MobileBook.fromJson(Map<String, dynamic>.from(row));
        collected.putIfAbsent(
          book.id,
          () => _mergeProgress(book, vaultEntries[book.id]),
        );
      }
    } catch (_) {
      // Offline or unconfigured table
    }

    // 3. Fetch Kenyan CBC / KCSE `curriculum_books`
    try {
      final rows = await supabase
          .from('curriculum_books')
          .select('*, subject:subjects(name), grade_level:grade_levels(name)')
          .order('created_at', ascending: false);

      for (final row in rows) {
        final map = Map<String, dynamic>.from(row);
        final subj = map['subject'];
        final grade = map['grade_level'];
        final normalized = <String, dynamic>{
          ...map,
          'author': map['publisher'] ?? 'KICD Curriculum',
          'fileUrl': map['pdf_file_url'] ?? map['file_url'] ?? '',
          'coverImage': map['cover_image_url'] ?? '',
          'subjects': subj is Map ? [subj['name']] : null,
          'level': grade is Map ? grade['name'] : 'School',
          'curriculum': const ['CBC', 'KCSE'],
        };
        final book = MobileBook.fromJson(normalized);
        collected.putIfAbsent(
          book.id,
          () => _mergeProgress(book, vaultEntries[book.id]),
        );
      }
    } catch (_) {}

    // 4. Always surface encrypted offline vault entries even with zero network
    for (final entry in vaultEntries.values) {
      collected.putIfAbsent(
        entry.book.id,
        () => entry.book.copyWith(readProgress: entry.progressPercent),
      );
    }

    return collected.values.toList();
  }

  MobileBook _mergeProgress(MobileBook book, OfflineVaultEntry? entry) {
    if (entry == null) return book;
    return book.copyWith(
      readProgress: entry.progressPercent > book.readProgress
          ? entry.progressPercent
          : book.readProgress,
    );
  }

  /// Resolves an authenticated download URL for either HTTP, Express `/api/download`,
  /// or Supabase Storage `books` bucket.
  Future<({String url, Map<String, String> headers})> resolveDownloadTarget(
    MobileBook book,
  ) async {
    final token = supabase.auth.currentSession?.accessToken;
    final headers = <String, String>{
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };

    final rawKey = book.fileUrl.trim();
    if (rawKey.startsWith('http://') || rawKey.startsWith('https://')) {
      return (url: rawKey, headers: headers);
    }

    if (AppConfig.hasApiBaseUrl) {
      final base = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
      final key = rawKey.isNotEmpty ? rawKey : '${book.id}.${book.format.name}';
      return (
        url: '$base/api/download?key=${Uri.encodeComponent(key)}',
        headers: headers,
      );
    }

    // Supabase Storage signed URL fallback
    final storageKey = rawKey.replaceFirst(RegExp(r'^books/'), '');
    final signed = await supabase.storage
        .from('books')
        .createSignedUrl(storageKey, 3600);
    return (url: signed, headers: headers);
  }

  Future<OfflineVaultEntry> downloadToEncryptedVault({
    required MobileBook book,
    void Function(double progress)? onProgress,
  }) async {
    final target = await resolveDownloadTarget(book);
    return vault.downloadAndSeal(
      book: book,
      downloadUrl: target.url,
      userId: _currentUserId,
      headers: target.headers,
      onProgress: onProgress,
    );
  }

  Future<void> saveProgress({
    required MobileBook book,
    String? epubCfi,
    int? pdfPage,
    required int progressPercent,
  }) async {
    final clamped = progressPercent.clamp(0, 100);
    await vault.updateReadingPosition(
      bookId: book.id,
      lastEpubCfi: epubCfi,
      lastPdfPage: pdfPage,
      progressPercent: clamped,
    );

    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;

    try {
      await supabase.from('reading_progress').upsert({
        'user_id': uid,
        'book_id': book.id,
        'progress': clamped,
        'current_page': pdfPage,
        'epub_cfi': epubCfi,
        'updated_at': DateTime.now().toIso8601String(),
      }, onConflict: 'user_id,book_id');
    } catch (_) {
      // Offline progress remains safely cached in local vault manifest
    }
  }
}
