import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
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

const STATUS_LABELS = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
};

const STATUS_ORDER = ["pendiente", "en_progreso", "completada"];

const STATUS_COLORS = {
  pendiente: "#facc15",
  en_progreso: "#2563eb",
  completada: "#10b981",
};

const QUICK_ACCESS_ITEMS = [
  { id: "quick-dashboard", icon: "layout-dashboard", label: "Panel de control", description: "Vuelve al resumen general.", targetId: "dashboardIntro" },
  { id: "quick-report", icon: "bar-chart-3", label: "Reporte general", description: "Revisa indicadores clave.", targetId: "generalReportCard", roles: ["administrador"] },
  { id: "quick-users", icon: "users", label: "Gestión de usuarios", description: "Administra accesos y registros.", targetId: "userManagementCard", roles: ["administrador"] },
  { id: "quick-print", icon: "printer", label: "Imprimir reporte", description: "Genera una versión para compartir.", roles: ["administrador", "docente", "auxiliar"], action: () => window.print() },
  { id: "quick-teacher", icon: "check-square", label: "Actividades por realizar", description: "Consulta tus pendientes y avances.", targetId: "teacherActivitiesCard", roles: ["docente"] },
];


// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let users = [];
let activities = [];
let currentUser = null;
let firestoreUsersLoaded = false;
let unsubscribeUsersListener = null;
let firestoreUsersError = null;
let firestoreUsersLastUpdated = null;
const userFilters = { search: "", role: "all", career: "all", auth: "all" };
let pendingFirebaseUser = null;

const elements = {};
const charts = { users: null, activities: null };

let googleProvider = null;


// --- CICLO DE VIDA DE LA APLICACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  cacheDomElements();
  updateLayoutMode();
  hideLoader();
  attachEventListeners();
  initCharts();
  initializeAuthentication();
  subscribeToFirestoreUsers();
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
    "refreshDashboard", "sidebarCollapseBtn", "sidebarExpandBtn"
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
}


// --- LÓGICA DE AUTENTICACIÓN ---
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
  if (auth) signOut(auth).catch(error => console.error("Error al cerrar sesión:", error));
}

function handleAuthStateChange(firebaseUser) {
  if (firebaseUser) {
    pendingFirebaseUser = firebaseUser;
    if (firestoreUsersLoaded) processLogin(firebaseUser);
  } else {
    applyLoggedOutState();
  }
}

function processLogin(firebaseUser) {
    if (!pendingFirebaseUser) return;
    const userToProcess = pendingFirebaseUser;
    pendingFirebaseUser = null;

    const normalizedEmail = (userToProcess.email || "").toLowerCase();
    const isAllowedDomain = normalizedEmail.endsWith(`@${ALLOWED_DOMAIN}`);
    
    const userRecord = users.find(u => 
        (u.potroEmail?.toLowerCase() === normalizedEmail) ||
        (u.institutionalEmail?.toLowerCase() === normalizedEmail) ||
        (u.email?.toLowerCase() === normalizedEmail) ||
        (u.firebaseUid === userToProcess.uid)
    );

    if (!isAllowedDomain && !(userRecord && userRecord.allowExternalAuth)) {
        showMessage(elements.loginError, `Debes usar una cuenta @${ALLOWED_DOMAIN}.`, "error", null);
        return handleLogout();
    }
    if (!userRecord) {
        showMessage(elements.loginError, "Tu cuenta no tiene permisos para acceder.", "error", null);
        return handleLogout();
    }

    // 🔥 **INICIO DEL REFINAMIENTO** 🔥
    // La lógica de asignación de UID desde el cliente se elimina por completo.
    // Nuestras reglas de Firestore ya manejan esta operación de forma segura.
    // El cliente ya no tiene esta responsabilidad crítica.
    if (!userRecord.firebaseUid) {
        console.log(`Primer inicio de sesión detectado para ${userToProcess.email}. El perfil se vinculará de forma segura en la primera actualización.`);
    }
    // 🔥 **FIN DEL REFINAMIENTO** 🔥

    currentUser = { ...userRecord, name: userRecord.name || userToProcess.displayName, firebaseUid: userToProcess.uid };
    
    loginUser(currentUser);
}


// --- GESTIÓN DE USUARIOS ---
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
  // 🔥 CORRECCIÓN: El Correo Potro ahora es obligatorio para crear nuevos usuarios, ya que funciona como ID.
  if (!editingUserId && !userData.potroEmail) {
    return showMessage(elements.userFormAlert, "El Correo Potro es obligatorio para registrar un nuevo usuario.");
  }

  const isDuplicate = users.some(user => {
    // La lógica de duplicados ahora se basa en el ID (que será el email).
    if (user.id === editingUserId) return false;
    const hasSamePotro = userData.potroEmail && user.id === userData.potroEmail;
    const hasSameControl = userData.controlNumber && user.controlNumber === userData.controlNumber;
    return hasSamePotro || hasSameControl;
  });

  if (isDuplicate) return showMessage(elements.userFormAlert, "Ya existe un usuario con ese Correo Potro o número de control.");

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
    // 🔥 CORRECCIÓN: Usamos el Correo Potro como ID para nuevos usuarios.
    // Si estamos editando, usamos el ID existente (que ya debería ser el correo).
    const docId = isEdit ? record.id : record.potroEmail;

    if (!docId) {
       return { success: false, message: "Error: El Correo Potro es necesario como identificador." };
    }

    const docRef = doc(db, "users", docId);

    const payload = {
      // Ya no guardamos el 'id' dentro del documento, pues el nombre del documento es el ID.
      userId: docRef.id,
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


// --- SINCRONIZACIÓN CON FIRESTORE ---
function subscribeToFirestoreUsers() {
  if (!db) {
    firestoreUsersError = "Configura Firebase para sincronizar usuarios.";
    renderAllSections();
    return;
  }
  let firestoreUsersLoading = true;
  const q = query(collection(db, "users"), orderBy("name"));

  unsubscribeUsersListener = onSnapshot(q, 
    (snapshot) => {
      users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      firestoreUsersLoaded = true;
      firestoreUsersLoading = false;
      firestoreUsersError = null;
      firestoreUsersLastUpdated = new Date();
      renderAllSections();
      if (pendingFirebaseUser) processLogin(pendingFirebaseUser);
    },
    (error) => {
      console.error("Error al suscribirse a los usuarios:", error);
      firestoreUsersLoading = false;
      firestoreUsersLoaded = true;
      firestoreUsersError = "No se pudieron cargar los usuarios.";
      renderAllSections();
      if (pendingFirebaseUser) processLogin(pendingFirebaseUser);
    }
  );
}

async function attemptLoadActivitiesFromFirestore() {
    // Lógica para cargar actividades si es necesario en el futuro.
}


// --- RENDERIZADO Y LÓGICA DE UI ---
function renderAllSections() {
    updateLayoutMode();
    syncHeaderHeight();
    if (currentUser) {
        buildNavigation(currentUser.role);
        buildQuickAccess(currentUser.role);
        renderSidebarUserCard(currentUser);
        configureRoleViews(currentUser.role);
        if (currentUser.role === 'administrador') {
            updateUserManagementControls();
            renderUserSummary();
            renderUserTable();
            renderUserSyncStatus();
        }
    } else {
        configureRoleViews(null); // Oculta todas las vistas específicas de rol
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
  renderAllSections();
}

function applyLoggedOutState() {
  currentUser = null;
  pendingFirebaseUser = null;
  elements.headerUserMeta?.classList.add("hidden");
  updateLayoutMode();
  renderAllSections(); // Llama a renderAll para limpiar las vistas
}

function renderUserTable() {
    if (!elements.userTableContainer) return;
    const filteredUsers = getFilteredUsers();
    renderUserTableMeta(filteredUsers);
    let firestoreUsersLoading;
    if (users.length === 0 && !firestoreUsersLoading) {
        elements.userTableContainer.innerHTML = `<p class="empty-state">No hay usuarios registrados. Agrega el primero para comenzar.</p>`;
        return;
    }
    if (filteredUsers.length === 0 && users.length > 0) {
        elements.userTableContainer.innerHTML = `<p class="empty-state">No se encontraron usuarios con los filtros aplicados.</p>`;
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
    let firestoreUsersLoading;
    if (firestoreUsersLoading) {
        elements.userTableMeta.textContent = 'Cargando usuarios...';
        return;
    }
    if (users.length === 0) {
        elements.userTableMeta.textContent = 'No hay usuarios para mostrar.';
        return;
    }
    elements.userTableMeta.textContent = `Mostrando ${filteredUsers.length} de ${users.length} usuarios.`;
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


// --- FUNCIONES UTILITARIAS Y DE UI ---
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
  document.getElementById("loader")?.remove();
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

function buildNavigation(role) {
    // Implementación futura si se necesita navegación dinámica
}

function buildQuickAccess(role) {
    // Implementación futura
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

function renderUserSyncStatus() {
    if (!elements.userSyncStatus) return;
    let cn = "user-sync-status", text = "";
    let firestoreUsersLoading;
    if (firestoreUsersLoading) { cn += " loading"; text = "Sincronizando..."; } 
    else if (firestoreUsersError) { cn += " error"; text = firestoreUsersError; } 
    else if (firestoreUsersLoaded) { cn += " success"; text = `Sincronizado. Última actualización: ${new Date(firestoreUsersLastUpdated).toLocaleTimeString()}`; }
    elements.userSyncStatus.className = cn;
    elements.userSyncStatus.textContent = text;
}

function initCharts() {
    const chartOptions = { responsive: true, maintainAspectRatio: false };
    if (document.getElementById("usersChart")) {
        charts.users = new Chart(document.getElementById("usersChart"), { type: "bar", data: { labels: [], datasets: [{ label: 'Usuarios', data: [], backgroundColor: 'rgba(37, 99, 235, 0.85)' }] }, options: chartOptions });
    }
    if (document.getElementById("activitiesChart")) {
        charts.activities = new Chart(document.getElementById("activitiesChart"), { type: "doughnut", data: { labels: [], datasets: [{ data: [] }] }, options: chartOptions });
    }
}

function updateCharts() {
  if (charts.users) {
    const careerCounts = users.reduce((acc, user) => { acc[user.career] = (acc[user.career] || 0) + 1; return acc; }, {});
    charts.users.data.labels = Object.keys(careerCounts).map(key => CAREER_LABELS[key] || key);
    charts.users.data.datasets[0].data = Object.values(careerCounts);
    charts.users.update();
  }
}

// --- FUNCIONES PENDIENTES DE IMPLEMENTAR ---
async function importSoftwareTeachers() {
    showMessage(elements.importTeachersAlert, "Función de importación no implementada.", "info");
}
async function handleActivityFormSubmit(event) {
    event.preventDefault();
    showMessage(elements.adminActivityAlert, "Gestión de actividades no implementada.", "info");
}
