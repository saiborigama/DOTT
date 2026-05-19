import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/api/api_provider.dart';
import '../../shared/models/order.dart';
import '../../shared/widgets/dott_card.dart';
import '../../shared/widgets/empty_state.dart';

final riderAvailableOrdersProvider = FutureProvider<List<DottOrder>>((ref) {
  return ref.watch(apiClientProvider).availableRiderOrders();
});

class RiderAvailableOrdersScreen extends ConsumerWidget {
  const RiderAvailableOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(riderAvailableOrdersProvider);
    return orders.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => EmptyState(title: 'Orders unavailable', message: '$error'),
      data: (items) {
        if (items.isEmpty) return const EmptyState(title: 'No available orders');
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            for (final order in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: DottCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('#${order.orderCode}', style: const TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 6),
                      Text(order.deliveryAddress),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () async {
                          await ref.read(apiClientProvider).acceptRiderOrder(order.id);
                          ref.invalidate(riderAvailableOrdersProvider);
                        },
                        child: const Text('Accept Order'),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class RiderDeliveriesScreen extends StatelessWidget {
  const RiderDeliveriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(title: 'Deliveries', message: 'Pickup OTP, live tracking, and delivery OTP come next.');
  }
}

class RiderAccountScreen extends StatelessWidget {
  const RiderAccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const EmptyState(title: 'Account', message: 'Earnings, COD settlement, and profile will move here.');
  }
}
