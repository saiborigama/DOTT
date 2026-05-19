class Product {
  const Product({
    required this.id,
    required this.name,
    required this.price,
    this.category = '',
    this.imageUrl = '',
    this.shopName = '',
  });

  final int id;
  final String name;
  final double price;
  final String category;
  final String imageUrl;
  final String shopName;

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: '${json['name'] ?? ''}',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      category: '${json['category'] ?? ''}',
      imageUrl: '${json['imageUrl'] ?? json['image_url'] ?? ''}',
      shopName: '${json['shopName'] ?? ''}',
    );
  }
}
