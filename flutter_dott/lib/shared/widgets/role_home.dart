import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_gate.dart';

class RoleHome extends ConsumerStatefulWidget {
  const RoleHome({super.key, required this.title, required this.tabs});

  final String title;
  final List<RoleTab> tabs;

  @override
  ConsumerState<RoleHome> createState() => _RoleHomeState();
}

class _RoleHomeState extends ConsumerState<RoleHome> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final tab = widget.tabs[index];
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => ref.read(sessionProvider.notifier).logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: tab.child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: [
          for (final item in widget.tabs)
            NavigationDestination(icon: Icon(item.icon), label: item.label),
        ],
      ),
    );
  }
}

class RoleTab {
  const RoleTab({required this.label, required this.icon, required this.child});

  final String label;
  final IconData icon;
  final Widget child;
}
