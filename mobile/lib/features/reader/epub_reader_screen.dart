import 'dart:typed_data';

import 'package:epub_view/epub_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/book.dart';
import '../library/library_controller.dart';
import '../tutor/models.dart';
import '../tutor/tutor_controller.dart';

enum _EpubTheme {
  paper('Paper', Color(0xFFFFFFFF), Color(0xFF1E293B)),
  sepia('Sepia', Color(0xFFF4ECD8), Color(0xFF2C2925)),
  dark('Dark', Color(0xFF161618), Color(0xFFE5E5EA)),
  amoled('AMOLED', Color(0xFF000000), Color(0xFFE5E5EA));

  const _EpubTheme(this.label, this.background, this.foreground);
  final String label;
  final Color background;
  final Color foreground;
}

class EpubReaderScreen extends ConsumerStatefulWidget {
  const EpubReaderScreen({
    super.key,
    required this.book,
    required this.decryptedBytes,
    this.initialCfi,
    this.isOfflineEncrypted = true,
  });

  final MobileBook book;
  final Uint8List decryptedBytes;
  final String? initialCfi;
  final bool isOfflineEncrypted;

  @override
  ConsumerState<EpubReaderScreen> createState() => _EpubReaderScreenState();
}

class _EpubReaderScreenState extends ConsumerState<EpubReaderScreen> {
  late final EpubController _epubController;
  _EpubTheme _theme = _EpubTheme.sepia;
  double _fontSize = 17;
  String? _currentChapterTitle;

  @override
  void initState() {
    super.initState();
    _epubController = EpubController(
      document: EpubDocument.openData(widget.decryptedBytes),
      epubCfi: widget.initialCfi,
    );
    _epubController.currentValueListenable.addListener(_onPositionChanged);
  }

  void _onPositionChanged() {
    final val = _epubController.currentValueListenable.value;
    if (val == null) return;
    final chapterTitle = val.chapter?.Title?.trim();
    if (chapterTitle != null &&
        chapterTitle.isNotEmpty &&
        chapterTitle != _currentChapterTitle &&
        mounted) {
      setState(() => _currentChapterTitle = chapterTitle);
    }

    final cfi = _epubController.generateEpubCfi();
    final total = _epubController.tableOfContentsListenable.value.length;
    final chapterIndex = val.chapterNumber;
    final pct = total > 0
        ? (((chapterIndex + 1) / total) * 100).round().clamp(1, 100)
        : 10;

    ref
        .read(booksRepositoryProvider)
        .saveProgress(book: widget.book, epubCfi: cfi, progressPercent: pct);
  }

  @override
  void dispose() {
    _epubController.currentValueListenable.removeListener(_onPositionChanged);
    _epubController.dispose();
    super.dispose();
  }

  KcseSubject _inferSubject() {
    final hay = '${widget.book.title} ${widget.book.subjects.join(" ")}'
        .toLowerCase();
    if (hay.contains('physic')) return KcseSubject.physics;
    if (hay.contains('chem')) return KcseSubject.chemistry;
    if (hay.contains('bio')) return KcseSubject.biology;
    if (hay.contains('math') || hay.contains('calc')) {
      return KcseSubject.mathematics;
    }
    if (hay.contains('english') || hay.contains('lit')) {
      return KcseSubject.english;
    }
    if (hay.contains('hist')) return KcseSubject.history;
    if (hay.contains('geo')) return KcseSubject.geography;
    return KcseSubject.general;
  }

  void _askSageTutor() {
    final tutor = ref.read(tutorControllerProvider.notifier);
    tutor.setSubject(_inferSubject());
    final chapterNote = _currentChapterTitle != null
        ? ' (${_currentChapterTitle!})'
        : '';
    tutor.setActiveBookContext(
      'Reading EPUB: "${widget.book.title}"$chapterNote by ${widget.book.displayPublisher}',
    );
    context.push('/tutor');
  }

  void _openTypographySheet() {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Reflowable EPUB Display',
                  style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Text('Font Size: ${_fontSize.round()} pt'),
                Slider(
                  min: 13,
                  max: 26,
                  divisions: 13,
                  value: _fontSize,
                  onChanged: (v) {
                    setModalState(() => _fontSize = v);
                    setState(() => _fontSize = v);
                  },
                ),
                const SizedBox(height: 8),
                const Text('Reading Surface'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final t in _EpubTheme.values)
                      ChoiceChip(
                        label: Text(t.label),
                        selected: _theme == t,
                        onSelected: (_) {
                          setModalState(() => _theme = t);
                          setState(() => _theme = t);
                        },
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _theme.background,
      appBar: AppBar(
        backgroundColor: _theme.background,
        foregroundColor: _theme.foreground,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.book.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
            Row(
              children: [
                if (widget.isOfflineEncrypted) ...[
                  const Icon(Icons.lock, size: 11, color: Colors.green),
                  const SizedBox(width: 4),
                ],
                Expanded(
                  child: EpubViewActualChapter(
                    controller: _epubController,
                    builder: (chapterValue) => Text(
                      chapterValue?.chapter?.Title?.trim() ?? 'Reflowable EPUB',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        color: _theme.foreground.withOpacity(0.68),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Typography & Theme',
            icon: const Icon(Icons.text_fields),
            onPressed: _openTypographySheet,
          ),
          IconButton(
            tooltip: 'Ask Sage AI about this chapter',
            icon: const Icon(Icons.auto_awesome),
            onPressed: _askSageTutor,
          ),
          Builder(
            builder: (ctx) => IconButton(
              tooltip: 'Table of Contents',
              icon: const Icon(Icons.toc),
              onPressed: () => Scaffold.of(ctx).openEndDrawer(),
            ),
          ),
        ],
      ),
      endDrawer: Drawer(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  'Chapters & Strands',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: EpubViewTableOfContents(controller: _epubController),
              ),
            ],
          ),
        ),
      ),
      body: EpubView(
        controller: _epubController,
        builders: EpubViewBuilders<DefaultBuilderOptions>(
          options: DefaultBuilderOptions(
            textStyle: TextStyle(
              fontSize: _fontSize,
              height: 1.55,
              color: _theme.foreground,
            ),
            chapterPadding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 16,
            ),
            paragraphPadding: const EdgeInsets.symmetric(
              horizontal: 20,
              vertical: 6,
            ),
          ),
          chapterDividerBuilder: (_) => Divider(
            color: _theme.foreground.withOpacity(0.15),
          ),
          loaderBuilder: (_) =>
              const Center(child: CircularProgressIndicator()),
          errorBuilder: (_, error) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not render EPUB: $error',
                style: TextStyle(color: _theme.foreground),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
