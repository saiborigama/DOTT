import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/api/api_provider.dart';
import '../../shared/app_role.dart';
import '../../shared/theme/dott_theme.dart';
import '../../shared/widgets/auth_gate.dart';
import '../../shared/widgets/role_home.dart';
import 'rider_screens.dart';

class RiderApp extends StatelessWidget {
  const RiderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [appRoleProvider.overrideWithValue(AppRole.rider)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'DOTT Rider',
        theme: DottTheme.light(),
        home: AuthGate(
          role: AppRole.rider,
          builder: (_) => const RoleHome(
            title: 'DOTT Rider',
            tabs: [
              RoleTab(label: 'Available', icon: Icons.delivery_dining, child: RiderAvailableOrdersScreen()),
              RoleTab(label: 'Deliveries', icon: Icons.route_outlined, child: RiderDeliveriesScreen()),
              RoleTab(label: 'Account', icon: Icons.person_outline, child: RiderAccountScreen()),
            ],
          ),
        ),
      ),
    );
  }
}
