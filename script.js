import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFirestoreDb } from "./firebase-config.js";

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
    email: potroEmail || "",
  };
}

const initialUsers = [
  {
    id: "u-admin-1",
    name: "María Fernanda López",
    controlNumber: "A210001",
    potroEmail: "maria.lopez@potros.itson.edu.mx",
    institutionalEmail: "maria.lopez@itson.edu.mx",
    role: "administrador",
    career: "software",
    phone: "(644) 410 9034",
  },
  {
    id: "u-admin-2",
    name: "Gerardo Sánchez",
    controlNumber: "A210002",
    potroEmail: "gerardo.sanchez@potros.itson.edu.mx",
    institutionalEmail: "gerardo.sanchez@itson.edu.mx",
    role: "administrador",
    career: "global",
    phone: "(644) 410 9065",
  },
  {
    id: "u-doc-1",
    name: "Ana Martínez Rivera",
    controlNumber: "D220101",
    potroEmail: "ana.martinez@potros.itson.edu.mx",
    institutionalEmail: "ana.martinez@itson.edu.mx",
    role: "docente",
    career: "software",
    phone: "(644) 109 2234",
  },
  {
    id: "u-doc-2",
    name: "José Luis Romero",
    controlNumber: "D220102",
    potroEmail: "jose.romero@potros.itson.edu.mx",
    institutionalEmail: "jose.romero@itson.edu.mx",
    role: "docente",
    career: "manufactura",
    phone: "(644) 130 1190",
  },
  {
    id: "u-doc-3",
    name: "Patricia Estrada",
    controlNumber: "D220103",
    potroEmail: "patricia.estrada@potros.itson.edu.mx",
    institutionalEmail: "patricia.estrada@itson.edu.mx",
    role: "docente",
    career: "mecatronica",
    phone: "(644) 173 8765",
  },
  {
    id: "u-doc-4",
    name: "Elena Aguilar",
    controlNumber: "D220104",
    potroEmail: "elena.aguilar@potros.itson.edu.mx",
    institutionalEmail: "elena.aguilar@itson.edu.mx",
    role: "docente",
    career: "software",
    phone: "(644) 200 8810",
  },
  {
    id: "u-aux-1",
    name: "Laura Quintero",
    controlNumber: "X230201",
    potroEmail: "laura.quintero@potros.itson.edu.mx",
    institutionalEmail: "laura.quintero@itson.edu.mx",
    role: "auxiliar",
    career: "software",
    phone: "(644) 198 2234",
  },
  {
    id: "u-aux-2",
    name: "César Miranda",
    controlNumber: "X230202",
    potroEmail: "cesar.miranda@potros.itson.edu.mx",
    institutionalEmail: "cesar.miranda@itson.edu.mx",
    role: "auxiliar",
    career: "manufactura",
    phone: "(644) 204 6611",
  },
  {
    id: "u-aux-3",
    name: "Sofía Herrera",
    controlNumber: "X230203",
    potroEmail: "sofia.herrera@potros.itson.edu.mx",
    institutionalEmail: "sofia.herrera@itson.edu.mx",
    role: "auxiliar",
    career: "mecatronica",
    phone: "(644) 120 5543",
  },
].map(createUserRecord);

const softwareTeacherImport = [
  {
    id: "u-imp-1",
    name: "Isaac Paniagua",
    controlNumber: "D230201",
    potroEmail: "isaac.paniagua@potros.itson.edu.mx",
    institutionalEmail: "isaac.paniagua@itson.edu.mx",
    role: "docente",
    career: "software",
    phone: "(622) 107 2441",
  },
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

const initialActivities = [
  {
    id: "act-1",
    title: "Planeación de asignaturas agosto-diciembre",
    description:
      "Actualizar planeaciones con rúbricas revisadas por academia.",
    dueDate: "2024-08-05",
    career: "software",
    responsibleRole: "docente",
    responsibleEmail: "ana.martinez@potros.itson.edu.mx",
    status: "en_progreso",
  },
  {
    id: "act-2",
    title: "Seguimiento de tutorías estudiantiles",
    description: "Compilar reportes de tutorías de mitad de semestre.",
    dueDate: "2024-07-12",
    career: "global",
    responsibleRole: "docente",
    responsibleEmail: null,
    status: "pendiente",
  },
  {
    id: "act-3",
    title: "Capacitación de laboratorio de manufactura",
    description:
      "Coordinar la disponibilidad de laboratorios para la inducción de verano.",
    dueDate: "2024-06-28",
    career: "manufactura",
    responsibleRole: "auxiliar",
    responsibleEmail: "cesar.miranda@potros.itson.edu.mx",
    status: "en_progreso",
  },
  {
    id: "act-4",
    title: "Actualización de convenios duales",
    description: "Documentar renovaciones con la industria automotriz.",
    dueDate: "2024-07-30",
    career: "mecatronica",
    responsibleRole: "administrador",
    responsibleEmail: "gerardo.sanchez@potros.itson.edu.mx",
    status: "pendiente",
  },
  {
    id: "act-5",
    title: "Reporte mensual de desempeño docente",
    description:
      "Compilar indicadores de desempeño y ausentismo para dirección académica.",
    dueDate: "2024-06-20",
    career: "global",
    responsibleRole: "administrador",
    responsibleEmail: "maria.lopez@potros.itson.edu.mx",
    status: "completada",
  },
  {
    id: "act-6",
    title: "Soporte a aulas híbridas",
    description:
      "Verificar equipos y conectividad antes de la semana de exámenes finales.",
    dueDate: "2024-06-18",
    career: "software",
    responsibleRole: "auxiliar",
    responsibleEmail: "laura.quintero@potros.itson.edu.mx",
    status: "pendiente",
  },
  {
    id: "act-7",
    title: "Evaluación intermedia de proyectos integradores",
    description: "Recolectar rúbricas y comentarios de los proyectos de software.",
    dueDate: "2024-07-05",
    career: "software",
    responsibleRole: "docente",
    responsibleEmail: "elena.aguilar@potros.itson.edu.mx",
    status: "en_progreso",
  },
];

let users = initialUsers.map((user) => ({ ...user }));
let activities = initialActivities.map((activity) => ({ ...activity }));
let currentUser = null;
let importedTeachersCount = 0;

const charts = {
  users: null,
  activities: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheDomElements();
  updateLayoutMode();
  scheduleHeaderSync();
  window.addEventListener("resize", scheduleHeaderSync);
  window.addEventListener("orientationchange", scheduleHeaderSync);
  hideLoader();
  populateUserSelector(elements.userSelector);
  attachEventListeners();
  initCharts();
  updateHeaderStats();
  updateHighlights();
  updateCharts();
  refreshIcons();
});

function cacheDomElements() {
  elements.authSection = document.getElementById("authSection");
  elements.dashboard = document.getElementById("dashboard");
  elements.dashboardShell = document.getElementById("dashboardShell");
  elements.loginForm = document.getElementById("loginForm");
  elements.userSelector = document.getElementById("userSelector");
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
  elements.navigation = document.getElementById("navigation");
  elements.adminView = document.getElementById("adminView");
  elements.docenteView = document.getElementById("docenteView");
  elements.auxiliarView = document.getElementById("auxiliarView");
  elements.userTableContainer = document.getElementById("userTableContainer");
  elements.adminActivityList = document.getElementById("adminActivityList");
  elements.adminActivityForm = document.getElementById("adminActivityForm");
  elements.adminActivityAlert = document.getElementById("adminActivityAlert");
  elements.importTeachersBtn = document.getElementById("importTeachersBtn");
  elements.importTeachersAlert = document.getElementById("importTeachersAlert");
  elements.inviteAlert = document.getElementById("inviteAlert");
  elements.teacherActivities = document.getElementById("teacherActivities");
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
  if (elements.loginForm) {
    elements.loginForm.addEventListener("submit", handleLoginSubmit);
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

function populateUserSelector(select) {
  if (!select) return;
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Elige un perfil para iniciar sesión";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);

  ["administrador", "docente", "auxiliar"].forEach((role) => {
    const usersByRole = users.filter((user) => user.role === role);
    if (!usersByRole.length) return;
    const group = document.createElement("optgroup");
    group.label = ROLE_LABELS[role];
    usersByRole.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      const descriptionParts = [user.potroEmail, user.controlNumber]
        .filter(Boolean)
        .join(" • ");
      option.textContent = descriptionParts
        ? `${user.name} — ${descriptionParts}`
        : user.name;
      group.append(option);
    });
    select.append(group);
  });
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const selector = elements.userSelector;
  if (!selector) return;
  const userId = selector.value;
  if (!userId) {
    showMessage(elements.loginError, "Selecciona un usuario para continuar.");
    return;
  }
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) {
    showMessage(elements.loginError, "El usuario seleccionado no está disponible.");
    return;
  }
  hideMessage(elements.loginError);
  loginUser(user);
}

function loginUser(user) {
  currentUser = user;
  if (elements.authSection) elements.authSection.classList.add("hidden");
  if (elements.dashboard) elements.dashboard.classList.remove("hidden");
  if (elements.headerUserMeta) elements.headerUserMeta.classList.remove("hidden");
  updateLayoutMode();
  scheduleHeaderSync();

  if (elements.headerUserName) elements.headerUserName.textContent = user.name;
  if (elements.headerUserRole) {
    elements.headerUserRole.textContent = ROLE_LABELS[user.role];
    elements.headerUserRole.className = ROLE_BADGE_CLASS[user.role] || "badge";
  }

  configureRoleViews(user.role);
  buildNavigation(user.role);
  renderSidebarUserCard(user);
  renderAllSections();
  setSidebarCollapsed(false);
  if (elements.loginForm) {
    elements.loginForm.reset();
  }
}

function handleLogout() {
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
  ["sidebarName", "sidebarEmail", "sidebarCareer"].forEach((key) => {
    if (elements[key]) elements[key].textContent = "";
  });
  document
    .querySelectorAll("[data-nav-label]")
    .forEach((section) => section.classList.remove("is-targeted"));
  setSidebarCollapsed(false);
  updateHeaderStats();
  refreshIcons();
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
  if (currentUser.role === "administrador") {
    renderUserTable();
    renderAdminActivityList();
  } else {
    clearAdminSections();
  }
  if (currentUser.role === "docente") {
    renderTeacherActivities();
  } else if (elements.teacherActivities) {
    elements.teacherActivities.innerHTML = "";
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
    const emails = [user.potroEmail, user.institutionalEmail]
      .filter(Boolean)
      .join(" • ");
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

function renderUserTable() {
  if (!elements.userTableContainer) return;
  if (!currentUser || currentUser.role !== "administrador") {
    elements.userTableContainer.innerHTML = "";
    return;
  }
  if (!users.length) {
    elements.userTableContainer.innerHTML =
      '<p class="empty-state">Aún no hay usuarios registrados.</p>';
    return;
  }
  const rows = users
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((user) => {
      const badgeClass = ROLE_BADGE_CLASS[user.role] || "badge";
      return `
        <tr>
          <td>${user.name || "—"}</td>
          <td>${user.id || "—"}</td>
          <td>${user.controlNumber || "—"}</td>
          <td>${user.potroEmail || "—"}</td>
          <td>${user.institutionalEmail || "—"}</td>
          <td>${CAREER_LABELS[user.career] || "—"}</td>
          <td><span class="${badgeClass}">${ROLE_LABELS[user.role]}</span></td>
          <td>${user.phone || "—"}</td>
        </tr>
      `;
    })
    .join("");

  elements.userTableContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>ID</th>
          <th>Número de control</th>
          <th>Correo Potro</th>
          <th>Correo institucional</th>
          <th>Carrera</th>
          <th>Rol</th>
          <th>Celular</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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

function renderTeacherActivities() {
  if (!elements.teacherActivities) return;
  if (!currentUser || currentUser.role !== "docente") {
    elements.teacherActivities.innerHTML = "";
    return;
  }
  const tasks = getActivitiesForRole("docente", currentUser);
  if (!tasks.length) {
    elements.teacherActivities.innerHTML =
      '<p class="empty-state">No tienes actividades asignadas por ahora.</p>';
    return;
  }
  elements.teacherActivities.innerHTML = tasks
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
            <span><i data-lucide="map-pin"></i>${CAREER_LABELS[activity.career] || "General"}</span>
          </div>
        </article>
      `;
    })
    .join("");
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
  if (elements.userTableContainer) elements.userTableContainer.innerHTML = "";
  if (elements.adminActivityList) elements.adminActivityList.innerHTML = "";
}

function handleActivityFormSubmit(event) {
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
  event.target.reset();
  renderAllSections();
  showMessage(
    elements.adminActivityAlert,
    "Actividad registrada correctamente.",
    "success",
  );
}

function updateActivityStatus(activityId, newStatus, source) {
  if (!STATUS_ORDER.includes(newStatus)) return;
  const activity = activities.find((item) => item.id === activityId);
  if (!activity || activity.status === newStatus) return;
  activity.status = newStatus;
  renderAllSections();
  if (source === "admin") {
    showMessage(elements.adminActivityAlert, "Estado actualizado.", "success");
  }
  if (source === "aux") {
    showMessage(
      elements.auxiliarActivityAlert,
      "Actividad actualizada correctamente.",
      "success",
    );
  }
}

function removeActivity(activityId) {
  activities = activities.filter((activity) => activity.id !== activityId);
  renderAllSections();
  showMessage(elements.adminActivityAlert, "Actividad eliminada.", "info");
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
      const documentId = record.id || record.controlNumber || generateId("user");
      const docRef = doc(collection(db, "users"), documentId);
      const payload = {
        name: record.name || "",
        userId: record.id || "",
        controlNumber: record.controlNumber || "",
        potroEmail: record.potroEmail || "",
        institutionalEmail: record.institutionalEmail || "",
        phone: record.phone || "",
        role: record.role || "",
        career: record.career || "",
        syncedAt: serverTimestamp(),
      };

      if (record.importedAt) {
        payload.importedAtIso = record.importedAt;
      }

      batch.set(docRef, payload, { merge: true });
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Error al sincronizar usuarios con Firebase:", error);
    return { success: false, reason: "error", error };
  }
}

async function importSoftwareTeachers() {
  const newTeachers = softwareTeacherImport.filter(
    (teacher) =>
      !users.some(
        (user) =>
          normalizeEmail(user.potroEmail) ===
          normalizeEmail(teacher.potroEmail),
      ),
  );
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
  importedTeachersCount += teachersToAdd.length;
  populateUserSelector(elements.userSelector);
  renderAllSections();

  const persistenceResult = await persistImportedUsers(teachersToAdd);
  let alertType = "success";
  let alertMessage = `${teachersToAdd.length} docentes agregados correctamente.`;

  if (persistenceResult.success) {
    alertMessage = `${teachersToAdd.length} docentes agregados y sincronizados con Firebase.`;
  } else if (persistenceResult.reason === "missing-config") {
    alertType = "info";
    alertMessage = `${teachersToAdd.length} docentes agregados. Configura Firebase para sincronizar la información.`;
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

function showMessage(element, message, type = "error") {
  if (!element) return;
  element.textContent = message;
  element.className = `alert ${type} show`;
  if (element.dataset.timeoutId) {
    clearTimeout(Number(element.dataset.timeoutId));
  }
  const timeoutId = window.setTimeout(() => {
    element.classList.remove("show");
    delete element.dataset.timeoutId;
  }, 4000);
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

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function generateId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
