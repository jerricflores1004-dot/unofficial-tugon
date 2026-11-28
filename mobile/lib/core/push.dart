import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Registers this phone for push notifications and keeps its token current.
class PushService {
  static String? _registeredFor;
  static final List<StreamSubscription<dynamic>> _subscriptions = [];

  /// [onMessage] runs for messages that arrive while the app is open (Android shows
  /// the others itself, even when the app is closed).
  static Future<void> start(SupabaseClient client,
      {void Function(String? title, String? body)? onMessage}) async {
    final userId = client.auth.currentUser?.id;
    if (kIsWeb || userId == null || _registeredFor == userId) return;
    _registeredFor = userId;
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      final token = await messaging.getToken();
      if (token != null) await _register(client, token);
      _subscriptions.add(messaging.onTokenRefresh.listen((fresh) => _register(client, fresh)));
      _subscriptions.add(FirebaseMessaging.onMessage.listen(
          (message) => onMessage?.call(message.notification?.title, message.notification?.body)));
    } catch (error) {
      debugPrint('PUSH setup failed: $error');
      _registeredFor = null;
    }
  }

  static Future<void> _register(SupabaseClient client, String token) async {
    await client.rpc('register_device', params: {
      'p_token': token,
      'p_platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
    });
  }
}