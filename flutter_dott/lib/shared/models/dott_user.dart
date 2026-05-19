class DottUser {
  const DottUser({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
  });

  final int id;
  final String name;
  final String email;
  final String phone;
  final String role;

  factory DottUser.fromJson(Map<String, dynamic> json) {
    return DottUser(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: '${json['name'] ?? ''}',
      email: '${json['email'] ?? ''}',
      phone: '${json['phone'] ?? ''}',
      role: '${json['role'] ?? ''}',
    );
  }
}
