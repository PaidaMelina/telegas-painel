import webpush from 'web-push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@telegas.com';

let initialized = false;

function init() {
  if (initialized) return;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    const keys = webpush.generateVAPIDKeys();
    console.log('\n========================================');
    console.log('VAPID keys geradas — adicione ao .env:');
    console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
    console.log('========================================\n');
    webpush.setVapidDetails(VAPID_EMAIL, keys.publicKey, keys.privateKey);
  } else {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  }
  initialized = true;
}

export function getVapidPublicKey(): string {
  init();
  return VAPID_PUBLIC || '';
}

export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; data?: Record<string, any> }
): Promise<void> {
  init();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (err: any) {
    // 410 = subscription expired/invalid
    if (err.statusCode === 410 || err.statusCode === 404) {
      throw new Error('SUBSCRIPTION_INVALID');
    }
    console.error('Push error:', err.message);
  }
}
