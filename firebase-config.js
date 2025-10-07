// Importa las funciones necesarias de los SDK de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// La configuración de Firebase de tu aplicación web
const firebaseConfig = {
  apiKey: "AIzaSyBWa6nNgWGdsqS12OhqAfIlJcSbT59cLGs",
  authDomain: "tablerocontroldocente.firebaseapp.com",
  projectId: "tablerocontroldocente",
  storageBucket: "tablerocontroldocente.appspot.com",
  messagingSenderId: "184781501380",
  appId: "1:184781501380:web:cc14875f679e077f28ea91"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Obtiene una referencia al servicio de base de datos y al servicio de autenticación
const db = getFirestore(app);
const auth = getAuth(app);

// Exporta las instancias para usarlas en otras partes de la aplicación
export { db, auth };
