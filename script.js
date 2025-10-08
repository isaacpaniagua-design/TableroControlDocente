// Importa la librería para convertir Markdown
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

// Importa las funciones de Firebase
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

// --- CONSTANTES Y CONFIGURACIÓN ---
const ALLOWED_DOMAIN = "potros.itson.edu.mx";
const PRIMARY_ADMIN_EMAIL = "isaac.paniagua@potros.itson.edu.mx";
const PRIMARY_ADMIN_EMAIL_NORMALIZED = PRIMARY_ADMIN_EMAIL.toLowerCase();

const CAREER_LABELS = {
  software: "Ing. en Software",
  manufactura: "Ing. en Manufactura",
  mecatronica: "Ing. en Mecatrónica",
  global: "General (todas las carreras)",
};

const ROLE_LABELS = {
  administrador: "Administrador",
  docente: "Docente",
  auxiliar: "Auxiliar",
};

const ROLE_BADGE_CLASS = {
  administrador: "badge admin",
  docente: "badge docente",
  auxiliar: "badge auxiliar",
};
// Justo después de la constante ROLE_BADGE_CLASS

const QUICK_ACCESS_LINKS = {
  administrador: [
    { label: 'Reporte por carrera', targetId: 'generalReportCard', icon: 'pie-chart' },
    { label: 'Gestión de usuarios', targetId: 'userManagementCard', icon: 'users' },
    { label: 'Gestión de actividades', targetId: 'activityManagementCard', icon: 'clipboard-list' }
  ]
};
// --- EL ARRAY CHANGELOG_DATA HA SIDO ELIMINADO ---

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let users = [];
let currentUser = null;
let unsubscribeUsersListener = null;
const userFilters = { search: "", role: "all", career: "all", auth: "all" };

const elements = {};
const charts = { users: null, activities: null };

let googleProvider = null;

let isInitialAuthCheckDone = false; // <--- AÑADE ESTA LÍNEA AQUÍ
// --- CICLO DE VIDA DE LA APLICACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  cacheDomElements();
  updateLayoutMode();
  attachEventListeners();
  initCharts();
  initializeAuthentication();
  renderChangelog(); // Ahora llamará a la nueva función
  window.addEventListener("resize", syncHeaderHeight);
});

// --- INICIALIZACIÓN Y MANEJO DEL DOM ---
function cacheDomElements() {
  const ids = [
    "authSection", "dashboard", "dashboardShell", "googleSignInBtn", "loginError", "logoutBtn",
    "headerUserMeta", "headerUserName", "headerUserRole", "sidebarName", "sidebarEmail",
    "sidebarCareer", "quickAccess", "quickAccessList", "navigation", "adminView",
    "docenteView", "auxiliarView", "userTableContainer", "startAddUserBtn", "userForm",
    "userFormTitle", "userFormDescription", "userFormSubmit", "cancelUserFormBtn",
    "userFormAlert", "userName", "userControlNumber", "userPotroEmail",
    "userInstitutionalEmail", "userAltEmail", "userPhone", "userRole", "userCareer",
    "userAllowExternalAuth", "userSummaryGrid", "userSearchInput", "userRoleFilter",
    "userCareerFilter", "userAuthFilter", "clearUserFiltersBtn", "userTableMeta",
    "userSyncStatus", "adminActivityList", "adminActivityForm", "adminActivityAlert",
    "importTeachersBtn", "importTeachersAlert", "inviteAlert", "teacherPendingActivities",
    "teacherProgressSummary", "auxiliarActivityList", "auxiliarActivityAlert", "printReport",
    "refreshDashboard", "sidebarCollapseBtn", "sidebarExpandBtn",
    "changelogModal", "openChangelogBtn", "closeChangelogBtn", "changelogBody", "modal-backdrop",
    "importModal", "closeImportModalBtn", "importModalBody", "importInstructions",
"importFileInput", "importProgress", "importStatus", "importProgressBar", "importResults",
"importResultsBody"
  ];
  ids.forEach(id => { elements[id] = document.getElementById(id); });
}

function attachEventListeners() {
    elements.googleSignInBtn?.addEventListener("click", handleGoogleSignIn);
    elements.logoutBtn?.addEventListener("click", handleLogout);
    elements.printReport?.addEventListener("click", () => window.print());
    elements.refreshDashboard?.addEventListener("click", renderAllSections);
    elements.startAddUserBtn?.addEventListener("click", () => openUserForm("create"));
    elements.cancelUserFormBtn?.addEventListener("click", () => hideUserForm({ reset: true }));
    elements.userForm?.addEventListener("submit", handleUserFormSubmit);
    elements.userTableContainer?.addEventListener("click", handleUserTableClick);
    elements.userSearchInput?.addEventListener("input", (e) => { userFilters.search = e.target.value.trim(); renderUserTable(); });
    elements.userRoleFilter?.addEventListener("change", (e) => { userFilters.role = e.target.value; renderUserTable(); });
    elements.userCareerFilter?.addEventListener("change", (e) => { userFilters.career = e.target.value; renderUserTable(); });
    elements.userAuthFilter?.addEventListener("change", (e) => { userFilters.auth = e.target.value; renderUserTable(); });
    elements.clearUserFiltersBtn?.addEventListener("click", resetUserFilters);
    elements.sidebarCollapseBtn?.addEventListener("click", () => setSidebarCollapsed(true));
    elements.sidebarExpandBtn?.addEventListener("click", () => setSidebarCollapsed(false));
    
    elements.openChangelogBtn?.addEventListener("click", () => toggleChangelogModal(true));
    elements.closeChangelogBtn?.addEventListener("click", () => toggleChangelogModal(false));
    elements.changelogModal?.addEventListener('click', (event) => {
        if (event.target === elements.changelogModal) {
            toggleChangelogModal(false);
        }
       });
  elements.importModal?.addEventListener('click', (event) => {
    if (event.target === elements.importModal) {
        toggleImportModal(false);
    }
});
  elements.quickAccessList?.addEventListener('click', handleQuickAccessClick);
  elements.importTeachersBtn?.addEventListener('click', () => toggleImportModal(true));
elements.closeImportModalBtn?.addEventListener('click', () => toggleImportModal(false));
elements.importFileInput?.addEventListener('change', handleFileSelect);


  
}

// --- LÓGICA DE AUTENTICACIÓN ---
// (Esta sección no cambia)
function initializeAuthentication() {
  try {
    if (!auth) throw new Error("Firebase Auth no se pudo inicializar.");
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ hd: ALLOWED_DOMAIN });
    onAuthStateChanged(auth, handleAuthStateChange);
    if (elements.googleSignInBtn) elements.googleSignInBtn.disabled = false;
  } catch (error) {
    console.error(error);
    showMessage(elements.loginError, "No se pudo conectar al servicio de autenticación.", "error", null);
    if (elements.googleSignInBtn) elements.googleSignInBtn.disabled = true;
  }
}

async function handleGoogleSignIn() {
  if (!auth || !googleProvider) return;
  hideMessage(elements.loginError);
  elements.googleSignInBtn.disabled = true;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
      showMessage(elements.loginError, "No fue posible iniciar sesión. Intenta nuevamente.", "error");
      console.error("Error de inicio de sesión:", error);
    }
  } finally {
    elements.googleSignInBtn.disabled = false;
  }
}

function handleLogout() {
  if (unsubscribeUsersListener) {
    unsubscribeUsersListener();
    unsubscribeUsersListener = null;
  }
  signOut(auth).catch(error => console.error("Error al cerrar sesión:", error));
}

async function handleAuthStateChange(firebaseUser) {
  if (firebaseUser) {
    const userEmail = firebaseUser.email.toLowerCase();
    const userDocRef = doc(db, "users", userEmail);

    try {
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userRecord = { ...userDoc.data(), id: userDoc.id };
        const isAllowedDomain = userEmail.endsWith(`@${ALLOWED_DOMAIN}`);
        if (!isAllowedDomain && !userRecord.allowExternalAuth) {
            showMessage(elements.loginError, `Debes usar una cuenta @${ALLOWED_DOMAIN} o solicitar acceso externo.`, "error", null);
            return handleLogout();
        }
        currentUser = { ...userRecord, name: userRecord.name || firebaseUser.displayName, firebaseUid: firebaseUser.uid };
        loginUser(currentUser);
      } else {
        showMessage(elements.loginError, "Tu cuenta no tiene permisos para acceder.", "error", null);
        handleLogout();
      }
    } catch (error) {
      console.error("Error al verificar el perfil de usuario:", error);
      showMessage(elements.loginError, "No se pudo verificar tu perfil. Intenta de nuevo.", "error", null);
      handleLogout();
    }
  } else {
    applyLoggedOutState();
  }

  // 🔥 LÓGICA DE CARGA: Se ejecuta solo la primera vez para una transición suave
  if (!isInitialAuthCheckDone) {
    isInitialAuthCheckDone = true;

    // 1. Quita la clase del body para hacer visible el contenido correcto
    document.body.classList.remove('app-loading');

    // 2. Elimina el loader con un efecto de desvanecimiento
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 400); // 400ms = duración de la transición en CSS
    }
  }
}

// (El resto del archivo, desde GESTIÓN DE USUARIOS hasta el final, no cambia...)
// --- GESTIÓN DE USUARIOS Y RENDERIZADO ---
function openUserForm(mode, user = null) {
  hideMessage(elements.userFormAlert);
  elements.userForm.hidden = false;
  elements.userForm.reset();
  const isEdit = mode === 'edit' && user;
  elements.userForm.dataset.editingId = isEdit ? user.id : "";
  elements.userFormTitle.textContent = isEdit ? "Editar usuario" : "Agregar usuario";
  elements.userFormSubmit.textContent = isEdit ? "Guardar cambios" : "Crear usuario";
  if (isEdit) {
    elements.userName.value = user.name || "";
    elements.userControlNumber.value = user.controlNumber || "";
    elements.userPotroEmail.value = user.potroEmail || "";
    elements.userInstitutionalEmail.value = user.institutionalEmail || "";
    elements.userAltEmail.value = user.email || "";
    elements.userPhone.value = user.phone || "";
    elements.userRole.value = user.role || "docente";
    elements.userCareer.value = user.career || "software";
    elements.userAllowExternalAuth.checked = user.allowExternalAuth || false;
  }
}
function hideUserForm({ reset = false } = {}) {
  elements.userForm.hidden = true;
  if (reset) {
    elements.userForm.reset();
    delete elements.userForm.dataset.editingId;
  }
}
async function handleUserFormSubmit(event) {
  event.preventDefault();
  if (!isPrimaryAdmin(currentUser)) return;
  const form = event.target;
  const formData = new FormData(form);
  const editingUserId = form.dataset.editingId || null;
  const userData = {
    name: String(formData.get("name") || "").trim(),
    controlNumber: String(formData.get("controlNumber") || "").trim(),
    potroEmail: String(formData.get("potroEmail") || "").trim().toLowerCase(),
    institutionalEmail: String(formData.get("institutionalEmail") || "").trim().toLowerCase(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    phone: String(formData.get("phone") || "").trim(),
    role: String(formData.get("role") || "docente"),
    career: String(formData.get("career") || "software"),
    allowExternalAuth: formData.get("allowExternalAuth") === "on",
  };
  if (!userData.name) return showMessage(elements.userFormAlert, "El nombre completo es obligatorio.");
  if (!editingUserId && !userData.potroEmail) {
    return showMessage(elements.userFormAlert, "El Correo Potro es obligatorio para registrar un nuevo usuario.");
  }
  const isDuplicate = users.some(user => {
    if (user.id === editingUserId) return false;
    const hasSamePotro = userData.potroEmail && user.id === userData.potroEmail;
    return hasSamePotro;
  });
  if (isDuplicate) return showMessage(elements.userFormAlert, "Ya existe un usuario con ese Correo Potro.");
  const recordToPersist = { ...userData, id: editingUserId, updatedBy: currentUser.email };
  const result = await persistUserChange(recordToPersist);
  if (result.success) {
    hideUserForm({ reset: true });
    showMessage(elements.userFormAlert, editingUserId ? "Usuario actualizado." : "Usuario agregado.", "success");
  } else {
    showMessage(elements.userFormAlert, result.message, "error");
  }
}
async function persistUserChange(record) {
  if (!db) return { success: false, message: "Base de datos no disponible." };
  try {
    const isEdit = !!record.id;
    const docId = isEdit ? record.id : record.potroEmail;
    if (!docId) {
       return { success: false, message: "Error: El Correo Potro es necesario como identificador." };
    }
    const docRef = doc(db, "users", docId);
    const payload = {
      name: record.name,
      controlNumber: record.controlNumber || null,
      potroEmail: record.potroEmail || null,
      institutionalEmail: record.institutionalEmail || null,
      email: record.email || null,
      phone: record.phone || null,
      role: record.role,
      career: record.career,
      allowExternalAuth: record.allowExternalAuth,
      updatedBy: record.updatedBy || null,
      updatedAt: serverTimestamp(),
    };
    if (!isEdit) {
      payload.createdBy = record.updatedBy || null;
      payload.createdAt = serverTimestamp();
    }
    await setDoc(docRef, payload, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("Error al sincronizar con Firestore:", error);
    return { 
      success: false, 
      message: isPermissionDeniedError(error) ? "Error de permisos. Revisa tus reglas de seguridad." : "No se pudo conectar con la base de datos."
    };
  }
}
function handleUserTableClick(event) {
  if (!isPrimaryAdmin(currentUser)) return;
  const button = event.target.closest("button[data-action][data-user-id]");
  if (!button) return;
  const userId = button.dataset.userId;
  const user = users.find(u => u.id === userId);
  if (!user) return;
  if (button.dataset.action === "edit") openUserForm("edit", user);
  else if (button.dataset.action === "delete") requestUserDeletion(user);
}
// Puedes añadir este bloque después de la función handleUserTableClick

function renderQuickAccessMenu(role) {
  if (!elements.quickAccess || !elements.quickAccessList) return;

  const links = QUICK_ACCESS_LINKS[role];

  if (links && links.length > 0) {
    elements.quickAccess.hidden = false;
    elements.quickAccessList.innerHTML = links.map(link => `
      <li>
        <button class="quick-access__button" data-target-id="${link.targetId}">
          <span class="quick-access__icon"><i data-lucide="${link.icon}"></i></span>
          <div class="quick-access__content">
            <strong>${link.label}</strong>
          </div>
        </button>
      </li>
    `).join('');
    refreshIcons(); // Esencial para que los nuevos íconos se rendericen
  } else {
    elements.quickAccess.hidden = true;
    elements.quickAccessList.innerHTML = '';
  }
}

function handleQuickAccessClick(event) {
  const button = event.target.closest('.quick-access__button');
  if (!button) return;

  const targetId = button.dataset.targetId;
  const targetElement = document.getElementById(targetId);

  if (targetElement) {
    // Aseguramos que el <details> esté abierto antes de navegar
    if (targetElement.tagName === 'DETAILS' && !targetElement.open) {
      targetElement.open = true;
    }
    
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Resaltamos la sección brevemente para dar feedback visual
    targetElement.classList.add('is-targeted');
    setTimeout(() => {
      targetElement.classList.remove('is-targeted');
    }, 1500);
  }
}
async function requestUserDeletion(user) {
    if ((user.potroEmail || "").toLowerCase() === PRIMARY_ADMIN_EMAIL_NORMALIZED) {
        return showMessage(elements.userFormAlert, "No puedes eliminar al administrador principal.", "error");
    }
    if (user.id === currentUser.id) {
        return showMessage(elements.userFormAlert, "No puedes eliminar tu propia cuenta.", "error");
    }
    if (confirm(`¿Estás seguro de que quieres eliminar a ${user.name}?`)) {
        try {
            await deleteDoc(doc(db, "users", user.id));
            showMessage(elements.userFormAlert, "Usuario eliminado.", "success");
        } catch (error) {
            showMessage(elements.userFormAlert, "No se pudo eliminar el usuario.", "error");
            console.error("Error al eliminar:", error);
        }
    }
}
function subscribeToFirestoreUsers() {
  if (!db || unsubscribeUsersListener) return;
  renderUserSyncStatus({ loading: true });
  const q = query(collection(db, "users"), orderBy("name"));
  unsubscribeUsersListener = onSnapshot(q, 
    (snapshot) => {
      users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      renderUserSyncStatus({ lastUpdate: new Date() });
      renderAllSections();
    },
    (error) => {
      console.error("Error al suscribirse a los usuarios:", error);
      renderUserSyncStatus({ error: "No se pudieron cargar los usuarios." });
      renderAllSections();
    }
  );
}
function renderAllSections() {
    updateLayoutMode();
    syncHeaderHeight();
    if (currentUser) {
        renderSidebarUserCard(currentUser);
        configureRoleViews(currentUser.role);
        if (currentUser.role === 'administrador') {
            updateUserManagementControls();
            renderUserSummary();
            renderUserTable();
        }
    } else {
        configureRoleViews(null);
    }
    updateCharts();
    refreshIcons();
}
function updateLayoutMode() {
  const dashboardVisible = !!currentUser;
  document.body.classList.toggle("dashboard-active", dashboardVisible);
  document.body.classList.toggle("auth-active", !dashboardVisible);
  elements.authSection?.classList.toggle("hidden", dashboardVisible);
  elements.dashboard?.classList.toggle("hidden", !dashboardVisible);
}
function loginUser(user) {
  elements.headerUserMeta?.classList.remove("hidden");
  
  if(elements.headerUserName) elements.headerUserName.textContent = user.name;
  if(elements.headerUserRole) {
    elements.headerUserRole.textContent = ROLE_LABELS[user.role] || 'Usuario';
    elements.headerUserRole.className = ROLE_BADGE_CLASS[user.role] || "badge";
  }
  if (user.role === 'administrador') {
    subscribeToFirestoreUsers();
  } else {
    renderAllSections();
  }
  // Dentro de loginUser(user)
renderQuickAccessMenu(user.role);
}
function applyLoggedOutState() {
  currentUser = null;
  users = [];
  elements.headerUserMeta?.classList.add("hidden");
  updateLayoutMode();
  renderAllSections();
  // Dentro de applyLoggedOutState()
renderQuickAccessMenu(null);
}
function renderUserTable() {
    if (!elements.userTableContainer) return;
    const filteredUsers = getFilteredUsers();
    renderUserTableMeta(filteredUsers);
    if (users.length === 0) {
        elements.userTableContainer.innerHTML = `<div class="empty-state">No hay usuarios para mostrar.</div>`;
        return;
    }
    if (filteredUsers.length === 0) {
        elements.userTableContainer.innerHTML = `<div class="empty-state">No se encontraron usuarios con los filtros aplicados.</div>`;
        return;
    }
    const allowManagement = isPrimaryAdmin(currentUser);
    const headerActions = allowManagement ? `<th class="actions-col">Acciones</th>` : "";
    const rows = filteredUsers.map(user => {
        const actionsCell = allowManagement ? `
            <td class="actions-cell">
                <div class="table-actions">
                    <button type="button" class="icon-button" data-action="edit" data-user-id="${user.id}" aria-label="Editar usuario">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button type="button" class="icon-button danger" data-action="delete" data-user-id="${user.id}" aria-label="Eliminar usuario">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>` : "";
        return `
            <tr>
                <td>${escapeHtml(user.name)}<br><small>${escapeHtml(user.potroEmail || user.email || 'Sin correo')}</small></td>
                <td>${escapeHtml(user.controlNumber || 'N/A')}</td>
                <td>${escapeHtml(CAREER_LABELS[user.career] || 'N/A')}</td>
                <td><span class="${ROLE_BADGE_CLASS[user.role]}">${ROLE_LABELS[user.role]}</span></td>
                <td><span class="badge ${user.allowExternalAuth ? 'external' : 'external off'}">${user.allowExternalAuth ? 'Permitido' : 'Restringido'}</span></td>
                ${actionsCell}
            </tr>`;
    }).join("");
    elements.userTableContainer.innerHTML = `
        <table class="user-table">
            <thead> <tr> <th>Nombre</th> <th>N° Control</th> <th>Carrera</th> <th>Rol</th> <th>Acceso</th> ${headerActions} </tr> </thead>
            <tbody>${rows}</tbody>
        </table>`;
    refreshIcons();
}
function renderUserTableMeta(filteredUsers) {
    if (!elements.userTableMeta) return;
    if (users.length > 0) {
        elements.userTableMeta.textContent = `Mostrando ${filteredUsers.length} de ${users.length} usuarios.`;
    } else {
        elements.userTableMeta.textContent = '';
    }
}
function getFilteredUsers() {
    return users.filter(user => {
        const search = userFilters.search.toLowerCase();
        const matchesSearch = !search || (user.name || "").toLowerCase().includes(search) || (user.potroEmail || "").toLowerCase().includes(search) || (user.controlNumber || "").toLowerCase().includes(search);
        const matchesRole = userFilters.role === 'all' || user.role === userFilters.role;
        const matchesCareer = userFilters.career === 'all' || user.career === userFilters.career;
        const matchesAuth = userFilters.auth === 'all' || (userFilters.auth === 'allowed' && user.allowExternalAuth) || (userFilters.auth === 'restricted' && !user.allowExternalAuth);
        return matchesSearch && matchesRole && matchesCareer && matchesAuth;
    });
}
function resetUserFilters() {
    userFilters.search = "";
    userFilters.role = "all";
    userFilters.career = "all";
    userFilters.auth = "all";
    if (elements.userSearchInput) elements.userSearchInput.value = "";
    if (elements.userRoleFilter) elements.userRoleFilter.value = "all";
    if (elements.userCareerFilter) elements.userCareerFilter.value = "all";
    if (elements.userAuthFilter) elements.userAuthFilter.value = "all";
    renderUserTable();
}
function updateUserManagementControls() {
    if (elements.startAddUserBtn) {
        elements.startAddUserBtn.hidden = !isPrimaryAdmin(currentUser);
    }
}
function isPrimaryAdmin(user) {
  return user && (user.potroEmail || "").toLowerCase() === PRIMARY_ADMIN_EMAIL_NORMALIZED;
}
function isPermissionDeniedError(error) {
  return error && error.code === 'permission-denied';
}
function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, match => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'})[match]);
}
function hideLoader() {
  const loader = document.getElementById("loader");
  if(loader) loader.remove();
}
function showMessage(element, message, type = "error", duration = 5000) {
  if (!element) return;
  element.textContent = message;
  element.className = `alert ${type} show`;
  if (duration) setTimeout(() => element.classList.remove("show"), duration);
}
function hideMessage(element) {
  if (element) element.classList.remove("show");
}
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}
function syncHeaderHeight() {
    const header = document.querySelector(".app-header");
    document.documentElement.style.setProperty("--header-height", `${header?.offsetHeight || 0}px`);
}
function setSidebarCollapsed(value) {
  if (!elements.dashboardShell) return;
  elements.dashboardShell.classList.toggle("sidebar-collapsed", value);
  elements.sidebarCollapseBtn?.setAttribute("aria-expanded", String(!value));
  if (elements.sidebarExpandBtn) elements.sidebarExpandBtn.hidden = !value;
}
function configureRoleViews(role) {
    elements.adminView?.classList.toggle("hidden", role !== 'administrador');
    elements.docenteView?.classList.toggle("hidden", role !== 'docente');
    elements.auxiliarView?.classList.toggle("hidden", role !== 'auxiliar');
}
function renderSidebarUserCard(user) {
    if (elements.sidebarName) elements.sidebarName.textContent = user.name;
    if (elements.sidebarEmail) elements.sidebarEmail.textContent = user.potroEmail || user.email;
    if (elements.sidebarCareer) elements.sidebarCareer.textContent = CAREER_LABELS[user.career] || "";
}
function renderUserSummary() {
    if (!elements.userSummaryGrid) return;
    const total = users.length;
    const admins = users.filter(u => u.role === 'administrador').length;
    const docentes = users.filter(u => u.role === 'docente').length;
    elements.userSummaryGrid.innerHTML = `
        <article class="user-summary-card"><span class="user-summary-icon"><i data-lucide="users"></i></span><div><span class="user-summary-label">Total</span><span class="user-summary-value">${total}</span></div></article>
        <article class="user-summary-card"><span class="user-summary-icon"><i data-lucide="shield"></i></span><div><span class="user-summary-label">Admins</span><span class="user-summary-value">${admins}</span></div></article>
        <article class="user-summary-card"><span class="user-summary-icon"><i data-lucide="book-open"></i></span><div><span class="user-summary-label">Docentes</span><span class="user-summary-value">${docentes}</span></div></article>`;
    refreshIcons();
}
function renderUserSyncStatus({ loading, error, lastUpdate }) {
    if (!elements.userSyncStatus) return;
    let cn = "user-sync-status", text = "";
    if (loading) { cn += " loading"; text = "Sincronizando..."; }
    else if (error) { cn += " error"; text = error; }
    else if (lastUpdate) { cn += " success"; text = `Sincronizado. Última actualización: ${new Date(lastUpdate).toLocaleTimeString()}`; }
    elements.userSyncStatus.className = cn;
    elements.userSyncStatus.textContent = text;
}
function initCharts() {
    const chartOptions = { responsive: true, maintainAspectRatio: false };
    if (document.getElementById("usersChart")) {
        const canvas = document.getElementById("usersChart");
        canvas.parentElement.style.height = '320px';
        charts.users = new Chart(canvas, { type: "bar", data: { labels: [], datasets: [{ label: 'Usuarios', data: [], backgroundColor: 'rgba(37, 99, 235, 0.85)' }] }, options: chartOptions });
    }
    if (document.getElementById("activitiesChart")) {
        const canvas = document.getElementById("activitiesChart");
        canvas.parentElement.style.height = '320px';
        charts.activities = new Chart(canvas, { type: "doughnut", data: { labels: [], datasets: [{ data: [] }] }, options: chartOptions });
    }
}
function updateCharts() {
  if (charts.users && users.length > 0) {
    const careerCounts = users.reduce((acc, user) => { acc[user.career] = (acc[user.career] || 0) + 1; return acc; }, {});
    charts.users.data.labels = Object.keys(careerCounts).map(key => CAREER_LABELS[key] || key);
    charts.users.data.datasets[0].data = Object.values(careerCounts);
    charts.users.update();
  }
}

// --- NUEVA FUNCIÓN ÚNICA PARA RENDERIZAR EL CHANGELOG ---
async function renderChangelog() {
  if (!elements.changelogBody) return;

  try {
    // 🔥 CAMBIO CLAVE: Se añade un parámetro único para evitar el caché del navegador
    const cacheBuster = `?v=${new Date().getTime()}`;
    const response = await fetch(`CHANGELOG.md${cacheBuster}`);
    if (!response.ok) {
        throw new Error('No se pudo cargar el archivo de actualizaciones.');
    }
    const markdownText = await response.text();
    
    // Convierte el texto Markdown a HTML usando 'marked' y lo muestra
    elements.changelogBody.innerHTML = marked(markdownText);

  } catch (error) {
    console.error("Error al cargar CHANGELOG.md:", error);
    elements.changelogBody.innerHTML = `<p class="alert error show">No se pudieron cargar las actualizaciones en este momento.</p>`;
  }
}

function toggleChangelogModal(show) {
  const modal = document.getElementById('changelogModal');
  if (!modal) {
    console.error("CRÍTICO: El elemento del modal no existe en el HTML.");
    return;
  }
  modal.classList.toggle("hidden", !show);
}

// --- LÓGICA DE IMPORTACIÓN DE EXCEL ---

function toggleImportModal(show) {
  if (!elements.importModal) return;
  elements.importModal.classList.toggle('hidden', !show);
  if (show) {
    // Resetea el modal a su estado inicial cada vez que se abre
    elements.importInstructions?.classList.remove('hidden');
    elements.importProgress?.classList.add('hidden');
    elements.importResults?.classList.add('hidden');
    elements.importFileInput.value = ''; // Limpia la selección de archivo anterior
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  elements.importInstructions.classList.add('hidden');
  elements.importProgress.classList.remove('hidden');
  elements.importResults.classList.add('hidden');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet);

    await processImportedData(json);
  };
  reader.onerror = (error) => {
    showMessage(elements.importTeachersAlert, "Error al leer el archivo.", "error");
    console.error("File reading error:", error);
    toggleImportModal(false);
  };
  reader.readAsArrayBuffer(file);
}

async function processImportedData(usersToImport) {
    const total = usersToImport.length;
    const successes = [];
    const failures = [];

    if (total === 0) {
        displayImportResults([], [{ user: { name: "Archivo Vacío" }, reason: "El archivo no contiene filas de datos." }]);
        return;
    }

    const validRoles = ['administrador', 'docente', 'auxiliar'];
    const validCareers = ['software', 'manufactura', 'mecatronica', 'global'];
    const potroEmailRegex = /.+@potros\.itson\.edu\.mx$/;

    for (let i = 0; i < total; i++) {
        const user = usersToImport[i];
        const progressPercent = ((i + 1) / total) * 100;
        
        elements.importStatus.textContent = `Procesando ${i + 1} de ${total}...`;
        elements.importProgressBar.style.width = `${progressPercent}%`;

        // --- VALIDACIÓN MEJORADA ---
        const lowerCaseRole = (user.role || 'docente').toString().trim().toLowerCase();
        const lowerCaseCareer = (user.career || 'software').toString().trim().toLowerCase();
        const lowerCasePotroEmail = (user.potroEmail || '').toString().trim().toLowerCase();

        if (!user.name || !lowerCasePotroEmail) {
            failures.push({ user, reason: "Faltan 'name' o 'potroEmail' obligatorios." });
            continue;
        }
        if (!potroEmailRegex.test(lowerCasePotroEmail)) {
            failures.push({ user, reason: `El correo '${user.potroEmail}' no es un correo @potros válido.` });
            continue;
        }
        if (!validRoles.includes(lowerCaseRole)) {
            failures.push({ user, reason: `El rol '${user.role}' no es válido. Usar: docente, auxiliar o administrador.` });
            continue;
        }
        if (!validCareers.includes(lowerCaseCareer)) {
            failures.push({ user, reason: `La carrera '${user.career}' no es válida.` });
            continue;
        }
        // --- FIN DE LA VALIDACIÓN ---

        const formattedUser = {
            name: String(user.name).trim(),
            potroEmail: lowerCasePotroEmail,
            role: lowerCaseRole,
            career: lowerCaseCareer,
            controlNumber: user.controlNumber ? String(user.controlNumber) : null,
            institutionalEmail: user.institutionalEmail ? String(user.institutionalEmail).trim().toLowerCase() : null,
            email: user.email ? String(user.email).trim().toLowerCase() : null,
            phone: user.phone ? String(user.phone) : null,
            allowExternalAuth: false,
            updatedBy: currentUser.email
        };

        const result = await persistImportedUser(formattedUser);
        if (result.success) {
            successes.push(formattedUser);
        } else {
            failures.push({ user: formattedUser, reason: result.message });
        }
        
        await new Promise(res => setTimeout(res, 50));
    }

    displayImportResults(successes, failures);
}

function displayImportResults(successes, failures) {
  elements.importProgress.classList.add('hidden');
  elements.importResults.classList.remove('hidden');

  let html = `<p>${successes.length} usuarios importados correctamente. ${failures.length} errores.</p>`;

  if (failures.length > 0) {
    html += `<h4>Errores:</h4>
    <table class="import-results-table">
      <thead><tr><th>Nombre</th><th>Correo</th><th>Razón del Error</th></tr></thead>
      <tbody>
        ${failures.map(f => `
          <tr>
            <td>${escapeHtml(f.user.name || 'N/A')}</td>
            <td>${escapeHtml(f.user.potroEmail || 'N/A')}</td>
            <td class="error-reason">${escapeHtml(f.reason)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  }

  elements.importResultsBody.innerHTML = html;
}
// --- FUNCIÓN DEDICADA PARA LA IMPORTACIÓN DE USUARIOS ---

async function persistImportedUser(record) {
    if (!db) return { success: false, message: "Base de datos no disponible." };
    
    try {
        const docId = record.potroEmail; // En la importación, el ID siempre es el correo.
        if (!docId) {
           return { success: false, message: "El Correo Potro es un campo obligatorio." };
        }
        const docRef = doc(db, "users", docId);
        const existingDoc = await getDoc(docRef);

        // Prepara los datos que son comunes tanto para crear como para actualizar.
        const payload = {
            name: record.name,
            controlNumber: record.controlNumber || null,
            potroEmail: record.potroEmail || null,
            institutionalEmail: record.institutionalEmail || null,
            email: record.email || null,
            phone: record.phone || null,
            role: record.role,
            career: record.career,
            allowExternalAuth: record.allowExternalAuth,
            updatedBy: record.updatedBy || null,
            updatedAt: serverTimestamp(),
        };

        // Si el documento NO existe, es un usuario nuevo. Añadimos los campos de creación.
        if (!existingDoc.exists()) {
            payload.createdBy = record.updatedBy || null;
            payload.createdAt = serverTimestamp();
        }

        // Usamos set con merge:true. Esto creará el documento si no existe,
        // o lo actualizará si ya existe, sin intentar sobreescribir 'createdAt'.
        await setDoc(docRef, payload, { merge: true });
        return { success: true };

    } catch (error) {
        console.error("Error al sincronizar usuario importado:", error);
        return { 
          success: false, 
          message: isPermissionDeniedError(error) ? "Error de permisos. Revisa tus reglas." : "No se pudo conectar con la base de datos."
        };
    }
}
