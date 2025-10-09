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
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, db } from "./firebase-config.js";

// --- CONSTANTES Y CONFIGURACIÓN ---
const PRIMARY_ADMIN_EMAIL_NORMALIZED = "isaac.paniagua@potros.itson.edu.mx";
const CAREER_LABELS = {
  software: "Ing. en Software",
  manufactura: "Ing. en Manufactura",
  mecatronica: "Ing. en Mecatrónica",
  global: "General",
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
const QUICK_ACCESS_LINKS = {
  administrador: [
    { label: 'Reporte General', targetId: 'generalReportCard', icon: 'pie-chart' },
    { label: 'Gestión de Usuarios', targetId: 'userManagementCard', icon: 'users' },
    { label: 'Gestión de Actividades', targetId: 'activityManagementCard', icon: 'clipboard-list' }
  ]
};

const ACTIVITY_STATUS_LABELS = { // <<--- AÑADIDO
  pendiente: "Pendiente",
  en_progreso: "En Progreso",
  completada: "Completada",
};

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let users = [];
let activities = [];
let currentUser = null;
let unsubscribeUsersListener = null;
let unsubscribeActivitiesListener = null;
const userFilters = { search: "", role: "all", career: "all" };
const elements = {};
const charts = { users: null, activities: null };

// --- CICLO DE VIDA DE LA APLICACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      document.body.classList.add('dashboard-active');
      initializeDashboard(firebaseUser);
    }
  });

  cacheDomElements();
  attachEventListeners();
  initCharts();
  renderChangelog();
});

async function initializeDashboard(firebaseUser) {
  const userDocRef = doc(db, "users", firebaseUser.email.toLowerCase());
  try {
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      currentUser = { ...userDoc.data(), id: userDoc.id, name: userDoc.data().name || firebaseUser.displayName };
      loginUser(currentUser);
    } else {
      console.error("Usuario autenticado, pero sin perfil en la base de datos.");
      handleLogout();
    }
  } catch (error) {
    console.error("Error al obtener el perfil de usuario:", error);
    handleLogout();
  }
}

function handleLogout() {
  if (unsubscribeUsersListener) unsubscribeUsersListener();
  if (unsubscribeActivitiesListener) unsubscribeActivitiesListener(); // <<--- AÑADIDO
  unsubscribeUsersListener = null;
  unsubscribeActivitiesListener = null; // <<--- AÑADIDO
  signOut(auth).catch(error => console.error("Error al cerrar sesión:", error));
}

function cacheDomElements() {
  const ids = [
    "logoutBtn", "headerUserMeta", "headerUserName", "headerUserRole", "quickAccessNav", "adminView", "docenteView",
    "auxiliarView", "userTableContainer", "startAddUserBtn", "userForm", "userFormTitle", "userFormDescription",
    "userFormSubmit", "cancelUserFormBtn", "userFormAlert", "userName", "userControlNumber", "userPotroEmail",
    "userInstitutionalEmail", "userAltEmail", "userPhone", "userRole", "userCareer", "userAllowExternalAuth",
    "userSummaryGrid", "userSearchInput", "userRoleFilter", "userCareerFilter", "clearUserFiltersBtn", "userTableMeta",
    "userSyncStatus", "printReport", "refreshDashboard", "openChangelogBtn", "closeChangelogBtn", "changelogModal",
    "changelogBody", "importModal", "closeImportModalBtn", "importModalBody", "importInstructions", "importFileInput",
    "importProgress", "importStatus", "importProgressBar", "importResults", "importResultsBody", "importTeachersBtn",
    "usersChart", "activitiesChart", "startAddActivityBtn", "adminActivityForm", "activityFormTitle", "cancelActivityFormBtn", "activityFormSubmit",
    "activityName", "activityDescription", "activityDueDate", "activityAssignee", "adminActivityAlert", "adminActivityList",
  ];
  ids.forEach(id => { elements[id] = document.getElementById(id); });
}

function attachEventListeners() {
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
    elements.clearUserFiltersBtn?.addEventListener("click", resetUserFilters);
    elements.openChangelogBtn?.addEventListener("click", () => toggleChangelogModal(true));
    elements.closeChangelogBtn?.addEventListener("click", () => toggleChangelogModal(false));
    elements.changelogModal?.addEventListener('click', (event) => { if (event.target === elements.changelogModal) toggleChangelogModal(false); });
    elements.importModal?.addEventListener('click', (event) => { if (event.target === elements.importModal) toggleImportModal(false); });
    elements.quickAccessNav?.addEventListener('click', handleQuickAccessClick);
    elements.importTeachersBtn?.addEventListener('click', () => toggleImportModal(true));
    elements.closeImportModalBtn?.addEventListener('click', () => toggleImportModal(false));
    elements.importFileInput?.addEventListener('change', handleFileSelect);
    elements.startAddActivityBtn?.addEventListener("click", () => openActivityForm("create"));
    elements.cancelActivityFormBtn?.addEventListener("click", () => hideActivityForm({ reset: true }));
    elements.adminActivityForm?.addEventListener("submit", handleActivityFormSubmit);
    elements.adminActivityList?.addEventListener("click", handleActivityListClick);
}

function renderAllSections() {
    if (!currentUser) return;
    
    configureRoleViews(currentUser.role);
    
    if (currentUser.role === 'administrador') {
        updateUserManagementControls();
        renderUserSummary();
        renderUserTable();
        renderActivityList(); // <<--- AÑADIDO
        populateAssigneeDropdown(); // <<--- AÑADIDO
    }
    updateCharts();
    refreshIcons();
}

function loginUser(user) {
  elements.headerUserMeta?.classList.remove("hidden");
  if(elements.headerUserName) elements.headerUserName.textContent = user.name;
  if(elements.headerUserRole) {
    elements.headerUserRole.textContent = ROLE_LABELS[user.role] || 'Usuario';
    elements.headerUserRole.className = `badge ${ROLE_BADGE_CLASS[user.role]}`;
  }
  
  if (user.role === 'administrador') {
    subscribeToFirestoreUsers();
    subscribeToFirestoreActivities(); // <<--- AÑADIDO
  }
  
  renderQuickAccessMenu(user.role);
  renderAllSections();
}

function configureRoleViews(role) {
    elements.adminView?.classList.toggle("hidden", role !== 'administrador');
    elements.docenteView?.classList.toggle("hidden", role !== 'docente');
    elements.auxiliarView?.classList.toggle("hidden", role !== 'auxiliar');
}

function renderQuickAccessMenu(role) {
  const navElement = elements.quickAccessNav;
  if (!navElement) return;

  const links = QUICK_ACCESS_LINKS[role];
  if (links && links.length > 0) {
    navElement.innerHTML = links.map(link => `
      <button type="button" data-target-id="${link.targetId}">
        <i data-lucide="${link.icon}"></i>
        <span>${link.label}</span>
      </button>
    `).join('');
    refreshIcons();
  } else {
    navElement.innerHTML = '';
  }
}

function handleQuickAccessClick(event) {
  const button = event.target.closest('button[data-target-id]');
  if (!button) return;
  const targetElement = document.getElementById(button.dataset.targetId);
  if (targetElement) {
    if (targetElement.tagName === 'DETAILS' && !targetElement.open) {
      targetElement.open = true;
    }
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function openUserForm(mode, user = null) {
  hideMessage(elements.userFormAlert);
  elements.userForm.hidden = false;
  elements.userForm.reset();
  const isEdit = mode === 'edit' && user;
  elements.userForm.dataset.editingId = isEdit ? user.id : "";
  elements.userFormTitle.textContent = isEdit ? "Editar usuario" : "Agregar usuario";
  elements.userFormSubmit.textContent = isEdit ? "Guardar cambios" : "Crear usuario";
  if (isEdit) {
    document.getElementById('userName').value = user.name || "";
    document.getElementById('userControlNumber').value = user.controlNumber || "";
    document.getElementById('userPotroEmail').value = user.potroEmail || "";
    document.getElementById('userInstitutionalEmail').value = user.institutionalEmail || "";
    document.getElementById('userAltEmail').value = user.email || "";
    document.getElementById('userPhone').value = user.phone || "";
    document.getElementById('userRole').value = user.role || "docente";
    document.getElementById('userCareer').value = user.career || "software";
    document.getElementById('userAllowExternalAuth').checked = user.allowExternalAuth || false;
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

  if (!userData.name || (!editingUserId && !userData.potroEmail)) {
    return showMessage(elements.userFormAlert, "El nombre y el Correo Potro son obligatorios.");
  }
  
  const isDuplicate = users.some(user => user.id === userData.potroEmail && user.id !== editingUserId);
  if (isDuplicate) {
    return showMessage(elements.userFormAlert, "Ya existe un usuario con ese Correo Potro.");
  }
  
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
    if (!docId) return { success: false, message: "Error: El Correo Potro es necesario." };
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
    return { success: false, message: "No se pudo conectar con la base de datos." };
  }
}

function handleUserTableClick(event) {
  if (!isPrimaryAdmin(currentUser)) return;
  const button = event.target.closest("button[data-action][data-user-id]");
  if (!button) return;
  const userId = button.dataset.userId;
  const user = users.find(u => u.id === userId);
  if (user) {
    if (button.dataset.action === "edit") openUserForm("edit", user);
    else if (button.dataset.action === "delete") requestUserDeletion(user);
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
  unsubscribeUsersListener = onSnapshot(q, (snapshot) => {
    users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    renderUserSyncStatus({ lastUpdate: new Date() });
    populateAssigneeDropdown();
    renderAllSections();
  }, (error) => {
    console.error("Error al suscribirse a los usuarios:", error);
    renderUserSyncStatus({ error: "No se pudieron cargar los usuarios." });
  });
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

function renderUserTable() {
    if (!elements.userTableContainer) return;
    const filteredUsers = getFilteredUsers();
    renderUserTableMeta(filteredUsers);
    if (users.length === 0) {
        elements.userTableContainer.innerHTML = `<div class="empty-state">No hay usuarios para mostrar.</div>`;
        return;
    }
    if (filteredUsers.length === 0 && (userFilters.search || userFilters.role !== 'all' || userFilters.career !== 'all')) {
        elements.userTableContainer.innerHTML = `<div class="empty-state">No se encontraron usuarios con los filtros aplicados.</div>`;
        return;
    }
    const allowManagement = isPrimaryAdmin(currentUser);
    const headerActions = allowManagement ? `<th class="actions-col">Acciones</th>` : "";
    const rows = filteredUsers.map(user => {
        const actionsCell = allowManagement ? `<td class="actions-cell"><div class="table-actions">
                    <button type="button" class="icon-button" data-action="edit" data-user-id="${user.id}"><i data-lucide="pencil"></i></button>
                    <button type="button" class="icon-button danger" data-action="delete" data-user-id="${user.id}"><i data-lucide="trash-2"></i></button>
                </div></td>` : "";
        return `<tr>
                <td>${escapeHtml(user.name)}<br><small>${escapeHtml(user.potroEmail || user.email || '')}</small></td>
                <td>${escapeHtml(user.controlNumber || 'N/A')}</td>
                <td>${escapeHtml(CAREER_LABELS[user.career] || 'N/A')}</td>
                <td><span class="${ROLE_BADGE_CLASS[user.role]}">${ROLE_LABELS[user.role]}</span></td>
                ${actionsCell}
            </tr>`;
    }).join("");
    elements.userTableContainer.innerHTML = `<table class="user-table">
            <thead><tr><th>Nombre</th><th>N° Control</th><th>Carrera</th><th>Rol</th>${headerActions}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    refreshIcons();
}

function getFilteredUsers() {
    return users.filter(user => {
        const search = userFilters.search.toLowerCase();
        return (!search || (user.name || "").toLowerCase().includes(search) || (user.potroEmail || "").toLowerCase().includes(search)) &&
               (userFilters.role === 'all' || user.role === userFilters.role) &&
               (userFilters.career === 'all' || user.career === userFilters.career);
    });
}

function renderUserTableMeta(filteredUsers) {
    if (elements.userTableMeta) {
        elements.userTableMeta.textContent = `Mostrando ${filteredUsers.length} de ${users.length} usuarios.`;
    }
}

function resetUserFilters() {
    userFilters.search = "";
    userFilters.role = "all";
    userFilters.career = "all";
    if (elements.userSearchInput) elements.userSearchInput.value = "";
    if (elements.userRoleFilter) elements.userRoleFilter.value = "all";
    if (elements.userCareerFilter) elements.userCareerFilter.value = "all";
    renderUserTable();
}

function updateUserManagementControls() {
    if(elements.startAddUserBtn) {
        elements.startAddUserBtn.hidden = !isPrimaryAdmin(currentUser);
    }
}

function isPrimaryAdmin(user) {
  return user && (user.potroEmail || "").toLowerCase() === PRIMARY_ADMIN_EMAIL_NORMALIZED;
}

function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, match => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'})[match]);
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
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderUserSyncStatus({ loading, error, lastUpdate }) {
    if (!elements.userSyncStatus) return;
    let cn = "user-sync-status", text = "";
    if (loading) { cn += " loading"; text = "Sincronizando..."; }
    else if (error) { cn += " error"; text = error; }
    else if (lastUpdate) { cn += " success"; text = `Sincronizado: ${new Date(lastUpdate).toLocaleTimeString()}`; }
    elements.userSyncStatus.className = cn;
    elements.userSyncStatus.textContent = text;
}

function initCharts() {
    const chartOptions = { responsive: true, maintainAspectRatio: false };
    if (elements.usersChart) {
        charts.users = new Chart(elements.usersChart, { type: "bar", data: { labels: [], datasets: [{ label: 'Usuarios', data: [], backgroundColor: "rgba(37, 99, 235, 0.6)" }] }, options: chartOptions });
    }
    if (elements.activitiesChart) {
        charts.activities = new Chart(elements.activitiesChart, { type: "doughnut", data: { labels: [], datasets: [{ data: [], backgroundColor: ["#facc15", "#2563eb", "#10b981"] }] }, options: chartOptions });
    }
}

function updateCharts() {
  if (charts.users && users.length > 0) {
    const careerCounts = users.reduce((acc, user) => { acc[user.career] = (acc[user.career] || 0) + 1; return acc; }, {});
    charts.users.data.labels = Object.keys(careerCounts).map(key => CAREER_LABELS[key] || key);
    charts.users.data.datasets[0].data = Object.values(careerCounts);
    charts.users.update();
    if (charts.activities && activities.length > 0) {
    const statusCounts = activities.reduce((acc, activity) => { acc[activity.status] = (acc[activity.status] || 0) + 1; return acc; }, {});
    charts.activities.data.labels = Object.keys(statusCounts).map(key => ACTIVITY_STATUS_LABELS[key] || key);
    charts.activities.data.datasets[0].data = Object.values(statusCounts);
    charts.activities.update();
  }
  }
}

async function renderChangelog() {
  if (!elements.changelogBody) return;
  try {
    const response = await fetch(`CHANGELOG.md?v=${new Date().getTime()}`);
    if (!response.ok) throw new Error('No se pudo cargar el changelog.');
    const markdownText = await response.text();
    elements.changelogBody.innerHTML = marked(markdownText);
  } catch (error) {
    elements.changelogBody.innerHTML = `<p class="alert error show">No se pudieron cargar las actualizaciones.</p>`;
  }
}

function toggleChangelogModal(show) {
  elements.changelogModal?.classList.toggle("hidden", !show);
}

function toggleImportModal(show) {
  elements.importModal?.classList.toggle("hidden", !show);
  if (show) {
    elements.importInstructions?.classList.remove("hidden");
    elements.importProgress?.classList.add("hidden");
    elements.importResults?.classList.add("hidden");
    if (elements.importFileInput) elements.importFileInput.value = '';
  }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    elements.importInstructions.classList.add('hidden');
    elements.importProgress.classList.remove('hidden');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        await processImportedData(json);
    };
    reader.readAsArrayBuffer(file);
}

async function processImportedData(usersToImport) {
    const total = usersToImport.length;
    const successes = [];
    const failures = [];
    for (let i = 0; i < total; i++) {
        const user = usersToImport[i];
        elements.importStatus.textContent = `Procesando ${i + 1} de ${total}...`;
        elements.importProgressBar.style.width = `${((i + 1) / total) * 100}%`;
        
        const formattedUser = {
            name: String(user.name || "").trim(),
            potroEmail: String(user.potroEmail || "").trim().toLowerCase(),
            role: String(user.role || "docente").trim().toLowerCase(),
            career: String(user.career || "software").trim().toLowerCase(),
            updatedBy: currentUser.email
        };

        if (formattedUser.name && formattedUser.potroEmail) {
            const result = await persistImportedUser(formattedUser);
            if (result.success) {
                successes.push(formattedUser);
            } else {
                failures.push({ user, reason: result.message });
            }
        } else {
            failures.push({ user, reason: "Nombre o Correo Potro faltante en el archivo." });
        }
        await new Promise(res => setTimeout(res, 20)); 
    }
    displayImportResults(successes, failures);
}

function displayImportResults(successes, failures) {
  elements.importProgress.classList.add('hidden');
  elements.importResults.classList.remove('hidden');
  let html = `<p><b>Resultados:</b> ${successes.length} usuarios importados, ${failures.length} errores.</p>`;
  if (failures.length > 0) {
    html += `<h4>Registros con errores:</h4><table class="import-results-table">
      <thead><tr><th>Nombre</th><th>Error</th></tr></thead>
      <tbody>${failures.map(f => `<tr><td>${escapeHtml(f.user.name || 'N/A')}</td><td class="error-reason">${escapeHtml(f.reason)}</td></tr>`).join('')}</tbody>
    </table>`;
  }
  elements.importResultsBody.innerHTML = html;
}

async function persistImportedUser(record) {
    try {
        const docRef = doc(db, "users", record.potroEmail);
        const docSnap = await getDoc(docRef);
        const payload = { ...record, updatedAt: serverTimestamp() };
        if (!docSnap.exists()) {
            payload.createdAt = serverTimestamp();
        }
        await setDoc(docRef, payload, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error de importación:", error);
        return { success: false, message: "Error al escribir en la base de datos." };
    }
}

// --- NUEVAS FUNCIONES PARA GESTIÓN DE ACTIVIDADES ---

function subscribeToFirestoreActivities() {
  if (!db || unsubscribeActivitiesListener) return;
  const q = query(collection(db, "activities"), orderBy("dueDate", "desc"));
  unsubscribeActivitiesListener = onSnapshot(q, (snapshot) => {
    activities = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    renderActivityList();
    updateCharts();
  }, (error) => {
    console.error("Error al suscribirse a las actividades:", error);
    elements.adminActivityList.innerHTML = `<p class="alert error show">No se pudieron cargar las actividades.</p>`;
  });
}

function openActivityForm(mode, activity = null) {
  hideMessage(elements.adminActivityAlert);
  elements.adminActivityForm.hidden = false;
  elements.adminActivityForm.reset();
  const isEdit = mode === 'edit' && activity;
  elements.adminActivityForm.dataset.editingId = isEdit ? activity.id : "";
  elements.activityFormTitle.textContent = isEdit ? "Editar Actividad" : "Crear Nueva Actividad";
  elements.activityFormSubmit.textContent = isEdit ? "Guardar Cambios" : "Crear Actividad";
  if (isEdit) {
    elements.activityName.value = activity.name || "";
    elements.activityDescription.value = activity.description || "";
    elements.activityDueDate.value = activity.dueDate ? new Date(activity.dueDate.toMillis()).toISOString().split('T')[0] : "";
    elements.activityAssignee.value = activity.assigneeEmail || "";
  }
}

function hideActivityForm({ reset = false } = {}) {
  elements.adminActivityForm.hidden = true;
  if (reset) {
    elements.adminActivityForm.reset();
    delete elements.adminActivityForm.dataset.editingId;
  }
}

async function handleActivityFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const editingActivityId = form.dataset.editingId || null;

  const assigneeEmail = String(formData.get("assignee") || "").trim();
  const selectedUser = users.find(u => u.potroEmail === assigneeEmail);

  const activityData = {
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    dueDate: new Date(formData.get("dueDate")),
    assigneeEmail: assigneeEmail,
    assigneeName: selectedUser ? selectedUser.name : "No asignado",
    career: selectedUser ? selectedUser.career : "global",
  };

  if (!activityData.name || !activityData.dueDate || !activityData.assigneeEmail) {
    return showMessage(elements.adminActivityAlert, "Nombre, fecha y responsable son obligatorios.");
  }

  const recordToPersist = { ...activityData, id: editingActivityId, updatedBy: currentUser.email };
  const result = await persistActivityChange(recordToPersist);

  if (result.success) {
    hideActivityForm({ reset: true });
    showMessage(elements.adminActivityAlert, editingActivityId ? "Actividad actualizada." : "Actividad agregada.", "success");
  } else {
    showMessage(elements.adminActivityAlert, result.message, "error");
  }
}

async function persistActivityChange(record) {
  if (!db) return { success: false, message: "Base de datos no disponible." };
  try {
    const isEdit = !!record.id;
    const payload = {
      name: record.name,
      description: record.description,
      dueDate: record.dueDate,
      assigneeEmail: record.assigneeEmail,
      assigneeName: record.assigneeName,
      career: record.career,
      updatedBy: record.updatedBy,
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      const docRef = doc(db, "activities", record.id);
      await setDoc(docRef, payload, { merge: true });
    } else {
      payload.status = "pendiente";
      payload.createdBy = record.updatedBy;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "activities"), payload);
    }
    return { success: true };
  } catch (error) {
    console.error("Error al sincronizar actividad:", error);
    return { success: false, message: "No se pudo conectar con la base de datos." };
  }
}

function handleActivityListClick(event) {
    const button = event.target.closest("button[data-action][data-activity-id]");
    if (!button) return;
    const activityId = button.dataset.activityId;
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
        if (button.dataset.action === "edit-activity") openActivityForm("edit", activity);
        else if (button.dataset.action === "delete-activity") requestActivityDeletion(activity);
    }
}

async function requestActivityDeletion(activity) {
    if (confirm(`¿Estás seguro de que quieres eliminar la actividad "${activity.name}"?`)) {
        try {
            await deleteDoc(doc(db, "activities", activity.id));
            showMessage(elements.adminActivityAlert, "Actividad eliminada.", "success");
        } catch (error) {
            showMessage(elements.adminActivityAlert, "No se pudo eliminar la actividad.", "error");
            console.error("Error al eliminar actividad:", error);
        }
    }
}

function renderActivityList() {
    if (!elements.adminActivityList) return;

    if (activities.length === 0) {
        elements.adminActivityList.innerHTML = `<div class="empty-state">No hay actividades creadas. ¡Añade una para empezar!</div>`;
        return;
    }

    const activitiesByCareer = activities.reduce((acc, activity) => {
        const career = activity.career || 'global';
        if (!acc[career]) {
            acc[career] = [];
        }
        acc[career].push(activity);
        return acc;
    }, {});

    let html = '';
    for (const career in activitiesByCareer) {
        html += `
            <div class="activity-career-group">
                <header class="activity-group-header">
                    <h3>${CAREER_LABELS[career] || 'General'}</h3>
                    <span class="activity-group-count">${activitiesByCareer[career].length} Actividades</span>
                </header>
                <div class="activity-cards">
                    ${activitiesByCareer[career].map(activity => renderActivityCard(activity)).join('')}
                </div>
            </div>`;
    }
    elements.adminActivityList.innerHTML = html;
    refreshIcons();
}

function renderActivityCard(activity) {
    const dueDate = activity.dueDate ? new Date(activity.dueDate.toMillis()).toLocaleDateString() : 'N/A';
    return `
        <div class="activity-card status-${activity.status}">
            <header>
                <div>
                    <h4>${escapeHtml(activity.name)}</h4>
                    <p>${escapeHtml(activity.description)}</p>
                </div>
                <span class="status-badge status-${activity.status}">${ACTIVITY_STATUS_LABELS[activity.status]}</span>
            </header>
            <div class="activity-meta">
                <span><i data-lucide="user"></i> ${escapeHtml(activity.assigneeName)}</span>
                <span><i data-lucide="calendar"></i> ${dueDate}</span>
            </div>
            <div class="action-buttons">
                <button type="button" class="icon-button" data-action="edit-activity" data-activity-id="${activity.id}"><i data-lucide="pencil"></i></button>
                <button type="button" class="icon-button danger" data-action="delete-activity" data-activity-id="${activity.id}"><i data-lucide="trash-2"></i></button>
            </div>
        </div>
    `;
}

function populateAssigneeDropdown() {
    if (!elements.activityAssignee) return;
    const options = users
        .filter(u => u.role === 'docente' || u.role === 'auxiliar')
        .map(user => `<option value="${user.potroEmail}">${user.name}</option>`)
        .join('');
    elements.activityAssignee.innerHTML = `<option value="">Selecciona un responsable...</option>${options}`;
}
