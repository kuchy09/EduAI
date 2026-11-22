import 'dart:convert';

enum BookFormat {
  epub('EPUB', 'Reflowable · Offline Ready'),
  pdf('PDF', 'Fixed Layout');

  const BookFormat(this.label, this.tagline);

  final String label;
  final String tagline;

  bool get isEpub => this == BookFormat.epub;
  bool get isPdf => this == BookFormat.pdf;
}

BookFormat inferBookFormat({String? explicitFormat, String? fileUrl}) {
  final fmt = (explicitFormat ?? '').trim().toLowerCase();
  if (fmt == 'epub' || fmt.contains('epub')) return BookFormat.epub;
  if (fmt == 'pdf' || fmt.contains('pdf')) return BookFormat.pdf;

  final url = (fileUrl ?? '').trim().toLowerCase().split('?').first;
  if (url.endsWith('.epub')) return BookFormat.epub;
  return BookFormat.pdf;
}

class PublisherSecurityPolicy {
  const PublisherSecurityPolicy({
    this.requireEncryptedOffline = true,
    this.watermarkUser = true,
    this.allowRawExport = false,
    this.offlineLeaseDays = 90,
  });

  final bool requireEncryptedOffline;
  final bool watermarkUser;
  final bool allowRawExport;
  final int offlineLeaseDays;

  factory PublisherSecurityPolicy.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PublisherSecurityPolicy();
    return PublisherSecurityPolicy(
      requireEncryptedOffline: json['requireEncryptedOffline'] as bool? ?? true,
      watermarkUser: json['watermarkUser'] as bool? ?? true,
      allowRawExport: json['allowRawExport'] as bool? ?? false,
      offlineLeaseDays: (json['offlineLeaseDays'] as num?)?.toInt() ?? 90,
    );
  }

  Map<String, dynamic> toJson() => {
    'requireEncryptedOffline': requireEncryptedOffline,
    'watermarkUser': watermarkUser,
    'allowRawExport': allowRawExport,
    'offlineLeaseDays': offlineLeaseDays,
  };
}

class MobileBook {
  const MobileBook({
    required this.id,
    required this.title,
    required this.author,
    required this.category,
    required this.format,
    this.publisher,
    this.isbn,
    this.isKicdApproved = false,
    this.description = '',
    this.level = 'All',
    this.curriculum = const [],
    this.subjects = const [],
    this.coverImage = '',
    this.fileUrl = '',
    this.pages,
    this.publishedYear,
    this.readProgress = 0,
    this.securityPolicy = const PublisherSecurityPolicy(),
  });

  final String id;
  final String title;
  final String author;
  final String category;
  final BookFormat format;
  final String? publisher;
  final String? isbn;
  final bool isKicdApproved;
  final String description;
  final String level;
  final List<String> curriculum;
  final List<String> subjects;
  final String coverImage;
  final String fileUrl;
  final int? pages;
  final int? publishedYear;
  final int readProgress;
  final PublisherSecurityPolicy securityPolicy;

  String get displayPublisher =>
      (publisher != null && publisher!.trim().isNotEmpty) ? publisher! : author;

  factory MobileBook.fromJson(Map<String, dynamic> json) {
    final fileUrl =
        (json['fileUrl'] ?? json['file_url'] ?? json['pdf_file_url'] ?? '')
            .toString();
    final explicitFormat = json['format']?.toString();
    final curriculumRaw = json['curriculum'];
    final subjectsRaw = json['subjects'];

    List<String> parseStringList(dynamic raw) {
      if (raw is List) {
        return raw.map((e) => e.toString().trim()).where((e) => e.isNotEmpty).toList();
      }
      if (raw is String && raw.trim().isNotEmpty) {
        return raw.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
      }
      return const [];
    }

    return MobileBook(
      id: json['id'].toString(),
      title: (json['title'] ?? 'Untitled Textbook').toString(),
      author: (json['author'] ?? json['publisher'] ?? 'Edu AI').toString(),
      category: (json['category'] ?? 'Textbook').toString(),
      format: inferBookFormat(explicitFormat: explicitFormat, fileUrl: fileUrl),
      publisher: json['publisher']?.toString(),
      isbn: json['isbn']?.toString(),
      isKicdApproved:
          (json['isKicdApproved'] ?? json['is_kicd_approved']) == true,
      description: (json['description'] ?? '').toString(),
      level: (json['level'] ?? json['education_level'] ?? 'All').toString(),
      curriculum: parseStringList(curriculumRaw),
      subjects: parseStringList(subjectsRaw),
      coverImage: (json['coverImage'] ?? json['cover_image'] ?? '').toString(),
      fileUrl: fileUrl,
      pages: (json['pages'] as num?)?.toInt(),
      publishedYear: (json['publishedYear'] ?? json['published_year'] as num?)
          ?.toInt(),
      readProgress: (json['readProgress'] as num?)?.toInt() ?? 0,
      securityPolicy: PublisherSecurityPolicy.fromJson(
        json['securityPolicy'] is Map<String, dynamic>
            ? json['securityPolicy'] as Map<String, dynamic>
            : null,
      ),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'author': author,
    'category': category,
    'format': format.name,
    'publisher': publisher,
    'isbn': isbn,
    'isKicdApproved': isKicdApproved,
    'description': description,
    'level': level,
    'curriculum': curriculum,
    'subjects': subjects,
    'coverImage': coverImage,
    'fileUrl': fileUrl,
    'pages': pages,
    'publishedYear': publishedYear,
    'readProgress': readProgress,
    'securityPolicy': securityPolicy.toJson(),
  };

  MobileBook copyWith({
    BookFormat? format,
    int? readProgress,
    String? coverImage,
  }) => MobileBook(
    id: id,
    title: title,
    author: author,
    category: category,
    format: format ?? this.format,
    publisher: publisher,
    isbn: isbn,
    isKicdApproved: isKicdApproved,
    description: description,
    level: level,
    curriculum: curriculum,
    subjects: subjects,
    coverImage: coverImage ?? this.coverImage,
    fileUrl: fileUrl,
    pages: pages,
    publishedYear: publishedYear,
    readProgress: readProgress ?? this.readProgress,
    securityPolicy: securityPolicy,
  );
}

class OfflineVaultEntry {
  const OfflineVaultEntry({
    required this.book,
    required this.localPath,
    required this.sha256Hex,
    required this.sizeBytes,
    required this.downloadedAt,
    required this.expiresAt,
    required this.userId,
    this.encrypted = true,
    this.lastEpubCfi,
    this.lastPdfPage = 1,
    this.progressPercent = 0,
  });

  final MobileBook book;
  final String localPath;
  final String sha256Hex;
  final int sizeBytes;
  final DateTime downloadedAt;
  final DateTime expiresAt;
  final String userId;
  final bool encrypted;
  final String? lastEpubCfi;
  final int lastPdfPage;
  final int progressPercent;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  String get formattedSize {
    if (sizeBytes < 1024) return '$sizeBytes B';
    if (sizeBytes < 1024 * 1024) {
      return '${(sizeBytes / 1024).toStringAsFixed(1)} KB';
    }
    return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  OfflineVaultEntry copyWith({
    String? lastEpubCfi,
    int? lastPdfPage,
    int? progressPercent,
  }) => OfflineVaultEntry(
    book: book.copyWith(readProgress: progressPercent ?? book.readProgress),
    localPath: localPath,
    sha256Hex: sha256Hex,
    sizeBytes: sizeBytes,
    downloadedAt: downloadedAt,
    expiresAt: expiresAt,
    userId: userId,
    encrypted: encrypted,
    lastEpubCfi: lastEpubCfi ?? this.lastEpubCfi,
    lastPdfPage: lastPdfPage ?? this.lastPdfPage,
    progressPercent: progressPercent ?? this.progressPercent,
  );

  factory OfflineVaultEntry.fromJson(Map<String, dynamic> json) =>
      OfflineVaultEntry(
        book: MobileBook.fromJson(json['book'] as Map<String, dynamic>),
        localPath: json['localPath'].toString(),
        sha256Hex: json['sha256Hex'].toString(),
        sizeBytes: (json['sizeBytes'] as num).toInt(),
        downloadedAt: DateTime.parse(json['downloadedAt'].toString()),
        expiresAt: DateTime.parse(json['expiresAt'].toString()),
        userId: json['userId'].toString(),
        encrypted: json['encrypted'] as bool? ?? true,
        lastEpubCfi: json['lastEpubCfi']?.toString(),
        lastPdfPage: (json['lastPdfPage'] as num?)?.toInt() ?? 1,
        progressPercent: (json['progressPercent'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toJson() => {
    'book': book.toJson(),
    'localPath': localPath,
    'sha256Hex': sha256Hex,
    'sizeBytes': sizeBytes,
    'downloadedAt': downloadedAt.toIso8601String(),
    'expiresAt': expiresAt.toIso8601String(),
    'userId': userId,
    'encrypted': encrypted,
    'lastEpubCfi': lastEpubCfi,
    'lastPdfPage': lastPdfPage,
    'progressPercent': progressPercent,
  };

  static String encodeManifest(Map<String, OfflineVaultEntry> entries) =>
      jsonEncode(entries.map((k, v) => MapEntry(k, v.toJson())));

  static Map<String, OfflineVaultEntry> decodeManifest(String raw) {
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) return {};
    final out = <String, OfflineVaultEntry>{};
    for (final entry in decoded.entries) {
      if (entry.value is Map<String, dynamic>) {
        out[entry.key] = OfflineVaultEntry.fromJson(
          entry.value as Map<String, dynamic>,
        );
      }
    }
    return out;
  }
}
