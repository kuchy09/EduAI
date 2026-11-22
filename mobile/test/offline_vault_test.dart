import 'dart:convert';
import 'dart:typed_data';

import 'package:eduai/core/models/book.dart';
import 'package:eduai/core/services/offline_vault_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('inferBookFormat detects EPUB and PDF extensions accurately', () {
    expect(
      inferBookFormat(fileUrl: 'books/123-klb_physics_form4.epub'),
      BookFormat.epub,
    );
    expect(
      inferBookFormat(fileUrl: 'https://cdn.example.com/chem.epub?token=abc'),
      BookFormat.epub,
    );
    expect(
      inferBookFormat(explicitFormat: 'epub', fileUrl: 'books/no-ext'),
      BookFormat.epub,
    );
    expect(
      inferBookFormat(fileUrl: 'books/math.pdf'),
      BookFormat.pdf,
    );
  });

  test('MobileBook parses API & Supabase payloads with security policy', () {
    final book = MobileBook.fromJson({
      'id': 'klb-phys-4',
      'title': 'KLB Physics Form 4',
      'publisher': 'Kenya Literature Bureau (KLB)',
      'is_kicd_approved': true,
      'file_url': 'books/klb-phys-4.epub',
      'securityPolicy': {
        'requireEncryptedOffline': true,
        'watermarkUser': true,
        'allowRawExport': false,
        'offlineLeaseDays': 30,
      },
    });

    expect(book.format, BookFormat.epub);
    expect(book.isKicdApproved, isTrue);
    expect(book.securityPolicy.requireEncryptedOffline, isTrue);
    expect(book.securityPolicy.allowRawExport, isFalse);
    expect(book.securityPolicy.offlineLeaseDays, 30);
  });

  test('SealedBookCipher encrypts, decrypts, and rejects tampered or cross-user access', () {
    final masterKey = Uint8List.fromList(List<int>.generate(32, (i) => i + 1));
    final sampleEpub = Uint8List.fromList(utf8.encode('PK\x03\x04EPUB_SAMPLE_CHAPTER'));

    final sealed = SealedBookCipher.seal(
      plaintext: sampleEpub,
      masterKey: masterKey,
      userId: 'student-123',
      bookId: 'book-epub-1',
    );

    expect(utf8.decode(sealed.sublist(0, 5)), 'EDUV1');
    expect(sealed.length, greaterThan(sampleEpub.length));

    final unsealed = SealedBookCipher.unseal(
      sealedEnvelope: sealed,
      masterKey: masterKey,
      userId: 'student-123',
      bookId: 'book-epub-1',
    );
    expect(unsealed, orderedEquals(sampleEpub));

    // Different learner account cannot decrypt
    expect(
      () => SealedBookCipher.unseal(
        sealedEnvelope: sealed,
        masterKey: masterKey,
        userId: 'different-student',
        bookId: 'book-epub-1',
      ),
      throwsA(isA<VaultSecurityException>()),
    );

    // Tampered payload fails integrity check
    final tampered = Uint8List.fromList(sealed);
    tampered[tampered.length - 1] ^= 0xFF;
    expect(
      () => SealedBookCipher.unseal(
        sealedEnvelope: tampered,
        masterKey: masterKey,
        userId: 'student-123',
        bookId: 'book-epub-1',
      ),
      throwsA(isA<VaultSecurityException>()),
    );
  });
}
