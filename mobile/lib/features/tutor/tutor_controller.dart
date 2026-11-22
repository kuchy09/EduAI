import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/services/tutor_service.dart';
import 'models.dart';

final tutorServiceProvider = Provider<TutorService>(
  (ref) => TutorService(supabase: ref.watch(supabaseProvider)),
);

class TutorState {
  const TutorState({
    this.messages = const [],
    this.subject = KcseSubject.general,
    this.activeBookContext,
    this.isStreaming = false,
    this.error,
  });

  final List<TutorMessage> messages;
  final KcseSubject subject;
  final String? activeBookContext;
  final bool isStreaming;
  final String? error;

  TutorState copyWith({
    List<TutorMessage>? messages,
    KcseSubject? subject,
    String? activeBookContext,
    bool clearBookContext = false,
    bool? isStreaming,
    String? error,
    bool clearError = false,
  }) => TutorState(
    messages: messages ?? this.messages,
    subject: subject ?? this.subject,
    activeBookContext: clearBookContext
        ? null
        : (activeBookContext ?? this.activeBookContext),
    isStreaming: isStreaming ?? this.isStreaming,
    error: clearError ? null : (error ?? this.error),
  );
}

class TutorController extends Notifier<TutorState> {
  @override
  TutorState build() => const TutorState();

  void setSubject(KcseSubject subject) {
    state = state.copyWith(subject: subject);
  }

  void setActiveBookContext(String? contextLabel) {
    state = state.copyWith(
      activeBookContext: contextLabel,
      clearBookContext: contextLabel == null,
    );
  }

  void clear() {
    if (state.isStreaming) return;
    state = TutorState(
      subject: state.subject,
      activeBookContext: state.activeBookContext,
    );
  }

  Future<void> send(String text) async {
    final prompt = text.trim();
    if (prompt.isEmpty || state.isStreaming) return;

    final history = state.messages
        .where((m) => m.content.trim().isNotEmpty)
        .toList();
    final now = DateTime.now();

    state = state.copyWith(
      messages: [
        ...history,
        TutorMessage(role: 'user', content: prompt, createdAt: now),
        TutorMessage(role: 'assistant', content: '', createdAt: now),
      ],
      isStreaming: true,
      clearError: true,
    );

    final buffer = StringBuffer();
    try {
      final user = ref.read(supabaseProvider).auth.currentUser;
      final name = user?.userMetadata?['full_name'];
      final contextualPrompt = state.activeBookContext != null
          ? '[Context: ${state.activeBookContext}]\n\n$prompt'
          : prompt;

      final stream = ref
          .read(tutorServiceProvider)
          .sendMessage(
            prompt: contextualPrompt,
            history: history,
            subject: state.subject,
            studentName: name is String ? name : null,
          );

      await for (final chunk in stream) {
        buffer.write(chunk);
        _setLastAssistantText(buffer.toString());
      }
    } on TutorException catch (e) {
      state = state.copyWith(error: e.message);
    } catch (_) {
      state = state.copyWith(error: 'Something went wrong. Please try again.');
    } finally {
      // Drop the empty placeholder if nothing arrived.
      final messages = [...state.messages];
      if (messages.isNotEmpty &&
          !messages.last.isUser &&
          messages.last.content.isEmpty) {
        messages.removeLast();
      }
      state = state.copyWith(messages: messages, isStreaming: false);
    }
  }

  void _setLastAssistantText(String text) {
    final messages = [...state.messages];
    if (messages.isEmpty) return;
    messages[messages.length - 1] = messages.last.copyWith(content: text);
    state = state.copyWith(messages: messages);
  }
}

final tutorControllerProvider = NotifierProvider<TutorController, TutorState>(
  TutorController.new,
);
