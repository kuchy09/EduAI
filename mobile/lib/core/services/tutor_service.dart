import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/tutor/models.dart';
import '../config.dart';
import 'sse_parser.dart';

/// A tutor failure with a message that is safe to show to the student.
class TutorException implements Exception {
  const TutorException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// Calls the `ai-tutor` Supabase Edge Function and streams the answer.
class TutorService {
  TutorService({
    required SupabaseClient supabase,
    http.Client Function()? clientFactory,
  }) : _supabase = supabase,
       _clientFactory = clientFactory ?? (() => http.Client());

  final SupabaseClient _supabase;
  final http.Client Function() _clientFactory;

  /// Sends [prompt] (with earlier [history]) and emits the answer text as it
  /// arrives. Throws [TutorException] on any failure.
  Stream<String> sendMessage({
    required String prompt,
    required List<TutorMessage> history,
    required KcseSubject subject,
    String? studentName,
  }) async* {
    final token = await _accessToken();
    final client = _clientFactory();
    try {
      final request =
          http.Request(
              'POST',
              Uri.parse('${AppConfig.supabaseUrl}/functions/v1/ai-tutor'),
            )
            ..headers.addAll({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
              'apikey': AppConfig.supabaseAnonKey,
            })
            ..body = jsonEncode({
              'prompt': prompt,
              'history': history.map((m) => m.toJson()).toList(),
              'subject': subject.name,
              if (studentName != null && studentName.isNotEmpty)
                'studentName': studentName,
            });

      final response = await client
          .send(request)
          .timeout(const Duration(seconds: 30));

      if (response.statusCode != 200) {
        throw TutorException(
          await _errorMessage(response),
          statusCode: response.statusCode,
        );
      }

      var gotText = false;
      var finished = false;
      await for (final event in parseTutorEvents(response.stream)) {
        switch (event) {
          case TutorDelta(:final text):
            gotText = true;
            yield text;
          case TutorDone():
            finished = true;
          case TutorError(:final message):
            throw TutorException(message);
        }
      }

      if (!finished && !gotText) {
        throw const TutorException(
          'The connection was interrupted. Please try again.',
        );
      }
    } on TimeoutException {
      throw const TutorException(
        'The tutor took too long to respond. Please try again.',
      );
    } on http.ClientException {
      throw const TutorException(
        'No connection. Check your internet and try again.',
      );
    } finally {
      client.close();
    }
  }

  Future<String> _accessToken() async {
    var session = _supabase.auth.currentSession;
    if (session != null && session.isExpired) {
      session = (await _supabase.auth.refreshSession()).session;
    }
    final token = session?.accessToken;
    if (token == null) {
      throw const TutorException(
        'Please sign in to use the tutor.',
        statusCode: 401,
      );
    }
    return token;
  }

  Future<String> _errorMessage(http.StreamedResponse response) async {
    final body = await response.stream.bytesToString();
    try {
      final json = jsonDecode(body);
      if (json is Map && json['error'] is String) {
        return json['error'] as String;
      }
    } on FormatException {
      // Not JSON; fall through to a generic message.
    }
    return switch (response.statusCode) {
      401 => 'Your session has expired. Please sign in again.',
      429 => 'You have reached your monthly tutor limit.',
      _ => 'The tutor is unavailable right now (error ${response.statusCode}).',
    };
  }
}
