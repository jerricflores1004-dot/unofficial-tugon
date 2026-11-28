import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import 'models.dart';
import 'offline_queue.dart';

/// Outcome of a resident report submission.
class SubmitResult {
  const SubmitResult({required this.submitted, this.incidentId});
  final bool submitted;
  final String? incidentId;
}

/// Every value the resident app renders is read from Supabase/PostgreSQL.
/// There are no sample records in this codebase: when a query fails the UI
/// shows an error or an empty state instead of falling back to fixed content.
class TugonApi {
  TugonApi(this.client);

  final SupabaseClient client;

  String get _userId => client.auth.currentUser?.id ?? '';
  Future<AppProfile?> myProfile() async {
    final row = await client
        .from('users')
        .select('role, agency, team, full_name, is_active')
        .eq('id', _userId)
        .maybeSingle();
    if (row == null) return null;
    return AppProfile.fromJson(Map<String, dynamic>.from(row as Map));
  }
  Future<List<ResidentIncident>> myIncidents() async {
    final response = await client
        .from('incidents')
        .select('*, tickets(ticket_number)')
        .eq('reporter_id', _userId)
        .order('reported_at', ascending: false);
    return (response as List)
        .map((item) => ResidentIncident.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  /// Controlled vocabulary stored in `public.incident_types`.
  /// Returns an empty list when the table has no active rows, and the report
  /// form then lets the resident type the incident instead.
  Future<List<IncidentTypeOption>> incidentTypes() async {
    final response = await client.rpc('active_incident_types');
    return (response as List)
        .map((item) => IncidentTypeOption.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<List<ResidentNotification>> myNotifications() async {
    final response = await client
        .from('notifications')
        .select('*')
        .or('user_id.eq.$_userId,user_id.is.null')
        .order('created_at', ascending: false)
        .limit(50);
    return response
        .map((item) => ResidentNotification.fromJson(
              Map<String, dynamic>.from(item as Map),
              isPersonal: (item as Map)['user_id'] == _userId,
            ))
        .toList();
  }

  Future<void> markNotificationRead(String id) async {
    await client
        .from('notifications')
        .update({'read_at': DateTime.now().toIso8601String()})
        .eq('id', id)
        .eq('user_id', _userId);
  }

  Future<int> markAllNotificationsRead() async {
    final response = await client
        .from('notifications')
        .update({'read_at': DateTime.now().toIso8601String()})
        .eq('user_id', _userId)
        .isFilter('read_at', null)
        .select('id');
    return response.length;
  }

  /// Published, non-expired announcements written by the operations workspace.
  Future<List<ResidentAnnouncement>> announcements() async {
    final now = DateTime.now().toUtc().toIso8601String();
    final response = await client
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .or('expires_at.is.null,expires_at.gt.$now')
        .order('published_at', ascending: false)
        .limit(10);
    return (response as List)
        .map((item) => ResidentAnnouncement.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  /// Reads a numeric workspace setting, e.g. `max_incident_photos`.
  Future<int> numericSetting(String key, int fallback) async {
    final response =
        await client.from('system_settings').select('value').eq('key', key).maybeSingle();
    final value = (response as Map?)?['value'];
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
    return fallback;
  }

  /// `offline_sync_enabled` from `public.system_settings`.
  Future<bool> offlineSyncEnabled() async {
    final response = await client
        .from('system_settings')
        .select('value')
        .eq('key', 'offline_sync_enabled')
        .maybeSingle();
    final value = (response as Map?)?['value'];
    if (value is bool) return value;
    if (value is String) return value.toLowerCase() == 'true';
    return false;
  }

  /// Returns the id of the stored incident so evidence can be attached to it.
  Future<String> submitIncident(Map<String, dynamic> payload) async {
    final response = await client
        .from('incidents')
        .insert({...payload, 'reporter_id': _userId})
        .select('id')
        .single();
    return (response as Map)['id'].toString();
  }

  /// The barangay at a GPS point, from OpenStreetMap's reverse geocoder.
  /// Returns null when offline or unknown; the resident can always type it.
  /// shortcut: public Nominatim allows ~1 request/second, fine for one tap per report;
  /// move to a self-hosted geocoder or a barangay boundary table if usage grows.
  Future<String?> barangayAt(double latitude, double longitude) async {
    try {
      final response = await Dio().get(
          'https://nominatim.openstreetmap.org/reverse',
          queryParameters: {
            'format': 'jsonv2',
            'lat': latitude,
            'lon': longitude,
            'zoom': 18,
            'addressdetails': 1,
          },
          options: Options(
              headers: {'User-Agent': 'TUGON-Mabini/1.0', 'Accept-Language': 'en'},
              receiveTimeout: const Duration(seconds: 8)));
      final address = (response.data as Map?)?['address'];
      if (address is! Map) return null;
      // In Mabini, OSM tags barangays as "quarter" or "village"; try the most specific first.
      for (final key in ['quarter', 'village', 'suburb', 'neighbourhood', 'hamlet']) {
        final value = address[key];
        if (value is String && value.trim().isNotEmpty) return value.trim();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Asks the server to run AI severity triage and auto-dispatch. Call it after
  /// the photos are uploaded so the AI can look at them. Callers fire and
  /// forget: a failure never blocks the report, and admins can re-run triage.
  Future<void> requestTriage(String incidentId) async {
    final base = dotenv.env['API_BASE_URL'];
    final token = client.auth.currentSession?.accessToken;
    if (base == null || token == null) return;
    await Dio().post('$base/api/incidents/$incidentId/triage',
        options: Options(headers: {'Authorization': 'Bearer $token'}));
  }

  /// Uploads evidence to the private bucket and records its metadata.
  /// The per-incident ceiling comes from `public.system_settings`.
  Future<int> uploadPhotos(String incidentId, List<XFile> files) async {
    final limit = await numericSetting('max_incident_photos', 5);
    var uploaded = 0;
    for (final file in files.take(limit)) {
      final local = File(file.path);
      final safeName = file.name.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '-');
      final path = '$incidentId/${const Uuid().v4()}-$safeName';
      await client.storage.from('incident-photos').upload(path, local);
      await client.from('incident_photos').insert({
        'incident_id': incidentId,
        'storage_path': path,
        'original_name': file.name,
        'content_type': file.mimeType ?? 'application/octet-stream',
        'size_bytes': await local.length(),
        'uploaded_by': _userId,
      });
      uploaded++;
    }
    return uploaded;
  }

  /// Submits a report, falling back to the on-device queue when the write fails
  /// and `offline_sync_enabled` allows it. Returns the stored incident id so
  /// evidence can be attached to the same row — never creating a duplicate.
  Future<SubmitResult> submitOrQueue(Map<String, dynamic> payload,
      OfflineReportQueue queue,
      {bool queueEnabled = true}) async {
    try {
      final incidentId = await submitIncident(payload);
      return SubmitResult(submitted: true, incidentId: incidentId);
    } catch (_) {
      if (!queueEnabled) rethrow;
      await queue.enqueue(payload);
      return const SubmitResult(submitted: false);
    }
  }

  Future<int> syncQueuedReports(OfflineReportQueue queue) async {
    final pending = await queue.read();
    var synced = 0;
    for (final report in pending) {
      final payload = Map<String, dynamic>.from(report)..remove('queued_at');
      try {
        final id = await submitIncident(payload);
        requestTriage(id).catchError((_) {});
        synced++;
      } catch (_) {
        break;
      }
    }
    await queue.replace(pending.skip(synced).toList());
    return synced;
  }

  Future<void> registerDevice(String token, String platform) async {
    final base = dotenv.env['API_BASE_URL'];
    if (base == null) return;
    await Dio().post('$base/api/notifications/register-device',
        data: {'token': token, 'platform': platform},
        options: Options(
            headers: {'Authorization': 'Bearer ${client.auth.currentSession?.accessToken}'}));
  }
}
