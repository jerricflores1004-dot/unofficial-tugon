import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'models.dart';
import 'offline_queue.dart';

class TugonApi {
  TugonApi(this.client);
  final SupabaseClient client;
  Future<List<ResidentIncident>> myIncidents() async { final response = await client.from('incidents').select('*, tickets(ticket_number)').eq('reporter_id', client.auth.currentUser!.id).order('reported_at', ascending: false); return (response as List).map((item) => ResidentIncident.fromJson(item)).toList(); }
  Future<void> submitIncident(Map<String, dynamic> payload) async { await client.from('incidents').insert({...payload, 'reporter_id': client.auth.currentUser!.id}); }
  Future<int> syncQueuedReports(OfflineReportQueue queue) async { final pending = await queue.read(); var synced = 0; for (final report in pending) { final payload = Map<String, dynamic>.from(report)..remove('queued_at'); try { await submitIncident(payload); synced++; } catch (_) { break; } } await queue.replace(pending.skip(synced).toList()); return synced; }
  Future<void> registerDevice(String token, String platform) async { final base = dotenv.env['API_BASE_URL']; if (base == null) return; await Dio().post('$base/api/notifications/register-device', data: {'token': token, 'platform': platform}, options: Options(headers: {'Authorization': 'Bearer ${client.auth.currentSession?.accessToken}'})); }
}
