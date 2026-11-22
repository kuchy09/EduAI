import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pdfx/pdfx.dart';

import '../../core/models/book.dart';
import '../library/library_controller.dart';
import '../tutor/models.dart';
import '../tutor/tutor_controller.dart';

class PdfReaderScreen extends ConsumerStatefulWidget {
  const PdfReaderScreen({
    super.key,
    required this.book,
    required this.decryptedBytes,
    this.initialPage = 1,
    this.isOfflineEncrypted = true,
  });

  final MobileBook book;
  final Uint8List decryptedBytes;
  final int initialPage;
  final bool isOfflineEncrypted;

  @override
  ConsumerState<PdfReaderScreen> createState() => _PdfReaderScreenState();
}

class _PdfReaderScreenState extends ConsumerState<PdfReaderScreen> {
  late final PdfControllerPinch _pdfController;
  int _currentPage = 1;
  int _totalPages = 0;
  bool _nightMode = false;

  @override
  void initState() {
    super.initState();
    _currentPage = widget.initialPage < 1 ? 1 : widget.initialPage;
    _pdfController = PdfControllerPinch(
      document: PdfDocument.openData(widget.decryptedBytes),
      initialPage: _currentPage,
    );
  }

  @override
  void dispose() {
    _pdfController.dispose();
    super.dispose();
  }

  void _onPageChanged(int page) {
    setState(() => _currentPage = page);
    final pct = _totalPages > 0
        ? ((page / _totalPages) * 100).round().clamp(1, 100)
        : 0;
    ref
        .read(booksRepositoryProvider)
        .saveProgress(book: widget.book, pdfPage: page, progressPercent: pct);
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
    return KcseSubject.general;
  }

  void _askSageTutor() {
    final tutor = ref.read(tutorControllerProvider.notifier);
    tutor.setSubject(_inferSubject());
    tutor.setActiveBookContext(
      'Reading PDF: "${widget.book.title}" (Page $_currentPage of $_totalPages)',
    );
    context.push('/tutor');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _nightMode ? const Color(0xFF121212) : Colors.grey.shade200,
      appBar: AppBar(
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
                Text(
                  _totalPages > 0
                      ? 'Page $_currentPage of $_totalPages'
                      : 'PDF Textbook',
                  style: const TextStyle(fontSize: 11),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: _nightMode ? 'Daylight PDF' : 'Night Invert PDF',
            icon: Icon(_nightMode ? Icons.light_mode : Icons.dark_mode),
            onPressed: () => setState(() => _nightMode = !_nightMode),
          ),
          IconButton(
            tooltip: 'Ask Sage AI about this page',
            icon: const Icon(Icons.auto_awesome),
            onPressed: _askSageTutor,
          ),
        ],
      ),
      body: ColorFiltered(
        colorFilter: _nightMode
            ? const ColorFilter.matrix(<double>[
                -1, 0, 0, 0, 255,
                0, -1, 0, 0, 255,
                0, 0, -1, 0, 255,
                0, 0, 0, 1, 0,
              ])
            : const ColorFilter.mode(Colors.transparent, BlendMode.dst),
        child: PdfViewPinch(
          controller: _pdfController,
          onDocumentLoaded: (doc) {
            if (mounted) {
              setState(() => _totalPages = doc.pagesCount);
            }
          },
          onPageChanged: _onPageChanged,
        ),
      ),
      bottomNavigationBar: _totalPages > 1
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Row(
                  children: [
                    Text('$_currentPage', style: const TextStyle(fontSize: 12)),
                    Expanded(
                      child: Slider(
                        min: 1,
                        max: _totalPages.toDouble(),
                        divisions: _totalPages > 1 ? _totalPages - 1 : null,
                        value: _currentPage.clamp(1, _totalPages).toDouble(),
                        onChanged: (v) {
                          final target = v.round();
                          _pdfController.jumpToPage(target);
                        },
                      ),
                    ),
                    Text('$_totalPages', style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
            )
          : null,
    );
  }
}
