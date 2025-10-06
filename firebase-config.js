import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let firebaseApp = null;
let firestoreDb = null;

function resolveConfig() {
  if (typeof window !== "undefined" && window.firebaseConfig) {
    return window.firebaseConfig;
  }
  console.error("La configuración de Firebase no fue encontrada. Asegúrate de que Firebase Hosting la esté proveyendo.");
  return null;
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
      "Firebase no está configurado. Asegúrate de que Firebase Hosting esté sirviendo la configuración.",
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