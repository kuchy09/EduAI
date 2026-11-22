import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/book.dart';
import '../../core/providers.dart';
import 'library_controller.dart';

enum _LibraryFilter { all, epub, pdf, offline }

class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  final _searchCtrl = TextEditingController();
  _LibraryFilter _filter = _LibraryFilter.all;
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<MobileBook> _filteredBooks(LibraryState state) {
    final q = _query.trim().toLowerCase();
    return state.books.where((book) {
      final isOffline = state.vaultEntries.containsKey(book.id);
      if (_filter == _LibraryFilter.epub && !book.format.isEpub) return false;
      if (_filter == _LibraryFilter.pdf && !book.format.isPdf) return false;
      if (_filter == _LibraryFilter.offline && !isOffline) return false;
      if (q.isEmpty) return true;
      return book.title.toLowerCase().contains(q) ||
          book.author.toLowerCase().contains(q) ||
          book.displayPublisher.toLowerCase().contains(q) ||
          book.subjects.any((s) => s.toLowerCase().contains(q));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(libraryControllerProvider);
    final controller = ref.read(libraryControllerProvider.notifier);
    final filtered = _filteredBooks(state);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Edu AI Library'),
        actions: [
          IconButton(
            tooltip: 'Sage AI Tutor',
            icon: const Icon(Icons.auto_awesome_outlined),
            onPressed: () => context.go('/tutor'),
          ),
          IconButton(
            tooltip: 'Refresh catalog',
            icon: const Icon(Icons.refresh),
            onPressed: state.isLoading ? null : controller.refresh,
          ),
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(supabaseProvider).auth.signOut(),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Search KCSE / CBC textbooks, publishers, subjects...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
                border: const OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                ChoiceChip(
                  label: Text('All (${state.books.length})'),
                  selected: _filter == _LibraryFilter.all,
                  onSelected: (_) =>
                      setState(() => _filter = _LibraryFilter.all),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  avatar: const Icon(Icons.menu_book_outlined, size: 16),
                  label: const Text('EPUB Reflowable'),
                  selected: _filter == _LibraryFilter.epub,
                  onSelected: (_) =>
                      setState(() => _filter = _LibraryFilter.epub),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  avatar: const Icon(Icons.picture_as_pdf_outlined, size: 16),
                  label: const Text('PDF'),
                  selected: _filter == _LibraryFilter.pdf,
                  onSelected: (_) =>
                      setState(() => _filter = _LibraryFilter.pdf),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  avatar: const Icon(Icons.lock_outline, size: 16),
                  label: Text('Offline Vault (${state.vaultEntries.length})'),
                  selected: _filter == _LibraryFilter.offline,
                  onSelected: (_) =>
                      setState(() => _filter = _LibraryFilter.offline),
                ),
              ],
            ),
          ),
          if (state.error != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: theme.colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                state.error!,
                style: TextStyle(color: theme.colorScheme.onErrorContainer),
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: controller.refresh,
              child: state.isLoading && state.books.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : filtered.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        Center(
                          child: Text(
                            'No matching textbooks found.\nPull down to sync your library.',
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (_, index) {
                        final book = filtered[index];
                        final vaultEntry = state.vaultEntries[book.id];
                        final dlProgress = state.downloadProgress[book.id];
                        return _BookCard(
                          book: book,
                          vaultEntry: vaultEntry,
                          downloadProgress: dlProgress,
                          onOpen: () =>
                              context.push('/reader/${book.id}', extra: book),
                          onDownload: () => controller.downloadToVault(book),
                          onRemoveOffline: () =>
                              controller.removeFromVault(book.id),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BookCard extends StatelessWidget {
  const _BookCard({
    required this.book,
    required this.vaultEntry,
    required this.downloadProgress,
    required this.onOpen,
    required this.onDownload,
    required this.onRemoveOffline,
  });

  final MobileBook book;
  final OfflineVaultEntry? vaultEntry;
  final double? downloadProgress;
  final VoidCallback onOpen;
  final VoidCallback onDownload;
  final VoidCallback onRemoveOffline;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isEpub = book.format.isEpub;
    final isOffline = vaultEntry != null;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 58,
                height: 82,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isEpub
                        ? [scheme.primary, scheme.tertiary]
                        : [scheme.secondary, scheme.surfaceContainerHighest],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      isEpub ? Icons.menu_book : Icons.picture_as_pdf,
                      color: Colors.white,
                      size: 24,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      book.format.label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      book.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${book.displayPublisher} · ${book.category}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall,
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          book.format.tagline,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: isEpub ? scheme.primary : scheme.secondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (book.isKicdApproved)
                          Text(
                            '· KICD Approved',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: Colors.teal.shade700,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        if (isOffline)
                          Text(
                            '· AES-256 Vault (${vaultEntry!.formattedSize})',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: Colors.green.shade700,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                    if (book.readProgress > 0) ...[
                      const SizedBox(height: 8),
                      LinearProgressIndicator(value: book.readProgress / 100),
                    ],
                    if (downloadProgress != null) ...[
                      const SizedBox(height: 8),
                      LinearProgressIndicator(value: downloadProgress),
                    ],
                  ],
                ),
              ),
              Column(
                children: [
                  if (downloadProgress != null)
                    const Padding(
                      padding: EdgeInsets.all(8),
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  else if (isOffline)
                    IconButton(
                      tooltip: 'Remove from Encrypted Vault',
                      icon: const Icon(Icons.verified_user, color: Colors.green),
                      onPressed: onRemoveOffline,
                    )
                  else
                    IconButton(
                      tooltip: 'Download & Encrypt Offline',
                      icon: const Icon(Icons.download_for_offline_outlined),
                      onPressed: onDownload,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
