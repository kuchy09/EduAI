/// Build-time configuration, passed with --dart-define so no keys live in source:
///
///   flutter run \
///     --dart-define=SUPABASE_URL=https://YOUR_REF.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=YOUR_ANON_KEY
///
/// Only the public anon key belongs in the app. Never ship the service-role
/// key or any AI provider key in a mobile build.
class AppConfig {
  const AppConfig._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static void assertConfigured() {
    if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
      throw StateError(
        'Missing configuration. Run with '
        '--dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...',
      );
    }
  }
}
