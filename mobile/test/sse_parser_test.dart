import 'dart:convert';

import 'package:eduai/core/services/sse_parser.dart';
import 'package:flutter_test/flutter_test.dart';

Stream<List<int>> chunked(String text, int size) async* {
  final bytes = utf8.encode(text);
  for (var i = 0; i < bytes.length; i += size) {
    yield bytes.sublist(i, i + size > bytes.length ? bytes.length : i + size);
  }
}

String sse(List<Map<String, Object?>> events) =>
    events.map((e) => 'data: ${jsonEncode(e)}\n\n').join();

void main() {
  test('parses deltas then done', () async {
    final body = sse([
      {'type': 'delta', 'text': 'Hello '},
      {'type': 'delta', 'text': 'Amina'},
      {'type': 'done'},
    ]);
    final events = await parseTutorEvents(chunked(body, 1000)).toList();
    expect(events.length, 3);
    expect((events[0] as TutorDelta).text, 'Hello ');
    expect(events[2], isA<TutorDone>());
  });

  test(
    'survives chunk boundaries inside lines and multi-byte characters',
    () async {
      final body = sse([
        {'type': 'delta', 'text': 'x² − 5x + 6 = 0 → (x−2)(x−3) 🎓'},
        {'type': 'done'},
      ]);
      for (final size in [1, 2, 3, 7]) {
        final events = await parseTutorEvents(chunked(body, size)).toList();
        expect(
          (events.first as TutorDelta).text,
          'x² − 5x + 6 = 0 → (x−2)(x−3) 🎓',
        );
        expect(events.last, isA<TutorDone>());
      }
    },
  );

  test(
    'handles CRLF, ignores junk lines, stops after an error event',
    () async {
      const body =
          ': keep-alive\r\n'
          'data: not json\r\n'
          'data: {"type":"delta","text":"a"}\r\n\r\n'
          'data: {"type":"error","message":"boom"}\r\n\r\n'
          'data: {"type":"delta","text":"never seen"}\r\n\r\n';
      final events = await parseTutorEvents(chunked(body, 5)).toList();
      expect(events.length, 2);
      expect((events[0] as TutorDelta).text, 'a');
      expect((events[1] as TutorError).message, 'boom');
    },
  );
}
