type FcmData = Record<string, string>;

/** Sends from the server only. The legacy key is never included in client bundles. */
export async function sendFcm(tokens: string[], title: string, body: string, data: FcmData = {}) {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey || tokens.length === 0) return { configured: Boolean(serverKey), sent: 0 };
  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { Authorization: `key=${serverKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ registration_ids: tokens, notification: { title, body }, data, priority: 'high' })
  });
  if (!response.ok) throw new Error('FCM delivery failed');
  const result = await response.json() as { success?: number };
  return { configured: true, sent: result.success || 0 };
}
