import 'package:eduai/core/config.dart';
import 'package:eduai/features/auth/auth_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('AppConfig provides default mobile OAuth deep-link redirect URI', () {
    expect(AppConfig.authRedirectUri, 'io.supabase.eduai://login-callback');
  });

  testWidgets(
    'AuthScreen renders Google, Apple, and GitHub options in sign-in and sign-up modes',
    (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: AuthScreen(),
          ),
        ),
      );

      expect(find.text('Welcome back'), findsOneWidget);
      expect(find.text('Continue with Google'), findsOneWidget);
      expect(find.text('Continue with Apple'), findsOneWidget);
      expect(find.text('Continue with GitHub'), findsOneWidget);

      await tester.tap(find.text('New here? Create an account'));
      await tester.pump();

      expect(find.text('Create your account'), findsOneWidget);
      expect(find.text('Continue with Google'), findsOneWidget);
      expect(find.text('Continue with Apple'), findsOneWidget);
      expect(find.text('Continue with GitHub'), findsOneWidget);
    },
  );
}
