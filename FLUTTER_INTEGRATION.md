# Flutter Integration Guide

This guide explains how to setup the Supabase Edge Function and connect your Flutter application to the AI Tutor backend.

## 1. Deploy the Backend (Supabase Edge Function)

First, install and link the Supabase CLI if you haven't already:

```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set your Anthropic API key as a secret
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
supabase secrets set GEMINI_API_KEY=AIzaSy...

# Deploy the function
supabase functions deploy ai-tutor
```

### Testing the Function Locally

Before deploying, you can test your edge function locally:

1. Create a `.env.local` file in your root folder with your environment keys:
```env
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

2. Run the function using the Supabase CLI:
```bash
supabase functions serve ai-tutor --env-file .env.local
```

3. Test it locally using `curl`:
```bash
curl -X POST http://localhost:54321/functions/v1/ai-tutor \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Solve x² - 5x + 6 = 0"}],
    "subject": "mathematics",
    "studentName": "Wolter"
  }'
```

## 2. Setup Your Flutter Project

Add the necessary dependencies to your `pubspec.yaml`, just as you provided:

```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.5.0
  flutter_markdown: ^0.6.22
  http: ^1.2.1
  flutter_riverpod: ^2.5.1
  go_router: ^13.2.0
```

Run `flutter pub get` to install them.

## 3. Initialize Supabase in Flutter

In your `main.dart`, initialize Supabase with your project URL and Anon Key.

```dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'https://YOUR_PROJECT_REF.supabase.co',
    anonKey: 'YOUR_ANON_KEY',
  );
  
  runApp(const EduAIApp());
}

class EduAIApp extends StatelessWidget {
  const EduAIApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sage AI Tutor',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const TutorScreen(),
    );
  }
}
```

## 4. Tutor Service (Advanced Edge Function Integration)

You can build a robust API Service for calling the backend, converting properties like Subjects, parsing the raw SSE chunks manually and using `flutter_riverpod` or generic Streams for your UI:

```dart
// lib/core/services/tutor_service.dart
// EduAI — Tutor Service
// Calls the Supabase Edge Function and exposes a Stream<String> of text chunks.

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// A single message in the tutor conversation.
class TutorMessage {
  final String role; // 'user' | 'assistant'
  final String content;
  final DateTime createdAt;

  const TutorMessage({
    required this.role,
    required this.content,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {'role': role, 'content': content};
}

/// KCSE subjects supported by the AI tutor.
enum KcseSubject {
  mathematics,
  physics,
  chemistry,
  biology,
  english,
  history,
  geography,
  general;

  String get label => switch (this) {
        KcseSubject.mathematics => 'Mathematics',
        KcseSubject.physics => 'Physics',
        KcseSubject.chemistry => 'Chemistry',
        KcseSubject.biology => 'Biology',
        KcseSubject.english => 'English',
        KcseSubject.history => 'History & Government',
        KcseSubject.geography => 'Geography',
        KcseSubject.general => 'General',
      };

  String get emoji => switch (this) {
        KcseSubject.mathematics => '📐',
        KcseSubject.physics => '⚡',
        KcseSubject.chemistry => '🧪',
        KcseSubject.biology => '🧬',
        KcseSubject.english => '📝',
        KcseSubject.history => '🏛️',
        KcseSubject.geography => '🌍',
        KcseSubject.general => '📚',
      };
}

class TutorService {
  final SupabaseClient _supabase = Supabase.instance.client;

  /// Sends a message to the AI tutor and returns a stream of text chunks.
  /// The stream emits partial text as Claude streams its response.
  ///
  /// Usage:
  /// ```dart
  /// final stream = tutorService.sendMessage(
  ///   messages: conversationHistory,
  ///   subject: KcseSubject.mathematics,
  /// );
  /// await for (final chunk in stream) {
  ///   setState(() => _response += chunk);
  /// }
  /// ```
  Stream<String> sendMessage({
    required List<TutorMessage> messages,
    required KcseSubject subject,
    String? studentName,
  }) async* {
    // Get auth token for the Edge Function
    final session = _supabase.auth.currentSession;
    if (session == null) {
      throw Exception('User not authenticated');
    }

    final supabaseUrl = Supabase.instance.client.supabaseUrl;
    final functionUrl = '$supabaseUrl/functions/v1/ai-tutor';

    final body = jsonEncode({
      'messages': messages.map((m) => m.toJson()).toList(),
      'subject': subject.name,
      if (studentName != null) 'studentName': studentName,
    });

    // Use Supabase's built-in functions.invoke for simple cases,
    // but we need raw HTTP for SSE streaming.
    final client = _supabase; // access httpClient via workaround below
    final _ = client; // suppress unused warning

    // Raw HTTP request for SSE streaming
    final request = await _makeStreamRequest(
      url: functionUrl,
      body: body,
      token: session.accessToken,
    );

    await for (final chunk in request) {
      yield chunk;
    }
  }

  Stream<String> _makeStreamRequest({
    required String url,
    required String body,
    required String token,
  }) async* {
    final uri = Uri.parse(url);

    // Flutter's http package doesn't natively support SSE, so we use
    // Supabase's httpClient via a direct approach with StreamedResponse.
    import 'package:http/http.dart' as http; // see note below

    // NOTE: Add `http` to pubspec.yaml if not already present.
    // It's a transitive dependency of supabase_flutter so it's available.

    final httpClient = http.Client();
    try {
      final httpRequest = http.Request('POST', uri)
        ..headers.addAll({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
          'apikey': Supabase.instance.client.supabaseKey,
        })
        ..body = body;

      final streamedResponse = await httpClient.send(httpRequest);

      if (streamedResponse.statusCode != 200) {
        final errorBody = await streamedResponse.stream.bytesToString();
        throw Exception('Edge Function error ${streamedResponse.statusCode}: $errorBody');
      }

      // Parse SSE stream
      final buffer = StringBuffer();
      await for (final bytes in streamedResponse.stream) {
        final chunk = utf8.decode(bytes);
        buffer.write(chunk);

        // Process complete SSE lines
        final content = buffer.toString();
        final lines = content.split('\n');

        // Keep incomplete last line in buffer
        buffer.clear();
        if (!content.endsWith('\n')) {
          buffer.write(lines.removeLast());
        }

        for (final line in lines) {
          if (line.startsWith('data: ')) {
            final data = line.substring(6).trim();
            if (data.isEmpty) continue;

            try {
              final json = jsonDecode(data) as Map<String, dynamic>;
              final type = json['type'] as String?;

              if (type == 'delta') {
                final text = json['text'] as String? ?? '';
                if (text.isNotEmpty) yield text;
              } else if (type == 'done') {
                return; // Stream complete
              }
            } catch (e) {
              debugPrint('SSE parse error: $e');
            }
          }
        }
      }
    } finally {
      httpClient.close();
    }
  }
}
```

## 5. Navigation and Routing

If you are using a router or organizing your app into multiple screens, you can navigate to your Tutor chat screen using simple MaterialPageRoute push, or using `go_router`:

```dart
// In your router or navigation setup
import 'features/tutor/tutor_screen.dart';

// Simple push example
Navigator.push(
  context,
  MaterialPageRoute(builder: (_) => const TutorScreen()),
);

// Or using go_router example
GoRoute(
  path: '/student/tutor',
  builder: (_, __) => const TutorScreen(),
),
```

## 6. Run your Flutter App

Now that your dependencies are linked and you have your Edge function prepared, run your Flutter app on an emulator or physical device using:

```bash
flutter run
```
