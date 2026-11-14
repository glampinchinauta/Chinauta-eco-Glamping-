import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firestore y Messaging se descargan solo cuando el personal activa notificaciones (el sitio público no los necesita).
export async function requestStaffNotificationPermission(userId?: string) {
  try {
    const [{ getFirestore, doc, setDoc }, { getMessaging, getToken }] = await Promise.all([
      import('firebase/firestore'),
      import('firebase/messaging'),
    ]);
    let messaging: ReturnType<typeof getMessaging> | null = null;
    try { messaging = getMessaging(app); } catch (e) { console.log("Firebase Messaging not supported in this environment", e); }
    if (!messaging) {
      alert("Firebase Messaging no está disponible en este navegador.");
      return null;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const currentToken = await getToken(messaging, {
        vapidKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgQtjxhjC8B9r52l7q34wX7UaK3zG0vB0oA'
      }).catch(() => null);

      if (currentToken) {
        console.log("FCM Token obtained:", currentToken);
        if (userId) {
          await setDoc(doc(getFirestore(app, firebaseConfig.firestoreDatabaseId), 'staff_fcm_tokens', userId), {
            token: currentToken,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
        alert("¡Notificaciones Push de FCM activadas exitosamente para el personal!");
        return currentToken;
      }
    } else {
      alert("Permiso de notificaciones denegado en el navegador.");
    }
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    alert("Error al activar notificaciones push.");
  }
  return null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider: { providerId?: string | null; email?: string | null }) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
