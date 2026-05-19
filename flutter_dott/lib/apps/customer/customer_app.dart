import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/api/api_provider.dart';
import '../../shared/app_role.dart';
import '../../shared/theme/dott_theme.dart';
import '../../shared/widgets/auth_gate.dart';
import '../../shared/widgets/role_home.dart';
import 'customer_home_screen.dart';

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [appRoleProvider.overrideWithValue(AppRole.customer)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'DOTT Customer',
        theme: DottTheme.light(),
        home: AuthGate(
          role: AppRole.customer,
          builder: (_) => const RoleHome(
            title: 'DOTT',
            tabs: [
              RoleTab(label: 'Home', icon: Icons.home_outlined, child: CustomerHomeScreen()),
              RoleTab(label: 'Shops', icon: Icons.storefront_outlined, child: CustomerShopsScreen()),
              RoleTab(label: 'Cart', icon: Icons.shopping_cart_outlined, child: CustomerCartScreen()),
              RoleTab(label: 'Account', icon: Icons.person_outline, child: CustomerAccountScreen()),
            ],
          ),
        ),
      ),
    );
  }
}
