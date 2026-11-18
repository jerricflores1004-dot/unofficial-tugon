import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/models.dart';
import '../core/theme.dart';

String _ago(String? iso) {
  final at = iso == null ? null : DateTime.tryParse(iso)?.toLocal();
  if (at == null) return '';
  final d = DateTime.now().difference(at);
  if (d.inMinutes < 1) return 'Just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} hr ago';
  return '${d.inDays} d ago';
}

class FieldHomeScreen extends StatefulWidget {
  const FieldHomeScreen({super.key, required this.profile});
  final AppProfile profile;

  @override
  State<FieldHomeScreen> createState() => _FieldHomeScreenState();
}

class _FieldHomeScreenState extends State<FieldHomeScreen> {
  final _db = Supabase.instance.client;
  Timer? _poll;
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _notFieldTeam = false;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _refresh();
    _poll = Timer.periodic(const Duration(seconds: 15), (_) => _refresh());
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  List<Map<String, dynamic>> get _all => ((_data?['assignments'] as List?) ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();

  Future<void> _refresh() async {
    try {
      final res = await _db.rpc('field_team_my_assignments');
      if (!mounted) return;
      setState(() {
        _notFieldTeam = res == null;
        _data = res == null ? null : Map<String, dynamic>.from(res as Map);
        _error = null;
        _loading = false;
      });
    } catch (e) {
      debugPrint('FIELD REFRESH ERROR: $e');
      if (!mounted) return;
      setState(() {
        _error = 'Unable to reach the server: $e';
        _loading = false;
      });
    }
  }

  void _snack(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _acknowledge(String id) async {
    setState(() => _busyId = id);
    try {
      await _db.rpc('field_team_acknowledge', params: {'p_observer_id': id});
      await _refresh();
      _snack('Acknowledged. The MDRRMO has been notified.');
    } catch (_) {
      _snack('Could not acknowledge. Check your signal and try again.');
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _openMaps(Map<String, dynamic> a) async {
    final lat = a['latitude'];
    final lng = a['longitude'];
    final query = lat != null && lng != null
        ? '$lat,$lng'
        : Uri.encodeComponent('${a['location_text'] ?? ''} ${a['barangay'] ?? ''} Mabini Batangas');
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) _snack('Could not open Maps.');
  }

  @override
  Widget build(BuildContext context) {
    final name = '${_data?['team']?['name'] ?? (widget.profile.fullName.isEmpty ? 'Field team' : widget.profile.fullName)}';
    final active = _all.where((a) => a['status'] != 'done').toList();
    final earlier = _all.where((a) => a['status'] == 'done').take(10).toList();
    final waiting = active.where((a) => a['status'] == 'assigned').length;

    return Scaffold(
      appBar: AppBar(
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => _db.auth.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _notFieldTeam
          ? const Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: Text(
            'This account is not set up as an MDRRMO field team. Contact the TUGON administrator.',
            textAlign: TextAlign.center,
          ),
        ),
      )
          : RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            if (_error != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(12)),
                child: Text(_error!, style: const TextStyle(color: Color(0xFF92400E), fontSize: 13)),
              ),
            if (waiting > 0)
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                    color: TugonColors.emergency, borderRadius: BorderRadius.circular(16)),
                child: Row(children: [
                  const Icon(Icons.notifications_active, color: Colors.white, size: 26),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      waiting == 1
                          ? '1 new assignment is waiting for your acknowledgement.'
                          : '$waiting new assignments are waiting for your acknowledgement.',
                      style: const TextStyle(
                          color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ),
                ]),
              ),
            if (active.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(children: [
                    Icon(Icons.shield_outlined, size: 40, color: TugonColors.blue),
                    SizedBox(height: 10),
                    Text('No active assignment',
                        style: TextStyle(
                            fontSize: 19, fontWeight: FontWeight.w800, color: TugonColors.navy)),
                    SizedBox(height: 6),
                    Text(
                      'New assignments from the MDRRMO appear here automatically.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: TugonColors.muted, fontSize: 13),
                    ),
                  ]),
                ),
              ),
            for (final a in active) _card(a),
            if (earlier.isNotEmpty) ...[
              const SizedBox(height: 18),
              const Text('Earlier',
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800, color: TugonColors.navy)),
              const SizedBox(height: 8),
              for (final a in earlier)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.check_circle_outline, color: TugonColors.muted),
                    title: Text('${a['incident_type'] ?? 'Incident'} · ${a['barangay'] ?? ''}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                    subtitle: Text(_ago(a['created_at'] as String?),
                        style: const TextStyle(fontSize: 11)),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _card(Map<String, dynamic> a) {
    final isNew = a['status'] == 'assigned';
    final priority = '${a['priority'] ?? ''}';
    final color = priority == 'critical'
        ? TugonColors.emergency
        : priority == 'high'
        ? const Color(0xFFEA580C)
        : TugonColors.blue;
    final agency = '${a['agency'] ?? ''}'.toUpperCase().replaceAll('_', ' ');
    final note = '${a['note'] ?? ''}';
    final id = '${a['id']}';

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: isNew ? TugonColors.emergency : color, width: 2),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
              child: Text(priority.toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
            ),
            const Spacer(),
            Text(isNew ? 'NEW ASSIGNMENT' : 'ACKNOWLEDGED',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: isNew ? TugonColors.emergency : TugonColors.success)),
          ]),
          const SizedBox(height: 12),
          Text('${a['incident_type'] ?? 'Incident'}',
              style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800, color: TugonColors.navy)),
          const SizedBox(height: 4),
          Text(
            '${a['barangay'] ?? ''}${('${a['location_text'] ?? ''}').isEmpty ? '' : ' · ${a['location_text']}'}',
            style: const TextStyle(fontSize: 15, color: TugonColors.ink),
          ),
          if (agency.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.local_shipping_outlined, size: 18, color: TugonColors.muted),
              const SizedBox(width: 6),
              Expanded(
                child: Text('Observe the $agency response',
                    style: const TextStyle(fontSize: 14, color: TugonColors.muted)),
              ),
            ]),
          ],
          if (('${a['description'] ?? ''}').isNotEmpty) ...[
            const SizedBox(height: 10),
            Text('${a['description']}',
                style: const TextStyle(fontSize: 13, height: 1.4, color: TugonColors.muted)),
          ],
          if (a['affected_people'] != null) ...[
            const SizedBox(height: 6),
            Text('${a['affected_people']} people affected',
                style: const TextStyle(fontSize: 12, color: TugonColors.muted)),
          ],
          if (note.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12)),
              child: Text('Message from the MDRRMO: $note',
                  style: const TextStyle(fontSize: 13, height: 1.4, color: TugonColors.ink)),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: () => _openMaps(a),
              icon: const Icon(Icons.map_outlined),
              label: const Text('Open in Maps', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 10),
          if (isNew)
            SizedBox(
              width: double.infinity,
              height: 60,
              child: FilledButton.icon(
                onPressed: _busyId == id ? null : () => _acknowledge(id),
                icon: _busyId == id
                    ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check_circle_outline, size: 26),
                label: const Text('Acknowledge',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              ),
            )
          else
            Text('Acknowledged ${_ago(a['acknowledged_at'] as String?)}',
                style: const TextStyle(fontSize: 12, color: TugonColors.muted)),
        ]),
      ),
    );
  }
}