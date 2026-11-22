import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/book.dart';
import '../../core/providers.dart';
import '../../core/services/books_repository.dart';
import '../../core/services/offline_vault_service.dart';

final offlineVaultServiceProvider = Provider<OfflineVaultService>(
  (ref) => OfflineVaultService(),
);

final booksRepositoryProvider = Provider<BooksRepository>(
  (ref) => BooksRepository(
    supabase: ref.watch(supabaseProvider),
    vault: ref.watch(offlineVaultServiceProvider),
  ),
);

class LibraryState {
  const LibraryState({
    this.books = const [],
    this.vaultEntries = const {},
    this.downloadProgress = const {},
    this.isLoading = false,
    this.error,
  });

  final List<MobileBook> books;
  final Map<String, OfflineVaultEntry> vaultEntries;
  final Map<String, double> downloadProgress;
  final bool isLoading;
  final String? error;

  LibraryState copyWith({
    List<MobileBook>? books,
    Map<String, OfflineVaultEntry>? vaultEntries,
    Map<String, double>? downloadProgress,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) => LibraryState(
    books: books ?? this.books,
    vaultEntries: vaultEntries ?? this.vaultEntries,
    downloadProgress: downloadProgress ?? this.downloadProgress,
    isLoading: isLoading ?? this.isLoading,
    error: clearError ? null : (error ?? this.error),
  );
}

class LibraryController extends Notifier<LibraryState> {
  @override
  LibraryState build() {
    Future.microtask(refresh);
    return const LibraryState(isLoading: true);
  }

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final repo = ref.read(booksRepositoryProvider);
      final vault = ref.read(offlineVaultServiceProvider);
      final results = await Future.wait([
        repo.fetchCatalog(),
        vault.loadManifest(),
      ]);
      state = state.copyWith(
        books: results[0] as List<MobileBook>,
        vaultEntries: results[1] as Map<String, OfflineVaultEntry>,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Unable to load library: $e',
      );
    }
  }

  Future<void> downloadToVault(MobileBook book) async {
    final nextProgress = Map<String, double>.from(state.downloadProgress);
    nextProgress[book.id] = 0.05;
    state = state.copyWith(downloadProgress: nextProgress, clearError: true);

    try {
      final entry = await ref
          .read(booksRepositoryProvider)
          .downloadToEncryptedVault(
            book: book,
            onProgress: (p) {
              final map = Map<String, double>.from(state.downloadProgress);
              map[book.id] = p;
              state = state.copyWith(downloadProgress: map);
            },
          );
      final updatedVault = Map<String, OfflineVaultEntry>.from(
        state.vaultEntries,
      )..[book.id] = entry;
      final cleanedProgress = Map<String, double>.from(state.downloadProgress)
        ..remove(book.id);
      state = state.copyWith(
        vaultEntries: updatedVault,
        downloadProgress: cleanedProgress,
      );
    } catch (e) {
      final cleanedProgress = Map<String, double>.from(state.downloadProgress)
        ..remove(book.id);
      state = state.copyWith(
        downloadProgress: cleanedProgress,
        error: 'Offline encryption failed for "${book.title}": $e',
      );
    }
  }

  Future<void> removeFromVault(String bookId) async {
    await ref.read(offlineVaultServiceProvider).removeBook(bookId);
    final updatedVault = Map<String, OfflineVaultEntry>.from(state.vaultEntries)
      ..remove(bookId);
    state = state.copyWith(vaultEntries: updatedVault);
  }
}

final libraryControllerProvider =
    NotifierProvider<LibraryController, LibraryState>(LibraryController.new);
