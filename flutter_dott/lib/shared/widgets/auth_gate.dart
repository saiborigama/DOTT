import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_provider.dart';
import '../app_role.dart';
import '../models/dott_user.dart';

final sessionProvider = StateNotifierProvider<SessionController, AsyncValue<DottUser?>>((ref) {
  return SessionController(ref.watch(apiClientProvider));
});

class SessionController extends StateNotifier<AsyncValue<DottUser?>> {
  SessionController(this.api) : super(const AsyncValue.loading()) {
    restore();
  }

  final ApiClient api;

  Future<void> restore() async {
    try {
      final token = await api.tokens.accessToken();
      if (token == null || token.isEmpty) {
        state = const AsyncValue.data(null);
        return;
      }
      state = AsyncValue.data(await api.me());
    } catch (_) {
      await api.tokens.clear();
      state = const AsyncValue.data(null);
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => api.login(email, password));
  }

  Future<void> register(String name, String email, String phone, String password) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => api.register(name: name, email: email, phone: phone, password: password));
  }

  Future<void> logout() async {
    await api.logout();
    state = const AsyncValue.data(null);
  }
}

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key, required this.role, required this.builder});

  final AppRole role;
  final WidgetBuilder builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return session.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => AuthScreen(role: role, errorText: '$error'),
      data: (user) => user == null ? AuthScreen(role: role) : builder(context),
    );
  }
}

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key, required this.role, this.errorText});

  final AppRole role;
  final String? errorText;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final password = TextEditingController();
  bool register = false;

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(18),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(widget.role.title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 4),
                      Text(register ? 'Create your account' : 'Welcome back', style: TextStyle(color: Colors.grey.shade600)),
                      const SizedBox(height: 18),
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment(value: false, label: Text('Sign In')),
                          ButtonSegment(value: true, label: Text('Sign Up')),
                        ],
                        selected: {register},
                        onSelectionChanged: (set) => setState(() => register = set.first),
                      ),
                      const SizedBox(height: 16),
                      if (register) ...[
                        TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
                        const SizedBox(height: 10),
                        TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone')),
                        const SizedBox(height: 10),
                      ],
                      TextField(controller: email, decoration: const InputDecoration(labelText: 'Email')),
                      const SizedBox(height: 10),
                      TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
                      if (widget.errorText != null) ...[
                        const SizedBox(height: 10),
                        Text(widget.errorText!, style: const TextStyle(color: Colors.red)),
                      ],
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: session.isLoading
                            ? null
                            : () {
                                if (register) {
                                  ref.read(sessionProvider.notifier).register(name.text, email.text, phone.text, password.text);
                                } else {
                                  ref.read(sessionProvider.notifier).login(email.text, password.text);
                                }
                              },
                        child: Text(session.isLoading ? 'Please wait...' : register ? 'Create Account' : 'Sign In'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
