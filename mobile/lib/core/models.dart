enum IncidentStatus { pending, verified, responding, resolved, closed, rejected }

/// Reads a to-one PostgREST embed, which may arrive as an object or a list.
dynamic _embedded(dynamic value) {
  if (value is List) return value.isEmpty ? null : value.first;
  return value;
}

String _text(dynamic value, [String fallback = '']) {
  if (value is String && value.isNotEmpty) return value;
  return fallback;
}

class ResidentIncident {
  final String ticketId;
  final String type;
  final String barangay;
  final String status;
  final String reportedAt;
  final String priority;

  const ResidentIncident({
    required this.ticketId,
    required this.type,
    required this.barangay,
    required this.status,
    required this.reportedAt,
    required this.priority,
  });

  factory ResidentIncident.fromJson(Map<String, dynamic> json) {
    final ticket = _embedded(json['tickets']) ?? _embedded(json['ticket']);
    return ResidentIncident(
      ticketId: _text(ticket?['ticket_number'], 'Processing'),
      type: _text(json['incident_type'], 'Unclassified incident'),
      barangay: _text(json['barangay'], 'Barangay not recorded'),
      status: _text(json['status'], 'pending'),
      reportedAt: _text(json['reported_at']),
      // Priority is computed by a PostgreSQL trigger and never trusted from the client.
      priority: _text(json['priority'], 'low'),
    );
  }
}

class IncidentTypeOption {
  final String id;
  final String label;
  final int sortOrder;

  const IncidentTypeOption({required this.id, required this.label, required this.sortOrder});

  factory IncidentTypeOption.fromJson(Map<String, dynamic> json) => IncidentTypeOption(
        id: _text(json['id']),
        label: _text(json['label']),
        sortOrder: json['sort_order'] is int ? json['sort_order'] as int : 0,
      );
}

class ResidentNotification {
  final String id;
  final String title;
  final String body;
  final String type;
  final bool unread;
  final DateTime? createdAt;

  const ResidentNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.unread,
    required this.createdAt,
  });

  factory ResidentNotification.fromJson(Map<String, dynamic> json, {bool isPersonal = true}) =>
      ResidentNotification(
        id: _text(json['id']),
        title: _text(json['title'], 'Notification'),
        body: _text(json['body']),
        type: _text(json['notification_type'], 'status_update'),
        // Broadcast rows carry no per-user read state.
        unread: isPersonal && json['read_at'] == null,
        createdAt: DateTime.tryParse(_text(json['created_at'])),
      );
}

class ResidentAnnouncement {
  final String id;
  final String title;
  final String body;
  final String priority;
  final DateTime? publishedAt;
  final DateTime? expiresAt;

  const ResidentAnnouncement({
    required this.id,
    required this.title,
    required this.body,
    required this.priority,
    required this.publishedAt,
    required this.expiresAt,
  });

  factory ResidentAnnouncement.fromJson(Map<String, dynamic> json) => ResidentAnnouncement(
        id: _text(json['id']),
        title: _text(json['title'], 'Announcement'),
        body: _text(json['body']),
        priority: _text(json['priority'], 'normal'),
        publishedAt: DateTime.tryParse(_text(json['published_at'])),
        expiresAt: DateTime.tryParse(_text(json['expires_at'])),
      );

  bool get isExpired {
    final expiry = expiresAt;
    return expiry != null && expiry.isBefore(DateTime.now());
  }
}
