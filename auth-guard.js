// auth-guard.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase-config.js";

const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const isAuthPage = currentPage === 'login.html';

onAuthStateChanged(auth, (user) => {
  if (user && isAuthPage) {
    // Si el usuario está autenticado y en la página de login, lo redirigimos al dashboard.
    window.location.replace('index.html');
  } else if (!user && !isAuthPage) {
    // Si el usuario NO está autenticado e intenta acceder a una página protegida (como index.html), lo redirigimos al login.
    window.location.replace('login.html');
  } else {
    // Si el usuario está en la página correcta, simplemente quitamos el loader para mostrar el contenido.
    document.body.classList.remove('app-loading');
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 400);
    }
  }
});
