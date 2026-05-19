import 'dart:io';

import 'package:dio/dio.dart';

import '../app_role.dart';
import '../models/dott_user.dart';
import '../models/order.dart';
import '../models/product.dart';
import '../models/shop.dart';
import 'token_store.dart';

const defaultApiBase = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8080/api',
);

class ApiClient {
  ApiClient({required this.role, String baseUrl = defaultApiBase})
      : tokens = TokenStore('dott_${role.name}'),
        dio = Dio(BaseOptions(baseUrl: baseUrl)) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokens.accessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode != 401) {
            handler.next(error);
            return;
          }
          final refresh = await tokens.refreshToken();
          if (refresh == null || refresh.isEmpty) {
            handler.next(error);
            return;
          }
          try {
            final response = await Dio(BaseOptions(baseUrl: baseUrl)).post(
              '/auth/refresh',
              data: {'refreshToken': refresh},
            );
            await tokens.save(response.data['accessToken'], response.data['refreshToken']);
            final retry = await dio.fetch(
              error.requestOptions
                ..headers['Authorization'] = 'Bearer ${response.data['accessToken']}',
            );
            handler.resolve(retry);
          } catch (_) {
            await tokens.clear();
            handler.next(error);
          }
        },
      ),
    );
  }

  final AppRole role;
  final Dio dio;
  final TokenStore tokens;

  Future<DottUser> login(String email, String password) async {
    final response = await dio.post('/auth/login', data: {'email': email, 'password': password});
    await tokens.save(response.data['accessToken'], response.data['refreshToken']);
    return DottUser.fromJson(response.data['user']);
  }

  Future<DottUser> register({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    final response = await dio.post('/auth/register', data: {
      'name': name,
      'email': email,
      'phone': phone,
      'password': password,
      'role': role.apiRole,
    });
    await tokens.save(response.data['accessToken'], response.data['refreshToken']);
    return DottUser.fromJson(response.data['user']);
  }

  Future<DottUser> me() async {
    final response = await dio.get('/auth/me');
    return DottUser.fromJson(response.data);
  }

  Future<void> logout() async {
    try {
      await dio.post('/auth/logout');
    } finally {
      await tokens.clear();
    }
  }

  Future<List<Shop>> shops({double? lat, double? lng, double radius = 10}) async {
    final response = await dio.get('/shops', queryParameters: {'lat': lat, 'lng': lng, 'radius': radius});
    return (response.data as List).map((item) => Shop.fromJson(item)).toList();
  }

  Future<Shop> myShop() async {
    final response = await dio.get('/shops/my');
    return Shop.fromJson(response.data);
  }

  Future<Shop?> tryMyShop() async {
    try {
      return await myShop();
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  Future<Shop> createShop({
    required String name,
    required String category,
    required String description,
    required String phone,
    required int deliveryTime,
    String address = 'Shop address will be updated soon',
    String city = 'Hyderabad',
  }) async {
    final response = await dio.post('/shops', data: {
      'name': name,
      'category': category,
      'description': description,
      'phone': phone,
      'deliveryTime': deliveryTime,
      'address': address,
      'city': city,
      'lat': 17.385,
      'lng': 78.4867,
      'minOrder': 0,
      'acceptsReturns': false,
      'returnDays': 0,
      'returnPolicyNote': '',
    });
    return Shop.fromJson(response.data);
  }

  Future<List<Product>> products({double? lat, double? lng, double radius = 10}) async {
    final response = await dio.get('/products', queryParameters: {'lat': lat, 'lng': lng, 'radius': radius});
    return (response.data as List).map((item) => Product.fromJson(item)).toList();
  }

  Future<List<Product>> myProducts() async {
    final response = await dio.get('/products/my');
    return (response.data as List).map((item) => Product.fromJson(item)).toList();
  }

  Future<Map<String, dynamic>> analyzeProductImage(File file) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path),
      'enhanceImage': 'false',
    });
    final response = await dio.post('/upload/product-image-transform', data: form);
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<List<DottOrder>> myOrders() async {
    final response = await dio.get('/orders/my');
    return (response.data as List).map((item) => DottOrder.fromJson(item)).toList();
  }

  Future<List<DottOrder>> shopOrders({String? status}) async {
    final response = await dio.get('/orders/shop/all', queryParameters: {'status': status});
    return (response.data as List).map((item) => DottOrder.fromJson(item)).toList();
  }

  Future<List<DottOrder>> availableRiderOrders() async {
    final response = await dio.get('/orders/rider/available');
    return (response.data as List).map((item) => DottOrder.fromJson(item)).toList();
  }

  Future<void> acceptRiderOrder(int orderId) async {
    await dio.post('/orders/$orderId/rider-accept');
  }

  Future<Map<String, dynamic>> generatePickupOtp(int orderId) async {
    final response = await dio.post('/orders/$orderId/pickup-otp/generate');
    return Map<String, dynamic>.from(response.data as Map);
  }
}
