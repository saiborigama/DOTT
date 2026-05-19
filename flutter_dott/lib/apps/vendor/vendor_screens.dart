import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../shared/api/api_provider.dart';
import '../../shared/models/order.dart';
import '../../shared/models/product.dart';
import '../../shared/widgets/dott_card.dart';
import '../../shared/widgets/empty_state.dart';

final vendorOrdersProvider = FutureProvider<List<DottOrder>>((ref) {
  return ref.watch(apiClientProvider).shopOrders();
});

final vendorProductsProvider = FutureProvider<List<Product>>((ref) {
  return ref.watch(apiClientProvider).myProducts();
});

class VendorOrdersScreen extends ConsumerWidget {
  const VendorOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(vendorOrdersProvider);
    return orders.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => EmptyState(title: 'Orders unavailable', message: '$error'),
      data: (items) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final order in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DottCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text('#${order.orderCode}', style: const TextStyle(fontWeight: FontWeight.w900))),
                        Text('Rs ${order.total.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w900)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(order.status),
                    if (order.deliveryAddress.isNotEmpty) Text(order.deliveryAddress, style: TextStyle(color: Colors.grey.shade600)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class VendorProductsScreen extends ConsumerWidget {
  const VendorProductsScreen({super.key});

  Future<void> _analyzeImage(BuildContext context, WidgetRef ref) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 88);
    if (image == null || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(const SnackBar(content: Text('Analyzing product photo...')));
    try {
      final result = await ref.read(apiClientProvider).analyzeProductImage(File(image.path));
      final autofill = Map<String, dynamic>.from((result['autofill'] as Map?) ?? {});
      if (!context.mounted) return;
      showModalBottomSheet(
        context: context,
        showDragHandle: true,
        builder: (_) => Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('AI Draft', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
              const SizedBox(height: 12),
              Text('Name: ${autofill['name'] ?? '-'}'),
              Text('Category: ${autofill['category'] ?? '-'}'),
              Text('Color: ${autofill['color'] ?? '-'}'),
              Text('Price: ${autofill['price'] ?? '-'}'),
              const SizedBox(height: 8),
              Text('${autofill['description'] ?? ''}'),
              const SizedBox(height: 12),
              Text('Source: ${result['analysisSource'] ?? '-'}', style: TextStyle(color: Colors.grey.shade600)),
            ],
          ),
        ),
      );
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('Analysis failed: $error')));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(vendorProductsProvider);
    return products.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => EmptyState(title: 'Products unavailable', message: '$error'),
      data: (items) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FilledButton.icon(
            onPressed: () => _analyzeImage(context, ref),
            icon: const Icon(Icons.add_a_photo_outlined),
            label: const Text('Analyze Product Image'),
          ),
          const SizedBox(height: 14),
          for (final product in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DottCard(
                child: Row(
                  children: [
                    const Icon(Icons.inventory_2_outlined),
                    const SizedBox(width: 12),
                    Expanded(child: Text(product.name, style: const TextStyle(fontWeight: FontWeight.w900))),
                    Text('Rs ${product.price.toStringAsFixed(0)}'),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class VendorSettingsScreen extends StatelessWidget {
  const VendorSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(title: 'Settings', message: 'Shop profile, payment, and alerts will move here.');
  }
}
