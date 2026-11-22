import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/book.dart';
import '../../core/providers.dart';
import '../../core/services/offline_vault_service.dart';
import '../library/library_controller.dart';
import 'epub_reader_screen.dart';
import 'pdf_reader_screen.dart';

/// Opens a textbook offline-first from the AES-256 vault, or downloads & seals it
/// on demand before routing to either [EpubReaderScreen] or [PdfReaderScreen].
class ReaderRouterScreen extends ConsumerStatefulWidget {
  const ReaderRouterScreen({
    super.key,
    required this.bookId,
    this.book,
  });

  final String bookId;
  final MobileBook? book;

  @override
  ConsumerState<ReaderRouterScreen> createState() => _ReaderRouterScreenState();
}

class _ReaderRouterScreenState extends ConsumerState<ReaderRouterScreen> {
  MobileBook? _resolvedBook;
  Uint8List? _decryptedBytes;
  OfflineVaultEntry? _vaultEntry;
  double _downloadProgress = 0;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    Future.microtask(_prepareBook);
  }

  Future<void> _prepareBook() async {
    setState(() {
      _loading = true;
      _error = null;
      _downloadProgress = 0;
    });

    try {
      final vault = ref.read(offlineVaultServiceProvider);
      final repo = ref.read(booksRepositoryProvider);
      final userId = ref.read(supabaseProvider).auth.currentUser?.id ?? 'anonymous';

      var book = widget.book;
      if (book == null) {
        final libraryBooks = ref.read(libraryControllerProvider).books;
        book = libraryBooks.where((b) => b.id == widget.bookId).firstOrNull;
        if (book == null) {
          final catalog = await repo.fetchCatalog();
          book = catalog.where((b) => b.id == widget.bookId).firstOrNull;
        }
      }

      if (book == null) {
        throw const VaultSecurityException('Book not found in catalog.');
      }

      _resolvedBook = book;
      var entry = await vault.getEntry(book.id);

      if (entry != null && !entry.isExpired) {
        final bytes = await vault.openDecryptedBytes(
          bookId: book.id,
          userId: userId,
        );
        if (!mounted) return;
        setState(() {
          _vaultEntry = entry;
          _decryptedBytes = bytes;
          _loading = false;
        });
        return;
      }

      // Download and encrypt into the offline vault before opening
      entry = await repo.downloadToEncryptedVault(
        book: book,
        onProgress: (p) {
          if (mounted) setState(() => _downloadProgress = p);
        },
      );
      final bytes = await vault.openDecryptedBytes(
        bookId: book.id,
        userId: userId,
      );
      await ref.read(libraryControllerProvider.notifier).refresh();

      if (!mounted) return;
      setState(() {
        _vaultEntry = entry;
        _decryptedBytes = bytes;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(_resolvedBook?.title ?? 'Opening Book')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(),
                const SizedBox(height: 16),
                Text(
                  _downloadProgress > 0
                      ? 'Encrypting offline copy (${(_downloadProgress * 100).round()}%)...'
                      : 'Unlocking AES-256 textbook vault...',
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_error != null || _decryptedBytes == null || _resolvedBook == null) {
      return Scaffold(
        appBar: AppBar(title: Text(_resolvedBook?.title ?? 'Reader Error')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline, size: 48),
                const SizedBox(height: 12),
                Text(
                  _error ?? 'Could not open textbook.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _prepareBook,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final book = _resolvedBook!;
    if (book.format.isEpub) {
      return EpubReaderScreen(
        book: book,
        decryptedBytes: _decryptedBytes!,
        initialCfi: _vaultEntry?.lastEpubCfi,
        isOfflineEncrypted: _vaultEntry?.encrypted ?? true,
      );
    }

    return PdfReaderScreen(
      book: book,
      decryptedBytes: _decryptedBytes!,
      initialPage: _vaultEntry?.lastPdfPage ?? 1,
      isOfflineEncrypted: _vaultEntry?.encrypted ?? true,
    );
  }
}
