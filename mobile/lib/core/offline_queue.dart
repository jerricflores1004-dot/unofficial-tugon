import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class OfflineReportQueue {
  static const _key = 'tugon_pending_reports';
  Future<List<Map<String, dynamic>>> read() async { final prefs = await SharedPreferences.getInstance(); final values = prefs.getStringList(_key) ?? []; return values.map((value) => jsonDecode(value) as Map<String, dynamic>).toList(); }
  Future<void> enqueue(Map<String, dynamic> report) async { final prefs = await SharedPreferences.getInstance(); final pending = await read(); pending.add({...report, 'queued_at': DateTime.now().toIso8601String()}); await prefs.setStringList(_key, pending.map(jsonEncode).toList()); }
  Future<void> replace(List<Map<String, dynamic>> reports) async { final prefs = await SharedPreferences.getInstance(); if (reports.isEmpty) { await prefs.remove(_key); } else { await prefs.setStringList(_key, reports.map(jsonEncode).toList()); } }
  Future<void> removeAll() async { final prefs = await SharedPreferences.getInstance(); await prefs.remove(_key); }
}
