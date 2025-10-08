// login.js
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-config.js";

const ALLOWED_DOMAIN = "potros.itson.edu.mx";
const googleSignInBtn = document.getElementById('googleSignInBtn');
const loginError = document.getElementById('loginError');

if (googleSignInBtn) {
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ hd: ALLOWED_DOMAIN });

  googleSignInBtn.addEventListener('click', async () => {
    loginError.classList.remove('show');
    googleSignInBtn.disabled = true;
    try {
      await signInWithPopup(auth, googleProvider);
      // El auth-guard.js se encargará de la redirección al detectar el cambio de estado.
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user") {
        loginError.textContent = "No fue posible iniciar sesión. Revisa los permisos o intenta nuevamente.";
        loginError.classList.add('show');
        console.error("Error de inicio de sesión:", error);
      }
    } finally {
      googleSignInBtn.disabled = false;
    }
  });
}

// Para renderizar los íconos de Lucide en esta página
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
});
