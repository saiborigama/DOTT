import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/api/api_provider.dart';
import '../../shared/models/product.dart';
import '../../shared/models/shop.dart';
import '../../shared/widgets/dott_card.dart';
import '../../shared/widgets/empty_state.dart';

final customerProductsProvider = FutureProvider<List<Product>>((ref) {
  return ref.watch(apiClientProvider).products();
});

final customerShopsProvider = FutureProvider<List<Shop>>((ref) {
  return ref.watch(apiClientProvider).shops();
});

class CustomerHomeScreen extends ConsumerWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(customerProductsProvider);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(customerProductsProvider),
      child: products.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => EmptyState(title: 'Products unavailable', message: '$error'),
        data: (items) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              decoration: InputDecoration(
                hintText: 'Search products',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(icon: const Icon(Icons.camera_alt_outlined), onPressed: () {}),
              ),
            ),
            const SizedBox(height: 16),
            Text('Products', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            if (items.isEmpty)
              const EmptyState(title: 'No products yet')
            else
              for (final product in items.take(20)) ProductTile(product: product),
          ],
        ),
      ),
    );
  }
}

class CustomerShopsScreen extends ConsumerWidget {
  const CustomerShopsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shops = ref.watch(customerShopsProvider);
    return shops.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => EmptyState(title: 'Shops unavailable', message: '$error'),
      data: (items) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const TextField(decoration: InputDecoration(hintText: 'Search shop name', prefixIcon: Icon(Icons.search))),
          const SizedBox(height: 14),
          for (final shop in items) ShopTile(shop: shop),
        ],
      ),
    );
  }
}

class CustomerCartScreen extends StatelessWidget {
  const CustomerCartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(title: 'Cart', message: 'Cart conversion comes next.');
  }
}

class CustomerAccountScreen extends StatelessWidget {
  const CustomerAccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(title: 'Account', message: 'Orders, tracking, referral, and profile will move here.');
  }
}

class ProductTile extends StatelessWidget {
  const ProductTile({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DottCard(
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 64,
                height: 64,
                color: const Color(0xFFEAF6FF),
                child: product.imageUrl.isEmpty ? const Icon(Icons.image_outlined) : Image.network(product.imageUrl, fit: BoxFit.cover),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                  Text(product.category, style: TextStyle(color: Colors.grey.shade600)),
                ],
              ),
            ),
            Text('Rs ${product.price.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }
}

class ShopTile extends StatelessWidget {
  const ShopTile({super.key, required this.shop});

  final Shop shop;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DottCard(
        child: Row(
          children: [
            const CircleAvatar(child: Icon(Icons.storefront_outlined)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(shop.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                  Text(shop.category, style: TextStyle(color: Colors.grey.shade600)),
                ],
              ),
            ),
            if (shop.distanceKm != null) Text('${shop.distanceKm!.toStringAsFixed(1)} km'),
          ],
        ),
      ),
    );
  }
}
