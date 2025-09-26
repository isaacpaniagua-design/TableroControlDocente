import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FALLBACK_CONFIG = {
  apiKey: "AIzaSyBWa6nNgWGdsqS12OhqAfIlJcSbT59cLGs",
  authDomain: "tablerocontroldocente.firebaseapp.com",
  projectId: "tablerocontroldocente",
  storageBucket: "tablerocontroldocente.firebasestorage.app",
  messagingSenderId: "184781501380",
  appId: "1:184781501380:web:cc14875f679e077f28ea91",
};

let firebaseApp = null;
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

export function getFirebaseApp() {
  if (firebaseApp) {
    return firebaseApp;
  }

  const config = resolveConfig();
  if (!config || !config.projectId) {
    console.warn(
      "Firebase no está configurado. Define window.firebaseConfig con las credenciales de tu proyecto.",
    );
    return null;
  }

  try {
    firebaseApp = getApps().length ? getApp() : initializeApp(config);
  } catch (error) {
    console.error("No fue posible inicializar Firebase:", error);
    firebaseApp = null;
  }

  return firebaseApp;
}

export function getFirestoreDb() {
  if (firestoreDb) {
    return firestoreDb;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    firestoreDb = getFirestore(app);
  } catch (error) {
    console.error("No fue posible obtener una instancia de Firestore:", error);
    firestoreDb = null;
    return null;
  }

  return firestoreDb;
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    return getAuth(app);
  } catch (error) {
    console.error("No fue posible obtener una instancia de Firebase Auth:", error);
    return null;
  }
}

export function isFirestoreConfigured() {
  const config = resolveConfig();
  return Boolean(config && config.projectId);
}
