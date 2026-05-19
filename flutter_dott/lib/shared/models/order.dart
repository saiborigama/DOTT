class DottOrder {
  const DottOrder({
    required this.id,
    required this.orderCode,
    required this.status,
    required this.total,
    this.customerName = '',
    this.deliveryAddress = '',
  });

  final int id;
  final String orderCode;
  final String status;
  final double total;
  final String customerName;
  final String deliveryAddress;

  factory DottOrder.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'];
    return DottOrder(
      id: (json['id'] as num?)?.toInt() ?? 0,
      orderCode: '${json['orderCode'] ?? json['order_code'] ?? ''}',
      status: '${json['status'] ?? ''}',
      total: (json['total'] as num?)?.toDouble() ?? 0,
      customerName: customer is Map ? '${customer['name'] ?? ''}' : '${json['customerName'] ?? ''}',
      deliveryAddress: '${json['deliveryAddress'] ?? json['delivery_address'] ?? ''}',
    );
  }
}
