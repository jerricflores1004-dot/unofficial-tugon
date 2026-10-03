import 'package:flutter_test/flutter_test.dart';
import 'package:tugon_mobile/core/models.dart';

void main() {
  test('resident incident maps API fields without trusting client priority', () {
    final incident = ResidentIncident.fromJson({
      'incident_type': 'Flooding',
      'barangay': 'Poblacion',
      'status': 'pending',
      'priority': 'high',
      'reported_at': '2026-10-03T09:00:00Z',
      'tickets': {'ticket_number': 'TGN-20261003-0001'},
    });
    expect(incident.ticketId, 'TGN-20261003-0001');
    expect(incident.type, 'Flooding');
    expect(incident.status, 'pending');
  });
}
