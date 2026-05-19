# DOTT Flutter

Flutter rewrite for the three active apps:

- Customer
- Vendor
- Rider

Admin is intentionally excluded.

## Entry Points

Run one role at a time:

```bash
flutter run -t lib/main_customer.dart
flutter run -t lib/main_vendor.dart
flutter run -t lib/main_rider.dart
```

The API defaults to `http://10.0.2.2:8080/api` for Android emulator. Override it:

```bash
flutter run -t lib/main_vendor.dart --dart-define=API_BASE_URL=http://192.168.63.61:8080/api
```

## Current Scope

This is the first conversion scaffold:

- Shared API client with login, refresh token, and authenticated requests
- Shared DOTT theme and reusable app shell
- Customer home/products/cart/account starter
- Vendor orders/products/settings starter with product image analysis upload
- Rider available orders/deliveries/account starter

Next conversion pass should move each React screen into its matching Flutter screen.
