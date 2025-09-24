// Usamos una versión más reciente de Firebase para mejoras de rendimiento y seguridad
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWa6nNgWGdsqS12OhqAfIlJcSbT59cLGs",
  authDomain: "tablerocontroldocente.firebaseapp.com",
  projectId: "tablerocontroldocente",
  storageBucket: "tablerocontroldocente.appspot.com",
  messagingSenderId: "184781501380",
  appId: "1:184781501380:web:cc14875f679e077f28ea91",
};

// --- Constantes y Configuración ---
const ALLOWED_DOMAIN = "@potros.itson.edu.mx";
const ADMIN_EMAILS = new Set(["isaac.paniagua@potros.itson.edu.mx"]);
const CAREER_LABELS = {
  software: "Ing. en Software",
  manufactura: "Ing. en Manufactura",
  mecatronica: "Ing. en Mecatrónica",
  global: "Global",
};
const ROLE_LABELS = {
  administrador: "Admin",
  docente: "Docente",
  auxiliar: "Auxiliar",
};
const ROLE_BADGE_CLASS = {
  administrador: "badge admin",
  docente: "badge docente",
  auxiliar: "badge auxiliar",
};

// --- Inicialización de Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Referencias a Elementos del DOM ---
const loader = document.getElementById("loader");
const authSection = document.getElementById("authSection");
const dashboard = document.getElementById("dashboard");
const googleLoginButton = document.getElementById("googleLoginButton");
const loginError = document.getElementById("loginError");
const headerUserMeta = document.getElementById("headerUserMeta");
const headerUserName = document.getElementById("headerUserName");
const headerUserRole = document.getElementById("headerUserRole");
const logoutBtn = document.getElementById("logoutBtn");
const sidebarName = document.getElementById("sidebarName");
const sidebarEmail = document.getElementById("sidebarEmail");
const sidebarCareer = document.getElementById("sidebarCareer");
const navigation = document.getElementById("navigation");
const userTableContainer = document.getElementById("userTableContainer");
const inviteUserForm = document.getElementById("inviteUserForm");
const inviteAlert = document.getElementById("inviteAlert");
const adminView = document.getElementById("adminView");
const docenteView = document.getElementById("docenteView");
const auxiliarView = document.getElementById("auxiliarView");

let currentUser = null;
let currentUserData = null;
let usersChart = null;
let activitiesChart = null;
let unsubscribers = [];

// --- Funciones de Utilidad ---
const showLoader = (show) => loader.classList.toggle("hidden", !show);

const showAlert = (element, message, type = "error", duration = 4000) => {
  element.textContent = message;
  element.className = `alert ${type} show`;
  setTimeout(() => {
    element.classList.remove("show");
  }, duration);
};
const openModal = (title, content, footer = "") => {
  const backdrop = document.getElementById("modal-backdrop");
  backdrop.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button id="closeModalBtn"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">${content}</div>
      <div class="modal-footer" style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem;">${footer}</div>
    </div>
  `;
  backdrop.classList.remove("hidden");
  lucide.createIcons();
  document
    .getElementById("closeModalBtn")
    .addEventListener("click", closeModal);
};

const closeModal = () => {
  document.getElementById("modal-backdrop").classList.add("hidden");
};

const cleanupSubscriptions = () => {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
};

// --- Lógica de Renderizado ---
const renderUserTable = () => {
  const q = query(collection(db, "users"), orderBy("displayName"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      userTableContainer.innerHTML = `<div class="empty-state">No hay usuarios registrados.</div>`;
      return;
    }
    let tableHTML = `
      <table>
        <thead><tr><th>Nombre</th><th>Carrera</th><th>Rol</th><th>Acciones</th></tr></thead>
        <tbody>
    `;
    snapshot.docs.forEach((docSnap) => {
      const user = docSnap.data();
      tableHTML += `
        <tr>
          <td>${user.displayName}<br><small>${user.email}</small></td>
          <td>${CAREER_LABELS[user.career] || user.career}</td>
          <td><span class="${ROLE_BADGE_CLASS[user.role]}">${
        ROLE_LABELS[user.role]
      }</span></td>
          <td>
            <div class="action-buttons">
              <button class="edit-btn" data-id="${
                docSnap.id
              }" title="Editar usuario"><i data-lucide="edit"></i></button>
              <button class="delete-btn" data-id="${
                docSnap.id
              }" title="Eliminar usuario"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
    tableHTML += `</tbody></table>`;
    userTableContainer.innerHTML = tableHTML;
    lucide.createIcons();
  });
  unsubscribers.push(unsubscribe);
};

const renderDashboard = (user, userData) => {
  currentUser = user;
  currentUserData = userData;

  // Limpiar suscripciones anteriores
  cleanupSubscriptions();

  // Actualizar UI
  sidebarName.textContent = userData.displayName;
  sidebarEmail.textContent = userData.email;
  sidebarCareer.textContent = CAREER_LABELS[userData.career];
  headerUserName.textContent = userData.displayName;
  headerUserRole.className = ROLE_BADGE_CLASS[userData.role];
  headerUserRole.textContent = ROLE_LABELS[userData.role];

  authSection.classList.add("hidden");
  dashboard.classList.remove("hidden");
  headerUserMeta.classList.remove("hidden");

  adminView.classList.add("hidden");
  docenteView.classList.add("hidden");
  auxiliarView.classList.add("hidden");

  // Lógica específica de roles
  if (userData.role === "administrador") {
    adminView.classList.remove("hidden");
    renderUserTable();
    // Aquí irían las funciones para renderizar gráficos, etc.
  } else if (userData.role === "docente") {
    docenteView.classList.remove("hidden");
    // Aquí iría la función para renderizar actividades del docente
  } else if (userData.role === "auxiliar") {
    auxiliarView.classList.remove("hidden");
    // Aquí iría la función para renderizar actividades del auxiliar
  }

  showLoader(false);
};

// --- Lógica de Autenticación ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (!user.email.endsWith(ALLOWED_DOMAIN)) {
      showAlert(loginError, "Debes usar una cuenta @potros.itson.edu.mx.");
      await signOut(auth);
      return;
    }
    const userRef = doc(db, "users", user.uid);
    let userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const invitationsRef = collection(db, "invitations");
      const q = query(invitationsRef, where("email", "==", user.email));
      const invitationSnapshot = await getDocs(q);

      let role = "docente";
      let career = "software";
      let displayName = user.displayName;

      if (!invitationSnapshot.empty) {
        const invitation = invitationSnapshot.docs[0].data();
        role = invitation.role;
        career = invitation.career;
        displayName = invitation.name;
        await deleteDoc(doc(db, "invitations", invitationSnapshot.docs[0].id));
      } else if (!ADMIN_EMAILS.has(user.email)) {
        showAlert(
          loginError,
          "Tu cuenta no tiene una invitación. Contacta a un administrador."
        );
        await signOut(auth);
        return;
      }

      if (ADMIN_EMAILS.has(user.email)) {
        role = "administrador";
      }

      const newUser = {
        uid: user.uid,
        displayName: displayName,
        email: user.email,
        career: career,
        role: role,
        createdAt: serverTimestamp(),
      };
      await setDoc(userRef, newUser);
      userDoc = await getDoc(userRef);
    }

    const userData = userDoc.data();
    if (ADMIN_EMAILS.has(userData.email) && userData.role !== "administrador") {
      await updateDoc(userRef, { role: "administrador" });
      userData.role = "administrador";
    }

    renderDashboard(user, userData);
  } else {
    currentUser = null;
    currentUserData = null;
    dashboard.classList.add("hidden");
    authSection.classList.remove("hidden");
    headerUserMeta.classList.add("hidden");
    cleanupSubscriptions();
    showLoader(false);
  }
});

googleLoginButton.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: "potros.itson.edu.mx" });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user") {
      showAlert(loginError, "Error al iniciar sesión con Google.");
      console.error(error);
    }
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));
document
  .getElementById("printReport")
  .addEventListener("click", () => window.print());

// --- Delegación de eventos para acciones de usuario (EDITAR/ELIMINAR) ---
userTableContainer.addEventListener("click", async (e) => {
  const target = e.target.closest("button");
  if (!target) return;

  const userId = target.dataset.id;
  if (!userId) return;

  if (target.classList.contains("delete-btn")) {
    handleDeleteUser(userId);
  } else if (target.classList.contains("edit-btn")) {
    handleEditUser(userId);
  }
});

const handleDeleteUser = (userId) => {
  const content = `<p>¿Estás seguro de que quieres eliminar a este usuario? Esta acción no se puede deshacer.</p>`;
  const footer = `
        <button type="button" class="primary" id="confirmDeleteBtn" style="background: var(--danger);">Eliminar</button>
        <button type="button" id="cancelDeleteBtn" style="background: var(--muted);">Cancelar</button>
    `;
  openModal("Confirmar Eliminación", content, footer);

  document
    .getElementById("cancelDeleteBtn")
    .addEventListener("click", closeModal);
  document
    .getElementById("confirmDeleteBtn")
    .addEventListener("click", async () => {
      showLoader(true);
      try {
        await deleteDoc(doc(db, "users", userId));
        showAlert(inviteAlert, "Usuario eliminado correctamente.", "success");
      } catch (error) {
        showAlert(inviteAlert, "Error al eliminar el usuario.", "error");
        console.error("Error deleting user:", error);
      } finally {
        closeModal();
        showLoader(false);
      }
    });
};

const handleEditUser = async (userId) => {
  showLoader(true);
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    showAlert(inviteAlert, "No se encontró el usuario.", "error");
    showLoader(false);
    return;
  }
  const user = userSnap.data();

  const content = `
        <form id="editUserForm">
            <div class="form-field">
                <label for="editName">Nombre Completo</label>
                <input type="text" id="editName" value="${
                  user.displayName
                }" required>
            </div>
            <div class="form-field">
                <label for="editCareer">Carrera</label>
                <select id="editCareer" required>
                    <option value="software" ${
                      user.career === "software" ? "selected" : ""
                    }>Ing. en Software</option>
                    <option value="manufactura" ${
                      user.career === "manufactura" ? "selected" : ""
                    }>Ing. en Manufactura</option>
                    <option value="mecatronica" ${
                      user.career === "mecatronica" ? "selected" : ""
                    }>Ing. en Mecatrónica</option>
                </select>
            </div>
            <div class="form-field">
                <label for="editRole">Rol del Sistema</label>
                <select id="editRole" required>
                    <option value="docente" ${
                      user.role === "docente" ? "selected" : ""
                    }>Docente</option>
                    <option value="auxiliar" ${
                      user.role === "auxiliar" ? "selected" : ""
                    }>Profesor Auxiliar</option>
                    <option value="administrador" ${
                      user.role === "administrador" ? "selected" : ""
                    }>Administrador</option>
                </select>
            </div>
        </form>
    `;
  const footer = `<button type="submit" form="editUserForm" class="primary">Guardar Cambios</button>`;
  openModal("Editar Usuario", content, footer);

  document
    .getElementById("editUserForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const updatedData = {
        displayName: document.getElementById("editName").value,
        career: document.getElementById("editCareer").value,
        role: document.getElementById("editRole").value,
      };
      showLoader(true);
      try {
        await updateDoc(userRef, updatedData);
        showAlert(inviteAlert, "Usuario actualizado.", "success");
      } catch (error) {
        showAlert(inviteAlert, "Error al actualizar.", "error");
        console.error("Error updating user:", error);
      } finally {
        closeModal();
        showLoader(false);
      }
    });

  showLoader(false);
};

// --- Event Listener para el formulario de invitación ---
inviteUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showLoader(true);

  const name = document.getElementById("inviteName").value;
  const email = document.getElementById("inviteEmail").value.toLowerCase();
  const career = document.getElementById("inviteCareer").value;
  const role = document.getElementById("inviteRole").value;

  if (!email.endsWith(ALLOWED_DOMAIN)) {
    showAlert(
      inviteAlert,
      "El correo debe ser del dominio @potros.itson.edu.mx.",
      "error"
    );
    showLoader(false);
    return;
  }

  try {
    // Verificar si el usuario ya existe
    const usersQuery = query(
      collection(db, "users"),
      where("email", "==", email)
    );
    const userSnapshot = await getDocs(usersQuery);
    if (!userSnapshot.empty) {
      showAlert(
        inviteAlert,
        "Este usuario ya se encuentra registrado.",
        "error"
      );
      showLoader(false);
      return;
    }

    // Crear la invitación
    await addDoc(collection(db, "invitations"), {
      name,
      email,
      career,
      role,
      createdAt: serverTimestamp(),
    });
    showAlert(
      inviteAlert,
      `Invitación enviada a ${name}. El usuario podrá acceder al iniciar sesión.`,
      "success"
    );
    inviteUserForm.reset();
  } catch (error) {
    showAlert(
      inviteAlert,
      "Ocurrió un error al enviar la invitación.",
      "error"
    );
    console.error("Error creating invitation:", error);
  } finally {
    showLoader(false);
  }
});

// --- Inicialización ---
lucide.createIcons();
showLoader(true); // Mostrar loader al cargar la página
