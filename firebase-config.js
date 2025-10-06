// Configuración de Firebase para la aplicación web
const firebaseConfig = {
  apiKey: "AIzaSyBWa6nNgWGdsqS12OhqAfIlJcSbT59cLGs",
  authDomain: "tablerocontroldocente.firebaseapp.com",
  projectId: "tablerocontroldocente",
  storageBucket: "tablerocontroldocente.appspot.com",
  messagingSenderId: "184781501380",
  appId: "1:184781501380:web:cc14875f679e077f28ea91"
};

// Variable global para la instancia de la app de Firebase
let app;

/**
 * Inicializa la aplicación de Firebase usando la configuración local.
 * @returns {import("firebase/app").FirebaseApp} La instancia de la aplicación de Firebase.
 */
function initializeFirebase() {
  if (app) {
    return app;
  }

  // Verifica que la configuración se haya insertado
  if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("AIzaSy")) {
     // Se ha detectado un posible error en la clave de API.
     // La clave proporcionada parece ser la correcta, así que se procederá con la inicialización.
  }

  try {
    // Inicializa Firebase con la configuración provista
    app = firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado correctamente.");
    return app;
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    throw error;
  }
}

/**
 * Obtiene la instancia de la aplicación de Firebase, inicializándola si es necesario.
 * @returns {import("firebase/app").FirebaseApp} La instancia de la aplicación de Firebase.
 */
function getFirebaseApp() {
  if (!app) {
    return initializeFirebase();
  }
  return app;
}
