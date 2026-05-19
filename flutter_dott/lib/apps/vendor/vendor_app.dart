import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/api/api_provider.dart';
import '../../shared/app_role.dart';
import '../../shared/models/shop.dart';
import '../../shared/theme/dott_theme.dart';
import '../../shared/widgets/auth_gate.dart';
import '../../shared/widgets/role_home.dart';
import 'vendor_shop_setup_screen.dart';
import 'vendor_screens.dart';

class VendorApp extends StatelessWidget {
  const VendorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [appRoleProvider.overrideWithValue(AppRole.vendor)],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'DOTT Vendor',
        theme: DottTheme.light(),
        home: AuthGate(
          role: AppRole.vendor,
          builder: (_) => const _VendorRoot(),
        ),
      ),
    );
  }
}

final vendorShopProvider = FutureProvider<Shop?>((ref) {
  return ref.watch(apiClientProvider).tryMyShop();
});

class _VendorRoot extends ConsumerStatefulWidget {
  const _VendorRoot();

  @override
  ConsumerState<_VendorRoot> createState() => _VendorRootState();
}

class _VendorRootState extends ConsumerState<_VendorRoot> {
  int _setupVersion = 0;

  @override
  Widget build(BuildContext context) {
    final shopAsync = ref.watch(vendorShopProvider);
    return shopAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(body: Center(child: Text('Could not load shop: $error'))),
      data: (shop) {
        if (shop == null) {
          return VendorShopSetupScreen(
            key: ValueKey(_setupVersion),
            onCreated: (_) {
              ref.invalidate(vendorShopProvider);
              setState(() => _setupVersion++);
            },
          );
        }
        return const RoleHome(
          title: 'DOTT Vendor',
          tabs: [
            RoleTab(label: 'Orders', icon: Icons.receipt_long_outlined, child: VendorOrdersScreen()),
            RoleTab(label: 'Products', icon: Icons.inventory_2_outlined, child: VendorProductsScreen()),
            RoleTab(label: 'Settings', icon: Icons.settings_outlined, child: VendorSettingsScreen()),
          ],
        );
      },
    );
  }
}
