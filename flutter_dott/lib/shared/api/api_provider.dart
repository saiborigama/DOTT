import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app_role.dart';
import 'api_client.dart';

final appRoleProvider = Provider<AppRole>((ref) => throw UnimplementedError());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(role: ref.watch(appRoleProvider));
});
