/// Build-time configuration, passed with --dart-define so no keys live in source:
///
///   flutter run \
///     --dart-define=SUPABASE_URL=https://YOUR_REF.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=YOUR_ANON_KEY \
///     --dart-define=API_BASE_URL=https://your-eduai-server.example
///
/// Only the public anon key belongs in the app. Never ship the service-role
/// key or any AI provider key in a mobile build.
class AppConfig {
  const AppConfig._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const authRedirectUri = String.fromEnvironment(
    'AUTH_REDIRECT_URI',
    defaultValue: 'io.supabase.eduai://login-callback',
  );

  static bool get hasApiBaseUrl => apiBaseUrl.trim().isNotEmpty;

  static void assertConfigured() {
    if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
      throw StateError(
        'Missing configuration. Run with '
        '--dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...',
      );
    }
  }
}
