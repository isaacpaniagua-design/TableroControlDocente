import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FALLBACK_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

let firestoreDb = null;

function resolveConfig() {
  if (typeof window !== "undefined" && window.firebaseConfig) {
    return window.firebaseConfig;
  }
  return FALLBACK_CONFIG;
}

export function getFirebaseConfig() {
  return resolveConfig();
}

export function getFirestoreDb() {
  if (firestoreDb) {
    return firestoreDb;
  }

  const config = resolveConfig();
  if (!config || !config.projectId) {
    console.warn(
      "Firebase no está configurado. Define window.firebaseConfig con las credenciales de tu proyecto.",
    );
    return null;
  }

  try {
    const app = getApps().length ? getApp() : initializeApp(config);
    firestoreDb = getFirestore(app);
  } catch (error) {
    console.error("No fue posible inicializar Firebase:", error);
    return null;
  }

  return firestoreDb;
}

export function isFirestoreConfigured() {
  const config = resolveConfig();
  return Boolean(config && config.projectId);
}
