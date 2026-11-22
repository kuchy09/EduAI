import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as crypto;
import 'package:dio/dio.dart';
import 'package:encrypt/encrypt.dart' as aes;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import '../models/book.dart';

class VaultSecurityException implements Exception {
  const VaultSecurityException(this.message);
  final String message;

  @override
  String toString() => 'VaultSecurityException: $message';
}

/// Pure-Dart AES-256-CBC + SHA-256 sealed envelope for offline EPUB and PDF files.
///
/// Format layout:
/// - Bytes 0..4   : Magic header `EDUV1` (5 bytes)
/// - Bytes 5..20  : Random 16-byte IV
/// - Bytes 21..52 : SHA-256 digest of plaintext bytes (32 bytes)
/// - Bytes 53..N  : AES-256-CBC PKCS7 ciphertext
///
/// Key derivation binds each encrypted textbook to both the hardware-stored
/// master device key AND `(userId, bookId)` so files cannot be extracted or
/// opened outside the signed-in learner's session.
class SealedBookCipher {
  const SealedBookCipher._();

  static final List<int> _magic = utf8.encode('EDUV1');
  static const int _headerSize = 5 + 16 + 32;

  static Uint8List deriveBookKeyBytes({
    required Uint8List masterKey,
    required String userId,
    required String bookId,
  }) {
    final hmac = crypto.Hmac(crypto.sha256, masterKey);
    final digest = hmac.convert(utf8.encode('$userId::$bookId::eduai-epub-vault'));
    return Uint8List.fromList(digest.bytes);
  }

  static Uint8List seal({
    required Uint8List plaintext,
    required Uint8List masterKey,
    required String userId,
    required String bookId,
    Uint8List? ivOverride,
  }) {
    final derivedKey = deriveBookKeyBytes(
      masterKey: masterKey,
      userId: userId,
      bookId: bookId,
    );
    final ivBytes = ivOverride ?? _randomBytes(16);
    if (ivBytes.length != 16) {
      throw const VaultSecurityException('Invalid IV length for AES-256.');
    }

    final plainDigest = crypto.sha256.convert(plaintext).bytes;
    final encrypter = aes.Encrypter(
      aes.AES(aes.Key(derivedKey), mode: aes.AESMode.cbc),
    );
    final encrypted = encrypter.encryptBytes(plaintext, iv: aes.IV(ivBytes));

    final builder = BytesBuilder(copy: false)
      ..add(_magic)
      ..add(ivBytes)
      ..add(plainDigest)
      ..add(encrypted.bytes);
    return builder.toBytes();
  }

  static Uint8List unseal({
    required Uint8List sealedEnvelope,
    required Uint8List masterKey,
    required String userId,
    required String bookId,
  }) {
    if (sealedEnvelope.length <= _headerSize) {
      throw const VaultSecurityException('Corrupted offline textbook envelope.');
    }

    for (var i = 0; i < _magic.length; i++) {
      if (sealedEnvelope[i] != _magic[i]) {
        throw const VaultSecurityException('Unsupported textbook vault format.');
      }
    }

    final ivBytes = Uint8List.sublistView(sealedEnvelope, 5, 21);
    final expectedHash = Uint8List.sublistView(sealedEnvelope, 21, 53);
    final cipherBytes = Uint8List.sublistView(sealedEnvelope, _headerSize);

    final derivedKey = deriveBookKeyBytes(
      masterKey: masterKey,
      userId: userId,
      bookId: bookId,
    );
    final encrypter = aes.Encrypter(
      aes.AES(aes.Key(derivedKey), mode: aes.AESMode.cbc),
    );

    final List<int> decrypted;
    try {
      decrypted = encrypter.decryptBytes(
        aes.Encrypted(cipherBytes),
        iv: aes.IV(ivBytes),
      );
    } catch (_) {
      throw const VaultSecurityException(
        'Access denied: textbook cannot be decrypted for this account or device.',
      );
    }

    final actualBytes = Uint8List.fromList(decrypted);
    final actualHash = crypto.sha256.convert(actualBytes).bytes;
    if (!_constantTimeEquals(actualHash, expectedHash)) {
      throw const VaultSecurityException(
        'Integrity check failed: offline textbook was modified.',
      );
    }
    return actualBytes;
  }

  static String sha256Hex(Uint8List data) => crypto.sha256.convert(data).toString();

  static Uint8List _randomBytes(int length) {
    final rng = Random.secure();
    return Uint8List.fromList(
      List<int>.generate(length, (_) => rng.nextInt(256)),
    );
  }

  static bool _constantTimeEquals(List<int> a, List<int> b) {
    if (a.length != b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff == 0;
  }
}

/// Manages encrypted offline EPUB & PDF storage in app-private storage, backed
/// by iOS Keychain / Android Keystore keys via [FlutterSecureStorage].
class OfflineVaultService {
  OfflineVaultService({
    FlutterSecureStorage? secureStorage,
    Dio? dio,
  }) : _secureStorage = secureStorage ?? const FlutterSecureStorage(),
       _dio = dio ?? Dio();

  static const _masterKeyStorageKey = 'eduai_vault_master_key_v1';

  final FlutterSecureStorage _secureStorage;
  final Dio _dio;

  Future<Directory> _vaultDir() async {
    final baseDir = await getApplicationSupportDirectory();
    final dir = Directory('${baseDir.path}${Platform.pathSeparator}vault');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  Future<File> _manifestFile() async {
    final dir = await _vaultDir();
    return File('${dir.path}${Platform.pathSeparator}manifest.json');
  }

  Future<Uint8List> _getOrCreateMasterKey() async {
    final existing = await _secureStorage.read(key: _masterKeyStorageKey);
    if (existing != null && existing.isNotEmpty) {
      return Uint8List.fromList(base64Decode(existing));
    }
    final rng = Random.secure();
    final generated = Uint8List.fromList(
      List<int>.generate(32, (_) => rng.nextInt(256)),
    );
    await _secureStorage.write(
      key: _masterKeyStorageKey,
      value: base64Encode(generated),
    );
    return generated;
  }

  Future<Map<String, OfflineVaultEntry>> loadManifest() async {
    try {
      final file = await _manifestFile();
      if (!await file.exists()) return {};
      final raw = await file.readAsString();
      return OfflineVaultEntry.decodeManifest(raw);
    } catch (_) {
      return {};
    }
  }

  Future<void> _saveManifest(Map<String, OfflineVaultEntry> manifest) async {
    final file = await _manifestFile();
    await file.writeAsString(
      OfflineVaultEntry.encodeManifest(manifest),
      flush: true,
    );
  }

  Future<OfflineVaultEntry?> getEntry(String bookId) async {
    final manifest = await loadManifest();
    return manifest[bookId];
  }

  Future<OfflineVaultEntry> downloadAndSeal({
    required MobileBook book,
    required String downloadUrl,
    required String userId,
    Map<String, String>? headers,
    void Function(double progress)? onProgress,
  }) async {
    final response = await _dio.get<List<int>>(
      downloadUrl,
      options: Options(
        responseType: ResponseType.bytes,
        headers: headers,
      ),
      onReceiveProgress: (received, total) {
        if (onProgress != null && total > 0) {
          onProgress((received / total).clamp(0.0, 1.0));
        }
      },
    );

    final rawData = response.data;
    if (rawData == null || rawData.isEmpty) {
      throw const VaultSecurityException('Downloaded textbook file is empty.');
    }

    final plainBytes = Uint8List.fromList(rawData);
    return sealExistingBytes(
      book: book,
      plainBytes: plainBytes,
      userId: userId,
    );
  }

  Future<OfflineVaultEntry> sealExistingBytes({
    required MobileBook book,
    required Uint8List plainBytes,
    required String userId,
  }) async {
    final dir = await _vaultDir();
    final safeId = book.id.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final targetFile = File(
      '${dir.path}${Platform.pathSeparator}$safeId.${book.format.name}.enc',
    );

    final masterKey = await _getOrCreateMasterKey();
    final sealed = SealedBookCipher.seal(
      plaintext: plainBytes,
      masterKey: masterKey,
      userId: userId,
      bookId: book.id,
    );

    await targetFile.writeAsBytes(sealed, flush: true);

    final now = DateTime.now();
    final entry = OfflineVaultEntry(
      book: book,
      localPath: targetFile.path,
      sha256Hex: SealedBookCipher.sha256Hex(plainBytes),
      sizeBytes: plainBytes.length,
      downloadedAt: now,
      expiresAt: now.add(
        Duration(days: book.securityPolicy.offlineLeaseDays),
      ),
      userId: userId,
      encrypted: true,
      progressPercent: book.readProgress,
    );

    final manifest = await loadManifest();
    manifest[book.id] = entry;
    await _saveManifest(manifest);
    return entry;
  }

  Future<Uint8List> openDecryptedBytes({
    required String bookId,
    required String userId,
  }) async {
    final manifest = await loadManifest();
    final entry = manifest[bookId];
    if (entry == null) {
      throw const VaultSecurityException('Book is not saved in offline vault.');
    }
    if (entry.userId != userId) {
      throw const VaultSecurityException(
        'Offline license belongs to a different learner account.',
      );
    }
    if (entry.isExpired) {
      throw const VaultSecurityException(
        'Offline publisher lease expired. Connect briefly to renew.',
      );
    }

    final file = File(entry.localPath);
    if (!await file.exists()) {
      throw const VaultSecurityException('Offline encrypted textbook missing.');
    }

    final sealed = await file.readAsBytes();
    final masterKey = await _getOrCreateMasterKey();
    return SealedBookCipher.unseal(
      sealedEnvelope: sealed,
      masterKey: masterKey,
      userId: userId,
      bookId: bookId,
    );
  }

  Future<void> updateReadingPosition({
    required String bookId,
    String? lastEpubCfi,
    int? lastPdfPage,
    int? progressPercent,
  }) async {
    final manifest = await loadManifest();
    final existing = manifest[bookId];
    if (existing == null) return;
    manifest[bookId] = existing.copyWith(
      lastEpubCfi: lastEpubCfi,
      lastPdfPage: lastPdfPage,
      progressPercent: progressPercent,
    );
    await _saveManifest(manifest);
  }

  Future<void> removeBook(String bookId) async {
    final manifest = await loadManifest();
    final existing = manifest.remove(bookId);
    if (existing != null) {
      final file = File(existing.localPath);
      if (await file.exists()) {
        await file.delete();
      }
    }
    await _saveManifest(manifest);
  }
}
