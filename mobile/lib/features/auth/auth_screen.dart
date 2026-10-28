import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config.dart';
import '../../core/providers.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _isSignUp = false;
  bool _busy = false;
  OAuthProvider? _oauthBusyProvider;
  String? _error;
  String? _info;

  bool get _isAnyBusy => _busy || _oauthBusyProvider != null;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signInWithOAuth(OAuthProvider provider) async {
    setState(() {
      _oauthBusyProvider = provider;
      _error = null;
      _info = null;
    });

    final auth = ref.read(supabaseProvider).auth;
    try {
      await auth.signInWithOAuth(
        provider,
        redirectTo: kIsWeb ? null : AppConfig.authRedirectUri,
      );
      // On callback completion, go_router redirects automatically to /tutor.
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Could not start sign-in. Check your internet.',
        );
      }
    } finally {
      if (mounted) setState(() => _oauthBusyProvider = null);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });

    final auth = ref.read(supabaseProvider).auth;
    try {
      if (_isSignUp) {
        final res = await auth.signUp(
          email: _email.text.trim(),
          password: _password.text,
          data: {'full_name': _name.text.trim()},
        );
        if (res.session == null && mounted) {
          setState(
            () => _info =
                'Check your email to confirm your account, then sign in.',
          );
        }
      } else {
        await auth.signInWithPassword(
          email: _email.text.trim(),
          password: _password.text,
        );
      }
      // On success the router redirects to the tutor screen.
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Could not reach the server. Check your internet.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Sage AI Tutor',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _isSignUp ? 'Create your account' : 'Welcome back',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 24),
                    _OAuthProviderButton(
                      label: 'Continue with Google',
                      leading: const _GoogleMarkIcon(),
                      busy: _oauthBusyProvider == OAuthProvider.google,
                      enabled: !_isAnyBusy,
                      onPressed: () => _signInWithOAuth(OAuthProvider.google),
                    ),
                    const SizedBox(height: 10),
                    _OAuthProviderButton(
                      label: 'Continue with Apple',
                      leading: Icon(
                        Icons.apple,
                        size: 22,
                        color: theme.colorScheme.onSurface,
                      ),
                      busy: _oauthBusyProvider == OAuthProvider.apple,
                      enabled: !_isAnyBusy,
                      onPressed: () => _signInWithOAuth(OAuthProvider.apple),
                    ),
                    const SizedBox(height: 10),
                    _OAuthProviderButton(
                      label: 'Continue with GitHub',
                      leading: _GitHubMarkIcon(
                        color: theme.colorScheme.onSurface,
                      ),
                      busy: _oauthBusyProvider == OAuthProvider.github,
                      enabled: !_isAnyBusy,
                      onPressed: () => _signInWithOAuth(OAuthProvider.github),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            'or continue with email',
                            style: theme.textTheme.bodySmall,
                          ),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (_isSignUp) ...[
                      TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          labelText: 'Your name',
                          border: OutlineInputBorder(),
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? 'Enter your name'
                            : null,
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => (v == null || !v.contains('@'))
                          ? 'Enter a valid email'
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      decoration: const InputDecoration(
                        labelText: 'Password',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) => (v == null || v.length < 8)
                          ? 'Use at least 8 characters'
                          : null,
                      onFieldSubmitted: (_) => _isAnyBusy ? null : _submit(),
                    ),
                    const SizedBox(height: 16),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          _error!,
                          style: TextStyle(color: theme.colorScheme.error),
                        ),
                      ),
                    if (_info != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(_info!),
                      ),
                    FilledButton(
                      onPressed: _isAnyBusy ? null : _submit,
                      child: _busy
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(_isSignUp ? 'Sign up' : 'Sign in'),
                    ),
                    TextButton(
                      onPressed: _isAnyBusy
                          ? null
                          : () => setState(() {
                              _isSignUp = !_isSignUp;
                              _error = null;
                              _info = null;
                            }),
                      child: Text(
                        _isSignUp
                            ? 'Already have an account? Sign in'
                            : 'New here? Create an account',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OAuthProviderButton extends StatelessWidget {
  const _OAuthProviderButton({
    required this.label,
    required this.leading,
    required this.busy,
    required this.enabled,
    required this.onPressed,
  });

  final String label;
  final Widget leading;
  final bool busy;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: enabled ? onPressed : null,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(46),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
      icon: busy
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : SizedBox(width: 20, height: 20, child: Center(child: leading)),
      label: Text(label),
    );
  }
}

class _GoogleMarkIcon extends StatelessWidget {
  const _GoogleMarkIcon();

  @override
  Widget build(BuildContext context) {
    return const CustomPaint(
      size: Size(18, 18),
      painter: _GoogleMarkPainter(),
    );
  }
}

class _GoogleMarkPainter extends CustomPainter {
  const _GoogleMarkPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.22;
    final rect = Rect.fromLTWH(
      stroke / 2,
      stroke / 2,
      size.width - stroke,
      size.height - stroke,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    // Red top-left arc
    paint.color = const Color(0xFFEA4335);
    canvas.drawArc(rect, -2.35, 1.55, false, paint);

    // Yellow left arc
    paint.color = const Color(0xFFFBBC05);
    canvas.drawArc(rect, 2.35, 1.15, false, paint);

    // Green bottom arc
    paint.color = const Color(0xFF34A853);
    canvas.drawArc(rect, 0.85, 1.50, false, paint);

    // Blue right arc + horizontal bar
    paint.color = const Color(0xFF4285F4);
    canvas.drawArc(rect, -0.15, 1.00, false, paint);

    final barPaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.fill;
    canvas.drawRect(
      Rect.fromLTWH(
        size.width * 0.50,
        size.height * 0.41,
        size.width * 0.46,
        stroke * 0.88,
      ),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _GitHubMarkIcon extends StatelessWidget {
  const _GitHubMarkIcon({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(18, 18),
      painter: _GitHubMarkPainter(color: color),
    );
  }
}

class _GitHubMarkPainter extends CustomPainter {
  const _GitHubMarkPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 24.0;
    canvas.save();
    canvas.scale(scale, scale);

    final path = Path()
      ..moveTo(12, 0.5)
      ..cubicTo(5.37, 0.5, 0, 5.87, 0, 12.5)
      ..cubicTo(0, 17.8, 3.44, 22.3, 8.21, 23.89)
      ..cubicTo(8.81, 24.0, 9.03, 23.63, 9.03, 23.31)
      ..lineTo(9.03, 21.1)
      ..cubicTo(5.69, 21.83, 4.99, 19.49, 4.99, 19.49)
      ..cubicTo(4.44, 18.1, 3.65, 17.73, 3.65, 17.73)
      ..cubicTo(2.56, 16.99, 3.73, 17.0, 3.73, 17.0)
      ..cubicTo(4.94, 17.09, 5.57, 18.24, 5.57, 18.24)
      ..cubicTo(6.64, 20.07, 8.38, 19.54, 9.06, 19.23)
      ..cubicTo(9.17, 18.45, 9.48, 17.92, 9.82, 17.62)
      ..cubicTo(7.16, 17.32, 4.36, 16.29, 4.36, 11.7)
      ..cubicTo(4.36, 10.39, 4.83, 9.32, 5.6, 8.48)
      ..cubicTo(5.48, 8.18, 5.06, 6.96, 5.72, 5.31)
      ..cubicTo(5.72, 5.31, 6.73, 4.99, 9.02, 6.54)
      ..cubicTo(9.98, 6.27, 11.0, 6.14, 12.02, 6.14)
      ..cubicTo(13.04, 6.14, 14.06, 6.27, 15.02, 6.54)
      ..cubicTo(17.31, 4.99, 18.32, 5.31, 18.32, 5.31)
      ..cubicTo(18.98, 6.96, 18.56, 8.18, 18.44, 8.48)
      ..cubicTo(19.21, 9.32, 19.68, 10.39, 19.68, 11.7)
      ..cubicTo(19.68, 16.3, 16.87, 17.31, 14.2, 17.61)
      ..cubicTo(14.63, 17.98, 15.01, 18.71, 15.01, 19.83)
      ..lineTo(15.01, 23.31)
      ..cubicTo(15.01, 23.63, 15.23, 24.01, 15.84, 23.89)
      ..cubicTo(20.6, 22.3, 24.0, 17.8, 24.0, 12.5)
      ..cubicTo(24.0, 5.87, 18.63, 0.5, 12.0, 0.5)
      ..close();

    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.fill,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _GitHubMarkPainter oldDelegate) =>
      oldDelegate.color != color;
}
