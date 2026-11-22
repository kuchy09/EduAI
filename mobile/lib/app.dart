import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/models/book.dart';
import 'core/providers.dart';
import 'features/auth/auth_screen.dart';
import 'features/library/library_screen.dart';
import 'features/reader/reader_router_screen.dart';
import 'features/tutor/tutor_screen.dart';

/// Lets go_router re-run its redirect whenever the auth state changes.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Stream<dynamic> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(supabaseProvider).auth;
  final refresh = _AuthRefresh(auth.onAuthStateChange);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: refresh,
    redirect: (context, state) {
      final signedIn = auth.currentSession != null;
      final onLogin = state.matchedLocation == '/login';
      if (!signedIn) return onLogin ? null : '/login';
      if (onLogin) return '/library';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const AuthScreen()),
      GoRoute(path: '/library', builder: (_, __) => const LibraryScreen()),
      GoRoute(path: '/tutor', builder: (_, __) => const TutorScreen()),
      GoRoute(
        path: '/reader/:bookId',
        builder: (_, state) {
          final bookId = state.pathParameters['bookId'] ?? '';
          final extra = state.extra;
          return ReaderRouterScreen(
            bookId: bookId,
            book: extra is MobileBook ? extra : null,
          );
        },
      ),
    ],
  );
});

class EduAIApp extends ConsumerWidget {
  const EduAIApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Edu AI · Sage Reader',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4F46E5),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      routerConfig: ref.watch(routerProvider),
    );
  }
}
