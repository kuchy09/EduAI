import 'dart:async';
import 'dart:convert';

/// Events emitted by the `ai-tutor` Edge Function over Server-Sent Events.
sealed class TutorEvent {
  const TutorEvent();
}

/// A piece of the tutor's answer.
final class TutorDelta extends TutorEvent {
  const TutorDelta(this.text);
  final String text;
}

/// The answer finished normally.
final class TutorDone extends TutorEvent {
  const TutorDone();
}

/// The server reported a failure while streaming.
final class TutorError extends TutorEvent {
  const TutorError(this.message);
  final String message;
}

/// Turns the raw response bytes into [TutorEvent]s.
///
/// Handles chunk boundaries that fall mid-line or mid-character, CRLF line
/// endings, and ignores lines that aren't `data:` or aren't valid JSON.
/// The stream ends after the first [TutorDone] or [TutorError].
Stream<TutorEvent> parseTutorEvents(Stream<List<int>> bytes) async* {
  final lines = bytes.transform(utf8.decoder).transform(const LineSplitter());
  await for (final line in lines) {
    if (!line.startsWith('data:')) continue;
    final data = line.substring(5).trim();
    if (data.isEmpty) continue;

    final event = _decode(data);
    if (event == null) continue;

    yield event;
    if (event is TutorDone || event is TutorError) return;
  }
}

TutorEvent? _decode(String data) {
  final Object? json;
  try {
    json = jsonDecode(data);
  } on FormatException {
    return null;
  }
  if (json is! Map<String, dynamic>) return null;

  switch (json['type']) {
    case 'delta':
      final text = json['text'];
      return text is String && text.isNotEmpty ? TutorDelta(text) : null;
    case 'done':
      return const TutorDone();
    case 'error':
      final message = json['message'];
      return TutorError(
        message is String
            ? message
            : 'The tutor ran into a problem. Please try again.',
      );
    default:
      return null;
  }
}
