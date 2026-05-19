class Shop {
  const Shop({
    required this.id,
    required this.name,
    this.category = '',
    this.imageUrl = '',
    this.distanceKm,
    this.rating,
  });

  final int id;
  final String name;
  final String category;
  final String imageUrl;
  final double? distanceKm;
  final double? rating;

  factory Shop.fromJson(Map<String, dynamic> json) {
    return Shop(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: '${json['name'] ?? ''}',
      category: '${json['category'] ?? ''}',
      imageUrl: '${json['imageUrl'] ?? json['image_url'] ?? ''}',
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      rating: (json['rating'] as num?)?.toDouble(),
    );
  }
}
