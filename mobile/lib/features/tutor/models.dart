/// A single message in the tutor conversation.
class TutorMessage {
  const TutorMessage({
    required this.role,
    required this.content,
    required this.createdAt,
  });

  /// 'user' or 'assistant'.
  final String role;
  final String content;
  final DateTime createdAt;

  bool get isUser => role == 'user';

  TutorMessage copyWith({String? content}) => TutorMessage(
    role: role,
    content: content ?? this.content,
    createdAt: createdAt,
  );

  Map<String, dynamic> toJson() => {'role': role, 'content': content};
}

/// Subjects the tutor can focus on. [name] is sent to the server as `subject`.
enum KcseSubject {
  mathematics('Mathematics', '📐'),
  physics('Physics', '⚡'),
  chemistry('Chemistry', '🧪'),
  biology('Biology', '🧬'),
  english('English', '📝'),
  history('History & Government', '🏛️'),
  geography('Geography', '🌍'),
  general('General', '📚');

  const KcseSubject(this.label, this.emoji);
  final String label;
  final String emoji;
}
