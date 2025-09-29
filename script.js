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
import { getFirebaseAuth, getFirestoreDb } from "./firebase-config.js";

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
  {
    id: "quick-dashboard",
    icon: "layout-dashboard",
    label: "Panel de control",
    description: "Vuelve al resumen general.",
    targetId: "dashboardIntro",
  },
  {
    id: "quick-report",
    icon: "bar-chart-3",
    label: "Reporte general",
    description: "Revisa indicadores clave del departamento.",
    targetId: "generalReportCard",
    roles: ["administrador"],
  },
  {
    id: "quick-refresh",
    icon: "refresh-cw",
    label: "Actualizar indicadores",
    description: "Sincroniza los datos más recientes.",
    targetId: "generalReportCard",
    roles: ["administrador"],
    action: () => {
      if (elements.refreshDashboard) {
        elements.refreshDashboard.click();
      } else {
        renderAllSections();
      }
    },
  },
  {
    id: "quick-users",
    icon: "users",
    label: "Gestión de usuarios",
    description: "Administra accesos y registros.",
    targetId: "userManagementCard",
    roles: ["administrador"],
  },
  {
    id: "quick-print",
    icon: "printer",
    label: "Imprimir reporte",
    description: "Genera una versión para compartir.",
    roles: ["administrador", "docente", "auxiliar"],
    action: () => {
      if (elements.printReport) {
        elements.printReport.click();
      } else {
        window.print();
      }
    },
  },
  {
    id: "quick-teacher",
    icon: "check-square",
    label: "Actividades por realizar",
    description: "Consulta tus pendientes y avances.",
    targetId: "teacherActivitiesCard",
    roles: ["docente"],
  },
  {
    id: "quick-teacher-progress",
    icon: "trending-up",
    label: "Mi progreso",
    description: "Revisa el estado de tus actividades asignadas.",
    targetId: "teacherProgressCard",
    roles: ["docente"],
  },
  {
    id: "quick-auxiliar",
    icon: "clipboard-list",
    label: "Actividades de apoyo",
    description: "Actualiza el seguimiento asignado.",
    targetId: "auxiliarActivitiesCard",
    roles: ["auxiliar"],
  },
];

let resizeFrame = null;

function syncHeaderHeight() {
  const header = document.querySelector(".app-header");
  const headerHeight = header ? header.offsetHeight : 0;
  document.documentElement.style.setProperty(
    "--header-height",
    `${headerHeight}px`,
  );
}

function scheduleHeaderSync() {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(syncHeaderHeight);
}

function updateLayoutMode() {
  const body = document.body;
  const dashboardVisible =
    currentUser !== null &&
    elements.dashboard &&
    !elements.dashboard.classList.contains("hidden");
  body.classList.toggle("dashboard-active", dashboardVisible);
  body.classList.toggle("auth-active", !dashboardVisible);
}

function setSidebarCollapsed(value) {
  if (!elements.dashboardShell) return;
  const shouldCollapse =
    typeof value === "boolean"
      ? value
      : !elements.dashboardShell.classList.contains("sidebar-collapsed");
  elements.dashboardShell.classList.toggle("sidebar-collapsed", shouldCollapse);
  if (elements.sidebarCollapseBtn) {
    elements.sidebarCollapseBtn.setAttribute(
      "aria-expanded",
      String(!shouldCollapse),
    );
  }
  if (elements.sidebarExpandBtn) {
    if (shouldCollapse) {
      elements.sidebarExpandBtn.removeAttribute("hidden");
      elements.sidebarExpandBtn.setAttribute("aria-hidden", "false");
    } else {
      elements.sidebarExpandBtn.setAttribute("hidden", "hidden");
      elements.sidebarExpandBtn.setAttribute("aria-hidden", "true");
    }
  }
}

function createUserRecord(raw) {
  const toTrimmedString = (value) => {
    const text = String(value ?? "").trim();
    return text;
  };

  const toEmail = (value) => {
    const email = toTrimmedString(value);
    return email ? email.toLowerCase() : "";
  };

  const potroEmail = toEmail(raw.potroEmail ?? raw.email ?? "");
  const institutionalEmailSource =
    raw.institutionalEmail ??
    (potroEmail && potroEmail.includes("@potros.")
      ? potroEmail.replace("@potros.", "@")
      : raw.institutionalEmail ?? "");
  const institutionalEmail = toEmail(institutionalEmailSource ?? "");
  const genericEmail = toEmail(raw.email ?? potroEmail ?? "");

  const firebaseUid = toTrimmedString(raw.firebaseUid ?? raw.uid ?? "");

  return {
    ...raw,
    id: toTrimmedString(raw.id ?? ""),
    name: toTrimmedString(raw.name ?? ""),
    controlNumber: toTrimmedString(raw.controlNumber ?? ""),
    phone: toTrimmedString(raw.phone ?? ""),
    role: toTrimmedString(raw.role ?? ""),
    career: toTrimmedString(raw.career ?? ""),
    potroEmail: potroEmail || "",
    institutionalEmail: institutionalEmail || "",
    email: genericEmail || potroEmail || "",
    firebaseUid,
    allowExternalAuth: Boolean(raw.allowExternalAuth ?? false),
  };
}

const initialUsers = [];

const softwareTeacherImport = [
  {
    id: "u-imp-2",
    name: "Julio Nava",
    controlNumber: "D230202",
    potroEmail: "julio.nava@potros.itson.edu.mx",
    institutionalEmail: "julio.nava@itson.edu.mx",
    role: "docente",
    career: "software",
    phone: "(622) 100 2760",
  },
  {
    id: "00000092313",
    name: "Aarón Gilberto León Flores",
    controlNumber: "87007190",
    potroEmail: "aaron.leon92313@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 165 7826",
  },
  {
    id: "00000090476",
    name: "Arturo García Saiza",
    controlNumber: "87006214",
    potroEmail: "arturo.garcia90476@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 149 1249",
  },
  {
    id: "00000013648",
    name: "Bertha Julia Valle Cruz",
    controlNumber: "85000551",
    potroEmail: "bertha.valle13648@potros.itson.edu.mx",
    institutionalEmail: "bvalle@itson.edu.mx",
    role: "docente",
    career: "software",
    phone: "(622) 109 2074",
  },
  {
    id: "00000231195",
    name: "Carlos Alberto Ruiz Castrejón",
    controlNumber: "",
    potroEmail: "carlos.ruizc@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "",
  },
  {
    id: "00000017041",
    name: "Eduardo Lara García",
    controlNumber: "87006213",
    potroEmail: "eduardo.garcia17041@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 107 2068",
  },
  {
    id: "00000099610",
    name: "Jesús Abraham Zazueta Castillo",
    controlNumber: "87006157",
    potroEmail: "jesus.zazueta99610@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 172 9061",
  },
  {
    id: "00000009726",
    name: "Jesús Antonio Pérez Ceceña",
    controlNumber: "87005932",
    potroEmail: "jesus.perez9726@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 227 5714",
  },
  {
    id: "00000262383",
    name: "Jesús Carlos Gaytán Salazar",
    controlNumber: "",
    potroEmail: "jesuscarlosgaytan@gmail.com",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "",
  },
  {
    id: "00000162447",
    name: "Jesús Rigoberto Villavicencio Navarro",
    controlNumber: "89003065",
    potroEmail: "jesus.villavicencio162447@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 227 5527",
  },
  {
    id: "00000016329",
    name: "Jorge Alberto Norzagaray Mora",
    controlNumber: "87005932",
    potroEmail: "jorge.norzagaray16329@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 100 4274",
  },
  {
    id: "00000019413",
    name: "Juan Manuel Osuna Aceves",
    controlNumber: "87001734",
    potroEmail: "juan.osuna19413@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 147 7961",
  },
  {
    id: "00000092307",
    name: "Julio Isaac Nava Cordero",
    controlNumber: "87007034",
    potroEmail: "julio.nava92307@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 100 2760",
  },
  {
    id: "00000020641",
    name: "Miguel Ángel Moroyoqui Parra",
    controlNumber: "87004412",
    potroEmail: "miguel.moroyoqui20641@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 120 0257",
  },
  {
    id: "00000019401",
    name: "Roberto Limon Ulloa",
    controlNumber: "85000836",
    potroEmail: "roberto.limon@potros.itson.edu.mx",
    institutionalEmail: "rlimon@itson.edu.mx",
    role: "docente",
    career: "software",
    phone: "(622) 108 8833",
  },
  {
    id: "00000090851",
    name: "Sergio Castellanos Bustamante",
    controlNumber: "",
    potroEmail: "sergio.castellanos90851@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "",
  },
  {
    id: "00000206923",
    name: "Vinko Antonio Nevescanín Moreno",
    controlNumber: "87007385",
    potroEmail: "vinko.nevescanin206923@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 123 6661",
  },
  {
    id: "00000091125",
    name: "Zaira Guadalupe Bermúdez Pérez",
    controlNumber: "87006990",
    potroEmail: "zaira.bermudez91125@potros.itson.edu.mx",
    institutionalEmail: "",
    role: "docente",
    career: "software",
    phone: "(622) 127 5763",
  },
].map(createUserRecord);

const initialActivities = [];

let users = initialUsers.map((user) => ({ ...user }));
let activities = initialActivities.map((activity) => ({ ...activity }));
let currentUser = null;
let importedTeachersCount = 0;
let firestoreUsersLoading = false;
let firestoreUsersLoaded = false;
let unsubscribeUsersListener = null;
let firestoreUsersError = null;
let firestoreUsersLastUpdated = null;
const userFilters = {
  search: "",
  role: "all",
  career: "all",
  auth: "all",
};
let pendingFirebaseUser = null;
let firestoreActivitiesLoading = false;
let firestoreActivitiesLoaded = false;
const recentlyDeletedUserKeys = new Set();

const LOCAL_STORAGE_KEYS = {
  users: "tcd.users",
  activities: "tcd.activities",
  importedTeachers: "tcd.importedTeachersCount",
};

let cachedLocalStorage = null;
let localStorageCheckAttempted = false;

const charts = {
  users: null,
  activities: null,
};

const elements = {};

let auth = null;
let googleProvider = null;
let unsubscribeAuth = null;
let authInitializationAttempted = false;
let preserveLoginMessage = false;
let editingUserKey = null;

function isPermissionDeniedError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  if (code === "permission-denied") {
    return true;
  }

  const message = typeof error.message === "string" ? error.message : "";
  return message.toLowerCase().includes("missing or insufficient permissions");
}

function getFirestoreSyncErrorMessage(resourceLabel, error) {
  if (isPermissionDeniedError(error)) {
    return `No fue posible sincronizar ${resourceLabel}. Verifica las reglas de Firebase Firestore (consulta firebase/README.md).`;
  }

  return `Ocurrió un error al sincronizar ${resourceLabel} desde Firebase. Inténtalo nuevamente más tarde.`;
}

function getSafeLocalStorage() {
  if (cachedLocalStorage) {
    return cachedLocalStorage;
  }

  if (localStorageCheckAttempted) {
    return null;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    localStorageCheckAttempted = true;
    return null;
  }

  try {
    const testKey = "__tcd_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    cachedLocalStorage = window.localStorage;
  } catch (error) {
    console.warn("El almacenamiento local no está disponible:", error);
    cachedLocalStorage = null;
  }

  localStorageCheckAttempted = true;
  return cachedLocalStorage;
}

function persistUsersLocally() {
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(LOCAL_STORAGE_KEYS.users, JSON.stringify(users));
  } catch (error) {
    console.error("No fue posible guardar los usuarios localmente:", error);
  }
}

function persistActivitiesLocally() {
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(LOCAL_STORAGE_KEYS.activities, JSON.stringify(activities));
  } catch (error) {
    console.error("No fue posible guardar las actividades localmente:", error);
  }
}

function persistImportedTeachersCountLocally() {
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(
      LOCAL_STORAGE_KEYS.importedTeachers,
      String(importedTeachersCount),
    );
  } catch (error) {
    console.error(
      "No fue posible guardar el conteo de docentes importados localmente:",
      error,
    );
  }
}

function restoreLocalState() {
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    const storedUsers = storage.getItem(LOCAL_STORAGE_KEYS.users);
    if (storedUsers) {
      const parsedUsers = JSON.parse(storedUsers);
      if (Array.isArray(parsedUsers)) {
        users = parsedUsers.map((user) => createUserRecord(user));
        users.forEach((user) => clearDeletedUserKeys(user));
      }
    }
  } catch (error) {
    console.error("No fue posible restaurar los usuarios guardados localmente:", error);
  }

  try {
    const storedActivities = storage.getItem(LOCAL_STORAGE_KEYS.activities);
    if (storedActivities) {
      const parsedActivities = JSON.parse(storedActivities);
      if (Array.isArray(parsedActivities)) {
        activities = parsedActivities
          .map((activity) => createActivityRecord(activity))
          .filter((activity) => Boolean(activity && activity.title));
      }
    }
  } catch (error) {
    console.error(
      "No fue posible restaurar las actividades guardadas localmente:",
      error,
    );
  }

  try {
    const storedCount = storage.getItem(LOCAL_STORAGE_KEYS.importedTeachers);
    if (storedCount !== null && storedCount !== undefined) {
      const parsedCount = Number(storedCount);
      if (!Number.isNaN(parsedCount)) {
        importedTeachersCount = parsedCount;
      }
    }
  } catch (error) {
    console.error(
      "No fue posible restaurar el conteo de docentes importados:",
      error,
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cacheDomElements();
  restoreLocalState();
  updateLayoutMode();
  scheduleHeaderSync();
  window.addEventListener("resize", scheduleHeaderSync);
  window.addEventListener("orientationchange", scheduleHeaderSync);
  hideLoader();
  attachEventListeners();
  initCharts();
  updateHeaderStats();
  updateHighlights();
  updateCharts();
  refreshIcons();
  initializeAuthentication();
  subscribeToFirestoreUsers();
  attemptLoadActivitiesFromFirestore();
});

function cacheDomElements() {
  elements.authSection = document.getElementById("authSection");
  elements.dashboard = document.getElementById("dashboard");
  elements.dashboardShell = document.getElementById("dashboardShell");
  elements.googleSignInBtn = document.getElementById("googleSignInBtn");
  elements.loginError = document.getElementById("loginError");
  elements.logoutBtn = document.getElementById("logoutBtn");
  elements.headerUserMeta = document.getElementById("headerUserMeta");
  elements.headerUserName = document.getElementById("headerUserName");
  elements.headerUserRole = document.getElementById("headerUserRole");
  elements.headerActiveTasks = document.getElementById("headerActiveTasks");
  elements.headerActiveUsers = document.getElementById("headerActiveUsers");
  elements.sidebarName = document.getElementById("sidebarName");
  elements.sidebarEmail = document.getElementById("sidebarEmail");
  elements.sidebarCareer = document.getElementById("sidebarCareer");
  elements.quickAccess = document.getElementById("quickAccess");
  elements.quickAccessList = document.getElementById("quickAccessList");
  elements.navigation = document.getElementById("navigation");
  elements.adminView = document.getElementById("adminView");
  elements.docenteView = document.getElementById("docenteView");
  elements.auxiliarView = document.getElementById("auxiliarView");
  elements.userTableContainer = document.getElementById("userTableContainer");
  elements.startAddUserBtn = document.getElementById("startAddUserBtn");
  elements.userForm = document.getElementById("userForm");
  elements.userFormTitle = document.getElementById("userFormTitle");
  elements.userFormDescription = document.getElementById("userFormDescription");
  elements.userFormSubmit = document.getElementById("userFormSubmit");
  elements.cancelUserFormBtn = document.getElementById("cancelUserFormBtn");
  elements.userFormAlert = document.getElementById("userFormAlert");
  elements.userNameInput = document.getElementById("userName");
  elements.userIdInput = document.getElementById("userId");
  elements.userControlNumberInput = document.getElementById("userControlNumber");
  elements.userPotroEmailInput = document.getElementById("userPotroEmail");
  elements.userInstitutionalEmailInput = document.getElementById(
    "userInstitutionalEmail",
  );
  elements.userAltEmailInput = document.getElementById("userAltEmail");
  elements.userPhoneInput = document.getElementById("userPhone");
  elements.userRoleSelect = document.getElementById("userRole");
  elements.userCareerSelect = document.getElementById("userCareer");
  elements.userAllowExternalAuthInput = document.getElementById(
    "userAllowExternalAuth",
  );
  elements.userSummaryGrid = document.getElementById("userSummaryGrid");
  elements.userSearchInput = document.getElementById("userSearchInput");
  elements.userRoleFilter = document.getElementById("userRoleFilter");
  elements.userCareerFilter = document.getElementById("userCareerFilter");
  elements.userAuthFilter = document.getElementById("userAuthFilter");
  elements.clearUserFiltersBtn = document.getElementById("clearUserFiltersBtn");
  elements.userTableMeta = document.getElementById("userTableMeta");
  elements.userSyncStatus = document.getElementById("userSyncStatus");
  elements.adminActivityList = document.getElementById("adminActivityList");
  elements.adminActivityForm = document.getElementById("adminActivityForm");
  elements.adminActivityAlert = document.getElementById("adminActivityAlert");
  elements.importTeachersBtn = document.getElementById("importTeachersBtn");
  elements.importTeachersAlert = document.getElementById("importTeachersAlert");
  elements.inviteAlert = document.getElementById("inviteAlert");
  elements.teacherPendingActivities = document.getElementById(
    "teacherPendingActivities",
  );
  elements.teacherProgressSummary = document.getElementById(
    "teacherProgressSummary",
  );
  elements.auxiliarActivityList = document.getElementById("auxiliarActivityList");
  elements.auxiliarActivityAlert = document.getElementById("auxiliarActivityAlert");
  elements.printReport = document.getElementById("printReport");
  elements.refreshDashboard = document.getElementById("refreshDashboard");
  elements.sidebarCollapseBtn = document.getElementById("sidebarCollapseBtn");
  elements.sidebarExpandBtn = document.getElementById("sidebarExpandBtn");
  if (elements.dashboardShell) {
    setSidebarCollapsed(false);
  }
}

function hideLoader() {
  const loader = document.getElementById("loader");
  const backdrop = document.getElementById("modal-backdrop");
  if (loader) loader.style.display = "none";
  if (backdrop) backdrop.style.display = "none";
}

function attachEventListeners() {
  if (elements.googleSignInBtn) {
    elements.googleSignInBtn.addEventListener("click", handleGoogleSignIn);
  }
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener("click", handleLogout);
  }
  if (elements.printReport) {
    elements.printReport.addEventListener("click", () => window.print());
  }
  if (elements.refreshDashboard) {
    elements.refreshDashboard.addEventListener("click", () => {
      showMessage(
        elements.adminActivityAlert,
        "Indicadores actualizados.",
        "info",
      );
      renderAllSections();
    });
  }
  if (elements.adminActivityForm) {
    elements.adminActivityForm.addEventListener(
      "submit",
      handleActivityFormSubmit,
    );
  }
  if (elements.importTeachersBtn) {
    elements.importTeachersBtn.addEventListener(
      "click",
      importSoftwareTeachers,
    );
  }
  if (elements.startAddUserBtn) {
    elements.startAddUserBtn.addEventListener("click", handleStartAddUser);
  }
  if (elements.cancelUserFormBtn) {
    elements.cancelUserFormBtn.addEventListener("click", cancelUserForm);
  }
  if (elements.userForm) {
    elements.userForm.addEventListener("submit", handleUserFormSubmit);
  }
  if (elements.userTableContainer) {
    elements.userTableContainer.addEventListener(
      "click",
      handleUserTableClick,
    );
  }
  if (elements.userSearchInput) {
    elements.userSearchInput.addEventListener("input", handleUserSearchInput);
  }
  if (elements.userRoleFilter) {
    elements.userRoleFilter.addEventListener(
      "change",
      handleUserRoleFilterChange,
    );
  }
  if (elements.userCareerFilter) {
    elements.userCareerFilter.addEventListener(
      "change",
      handleUserCareerFilterChange,
    );
  }
  if (elements.userAuthFilter) {
    elements.userAuthFilter.addEventListener(
      "change",
      handleUserAuthFilterChange,
    );
  }
  if (elements.clearUserFiltersBtn) {
    elements.clearUserFiltersBtn.addEventListener(
      "click",
      resetUserFilters,
    );
  }
  if (elements.sidebarCollapseBtn) {
    elements.sidebarCollapseBtn.addEventListener("click", () => {
      setSidebarCollapsed(true);
      if (elements.sidebarExpandBtn) {
        elements.sidebarExpandBtn.focus();
      }
    });
  }
  if (elements.sidebarExpandBtn) {
    elements.sidebarExpandBtn.addEventListener("click", () => {
      setSidebarCollapsed(false);
      if (elements.sidebarCollapseBtn) {
        elements.sidebarCollapseBtn.focus();
      }
    });
  }
}

function ensureAuthInstance() {
  if (auth) {
    return auth;
  }

  if (authInitializationAttempted) {
    return null;
  }

  authInitializationAttempted = true;
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    return null;
  }

  auth = authInstance;
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ hd: ALLOWED_DOMAIN });
  unsubscribeAuth = onAuthStateChanged(auth, handleAuthStateChange);
  return auth;
}

function initializeAuthentication() {
  const authInstance = ensureAuthInstance();
  if (!authInstance) {
    if (elements.googleSignInBtn) {
      elements.googleSignInBtn.disabled = true;
      elements.googleSignInBtn.setAttribute("aria-disabled", "true");
    }
    showMessage(
      elements.loginError,
      "Configura Firebase Auth para habilitar el inicio de sesión con Google.",
      "info",
      null,
    );
    return;
  }

  if (elements.googleSignInBtn) {
    elements.googleSignInBtn.disabled = false;
    elements.googleSignInBtn.removeAttribute("aria-disabled");
  }
  hideMessage(elements.loginError);
}

async function handleGoogleSignIn() {
  hideMessage(elements.loginError);
  const authInstance = ensureAuthInstance();
  if (!authInstance || !googleProvider) {
    showMessage(
      elements.loginError,
      "La autenticación no está disponible en este momento.",
      "error",
      null,
    );
    return;
  }

  try {
    if (elements.googleSignInBtn) {
      elements.googleSignInBtn.disabled = true;
    }
    await signInWithPopup(authInstance, googleProvider);
  } catch (error) {
    if (error?.code === "auth/popup-closed-by-user") {
      showMessage(
        elements.loginError,
        "La ventana de inicio de sesión se cerró antes de completar el proceso.",
        "info",
      );
    } else if (error?.code !== "auth/cancelled-popup-request") {
      console.error("Error al iniciar sesión con Google:", error);
      showMessage(
        elements.loginError,
        "No fue posible iniciar sesión. Intenta nuevamente.",
        "error",
      );
    }
  } finally {
    if (elements.googleSignInBtn) {
      elements.googleSignInBtn.disabled = false;
    }
  }
}

async function handleLogout() {
  const authInstance = ensureAuthInstance();
  if (!authInstance) {
    applyLoggedOutState();
    return;
  }

  try {
    await signOut(authInstance);
  } catch (error) {
    console.error("No fue posible cerrar la sesión de Firebase:", error);
    applyLoggedOutState();
    showMessage(
      elements.loginError,
      "Ocurrió un problema al cerrar sesión. Vuelve a intentarlo.",
      "error",
    );
  }
}

function handleAuthStateChange(firebaseUser) {
  if (!firebaseUser) {
    pendingFirebaseUser = null;
    applyLoggedOutState({ preserveMessages: preserveLoginMessage });
    preserveLoginMessage = false;
    return;
  }

  pendingFirebaseUser = firebaseUser;
  const normalizedEmail = normalizeEmail(firebaseUser.email);
  const matchedUser = findUserRecord(firebaseUser);
  const isAllowedDomain =
    normalizedEmail && normalizedEmail.endsWith(`@${ALLOWED_DOMAIN}`);

  if (!isAllowedDomain && !(matchedUser && matchedUser.allowExternalAuth)) {
    pendingFirebaseUser = null;
    preserveLoginMessage = true;
    applyLoggedOutState({ preserveMessages: true });
    showMessage(
      elements.loginError,
      `Debes iniciar sesión con una cuenta @${ALLOWED_DOMAIN}.`,
      "error",
      null,
    );
    if (auth) {
      signOut(auth).catch(() => {});
    }
    return;
  }

  if (!matchedUser) {
    if (!firestoreUsersLoaded) {
      showMessage(
        elements.loginError,
        "Verificando tus permisos de acceso...",
        "info",
        null,
      );
      return;
    }

    pendingFirebaseUser = null;
    preserveLoginMessage = true;
    applyLoggedOutState({ preserveMessages: true });
    showMessage(
      elements.loginError,
      "Tu cuenta no tiene permisos para acceder al tablero. Contacta al administrador.",
      "error",
      null,
    );
    if (auth) {
      signOut(auth).catch(() => {});
    }
    return;
  }

  const userRecord = {
    ...matchedUser,
    name:
      matchedUser.name ||
      firebaseUser.displayName ||
      firebaseUser.email ||
      "Usuario",
    potroEmail: matchedUser.potroEmail || normalizedEmail,
    email: normalizedEmail || matchedUser.email || "",
    firebaseUid: matchedUser.firebaseUid || firebaseUser.uid || "",
  };

  if (normalizedEmail === PRIMARY_ADMIN_EMAIL_NORMALIZED) {
    userRecord.role = "administrador";
  }

  pendingFirebaseUser = null;
  preserveLoginMessage = false;
  hideMessage(elements.loginError);
  loginUser(userRecord);
}

function loginUser(user) {
  currentUser = { ...user };
  if (elements.authSection) elements.authSection.classList.add("hidden");
  if (elements.dashboard) elements.dashboard.classList.remove("hidden");
  if (elements.headerUserMeta) elements.headerUserMeta.classList.remove("hidden");
  updateLayoutMode();
  scheduleHeaderSync();

  if (elements.headerUserName) elements.headerUserName.textContent = currentUser.name;
  if (elements.headerUserRole) {
    elements.headerUserRole.textContent = ROLE_LABELS[currentUser.role];
    elements.headerUserRole.className =
      ROLE_BADGE_CLASS[currentUser.role] || "badge";
  }

  configureRoleViews(currentUser.role);
  buildNavigation(currentUser.role);
  renderSidebarUserCard(currentUser);
  renderAllSections();
  setSidebarCollapsed(false);
}

function applyLoggedOutState({ preserveMessages = false } = {}) {
  currentUser = null;
  if (elements.dashboard) elements.dashboard.classList.add("hidden");
  if (elements.authSection) elements.authSection.classList.remove("hidden");
  if (elements.headerUserMeta) elements.headerUserMeta.classList.add("hidden");
  updateLayoutMode();
  scheduleHeaderSync();
  if (elements.headerUserName) elements.headerUserName.textContent = "";
  if (elements.headerUserRole) {
    elements.headerUserRole.textContent = "";
    elements.headerUserRole.className = "badge";
  }
  if (elements.navigation) elements.navigation.innerHTML = "";
  if (elements.quickAccessList) elements.quickAccessList.innerHTML = "";
  if (elements.quickAccess) elements.quickAccess.setAttribute("hidden", "hidden");
  ["sidebarName", "sidebarEmail", "sidebarCareer"].forEach((key) => {
    if (elements[key]) elements[key].textContent = "";
  });
  document
    .querySelectorAll("[data-nav-label]")
    .forEach((section) => section.classList.remove("is-targeted"));
  setSidebarCollapsed(false);
  clearAdminSections();
  updateHeaderStats();
  renderUserSyncStatus();
  refreshIcons();
  if (!preserveMessages) {
    hideMessage(elements.loginError);
  }
}

function findUserByEmail(email) {
  const target = normalizeEmail(email);
  if (!target) return null;

  return (
    users.find((user) => {
      const potro = normalizeEmail(user.potroEmail);
      const institutional = normalizeEmail(user.institutionalEmail);
      const generic = normalizeEmail(user.email);
      return potro === target || institutional === target || generic === target;
    }) || null
  );
}

function findUserByUid(uid) {
  const targetUid = String(uid || "").trim();
  if (!targetUid) return null;

  return (
    users.find((user) => {
      const candidateUid = String(user.firebaseUid || user.uid || "").trim();
      return candidateUid && candidateUid === targetUid;
    }) || null
  );
}

function findUserRecord(firebaseUser) {
  if (!firebaseUser) {
    return null;
  }

  const normalizedEmail = normalizeEmail(firebaseUser.email);
  if (normalizedEmail) {
    const byEmail = findUserByEmail(normalizedEmail);
    if (byEmail) {
      return byEmail;
    }
  }

  return findUserByUid(firebaseUser.uid);
}

function configureRoleViews(role) {
  if (elements.adminView)
    elements.adminView.classList.toggle("hidden", role !== "administrador");
  if (elements.docenteView)
    elements.docenteView.classList.toggle("hidden", role !== "docente");
  if (elements.auxiliarView)
    elements.auxiliarView.classList.toggle("hidden", role !== "auxiliar");
}

function buildNavigation(role) {
  if (!elements.navigation) return;
  elements.navigation.innerHTML = "";
  const sections = Array.from(document.querySelectorAll("[data-nav-label]"));
  sections.forEach((section) => section.classList.remove("is-targeted"));

  const allowedSections = sections.filter((section) => {
    const roles = (section.dataset.navRoles || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return !roles.length || roles.includes(role);
  });

  allowedSections.forEach((section, index) => {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = section.dataset.navLabel || "Sección";
    button.classList.add("nav-button");
    button.addEventListener("click", () => {
      setActiveNavButton(button);
      setActiveSection(section);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (index === 0) {
      setActiveNavButton(button);
      setActiveSection(section);
    }
    listItem.append(button);
    elements.navigation.append(listItem);
  });
}

function buildQuickAccess(role) {
  if (!elements.quickAccessList) return;

  const allowedItems = QUICK_ACCESS_ITEMS.filter((item) => {
    if (!item.roles || !item.roles.length) return true;
    return item.roles.includes(role);
  });

  elements.quickAccessList.innerHTML = "";
  if (elements.quickAccess) {
    elements.quickAccess.toggleAttribute("hidden", allowedItems.length === 0);
  }

  allowedItems.forEach((item) => {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-access__button";
    button.setAttribute("data-quick-action", item.id);
    button.innerHTML = `
      <span class="quick-access__icon">
        <i data-lucide="${item.icon}"></i>
      </span>
      <span class="quick-access__content">
        <strong>${item.label}</strong>
        ${item.description ? `<small>${item.description}</small>` : ""}
      </span>
    `;
    button.addEventListener("click", () => {
      if (item.targetId) {
        const target = document.getElementById(item.targetId);
        if (target) {
          setActiveSection(target);
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          const navLabel = target.dataset.navLabel || "";
          if (navLabel && elements.navigation) {
            const navButton = Array.from(
              elements.navigation.querySelectorAll("button"),
            ).find((nav) => nav.textContent.trim() === navLabel);
            if (navButton) {
              setActiveNavButton(navButton);
            }
          }
        }
      }
      if (typeof item.action === "function") {
        item.action();
      }
    });
    listItem.append(button);
    elements.quickAccessList.append(listItem);
  });

  refreshIcons();
}

function setActiveNavButton(activeButton) {
  if (!elements.navigation) return;
  elements.navigation
    .querySelectorAll("button")
    .forEach((button) => button.classList.remove("active"));
  if (activeButton) activeButton.classList.add("active");
}

function setActiveSection(section) {
  document
    .querySelectorAll("[data-nav-label]")
    .forEach((candidate) => candidate.classList.remove("is-targeted"));
  if (section) section.classList.add("is-targeted");
}

function renderAllSections() {
  if (!currentUser) return;
  updateHeaderStats();
  updateHighlights();
  renderSidebarUserCard(currentUser);
  buildQuickAccess(currentUser.role);
  updateUserManagementControls();
  if (currentUser.role === "administrador") {
    renderUserSyncStatus();
    renderUserSummary();
    renderUserTable();
    renderAdminActivityList();
  } else {
    renderUserSyncStatus();
    clearAdminSections();
  }
  if (currentUser.role === "docente") {
    renderTeacherPendingActivities();
    renderTeacherProgress();
  } else {
    if (elements.teacherPendingActivities)
      elements.teacherPendingActivities.innerHTML = "";
    if (elements.teacherProgressSummary)
      elements.teacherProgressSummary.innerHTML = "";
  }
  if (currentUser.role === "auxiliar") {
    renderAuxiliarActivities();
  } else if (elements.auxiliarActivityList) {
    elements.auxiliarActivityList.innerHTML = "";
  }
  updateCharts();
  refreshIcons();
}

function renderSidebarUserCard(user) {
  if (elements.sidebarName) elements.sidebarName.textContent = user.name;
  if (elements.sidebarEmail) {
    const emailCandidates = [user.potroEmail, user.institutionalEmail];
    if (user.email) {
      const normalizedEmail = normalizeEmail(user.email);
      const alreadyPresent = emailCandidates.some(
        (candidate) => normalizeEmail(candidate) === normalizedEmail,
      );
      if (!alreadyPresent) {
        emailCandidates.push(user.email);
      }
    }
    const emails = emailCandidates.filter(Boolean).join(" • ");
    elements.sidebarEmail.textContent = emails;
  }
  if (elements.sidebarCareer) {
    const details = [
      CAREER_LABELS[user.career] || "Coordinación general",
      user.controlNumber ? `No. control: ${user.controlNumber}` : "",
    ]
      .filter(Boolean)
      .join(" • ");
    elements.sidebarCareer.textContent = details;
  }
}

function handleUserSearchInput(event) {
  const value = String(event.target.value || "");
  userFilters.search = value.trim().toLowerCase();
  renderUserTable();
}

function handleUserRoleFilterChange(event) {
  userFilters.role = event.target.value || "all";
  renderUserTable();
}

function handleUserCareerFilterChange(event) {
  userFilters.career = event.target.value || "all";
  renderUserTable();
}

function handleUserAuthFilterChange(event) {
  userFilters.auth = event.target.value || "all";
  renderUserTable();
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

function areUserFiltersActive() {
  return (
    Boolean(userFilters.search) ||
    userFilters.role !== "all" ||
    userFilters.career !== "all" ||
    userFilters.auth !== "all"
  );
}

function getFilteredUsers() {
  const searchTerm = userFilters.search;
  return users.filter((user) => {
    if (userFilters.role !== "all" && user.role !== userFilters.role) {
      return false;
    }
    if (userFilters.career !== "all" && user.career !== userFilters.career) {
      return false;
    }
    if (userFilters.auth === "allowed" && !user.allowExternalAuth) {
      return false;
    }
    if (userFilters.auth === "restricted" && user.allowExternalAuth) {
      return false;
    }
    if (searchTerm) {
      const haystack = [
        user.name,
        user.id,
        user.controlNumber,
        user.potroEmail,
        user.institutionalEmail,
        user.email,
        user.phone,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      if (!haystack.includes(searchTerm)) {
        return false;
      }
    }
    return true;
  });
}

function renderUserTableMeta(filteredUsers) {
  if (!elements.userTableMeta) return;
  if (!currentUser || currentUser.role !== "administrador") {
    elements.userTableMeta.textContent = "";
    elements.userTableMeta.classList.remove("error");
    return;
  }

  elements.userTableMeta.classList.remove("error");

  if (firestoreUsersError) {
    elements.userTableMeta.textContent = firestoreUsersError;
    elements.userTableMeta.classList.add("error");
    return;
  }

  if (!firestoreUsersLoaded && firestoreUsersLoading) {
    elements.userTableMeta.textContent =
      "Sincronizando usuarios con Firebase…";
    return;
  }

  if (!users.length) {
    elements.userTableMeta.textContent =
      "No hay usuarios registrados todavía.";
    return;
  }

  if (!filteredUsers.length) {
    elements.userTableMeta.textContent = areUserFiltersActive()
      ? "No se encontraron usuarios con los filtros aplicados."
      : "No hay usuarios registrados con los criterios seleccionados.";
    return;
  }

  if (!areUserFiltersActive()) {
    elements.userTableMeta.textContent = `Mostrando ${filteredUsers.length} usuarios.`;
  } else {
    elements.userTableMeta.textContent = `Mostrando ${filteredUsers.length} de ${users.length} usuarios.`;
  }
}

function renderUserSummary() {
  if (!elements.userSummaryGrid) return;
  if (!currentUser || currentUser.role !== "administrador") {
    elements.userSummaryGrid.innerHTML = "";
    return;
  }

  if (!firestoreUsersLoaded && firestoreUsersLoading && !users.length) {
    elements.userSummaryGrid.innerHTML = `
      <div class="user-summary-empty">
        <i data-lucide="loader-2"></i>
        <span>Sincronizando usuarios con Firebase…</span>
      </div>
    `;
    refreshIcons();
    return;
  }

  if (!users.length) {
    const emptyIcon = firestoreUsersError ? "alert-triangle" : "users";
    const emptyMessage = firestoreUsersError
      ? escapeHtml(firestoreUsersError)
      : "Agrega docentes desde Firebase o importa la plantilla de Ing. en Software.";
    elements.userSummaryGrid.innerHTML = `
      <div class="user-summary-empty">
        <i data-lucide="${emptyIcon}"></i>
        <span>${emptyMessage}</span>
      </div>
    `;
    refreshIcons();
    return;
  }

  const totalUsers = users.length;
  const adminCount = users.filter((user) => user.role === "administrador").length;
  const docenteCount = users.filter((user) => user.role === "docente").length;
  const auxiliarCount = users.filter((user) => user.role === "auxiliar").length;
  const externalCount = users.filter((user) => user.allowExternalAuth).length;
  const externalPercent = totalUsers
    ? Math.round((externalCount / totalUsers) * 100)
    : 0;
  const totalSegments = [
    `Admins ${adminCount}`,
    `Docentes ${docenteCount}`,
    `Auxiliares ${auxiliarCount}`,
  ];
  if (importedTeachersCount) {
    totalSegments.push(`${importedTeachersCount} importados`);
  }

  const careerNames = Array.from(
    new Set(
      users
        .map((user) => CAREER_LABELS[user.career] || null)
        .filter(Boolean),
    ),
  );

  const programHelper =
    careerNames.length === 0
      ? "Asigna carreras al registrar cada usuario."
      : careerNames.length > 2
      ? `${careerNames.slice(0, 2).join(", ")} +${careerNames.length - 2}`
      : careerNames.join(", ");

  const summaryItems = [
    {
      icon: "users",
      label: "Usuarios totales",
      value: totalUsers,
      helper: totalSegments.join(" • "),
    },
    {
      icon: "share-2",
      label: "Acceso externo",
      value: externalCount,
      helper:
        externalCount > 0
          ? `${externalPercent}% con inicio externo`
          : "Restringido a cuentas institucionales",
    },
    {
      icon: "map-pin",
      label: "Programas atendidos",
      value: careerNames.length,
      helper: programHelper,
    },
  ];

  elements.userSummaryGrid.innerHTML = summaryItems
    .map(
      (item) => `
        <article class="user-summary-card">
          <span class="user-summary-icon">
            <i data-lucide="${item.icon}"></i>
          </span>
          <div class="user-summary-content">
            <span class="user-summary-label">${escapeHtml(item.label)}</span>
            <span class="user-summary-value">${escapeHtml(String(item.value))}</span>
            ${
              item.helper
                ? `<span class="user-summary-helper">${escapeHtml(item.helper)}</span>`
                : ""
            }
          </div>
        </article>
      `,
    )
    .join("");
  refreshIcons();
}

function renderUserSyncStatus() {
  if (!elements.userSyncStatus) return;
  if (!currentUser || currentUser.role !== "administrador") {
    elements.userSyncStatus.textContent = "";
    elements.userSyncStatus.className = "user-sync-status";
    return;
  }

  let statusClass = "user-sync-status";
  let message = "";

  if (firestoreUsersError) {
    statusClass += " error";
    message = firestoreUsersError;
  } else if (firestoreUsersLoading && !firestoreUsersLoaded) {
    statusClass += " loading";
    message = "Sincronizando usuarios con Firebase…";
  } else if (firestoreUsersLoaded) {
    statusClass += " success";
    if (firestoreUsersLastUpdated) {
      const formattedTime = formatSyncTime(firestoreUsersLastUpdated);
      message = formattedTime
        ? `Usuarios sincronizados con Firebase. Actualizado a las ${formattedTime} h.`
        : "Usuarios sincronizados con Firebase.";
    } else {
      message = "Usuarios sincronizados con Firebase.";
    }
  } else {
    statusClass += " muted";
    message = "Configura Firebase para sincronizar los usuarios.";
  }

  elements.userSyncStatus.textContent = message;
  elements.userSyncStatus.className = statusClass;
}

function renderUserTable() {
  if (!elements.userTableContainer) return;
  if (!currentUser || currentUser.role !== "administrador") {
    elements.userTableContainer.innerHTML = "";
    renderUserTableMeta([]);
    return;
  }

  if (!firestoreUsersLoaded && firestoreUsersLoading && !users.length) {
    elements.userTableContainer.innerHTML =
      '<div class="loading-state">Sincronizando usuarios con Firebase…</div>';
    renderUserTableMeta([]);
    refreshIcons();
    return;
  }

  const filteredUsers = getFilteredUsers();
  renderUserTableMeta(filteredUsers);

  if (!users.length) {
    elements.userTableContainer.innerHTML =
      '<p class="empty-state">Conecta con Firebase o agrega nuevos usuarios para comenzar.</p>';
    refreshIcons();
    return;
  }

  if (!filteredUsers.length) {
    elements.userTableContainer.innerHTML =
      '<p class="empty-state">No se encontraron usuarios con los filtros seleccionados.</p>';
    refreshIcons();
    return;
  }

  const allowManagement = isPrimaryAdmin(currentUser);
  const sortedUsers = filteredUsers
    .slice()
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "es", {
        sensitivity: "base",
      }),
    );

  const rows = sortedUsers
    .map((user) => {
      const badgeClass = ROLE_BADGE_CLASS[user.role] || "badge";
      const roleLabel = ROLE_LABELS[user.role] || "—";
      const identityKeys = getUserIdentityKeys(user);
      const datasetKey = encodeURIComponent(
        identityKeys[0] || `index:${users.indexOf(user)}`,
      );
      const externalBadge = user.allowExternalAuth
        ? '<span class="badge external">Permitido</span>'
        : '<span class="badge external off">Solo institucional</span>';
      const actionsCell = allowManagement
        ? `
          <td class="actions-cell">
            <div class="table-actions">
              <button type="button" class="icon-button edit-user" data-action="edit" data-user-key="${datasetKey}" aria-label="Editar usuario">
                <i data-lucide="pencil"></i>
              </button>
              <button type="button" class="icon-button danger delete-user" data-action="delete" data-user-key="${datasetKey}" aria-label="Eliminar usuario">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        `
        : "";

      return `
        <tr>
          <td>${escapeHtml(user.name || "—")}</td>
          <td>${escapeHtml(user.id || "—")}</td>
          <td>${escapeHtml(user.controlNumber || "—")}</td>
          <td>${escapeHtml(user.potroEmail || "—")}</td>
          <td>${escapeHtml(user.institutionalEmail || "—")}</td>
          <td>${escapeHtml(CAREER_LABELS[user.career] || "—")}</td>
          <td><span class="${badgeClass}">${escapeHtml(roleLabel)}</span></td>
          <td>${externalBadge}</td>
          <td>${escapeHtml(user.phone || "—")}</td>
          ${actionsCell}
        </tr>
      `;
    })
    .join("");

  const headerActions = allowManagement
    ? '<th class="actions-col">Acciones</th>'
    : "";

  elements.userTableContainer.innerHTML = `
    <table class="user-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>ID</th>
          <th>Número de control</th>
          <th>Correo Potro</th>
          <th>Correo institucional</th>
          <th>Carrera</th>
          <th>Rol</th>
          <th>Acceso externo</th>
          <th>Celular</th>
          ${headerActions}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  refreshIcons();
}

function updateUserManagementControls() {
  const isPrimary = Boolean(currentUser && isPrimaryAdmin(currentUser));
  if (elements.startAddUserBtn) {
    elements.startAddUserBtn.hidden = !isPrimary;
  }
  if (!isPrimary) {
    hideUserForm({ reset: true });
    hideMessage(elements.userFormAlert);
  }
}

function handleStartAddUser() {
  if (!currentUser || !isPrimaryAdmin(currentUser)) return;
  editingUserKey = null;
  openUserForm("create");
}

function handleUserTableClick(event) {
  if (!currentUser || !isPrimaryAdmin(currentUser)) return;
  const button = event.target.closest("button[data-action][data-user-key]");
  if (!button) return;
  const encodedKey = button.dataset.userKey || "";
  const userKey = decodeURIComponent(encodedKey);
  if (!userKey) {
    showMessage(
      elements.userFormAlert,
      "No fue posible identificar al usuario seleccionado.",
    );
    return;
  }

  if (button.dataset.action === "edit") {
    startEditUser(userKey);
  } else if (button.dataset.action === "delete") {
    requestUserDeletion(userKey);
  }
}

function openUserForm(mode, record = null) {
  if (!elements.userForm) return;
  const isEdit = mode === "edit";
  elements.userForm.hidden = false;
  elements.userForm.dataset.mode = mode;
  if (!isEdit) {
    elements.userForm.reset();
    if (elements.userAllowExternalAuthInput) {
      elements.userAllowExternalAuthInput.checked = false;
    }
  }
  if (elements.userFormTitle) {
    elements.userFormTitle.textContent = isEdit
      ? "Editar usuario"
      : "Agregar usuario";
  }
  if (elements.userFormDescription) {
    elements.userFormDescription.textContent = isEdit
      ? "Actualiza la información del miembro seleccionado."
      : "Registra un nuevo docente, administrador o auxiliar.";
  }
  if (elements.userFormSubmit) {
    elements.userFormSubmit.textContent = isEdit
      ? "Guardar cambios"
      : "Guardar usuario";
  }
  if (elements.cancelUserFormBtn) {
    elements.cancelUserFormBtn.hidden = false;
  }
  hideMessage(elements.userFormAlert);
  if (record) {
    populateUserForm(record);
  }
  if (elements.userNameInput) {
    elements.userNameInput.focus();
  }
}

function populateUserForm(record) {
  if (!record) return;
  if (elements.userNameInput) elements.userNameInput.value = record.name || "";
  if (elements.userIdInput) elements.userIdInput.value = record.id || "";
  if (elements.userControlNumberInput)
    elements.userControlNumberInput.value = record.controlNumber || "";
  if (elements.userPotroEmailInput)
    elements.userPotroEmailInput.value = record.potroEmail || "";
  if (elements.userInstitutionalEmailInput)
    elements.userInstitutionalEmailInput.value = record.institutionalEmail || "";
  if (elements.userAltEmailInput)
    elements.userAltEmailInput.value = record.email || "";
  if (elements.userPhoneInput) elements.userPhoneInput.value = record.phone || "";
  if (elements.userRoleSelect)
    elements.userRoleSelect.value = record.role || elements.userRoleSelect.value;
  if (elements.userCareerSelect)
    elements.userCareerSelect.value = record.career || elements.userCareerSelect.value;
  if (elements.userAllowExternalAuthInput)
    elements.userAllowExternalAuthInput.checked = Boolean(
      record.allowExternalAuth,
    );
}

function startEditUser(userKey) {
  if (!currentUser || !isPrimaryAdmin(currentUser)) return;
  const user = findUserByKey(userKey);
  if (!user) {
    showMessage(
      elements.userFormAlert,
      "No fue posible localizar el usuario seleccionado.",
    );
    return;
  }
  editingUserKey = userKey;
  openUserForm("edit", user);
}

function cancelUserForm() {
  hideUserForm({ reset: true });
  hideMessage(elements.userFormAlert);
}

function hideUserForm({ reset = false } = {}) {
  editingUserKey = null;
  if (!elements.userForm) return;
  if (reset) {
    elements.userForm.reset();
    if (elements.userAllowExternalAuthInput) {
      elements.userAllowExternalAuthInput.checked = false;
    }
  }
  elements.userForm.hidden = true;
  delete elements.userForm.dataset.mode;
  if (elements.cancelUserFormBtn) {
    elements.cancelUserFormBtn.hidden = true;
  }
}

async function handleUserFormSubmit(event) {
  event.preventDefault();
  if (!currentUser || !isPrimaryAdmin(currentUser)) return;
  if (!elements.userForm) return;

  const formData = new FormData(elements.userForm);
  const allowExternalAuth = formData.get("allowExternalAuth") === "on";
  const rawRecord = {
    id: formData.get("id"),
    name: formData.get("name"),
    controlNumber: formData.get("controlNumber"),
    potroEmail: formData.get("potroEmail"),
    institutionalEmail: formData.get("institutionalEmail"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    career: formData.get("career"),
    allowExternalAuth,
  };

  const candidate = createUserRecord(rawRecord);
  candidate.allowExternalAuth = allowExternalAuth;

  if (!candidate.name) {
    showMessage(elements.userFormAlert, "Ingresa el nombre completo del usuario.");
    return;
  }
  if (!ROLE_LABELS[candidate.role]) {
    showMessage(elements.userFormAlert, "Selecciona un rol válido para el usuario.");
    return;
  }
  if (!CAREER_LABELS[candidate.career]) {
    showMessage(elements.userFormAlert, "Selecciona una carrera válida para el usuario.");
    return;
  }
  const hasIdentifier = [
    candidate.id,
    candidate.controlNumber,
    candidate.potroEmail,
    candidate.institutionalEmail,
    candidate.email,
  ].some((value) => String(value || "").trim().length);
  if (!hasIdentifier) {
    showMessage(
      elements.userFormAlert,
      "Proporciona al menos un identificador: ID, número de control o correo.",
    );
    return;
  }

  const ignoreKey = editingUserKey;
  ensureUserId(candidate, ignoreKey);

  if (hasUserConflict(candidate, ignoreKey)) {
    showMessage(
      elements.userFormAlert,
      "Ya existe un usuario con la misma información de identificación.",
    );
    return;
  }

  const isEdit = Boolean(editingUserKey);
  let recordToPersist = null;

  if (isEdit) {
    const index = findUserIndexByKey(editingUserKey);
    if (index < 0) {
      showMessage(
        elements.userFormAlert,
        "No fue posible actualizar la información del usuario.",
      );
      return;
    }
    const existingUser = users[index];
    recordToPersist = { ...existingUser, ...candidate, updatedAt: new Date().toISOString() };
    users = users.map((user, idx) => (idx === index ? recordToPersist : user));
  } else {
    recordToPersist = {
      ...candidate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users = [...users, recordToPersist];
  }

  clearDeletedUserKeys(recordToPersist);

  persistUsersLocally();

  hideUserForm({ reset: true });
  renderAllSections();
  refreshCurrentUser();

  let alertType = "success";
  let alertMessage = isEdit
    ? "Usuario actualizado correctamente."
    : "Usuario agregado correctamente.";

  const persistenceResult = await persistUserChange(recordToPersist);
  if (persistenceResult.success) {
    alertMessage = isEdit
      ? "Usuario actualizado y sincronizado con Firebase."
      : "Usuario agregado y sincronizado con Firebase.";
  } else if (persistenceResult.reason === "missing-config") {
    alertType = "info";
    alertMessage = isEdit
      ? "Usuario actualizado. Configura Firebase para sincronizar los cambios."
      : "Usuario agregado. Configura Firebase para sincronizar los cambios.";
  } else if (persistenceResult.reason === "missing-id") {
    alertType = "info";
    alertMessage = isEdit
      ? "Usuario actualizado. Define un ID para sincronizar con Firebase."
      : "Usuario agregado. Define un ID para sincronizar con Firebase.";
  } else if (persistenceResult.reason === "permission-denied") {
    alertType = "error";
    alertMessage = isEdit
      ? "Usuario actualizado, pero tu cuenta no tiene permisos para sincronizar con Firebase. Revisa firebase/README.md para ajustar las reglas de seguridad."
      : "Usuario agregado, pero tu cuenta no tiene permisos para sincronizar con Firebase. Revisa firebase/README.md para ajustar las reglas de seguridad.";
  } else if (persistenceResult.reason === "error") {
    alertType = "error";
    alertMessage = isEdit
      ? "Usuario actualizado, pero no fue posible sincronizar con Firebase."
      : "Usuario agregado, pero no fue posible sincronizar con Firebase.";
  }

  showMessage(elements.userFormAlert, alertMessage, alertType);
  refreshIcons();
}

async function requestUserDeletion(userKey) {
  if (!currentUser || !isPrimaryAdmin(currentUser)) return;
  const user = findUserByKey(userKey);
  if (!user) {
    showMessage(
      elements.userFormAlert,
      "No fue posible localizar el usuario seleccionado.",
    );
    return;
  }

  const isPrimary = normalizeEmail(user.potroEmail) === PRIMARY_ADMIN_EMAIL_NORMALIZED;
  if (isPrimary) {
    showMessage(
      elements.userFormAlert,
      "No puedes eliminar la cuenta del administrador principal.",
    );
    return;
  }

  const isCurrentUser =
    currentUser &&
    getUserIdentityKeys(currentUser).some((key) =>
      getUserIdentityKeys(user).includes(key),
    );
  if (isCurrentUser) {
    showMessage(
      elements.userFormAlert,
      "No puedes eliminar tu propia cuenta desde esta sección.",
    );
    return;
  }

  const confirmed = window.confirm(
    `¿Eliminar a ${user.name || "este usuario"}? Esta acción no se puede deshacer.`,
  );
  if (!confirmed) {
    return;
  }

  const index = findUserIndexByKey(userKey);
  if (index < 0) {
    showMessage(
      elements.userFormAlert,
      "No fue posible eliminar al usuario seleccionado.",
    );
    return;
  }

  const identityKeys = getUserIdentityKeys(user);
  const identityKeySet = new Set(identityKeys);

  users = users.filter((candidate, idx) => {
    if (idx === index) {
      return false;
    }

    const candidateKeys = getUserIdentityKeys(candidate);
    return !candidateKeys.some((key) => identityKeySet.has(key));
  });

  registerDeletedUser(user);
  persistUsersLocally();
  hideUserForm({ reset: true });
  renderAllSections();

  let alertType = "success";
  let alertMessage = "Usuario eliminado correctamente.";

  const persistenceResult = await removeUserFromFirestore(user);
  if (persistenceResult.success) {
    alertMessage = "Usuario eliminado y sincronizado con Firebase.";
  } else if (persistenceResult.reason === "missing-config") {
    alertType = "info";
    alertMessage = "Usuario eliminado localmente. Configura Firebase para reflejar los cambios.";
  } else if (persistenceResult.reason === "missing-id") {
    alertType = "info";
    alertMessage = "Usuario eliminado. Asignar un ID permitiría sincronizar la eliminación con Firebase.";
  } else if (persistenceResult.reason === "permission-denied") {
    alertType = "error";
    alertMessage =
      "Usuario eliminado localmente, pero tu cuenta no tiene permisos para sincronizar con Firebase. Revisa firebase/README.md para ajustar las reglas de seguridad.";
  } else if (persistenceResult.reason === "error") {
    alertType = "error";
    alertMessage = "Usuario eliminado localmente, pero no se pudo sincronizar con Firebase.";
  }

  showMessage(elements.userFormAlert, alertMessage, alertType);
  refreshIcons();
}

function findUserIndexByKey(userKey) {
  if (!userKey) return -1;
  if (userKey.startsWith("index:")) {
    const index = Number(userKey.split(":")[1]);
    if (!Number.isNaN(index) && users[index]) {
      return index;
    }
  }
  return users.findIndex((user) => getUserIdentityKeys(user).includes(userKey));
}

function findUserByKey(userKey) {
  const index = findUserIndexByKey(userKey);
  return index >= 0 ? users[index] : null;
}

function hasUserConflict(candidate, ignoreKey = null) {
  const candidateKeys = getUserIdentityKeys(candidate);
  const activeCandidateKeys = candidateKeys.filter(
    (key) => !recentlyDeletedUserKeys.has(key),
  );

  if (!activeCandidateKeys.length) {
    return false;
  }

  return users.some((user) => {
    const userKeys = getUserIdentityKeys(user);
    if (ignoreKey && userKeys.includes(ignoreKey)) {
      return false;
    }
    return activeCandidateKeys.some((key) => userKeys.includes(key));
  });
}

function ensureUserId(record, ignoreKey = null) {
  let baseId = String(record.id || "").trim();
  if (!baseId && record.controlNumber) {
    baseId = String(record.controlNumber).trim();
  }
  if (!baseId) {
    const email =
      normalizeEmail(record.potroEmail) ||
      normalizeEmail(record.email) ||
      normalizeEmail(record.institutionalEmail);
    if (email) {
      baseId = email.split("@")[0];
    }
  }
  if (!baseId) {
    baseId = `user-${Date.now()}`;
  }
  baseId = baseId
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!baseId) {
    baseId = `user-${Date.now()}`;
  }

  let finalId = baseId;
  let attempt = 1;
  while (
    users.some((user) => {
      const userKeys = getUserIdentityKeys(user);
      if (ignoreKey && userKeys.includes(ignoreKey)) {
        return false;
      }
      return String(user.id || "").trim() === finalId;
    })
  ) {
    attempt += 1;
    finalId = `${baseId}-${attempt}`;
  }

  record.id = finalId;
  return record;
}

function renderAdminActivityList() {
  if (!elements.adminActivityList) return;
  if (!currentUser || currentUser.role !== "administrador") {
    elements.adminActivityList.innerHTML = "";
    return;
  }
  if (!activities.length) {
    elements.adminActivityList.innerHTML =
      '<p class="empty-state">Registra tu primera actividad para comenzar el seguimiento.</p>';
    return;
  }

  const sortedActivities = activities.slice().sort((a, b) => {
    const dateA = new Date(a.dueDate).getTime();
    const dateB = new Date(b.dueDate).getTime();
    return dateA - dateB;
  });

  const rows = sortedActivities
    .map((activity) => {
      const statusBadge = `status-badge status-${activity.status}`;
      const responsibleLabel = ROLE_LABELS[activity.responsibleRole] || "—";
      const email = activity.responsibleEmail
        ? `<br /><small>${activity.responsibleEmail}</small>`
        : "";
      const options = STATUS_ORDER.map((status) => {
        const selected = status === activity.status ? "selected" : "";
        return `<option value="${status}" ${selected}>${STATUS_LABELS[status]}</option>`;
      }).join("");

      return `
        <tr>
          <td>
            <strong>${activity.title}</strong>
            <br /><small>${activity.description || "Sin descripción"}</small>
          </td>
          <td>${CAREER_LABELS[activity.career] || "—"}</td>
          <td><span class="${statusBadge}">${STATUS_LABELS[activity.status]}</span></td>
          <td>${formatDate(activity.dueDate)}</td>
          <td>${responsibleLabel}${email}</td>
          <td>
            <select class="status-select" data-activity="${activity.id}">
              ${options}
            </select>
          </td>
          <td>
            <button class="ghost small" type="button" data-delete="${activity.id}">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  elements.adminActivityList.innerHTML = `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Actividad</th>
            <th>Carrera</th>
            <th>Estado</th>
            <th>Fecha límite</th>
            <th>Responsable</th>
            <th>Actualizar estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  elements.adminActivityList
    .querySelectorAll(".status-select")
    .forEach((select) => {
      select.addEventListener("change", (event) => {
        const activityId = event.target.dataset.activity;
        const newStatus = event.target.value;
        updateActivityStatus(activityId, newStatus, "admin");
      });
    });

  elements.adminActivityList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const activityId = event.currentTarget.dataset.delete;
      removeActivity(activityId);
    });
  });
}

function renderTeacherPendingActivities() {
  if (!elements.teacherPendingActivities) return;
  if (!currentUser || currentUser.role !== "docente") {
    elements.teacherPendingActivities.innerHTML = "";
    return;
  }
  const tasks = getActivitiesForRole("docente", currentUser)
    .filter((activity) => activity.status !== "completada")
    .sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0;
      if (Number.isNaN(dateA)) return 1;
      if (Number.isNaN(dateB)) return -1;
      return dateA - dateB;
    });

  if (!tasks.length) {
    elements.teacherPendingActivities.innerHTML =
      '<p class="empty-state">No tienes actividades por realizar en este momento.</p>';
    return;
  }

  elements.teacherPendingActivities.innerHTML = tasks
    .map((activity) => {
      return `
        <article class="activity-card status-${activity.status}">
          <header>
            <div>
              <h3>${activity.title}</h3>
              <p>${activity.description || "Sin descripción disponible."}</p>
            </div>
            <span class="status-badge status-${activity.status}">${STATUS_LABELS[activity.status]}</span>
          </header>
          <div class="activity-meta">
            <span><i data-lucide="calendar"></i>${formatDate(activity.dueDate)}</span>
            <span><i data-lucide="map-pin"></i>${
              CAREER_LABELS[activity.career] || "General"
            }</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTeacherProgress() {
  if (!elements.teacherProgressSummary) return;
  if (!currentUser || currentUser.role !== "docente") {
    elements.teacherProgressSummary.innerHTML = "";
    return;
  }

  const tasks = getActivitiesForRole("docente", currentUser);
  if (!tasks.length) {
    elements.teacherProgressSummary.innerHTML =
      '<p class="empty-state">Cuando tengas actividades asignadas podrás ver tu progreso aquí.</p>';
    return;
  }

  const totals = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  tasks.forEach((activity) => {
    if (typeof totals[activity.status] === "number") {
      totals[activity.status] += 1;
    }
  });

  const totalTasks = tasks.length;
  const completedCount = totals.completada || 0;
  const inProgressCount = totals.en_progreso || 0;
  const pendingCount = totals.pendiente || 0;
  const completionPercent = totalTasks
    ? Math.round((completedCount / totalTasks) * 100)
    : 0;

  const statusList = STATUS_ORDER.map((status) => {
    const count = totals[status] || 0;
    const percent = totalTasks ? Math.round((count / totalTasks) * 100) : 0;
    const activityLabel = count === 1 ? "actividad" : "actividades";
    return `
      <li class="teacher-progress__status-item">
        <span class="status-badge status-${status}">${
          STATUS_LABELS[status]
        }</span>
        <div class="teacher-progress__status-meta">
          <span class="teacher-progress__status-count">${count} ${activityLabel}</span>
          <span class="teacher-progress__status-percent">${percent}%</span>
        </div>
      </li>
    `;
  }).join("");

  const summaryText = `Tienes ${pendingCount} ${
    pendingCount === 1 ? "actividad pendiente" : "actividades pendientes"
  } y ${inProgressCount} ${
    inProgressCount === 1
      ? "actividad en progreso"
      : "actividades en progreso"
  }.`;

  elements.teacherProgressSummary.innerHTML = `
    <div class="teacher-progress__header">
      <div>
        <p class="teacher-progress__label">Avance general</p>
        <h3 class="teacher-progress__value">${completionPercent}% completado</h3>
      </div>
      <div class="teacher-progress__totals">
        <span><strong>${totalTasks}</strong> ${
    totalTasks === 1 ? "actividad" : "actividades"
  }</span>
        <span><strong>${completedCount}</strong> ${
    completedCount === 1 ? "completada" : "completadas"
  }</span>
      </div>
    </div>
    <div
      class="teacher-progress__bar"
      role="img"
      aria-label="Progreso completado ${completionPercent}%"
    >
      <span
        class="teacher-progress__bar-fill"
        style="width: ${completionPercent}%"
      ></span>
    </div>
    <p class="teacher-progress__summary">${summaryText}</p>
    <ul class="teacher-progress__status-list">${statusList}</ul>
  `;
}

function renderAuxiliarActivities() {
  if (!elements.auxiliarActivityList) return;
  if (!currentUser || currentUser.role !== "auxiliar") {
    elements.auxiliarActivityList.innerHTML = "";
    return;
  }
  const tasks = getActivitiesForRole("auxiliar", currentUser);
  if (!tasks.length) {
    elements.auxiliarActivityList.innerHTML =
      '<p class="empty-state">No tienes actividades asignadas en este momento.</p>';
    return;
  }
  elements.auxiliarActivityList.innerHTML = tasks
    .map((activity) => {
      const options = STATUS_ORDER.map((status) => {
        const selected = status === activity.status ? "selected" : "";
        return `<option value="${status}" ${selected}>${STATUS_LABELS[status]}</option>`;
      }).join("");
      return `
        <article class="activity-card status-${activity.status}">
          <header>
            <div>
              <h3>${activity.title}</h3>
              <p>${activity.description || "Sin descripción disponible."}</p>
            </div>
            <span class="status-badge status-${activity.status}">${STATUS_LABELS[activity.status]}</span>
          </header>
          <div class="activity-meta">
            <span><i data-lucide="calendar"></i>${formatDate(activity.dueDate)}</span>
            <span><i data-lucide="map-pin"></i>${CAREER_LABELS[activity.career] || "General"}</span>
          </div>
          <div class="activity-actions">
            <label for="status-${activity.id}">Actualizar estado</label>
            <select id="status-${activity.id}" data-activity="${activity.id}">
              ${options}
            </select>
          </div>
        </article>
      `;
    })
    .join("");

  elements.auxiliarActivityList.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", (event) => {
      const activityId = event.target.dataset.activity;
      const newStatus = event.target.value;
      updateActivityStatus(activityId, newStatus, "aux");
    });
  });
}

function clearAdminSections() {
  if (elements.userSummaryGrid) elements.userSummaryGrid.innerHTML = "";
  if (elements.userTableContainer) elements.userTableContainer.innerHTML = "";
  if (elements.userTableMeta) elements.userTableMeta.textContent = "";
  if (elements.adminActivityList) elements.adminActivityList.innerHTML = "";
  hideUserForm({ reset: true });
}

async function handleActivityFormSubmit(event) {
  event.preventDefault();
  if (!currentUser || currentUser.role !== "administrador") return;
  const formData = new FormData(event.target);
  const title = String(formData.get("title") || "").trim();
  const dueDate = String(formData.get("dueDate") || "").trim();
  if (!title || !dueDate) {
    showMessage(elements.adminActivityAlert, "Completa la información obligatoria.");
    return;
  }
  const newActivity = {
    id: generateId("act"),
    title,
    description: String(formData.get("description") || "").trim(),
    dueDate,
    career: formData.get("career") || "global",
    responsibleRole: formData.get("responsibleRole") || "docente",
    responsibleEmail: normalizeEmail(formData.get("responsibleEmail")),
    status: "pendiente",
    createdAt: new Date().toISOString(),
    createdBy: currentUser.potroEmail,
  };
  activities = [newActivity, ...activities];
  persistActivitiesLocally();
  event.target.reset();
  renderAllSections();
  showMessage(
    elements.adminActivityAlert,
    "Actividad registrada correctamente.",
    "success",
  );

  const persistenceResult = await persistActivityChange(newActivity);
  if (persistenceResult.success) {
    showMessage(
      elements.adminActivityAlert,
      "Actividad registrada y sincronizada con Firebase.",
      "success",
    );
  } else if (persistenceResult.reason === "missing-config") {
    showMessage(
      elements.adminActivityAlert,
      "Actividad registrada. Configura Firebase para sincronizar con Firestore.",
      "info",
    );
  } else if (persistenceResult.reason === "permission-denied") {
    showMessage(
      elements.adminActivityAlert,
      "Actividad registrada, pero tu cuenta no tiene permisos para sincronizar con Firebase. Revisa firebase/README.md para ajustar las reglas de seguridad.",
      "error",
    );
  } else if (persistenceResult.reason === "error") {
    showMessage(
      elements.adminActivityAlert,
      "Actividad registrada, pero no fue posible sincronizar con Firebase.",
      "error",
    );
  }
}

async function updateActivityStatus(activityId, newStatus, source) {
  if (!STATUS_ORDER.includes(newStatus)) return;
  const index = activities.findIndex((item) => item.id === activityId);
  if (index < 0) return;
  const previousActivity = { ...activities[index] };
  if (previousActivity.status === newStatus) return;

  const updatedActivity = {
    ...previousActivity,
    status: newStatus,
    updatedAt: new Date().toISOString(),
    updatedBy:
      currentUser?.potroEmail ||
      currentUser?.email ||
      previousActivity.updatedBy ||
      "",
  };

  activities[index] = updatedActivity;
  persistActivitiesLocally();
  renderAllSections();

  let feedbackElement = null;
  let initialMessage = "";
  if (source === "admin") {
    feedbackElement = elements.adminActivityAlert;
    initialMessage = "Estado actualizado.";
  } else if (source === "aux") {
    feedbackElement = elements.auxiliarActivityAlert;
    initialMessage = "Actividad actualizada correctamente.";
  }

  if (feedbackElement && initialMessage) {
    showMessage(feedbackElement, initialMessage, "success");
  }

  const persistenceResult = await persistActivityChange(updatedActivity);
  if (persistenceResult.success) {
    if (feedbackElement) {
      const successMessage =
        source === "admin"
          ? "Estado actualizado y sincronizado con Firebase."
          : "Actividad actualizada y sincronizada correctamente.";
      showMessage(feedbackElement, successMessage, "success");
    }
    return;
  }

  if (persistenceResult.reason === "missing-config") {
    if (feedbackElement) {
      const infoMessage =
        source === "admin"
          ? "Estado actualizado. Configura Firebase para sincronizar."
          : "Actividad actualizada. Configura Firebase para sincronizar.";
      showMessage(feedbackElement, infoMessage, "info");
    }
    return;
  }

  if (persistenceResult.reason === "permission-denied") {
    activities[index] = previousActivity;
    persistActivitiesLocally();
    renderAllSections();
    if (feedbackElement) {
      const errorMessage =
        source === "admin"
          ? "Tu cuenta no tiene permisos para sincronizar con Firebase. Revisa firebase/README.md y el cambio se revirtió."
          : "Tu cuenta no tiene permisos para sincronizar con Firebase. Revisa firebase/README.md y el cambio se revirtió.";
      showMessage(feedbackElement, errorMessage, "error");
    }
    return;
  }

  activities[index] = previousActivity;
  persistActivitiesLocally();
  renderAllSections();
  if (feedbackElement) {
    const errorMessage =
      source === "admin"
        ? "No fue posible sincronizar con Firebase. El cambio se revirtió."
        : "No fue posible sincronizar con Firebase. El cambio se revirtió.";
    showMessage(feedbackElement, errorMessage, "error");
  }
}

async function removeActivity(activityId) {
  const index = activities.findIndex((activity) => activity.id === activityId);
  if (index < 0) return;

  const originalActivities = activities.slice();
  const updatedActivities = originalActivities.slice();
  const [removedActivity] = updatedActivities.splice(index, 1);
  if (!removedActivity) {
    return;
  }
  activities = updatedActivities;
  persistActivitiesLocally();
  renderAllSections();
  showMessage(elements.adminActivityAlert, "Actividad eliminada.", "info");

  const persistenceResult = await removeActivityFromFirestore(removedActivity);
  if (persistenceResult.success) {
    showMessage(
      elements.adminActivityAlert,
      "Actividad eliminada y sincronizada con Firebase.",
      "success",
    );
    return;
  }

  if (persistenceResult.reason === "missing-config") {
    showMessage(
      elements.adminActivityAlert,
      "Actividad eliminada localmente. Configura Firebase para sincronizar.",
      "info",
    );
    return;
  }

  if (persistenceResult.reason === "permission-denied") {
    activities = originalActivities;
    persistActivitiesLocally();
    renderAllSections();
    showMessage(
      elements.adminActivityAlert,
      "Tu cuenta no tiene permisos para sincronizar con Firebase. Revisa firebase/README.md; la eliminación se revirtió.",
      "error",
    );
    return;
  }

  activities = originalActivities;
  persistActivitiesLocally();
  renderAllSections();
  showMessage(
    elements.adminActivityAlert,
    "No fue posible eliminar la actividad en Firebase. El cambio se revirtió.",
    "error",
  );
}

async function persistImportedUsers(records) {
  if (!Array.isArray(records) || !records.length) {
    return { success: true };
  }

  const db = getFirestoreDb();
  if (!db) {
    return { success: false, reason: "missing-config" };
  }

  try {
    const batch = writeBatch(db);
    records.forEach((record) => {
      const resolvedId =
        resolveUserDocumentId(record) || record.controlNumber || generateId("user");
      const documentId = String(resolvedId || "").trim();
      if (!documentId) {
        return;
      }

      const docRef = doc(db, "users", documentId);
      const payload = buildFirestoreUserPayload({
        ...record,
        id: record.id || documentId,
      });

      batch.set(docRef, payload, { merge: true });
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Error al sincronizar usuarios con Firebase:", error);
    if (isPermissionDeniedError(error)) {
      return { success: false, reason: "permission-denied", error };
    }
    return { success: false, reason: "error", error };
  }
}

async function persistUserChange(record) {
  if (!record) {
    return { success: true };
  }

  const db = getFirestoreDb();
  if (!db) {
    return { success: false, reason: "missing-config" };
  }

  const documentIdCandidate = resolveUserDocumentId(record);
  const documentId = String(documentIdCandidate || "").trim();
  if (!documentId) {
    return { success: false, reason: "missing-id" };
  }

  try {
    const docRef = doc(db, "users", documentId);
    const payload = buildFirestoreUserPayload({ ...record, id: record.id || documentId });
    await setDoc(docRef, payload, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("No fue posible sincronizar el usuario con Firebase:", error);
    if (isPermissionDeniedError(error)) {
      return { success: false, reason: "permission-denied", error };
    }
    return { success: false, reason: "error", error };
  }
}

async function removeUserFromFirestore(record) {
  if (!record) {
    return { success: true };
  }

  const db = getFirestoreDb();
  if (!db) {
    return { success: false, reason: "missing-config" };
  }

  const documentId = resolveUserDocumentId(record);
  if (!documentId) {
    return { success: false, reason: "missing-id" };
  }

  try {
    await deleteDoc(doc(db, "users", documentId));
    return { success: true };
  } catch (error) {
    console.error("No fue posible eliminar el usuario de Firebase:", error);
    if (isPermissionDeniedError(error)) {
      return { success: false, reason: "permission-denied", error };
    }
    return { success: false, reason: "error", error };
  }
}

async function persistActivityChange(record) {
  if (!record) {
    return { success: true };
  }

  const db = getFirestoreDb();
  if (!db) {
    return { success: false, reason: "missing-config" };
  }

  const documentId = resolveActivityDocumentId(record);
  if (!documentId) {
    return { success: false, reason: "missing-id" };
  }

  try {
    const batch = writeBatch(db);
    const docRef = doc(collection(db, "activities"), documentId);
    const payload = buildFirestoreActivityPayload({
      ...record,
      id: record.id || documentId,
    });
    batch.set(docRef, payload, { merge: true });
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("No fue posible sincronizar la actividad con Firebase:", error);
    if (isPermissionDeniedError(error)) {
      return { success: false, reason: "permission-denied", error };
    }
    return { success: false, reason: "error", error };
  }
}

async function removeActivityFromFirestore(record) {
  if (!record) {
    return { success: true };
  }

  const db = getFirestoreDb();
  if (!db) {
    return { success: false, reason: "missing-config" };
  }

  const documentId = resolveActivityDocumentId(record);
  if (!documentId) {
    return { success: false, reason: "missing-id" };
  }

  try {
    await deleteDoc(doc(db, "activities", documentId));
    return { success: true };
  } catch (error) {
    console.error("No fue posible eliminar la actividad de Firebase:", error);
    if (isPermissionDeniedError(error)) {
      return { success: false, reason: "permission-denied", error };
    }
    return { success: false, reason: "error", error };
  }
}

function buildFirestoreUserPayload(record) {
  const payload = {
    id: record.id || "",
    name: record.name || "",
    userId: record.id || "",
    controlNumber: record.controlNumber || "",
    potroEmail: record.potroEmail || "",
    institutionalEmail: record.institutionalEmail || "",
    email: record.email || "",
    phone: record.phone || "",
    role: record.role || "",
    career: record.career || "",
    syncedAt: serverTimestamp(),
  };

  if (record.firebaseUid) {
    payload.firebaseUid = record.firebaseUid;
  }

  if (typeof record.allowExternalAuth === "boolean") {
    payload.allowExternalAuth = record.allowExternalAuth;
  }

  if (record.importedAt) {
    payload.importedAtIso = record.importedAt;
  }

  if (record.createdAt) {
    payload.createdAtIso = record.createdAt;
  }

  if (record.updatedAt) {
    payload.updatedAtIso = record.updatedAt;
  }

  return payload;
}

function resolveUserDocumentId(record) {
  if (!record) return null;
  const candidates = [
    record.id,
    record.userId,
    record.controlNumber,
    record.potroEmail,
    record.email,
    record.institutionalEmail,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) {
      if (value.includes("@")) {
        const normalized = normalizeEmail(value);
        if (normalized) {
          return normalized;
        }
      }
      return value;
    }
  }

  return null;
}

function buildFirestoreActivityPayload(record) {
  const payload = {
    activityId: record.id || "",
    title: record.title || "",
    description: record.description || "",
    dueDate: record.dueDate || "",
    career: record.career || "global",
    responsibleRole: record.responsibleRole || "",
    responsibleEmail: record.responsibleEmail
      ? normalizeEmail(record.responsibleEmail)
      : "",
    status: STATUS_ORDER.includes(record.status) ? record.status : "pendiente",
    syncedAt: serverTimestamp(),
  };

  if (record.createdAt) {
    payload.createdAtIso = record.createdAt;
  }

  if (record.createdBy) {
    payload.createdBy = record.createdBy;
  }

  if (record.updatedAt) {
    payload.updatedAtIso = record.updatedAt;
  }

  if (record.updatedBy) {
    payload.updatedBy = record.updatedBy;
  }

  return payload;
}

function resolveActivityDocumentId(record) {
  if (!record) return null;

  const candidates = [
    record.id,
    record.activityId,
    record.documentId,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }

  if (record.title && record.dueDate) {
    return `${String(record.title).trim()}|${String(record.dueDate).trim()}`;
  }

  return null;
}

function createActivityRecord(raw) {
  const toTrimmedString = (value) => String(value ?? "").trim();
  const status = STATUS_ORDER.includes(raw.status)
    ? raw.status
    : "pendiente";

  return {
    id:
      toTrimmedString(
        raw.id || raw.activityId || raw.activity_id || raw.documentId || "",
      ) || null,
    title: toTrimmedString(raw.title || ""),
    description: toTrimmedString(raw.description || ""),
    dueDate: toTrimmedString(raw.dueDate || raw.due_date || ""),
    career: toTrimmedString(raw.career || "global") || "global",
    responsibleRole: toTrimmedString(raw.responsibleRole || raw.role || ""),
    responsibleEmail:
      normalizeEmail(raw.responsibleEmail || raw.assignedTo || raw.assigneeEmail) ||
      "",
    status,
    createdAt: toTrimmedString(
      raw.createdAt || raw.createdAtIso || raw.created_at || "",
    ),
    createdBy: toTrimmedString(raw.createdBy || raw.created_by || ""),
    updatedAt: toTrimmedString(
      raw.updatedAt || raw.updatedAtIso || raw.updated_at || "",
    ),
    updatedBy: toTrimmedString(raw.updatedBy || raw.updated_by || ""),
  };
}

async function importSoftwareTeachers() {
  const newTeachers = softwareTeacherImport.filter((teacher) => {
    const teacherEmail = normalizeEmail(teacher.potroEmail);
    if (teacherEmail === PRIMARY_ADMIN_EMAIL_NORMALIZED) {
      return false;
    }

    return !users.some(
      (user) =>
        normalizeEmail(user.potroEmail) === teacherEmail,
    );
  });
  if (!newTeachers.length) {
    showMessage(
      elements.importTeachersAlert,
      "Los docentes de Ing. en Software ya fueron importados.",
      "info",
    );
    return;
  }

  const teachersToAdd = newTeachers.map((teacher) => ({
    ...teacher,
    importedAt: new Date().toISOString(),
  }));

  users = [...users, ...teachersToAdd];
  teachersToAdd.forEach((teacher) => clearDeletedUserKeys(teacher));
  importedTeachersCount += teachersToAdd.length;
  persistUsersLocally();
  persistImportedTeachersCountLocally();
  renderAllSections();

  const persistenceResult = await persistImportedUsers(teachersToAdd);
  let alertType = "success";
  let alertMessage = `${teachersToAdd.length} docentes agregados correctamente.`;

  if (persistenceResult.success) {
    alertMessage = `${teachersToAdd.length} docentes agregados y sincronizados con Firebase.`;
  } else if (persistenceResult.reason === "missing-config") {
    alertType = "info";
    alertMessage = `${teachersToAdd.length} docentes agregados. Configura Firebase para sincronizar la información.`;
  } else if (persistenceResult.reason === "permission-denied") {
    alertType = "error";
    alertMessage = `${teachersToAdd.length} docentes agregados, pero tu cuenta no tiene permisos para sincronizar con Firebase. Revisa firebase/README.md para ajustar las reglas de seguridad.`;
  } else if (persistenceResult.reason === "error") {
    alertType = "error";
    alertMessage = `${teachersToAdd.length} docentes agregados, pero no fue posible sincronizar con Firebase.`;
  }

  showMessage(elements.importTeachersAlert, alertMessage, alertType);
  showMessage(
    elements.inviteAlert,
    "Comparte el acceso con los docentes recién importados.",
    "info",
  );
}

function subscribeToFirestoreUsers() {
  if (unsubscribeUsersListener || firestoreUsersLoading) {
    return;
  }

  const db = getFirestoreDb();
  if (!db) {
    firestoreUsersLoaded = true;
    firestoreUsersLoading = false;
    firestoreUsersError =
      "Configura Firebase para sincronizar los usuarios.";
    renderUserSyncStatus();
    renderUserTable();
    renderUserSummary();
    retryPendingLogin();
    return;
  }

  firestoreUsersLoading = true;
  firestoreUsersError = null;
  renderUserSyncStatus();

  const usersRef = collection(db, "users");
  const usersQuery = query(usersRef, orderBy("name", "asc"));

  unsubscribeUsersListener = onSnapshot(
    usersQuery,
    (snapshot) => {
      firestoreUsersLoaded = true;
      firestoreUsersLoading = false;
      firestoreUsersError = null;
      firestoreUsersLastUpdated = new Date();

      const remoteUsers = snapshot.docs
        .map((docSnapshot) => {
          const data = docSnapshot.data() || {};
          const candidate = createUserRecord({
            ...data,
            id: data.id || data.userId || docSnapshot.id || "",
          });

          if (!candidate.id) {
            candidate.id = docSnapshot.id;
          }

          return candidate;
        })
        .filter((user) => Boolean(user.name || user.potroEmail || user.email));

      users = remoteUsers;
      users.forEach((user) => clearDeletedUserKeys(user));
      persistUsersLocally();
      updateHeaderStats();
      updateHighlights();
      updateCharts();

      if (currentUser) {
        renderAllSections();
      } else {
        refreshIcons();
      }

      renderUserSyncStatus();
      retryPendingLogin();
    },
    (error) => {
      unsubscribeUsersListener = null;
      firestoreUsersLoaded = true;
      firestoreUsersLoading = false;
      firestoreUsersError = getFirestoreSyncErrorMessage(
        "los usuarios",
        error,
      );
      console.error(
        "No fue posible suscribirse a los usuarios de Firebase:",
        error,
      );

      renderUserSyncStatus();
      if (currentUser && currentUser.role === "administrador") {
        showMessage(
          elements.userFormAlert,
          firestoreUsersError,
          "error",
          null,
        );
        showMessage(
          elements.importTeachersAlert,
          firestoreUsersError,
          "error",
          null,
        );
      }

      renderUserTable();
      renderUserSummary();
      retryPendingLogin();
    },
  );
}

async function attemptLoadActivitiesFromFirestore() {
  if (firestoreActivitiesLoaded || firestoreActivitiesLoading) {
    return;
  }

  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  firestoreActivitiesLoading = true;

  try {
    const snapshot = await getDocs(collection(db, "activities"));
    if (snapshot.empty) {
      firestoreActivitiesLoaded = true;
      return;
    }

    const remoteActivities = snapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data() || {};
        const candidate = createActivityRecord({
          ...data,
          id: data.id || data.activityId || docSnapshot.id || "",
        });

        if (!candidate.id) {
          candidate.id = docSnapshot.id;
        }

        return candidate;
      })
      .filter((activity) => Boolean(activity.title));

    if (!remoteActivities.length) {
      firestoreActivitiesLoaded = true;
      return;
    }

    activities = remoteActivities;
    persistActivitiesLocally();
    firestoreActivitiesLoaded = true;
    if (currentUser) {
      renderAllSections();
    } else {
      updateHeaderStats();
      updateHighlights();
      updateCharts();
      refreshIcons();
    }
  } catch (error) {
    console.error("No fue posible obtener actividades de Firebase:", error);
    firestoreActivitiesLoaded = true;

    const syncMessage = getFirestoreSyncErrorMessage(
      "las actividades",
      error,
    );

    showMessage(elements.adminActivityAlert, syncMessage, "error", null);
    showMessage(elements.auxiliarActivityAlert, syncMessage, "error", null);

    if (currentUser) {
      renderAllSections();
    }
  } finally {
    firestoreActivitiesLoading = false;
  }
}

function refreshCurrentUser() {
  if (!currentUser) {
    return;
  }

  const updatedRecord = findUserByIdentity(currentUser);
  if (!updatedRecord) {
    renderAllSections();
    return;
  }

  currentUser = { ...updatedRecord, email: currentUser.email || updatedRecord.email };
  renderAllSections();
}

function findUserByIdentity(referenceUser) {
  if (!referenceUser) {
    return null;
  }

  const referenceKeys = getUserIdentityKeys(referenceUser);
  return (
    users.find((user) => {
      const userKeys = getUserIdentityKeys(user);
      return userKeys.some((key) => referenceKeys.includes(key));
    }) || null
  );
}

function getUserIdentityKeys(user) {
  const keys = [];
  if (user.id) keys.push(`id:${String(user.id).toLowerCase()}`);
  if (user.controlNumber)
    keys.push(`control:${String(user.controlNumber).toLowerCase()}`);

  const potro = normalizeEmail(user.potroEmail);
  if (potro) keys.push(`email:${potro}`);

  const institutional = normalizeEmail(user.institutionalEmail);
  if (institutional) keys.push(`email:${institutional}`);

  const email = normalizeEmail(user.email);
  if (email) keys.push(`email:${email}`);

  if (user.firebaseUid) keys.push(`uid:${String(user.firebaseUid)}`);
  if (user.uid) keys.push(`uid:${String(user.uid)}`);

  return Array.from(new Set(keys));
}

function registerDeletedUser(record) {
  if (!record) return;
  const keys = getUserIdentityKeys(record);
  keys.forEach((key) => recentlyDeletedUserKeys.add(key));
}

function clearDeletedUserKeys(record) {
  if (!record) return;
  const keys = getUserIdentityKeys(record);
  keys.forEach((key) => recentlyDeletedUserKeys.delete(key));
}

function retryPendingLogin() {
  if (!pendingFirebaseUser) {
    return;
  }

  if (!firestoreUsersLoaded) {
    return;
  }

  handleAuthStateChange(pendingFirebaseUser);
}

function updateHeaderStats() {
  const activeActivities = activities.filter(
    (activity) => activity.status !== "completada",
  ).length;
  if (elements.headerActiveTasks)
    elements.headerActiveTasks.textContent = String(activeActivities);
  if (elements.headerActiveUsers)
    elements.headerActiveUsers.textContent = String(users.length);
}

function updateHighlights() {
  const highlights = document.querySelectorAll(
    "#dashboardHighlights article",
  );
  if (!highlights.length) return;
  const totalCareers = new Set(users.map((user) => user.career)).size;
  const activeActivities = activities.filter(
    (activity) => activity.status !== "completada",
  ).length;
  const completedActivities = activities.filter(
    (activity) => activity.status === "completada",
  ).length;

  if (highlights[0]) {
    highlights[0].querySelector("p").textContent =
      `La plataforma cuenta con ${users.length} usuarios en ${totalCareers} programas.`;
  }
  if (highlights[1]) {
    highlights[1].querySelector("p").textContent =
      `${activeActivities} actividades requieren atención y ${completedActivities} ya se completaron.`;
  }
  if (highlights[2]) {
    highlights[2].querySelector("p").textContent =
      importedTeachersCount
        ? `Se incorporaron ${importedTeachersCount} docentes de Ing. en Software recientemente.`
        : "Integra nuevos docentes con plantillas precargadas.";
  }
}

function getActivitiesForRole(role, user) {
  return activities.filter((activity) => {
    if (activity.responsibleRole !== role) return false;
    if (!user) return false;
    if (activity.responsibleEmail) {
      return (
        activity.responsibleEmail.toLowerCase() ===
        normalizeEmail(user.potroEmail)
      );
    }
    if (activity.career === "global") return true;
    return activity.career === user.career;
  });
}

function normalizeEmail(value) {
  const email = String(value || "").trim();
  return email ? email.toLowerCase() : null;
}

function isPrimaryAdmin(user) {
  if (!user) return false;
  const candidates = [user.potroEmail, user.email, user.institutionalEmail];
  return candidates.some(
    (candidate) => normalizeEmail(candidate) === PRIMARY_ADMIN_EMAIL_NORMALIZED,
  );
}

function initCharts() {
  const usersCanvas = document.getElementById("usersChart");
  if (usersCanvas) {
    charts.users = new Chart(usersCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            label: "Usuarios",
            data: [],
            backgroundColor: [
              "rgba(37, 99, 235, 0.85)",
              "rgba(56, 189, 248, 0.85)",
              "rgba(125, 211, 252, 0.85)",
              "rgba(99, 102, 241, 0.85)",
            ],
            borderRadius: 12,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
          },
        },
      },
    });
  }

  const activitiesCanvas = document.getElementById("activitiesChart");
  if (activitiesCanvas) {
    charts.activities = new Chart(activitiesCanvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: STATUS_ORDER.map((status) => STATUS_LABELS[status]),
        datasets: [
          {
            data: [],
            backgroundColor: STATUS_ORDER.map((status) => STATUS_COLORS[status]),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  }
}

function updateCharts() {
  if (charts.users) {
    const careerKeys = Object.keys(CAREER_LABELS);
    charts.users.data.labels = careerKeys.map((key) => CAREER_LABELS[key]);
    charts.users.data.datasets[0].data = careerKeys.map((key) =>
      users.filter((user) => user.career === key).length,
    );
    charts.users.update();
  }
  if (charts.activities) {
    charts.activities.data.datasets[0].data = STATUS_ORDER.map((status) =>
      activities.filter((activity) => activity.status === status).length,
    );
    charts.activities.update();
  }
}

function showMessage(element, message, type = "error", duration = 4000) {
  if (!element) return;
  element.textContent = message;
  element.className = `alert ${type} show`;
  if (element.dataset.timeoutId) {
    clearTimeout(Number(element.dataset.timeoutId));
    delete element.dataset.timeoutId;
  }
  if (duration === null) {
    return;
  }
  const timeoutId = window.setTimeout(() => {
    element.classList.remove("show");
    delete element.dataset.timeoutId;
  }, duration);
  element.dataset.timeoutId = String(timeoutId);
}

function hideMessage(element) {
  if (!element) return;
  if (element.dataset.timeoutId) {
    clearTimeout(Number(element.dataset.timeoutId));
    delete element.dataset.timeoutId;
  }
  element.textContent = "";
  element.classList.remove("show");
}

function refreshIcons() {
  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
}

function formatSyncTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (error) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
