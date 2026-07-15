import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the named database from the config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test connection to Firestore
async function testConnection() {
  try {
    console.log("Testing Firestore connection to database:", firebaseConfig.firestoreDatabaseId);
    // Attempt to fetch a non-existent document to test connectivity from server
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log("Firestore connection test completed (document not found is normal).");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline')) {
        console.error("Firebase configuration error: The client is offline. Please check your Firebase setup and internet connection.");
      } else if (error.message.includes('permission-denied')) {
        console.log("Firestore connection test: document not found or permission denied (this is expected for fresh DB).");
      } else {
        console.error("Firestore connectivity check error:", error.message);
      }
    }
  }
}

testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function cleanFirestoreData(data: any): any {
  if (data === undefined) return null;
  if (data === null) return null;
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }
  if (typeof data === 'object') {
    if (data instanceof Date) {
      return data.toISOString();
    }
    const cleaned: any = {};
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val !== undefined) {
        cleaned[key] = cleanFirestoreData(val);
      }
    }
    return cleaned;
  }
  return data;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  let friendlyMsg = "Une erreur est survenue avec la base de données.";
  if (errMessage.includes("permission-denied") || errMessage.includes("Missing or insufficient permissions")) {
    friendlyMsg = "Accès refusé : Vous n'avez pas les autorisations nécessaires pour effectuer cette action.";
  } else if (errMessage.includes("unsupported field value: undefined")) {
    friendlyMsg = "Erreur de données : Une valeur non définie a été envoyée. Veuillez vérifier tous les champs du formulaire.";
  } else {
    friendlyMsg = `Erreur (${operationType} sur ${path}): ${errMessage}`;
  }
  
  alert(friendlyMsg);
  throw new Error(JSON.stringify(errInfo));
}
