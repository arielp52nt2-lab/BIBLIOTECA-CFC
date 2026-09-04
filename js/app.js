const sourceData = window.CFC_DATA;

const metadata = {
  "el-reloj-giratiempo": {
    shortTitle: "El Reloj · Giratiempo",
    duration: 20, durationLabel: "20 min",
    participants: 30, participantsLabel: "8–30 personas",
    mode: "presencial", skills: ["conexion", "comunicacion"],
    difficulty: "inicial", audience: "equipos", accent: "pink",
    symbol: "◷", publicLabel: "Equipos",
    keywords: "movimiento ritmo coordinación rompehielos energía agrupación apertura"
  },
  "torneo-quidditch": {
    shortTitle: "El Torneo de Quidditch",
    duration: 20, durationLabel: "20 min",
    participants: 12, participantsLabel: "12 personas",
    mode: "presencial", skills: ["comunicacion", "confianza"],
    difficulty: "avanzada", audience: "lideres", accent: "red",
    symbol: "✦", publicLabel: "Líderes y equipos",
    keywords: "liderazgo coordinación estrategia confianza comunicación roles desafío"
  },
  "boveda-gringotts": {
    shortTitle: "La Bóveda de Gringotts",
    duration: 45, durationLabel: "45 min",
    participants: 15, participantsLabel: "15 personas",
    mode: "presencial", skills: ["estrategia", "comunicacion"],
    difficulty: "intermedia", audience: "equipos", accent: "blue",
    symbol: "◇", publicLabel: "Equipos",
    keywords: "precisión procesos mejora orden secuencia estrategia liderazgo"
  },
  "triangulo-perfecto": {
    shortTitle: "El Triángulo Perfecto",
    duration: 25, durationLabel: "25 min",
    participants: 30, participantsLabel: "30 personas",
    mode: "presencial", skills: ["confianza", "comunicacion"],
    difficulty: "intermedia", audience: "equipos", accent: "pink",
    symbol: "△", publicLabel: "Equipos",
    keywords: "comunicación no verbal escucha coordinación liderazgo cuerda"
  },
  "carta-nunca-enviada": {
    shortTitle: "La Carta que nunca he enviado",
    duration: 10, durationLabel: "10 min",
    participants: 30, participantsLabel: "Individual o grupal",
    mode: "virtual", skills: ["reflexion", "conexion"],
    difficulty: "inicial", audience: "general", accent: "blue",
    symbol: "✉", publicLabel: "Público general",
    keywords: "gratitud emociones cierre perdón reconocimiento escritura reflexión"
  }
};

const deletedStorageKey = "cfc-fichas-eliminadas";
const renamedStorageKey = "cfc-nombres-editados";
let deletedActivityIds = new Set(JSON.parse(localStorage.getItem(deletedStorageKey) || "[]"));
let renamedActivities = JSON.parse(localStorage.getItem(renamedStorageKey) || "{}");
const remoteEndpoint = "/api/cfc-data";
let remoteMode = false;
let activities = sourceData
  .map(item => {
    const activity = { ...item, ...metadata[item.id] };
    const savedName = renamedActivities[activity.id];
    return savedName ? { ...activity, title: savedName, shortTitle: savedName } : activity;
  })
  .filter(item => !deletedActivityIds.has(item.id));
const activityGrid = document.querySelector(".activity-grid");
const emptyState = document.querySelector(".empty-state");
const resultSummary = document.querySelector("#resultSummary");
const searchInput = document.querySelector("#activitySearch");
const searchBox = document.querySelector(".search-box");
const suggestions = document.querySelector(".suggestions");
const filterPanel = document.querySelector("#filterPanel");
const filterToggle = document.querySelector(".filter-toggle");
const activeFilterCount = document.querySelector(".active-filter-count");
const dialog = document.querySelector("#detailDialog");
const menu = document.querySelector(".main-nav");
const menuToggle = document.querySelector(".menu-toggle");
const uploadDialog = document.querySelector("#uploadDialog");
const uploadForm = document.querySelector("#uploadForm");
const uploadName = document.querySelector("#activityName");
const uploadMessage = document.querySelector(".upload-message");
const selectedSourceFile = document.querySelector(".selected-source-file");
const importSourceFile = document.querySelector("[name='importSourceFile']");
const importMessage = document.querySelector(".import-message");
const importSubmit = document.querySelector(".import-submit");
const downloadBackupButton = document.querySelector(".download-backup");
const restoreBackupButton = document.querySelector(".restore-backup");
const restoreBackupFile = document.querySelector(".restore-backup-file");
const backupMessage = document.querySelector(".backup-message");
const uploadedList = document.querySelector(".uploaded-list");
const uploadedEmpty = document.querySelector(".uploaded-empty");
const uploadedCount = document.querySelector(".uploaded-count");
const deleteDialog = document.querySelector("#deleteDialog");
const deleteForm = document.querySelector("#deleteForm");
const deleteMessage = document.querySelector(".delete-message");
const renameDialog = document.querySelector("#renameDialog");
const renameForm = document.querySelector("#renameForm");
const renameActivityName = document.querySelector("#renameActivityName");
const renameMessage = document.querySelector(".rename-message");
let pendingDeleteId = "";
let pendingRenameId = "";
let editingActivityId = "";
let currentOriginalUrl = "";

async function remoteRequest(action, options = {}) {
  const response = await fetch(`${remoteEndpoint}?action=${encodeURIComponent(action)}`, options);
  const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || "No fue posible conectar con el almacenamiento web.");
  return payload;
}

function originalActivities() {
  return sourceData.map(item => {
    const activity = { ...item, ...metadata[item.id] };
    const savedName = renamedActivities[activity.id];
    return savedName ? { ...activity, title: savedName, shortTitle: savedName } : activity;
  }).filter(item => !deletedActivityIds.has(item.id));
}

const uploadDatabase = "cfc-biblioteca-local";
const uploadStore = "fichas";
let currentUploadedUrl = "";

function openUploadDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(uploadDatabase, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(uploadStore, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveUploadedActivity(activity) {
  const database = await openUploadDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(uploadStore, "readwrite");
    transaction.objectStore(uploadStore).put(activity);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function deleteUploadedActivity(id) {
  const database = await openUploadDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(uploadStore, "readwrite");
    transaction.objectStore(uploadStore).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function getUploadedActivities() {
  const database = await openUploadDatabase();
  const uploaded = await new Promise((resolve, reject) => {
    const request = database.transaction(uploadStore, "readonly").objectStore(uploadStore).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return uploaded;
}

async function loadUploadedActivities() {
  try {
    const uploaded = await getUploadedActivities();
    const uploadedIds = new Set(uploaded.map(item => item.id));
    activities = [...activities.filter(item => !uploadedIds.has(item.id)), ...uploaded];
  } catch (error) {
    console.warn("No fue posible recuperar las fichas locales.", error);
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  const [metadata, encoded] = dataURL.split(",");
  const mime = metadata.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

async function createLibraryBackup() {
  const uploaded = await getUploadedActivities();
  const serializedUploads = await Promise.all(uploaded.map(async activity => {
    const { fileBlob, ...metadata } = activity;
    return { ...metadata, fileDataURL: fileBlob ? await blobToDataURL(fileBlob) : "" };
  }));
  const localData = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("cfc-")) localData[key] = localStorage.getItem(key);
  }
  return {
    type: "cfc-biblioteca-respaldo",
    version: 1,
    exportedAt: new Date().toISOString(),
    uploadedActivities: serializedUploads,
    localData
  };
}

async function restoreLibraryBackup(backup) {
  if (!backup || backup.type !== "cfc-biblioteca-respaldo" || !Array.isArray(backup.uploadedActivities)) {
    throw new Error("Formato de respaldo no válido");
  }
  for (const [key, value] of Object.entries(backup.localData || {})) {
    if (key.startsWith("cfc-") && typeof value === "string") localStorage.setItem(key, value);
  }
  for (const serialized of backup.uploadedActivities) {
    const { fileDataURL, ...activity } = serialized;
    if (fileDataURL) activity.fileBlob = dataURLToBlob(fileDataURL);
    await saveUploadedActivity(activity);
  }
}

function safeText(value = "") {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function renderUploadedManager() {
  const manageable = [...activities];
  uploadedCount.textContent = `${manageable.length} ${manageable.length === 1 ? "ficha" : "fichas"}`;
  uploadedEmpty.hidden = manageable.length > 0;
  uploadedList.innerHTML = manageable.map(item => `
    <article class="uploaded-item">
      <div class="uploaded-item-info">
        <strong>${safeText(item.shortTitle)}</strong>
        <small>${categoryName(item.category)} · ${item.uploaded ? safeText(item.fileName) : "Ficha original"}</small>
      </div>
      <div class="uploaded-item-actions">
        <button class="request-edit" type="button" data-edit-id="${item.id}">Editar ficha</button>
        <button class="request-delete" type="button" data-delete-id="${item.id}">Eliminar</button>
      </div>
    </article>`).join("");
}

const state = {
  category: "todos",
  query: "",
  duration: "",
  participants: "",
  mode: "",
  skill: "",
  difficulty: "",
  audience: ""
};

const catalogCategories = new Set(["todos", "activador", "dispositivo", "favoritos"]);
const requestedCatalogCategory = new URLSearchParams(window.location.search).get("categoria");

let favorites = new Set(JSON.parse(localStorage.getItem("cfc-favoritos") || "[]"));

const brands = [
  { id: "kfc", name: "KFC", logos: ["kfc.png"] },
  { id: "menestras", name: "Menestras del Negro", logos: ["menestras-del-negro.png"] },
  { id: "gus", name: "Gus", logos: ["gus.png"] },
  { id: "el-espanol", name: "El Español", logos: ["el-espanol.png"] },
  { id: "american-deli", name: "American Deli", logos: ["american-deli.png"] },
  { id: "cajun", name: "Cajun", logos: ["cajun.png"], dark: true },
  { id: "dolce", name: "Dolce Incontro", logos: ["dolce-incontro.png"] },
  { id: "juan-valdez", name: "Juan Valdez Café", logos: ["juan-valdez.png"] },
  { id: "casa-res", name: "Casa Res", logos: ["casa-res-alta-calidad.png"], dark: true },
  { id: "tropiburger", name: "Tropiburger", logos: ["tropiburger.png"] },
  { id: "il-cappo", name: "Il Cappo", logos: ["il-cappo.png"] },
  { id: "astoria", name: "Café Astoria", logos: ["cafe-astoria.png"] },
  { id: "duport", name: "Café Duport", logos: ["cafe-duport-integrado.png"] },
  { id: "br-cinnabon", name: "Baskin Robbins + Cinnabon", logos: ["baskin-robbins.png", "cinnabon.png"], dual: true },
  { id: "plantas", name: "Plantas", logos: ["plantas.png"] },
  { id: "car", name: "CAR", logos: ["car-transparente.png"], expandable: true }
];
const defaultCarDepartments = ["Mercadeo", "Selección", "Nómina", "Tesorería", "DSI", "Nuevos Negocios"];
const carDepartmentsStorageKey = "cfc-areas-car";
let carDepartments = JSON.parse(localStorage.getItem(carDepartmentsStorageKey) || JSON.stringify(defaultCarDepartments));
let selectedBrand = localStorage.getItem("cfc-marca-seleccionada") || "";
let selectedDepartments = new Set(JSON.parse(localStorage.getItem("cfc-car-departamentos") || "[]"));
selectedDepartments = new Set([...selectedDepartments].filter(department => carDepartments.includes(department)).slice(0, 1));
const brandGrid = document.querySelector(".brand-grid");
const brandStatus = document.querySelector(".brand-selection-status");
const carPanel = document.querySelector("#carDepartments");
const departmentGrid = document.querySelector(".department-grid");
const carAreaForm = document.querySelector("#carAreaForm");
const carAreaName = document.querySelector("#carAreaName");
const carAreaMessage = document.querySelector(".car-area-message");
const deleteCarAreaButton = document.querySelector(".delete-car-area");
const brandsDrawer = document.querySelector(".brands-drawer");
const brandsBackdrop = document.querySelector(".brands-backdrop");
const brandsMenuButton = document.querySelector("[data-brands-toggle]");
const navBrandSelection = document.querySelector(".nav-brand-selection");
const brandPrograms = document.querySelector("#brandPrograms");
const programForm = document.querySelector("#programForm");
const programName = document.querySelector("#programName");
const programMonth = document.querySelector("#programMonth");
const programYear = document.querySelector("#programYear");
const programDeviceOptions = document.querySelector(".program-device-options");
const programList = document.querySelector(".program-list");
const programFormMessage = document.querySelector(".program-form-message");
const cancelProgramEdit = document.querySelector(".cancel-program-edit");
const saveProgramButton = document.querySelector(".save-program");
const brandProgramsStorageKey = "cfc-programas-por-marca";
let brandProgramRecords = JSON.parse(localStorage.getItem(brandProgramsStorageKey) || "[]");
let editingProgramId = "";
const programAuthDialog = document.querySelector("#programAuthDialog");
const programAuthForm = document.querySelector("#programAuthForm");
const programAuthMessage = document.querySelector(".program-auth-message");
let pendingProgramDeleteId = "";

async function syncRemoteState() {
  if (!remoteMode) return;
  await remoteRequest("sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ programs: brandProgramRecords, carDepartments, deletedActivityIds: [...deletedActivityIds], renamedActivities })
  });
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function openBrandsDrawer() {
  brandsDrawer.hidden = false;
  brandsBackdrop.hidden = false;
  brandsMenuButton.setAttribute("aria-expanded", "true");
  brandsMenuButton.classList.add("active");
  brandsDrawer.querySelector(".brands-heading")?.classList.add("visible");
  menu.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "hidden";
}

function closeBrandsDrawer() {
  brandsDrawer.hidden = true;
  brandsBackdrop.hidden = true;
  brandsMenuButton.setAttribute("aria-expanded", "false");
  brandsMenuButton.classList.remove("active");
  if (!dialog.open) document.body.style.overflow = "";
}

function brandCardTemplate(brand) {
  const selected = selectedBrand === brand.id;
  const logoMarkup = brand.logos.map(logo => `<img src="assets/marcas/${logo}" alt="">`).join("");
  return `<button class="brand-card brand-${brand.id} ${selected ? "selected" : ""} ${brand.dual ? "dual-brand" : ""} ${brand.expandable ? "car-brand" : ""}" type="button" data-brand="${brand.id}" aria-pressed="${selected}" ${brand.expandable ? `aria-expanded="${!carPanel.hidden}" aria-controls="carDepartments"` : ""}>
    <span class="brand-logo-stage ${brand.dark ? "dark-stage" : ""}" aria-hidden="true">${logoMarkup}</span>
    <span class="brand-card-info"><span><small>${brand.expandable ? "Área corporativa" : brand.dual ? "Marcas aliadas" : "Marca Grupo KFC"}</small><strong>${brand.name}</strong></span><span class="brand-select-indicator">${brand.expandable ? "⌄" : selected ? "✓" : "+"}</span></span>
  </button>`;
}

function updateBrandStatus() {
  if (!selectedBrand) {
    brandStatus.textContent = "Ninguna marca seleccionada";
    navBrandSelection.textContent = "";
    return;
  }
  const brand = brands.find(item => item.id === selectedBrand);
  const activeDepartment = [...selectedDepartments][0];
  const departmentText = selectedBrand === "car" && activeDepartment ? ` · ${activeDepartment}` : "";
  brandStatus.textContent = `Seleccionada: ${brand.name}${departmentText}`;
  navBrandSelection.textContent = `· ${brand.name}`;
}

function renderBrands() {
  brandGrid.innerHTML = brands.map(brandCardTemplate).join("");
  departmentGrid.innerHTML = carDepartments.map(department => {
    const selected = selectedDepartments.has(department);
    return `<button class="department-button ${selected ? "selected" : ""}" type="button" data-department="${escapeHTML(department)}" aria-pressed="${selected}">${escapeHTML(department)}</button>`;
  }).join("");
  const activeDepartment = [...selectedDepartments][0];
  deleteCarAreaButton.disabled = !activeDepartment;
  deleteCarAreaButton.textContent = activeDepartment ? `Eliminar ${activeDepartment}` : "Eliminar área seleccionada";
  updateBrandStatus();
  renderBrandPrograms();
}

function resetProgramForm() {
  editingProgramId = "";
  programForm.reset();
  programFormMessage.textContent = "";
  cancelProgramEdit.hidden = true;
  saveProgramButton.innerHTML = "Añadir programa <span>＋</span>";
  programMonth.value = String(new Date().getMonth() + 1);
  programYear.value = String(new Date().getFullYear());
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function programDateParts(record) {
  if (record.year && record.month) return { year: Number(record.year), month: Number(record.month) };
  const fallback = new Date(record.createdAt || Date.now());
  return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 };
}

function programDateLabel(record) {
  const { year, month } = programDateParts(record);
  return `${monthNames[month - 1] || "Mes por definir"} ${year}`;
}

function renderBrandPrograms() {
  const activeDepartment = [...selectedDepartments][0] || "";
  brandPrograms.hidden = !selectedBrand || (selectedBrand === "car" && !activeDepartment);
  if (brandPrograms.hidden) return;
  const brand = brands.find(item => item.id === selectedBrand);
  const contextLabel = selectedBrand === "car" ? `${brand.name} · ${activeDepartment}` : brand?.name || "";
  document.querySelector(".program-brand-name").textContent = contextLabel;
  const editingRecord = brandProgramRecords.find(record => record.id === editingProgramId);
  const linkedIds = editingRecord?.activityIds || editingRecord?.deviceIds || [];
  const experienceGroup = (category, title, marker) => {
    const grouped = activities.filter(activity => activity.category === category);
    const options = grouped.length ? grouped.map(activity => {
      const checked = linkedIds.includes(activity.id) ? "checked" : "";
      return `<label><input type="checkbox" name="programActivity" value="${escapeHTML(activity.id)}" ${checked}><span><b>${escapeHTML(activity.shortTitle)}</b><small>${escapeHTML(activity.durationLabel)} · ${escapeHTML(activity.participantsLabel)}</small></span></label>`;
    }).join("") : `<p class="no-program-devices">No hay ${title.toLowerCase()} disponibles todavía.</p>`;
    return `<section class="program-experience-group program-${category}"><header><span>${marker}</span><div><small>Selecciona los utilizados</small><h5>${title}</h5></div><b>${grouped.length}</b></header><div class="program-experience-options">${options}</div></section>`;
  };
  programDeviceOptions.innerHTML = experienceGroup("activador", "Activadores", "⚡") + experienceGroup("dispositivo", "Dispositivos", "◆");

  const records = brandProgramRecords
    .filter(record => record.brandId === selectedBrand && (selectedBrand !== "car" || record.department === activeDepartment))
    .sort((first, second) => {
      const a = programDateParts(first);
      const b = programDateParts(second);
      return (a.year * 12 + a.month) - (b.year * 12 + b.month) || (first.createdAt || 0) - (second.createdAt || 0);
    });
  document.querySelector(".program-count").textContent = `${records.length} ${records.length === 1 ? "programa" : "programas"}`;
  programList.innerHTML = records.length ? records.map((record, index) => {
    const linkedExperiences = (record.activityIds || record.deviceIds || []).map(id => activities.find(activity => activity.id === id)).filter(Boolean);
    const deviceMarkup = linkedExperiences.length ? linkedExperiences.map(activity => `<button type="button" data-open="${escapeHTML(activity.id)}"><span>${escapeHTML(activity.symbol)}</span>${escapeHTML(activity.shortTitle)} <small>${categoryName(activity.category)}</small></button>`).join("") : `<p>Sin activadores o dispositivos vinculados todavía.</p>`;
    return `<article class="program-card">
      <div class="program-index">${String(index + 1).padStart(2, "0")}</div>
      <div class="program-card-copy"><small>${escapeHTML(contextLabel)}</small><h4>${escapeHTML(record.name)}</h4><span class="program-date">◷ ${escapeHTML(programDateLabel(record))}</span><div class="program-devices">${deviceMarkup}</div></div>
      <div class="program-card-actions"><button type="button" data-program-edit="${record.id}">Editar</button><button type="button" data-program-delete="${record.id}">Eliminar</button></div>
    </article>`;
  }).join("") : `<div class="program-empty"><span>＋</span><strong>Aún no hay programas para ${escapeHTML(contextLabel)}</strong><p>Crea el primero y relaciona los activadores y dispositivos que utilizaron.</p></div>`;
}

function selectBrand(id) {
  resetProgramForm();
  selectedBrand = id;
  localStorage.setItem("cfc-marca-seleccionada", id);
  if (id === "car") carPanel.hidden = false;
  else carPanel.hidden = true;
  renderBrands();
  (id === "car" ? carPanel : brandPrograms).scrollIntoView({ behavior: "smooth", block: "nearest" });
}

brandGrid.addEventListener("click", event => {
  const card = event.target.closest("[data-brand]");
  if (card) selectBrand(card.dataset.brand);
});
departmentGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-department]");
  if (!button) return;
  const department = button.dataset.department;
  resetProgramForm();
  selectedDepartments.clear();
  selectedDepartments.add(department);
  localStorage.setItem("cfc-car-departamentos", JSON.stringify([...selectedDepartments]));
  renderBrands();
  brandPrograms.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
document.querySelector(".close-car-panel").addEventListener("click", () => {
  carPanel.hidden = true;
  renderBrands();
});
brandsMenuButton.addEventListener("click", () => brandsDrawer.hidden ? openBrandsDrawer() : closeBrandsDrawer());
document.querySelector(".close-brands-drawer").addEventListener("click", closeBrandsDrawer);
brandsBackdrop.addEventListener("click", closeBrandsDrawer);

function saveCarDepartments() {
  localStorage.setItem(carDepartmentsStorageKey, JSON.stringify(carDepartments));
  localStorage.setItem("cfc-car-departamentos", JSON.stringify([...selectedDepartments]));
}

carAreaForm.addEventListener("submit", async event => {
  event.preventDefault();
  const areaName = carAreaName.value.trim();
  if (!areaName) {
    carAreaMessage.textContent = "Escribe el nombre de la nueva área.";
    carAreaName.focus();
    return;
  }
  if (carDepartments.some(department => normalize(department) === normalize(areaName))) {
    carAreaMessage.textContent = "Esa área ya existe.";
    carAreaName.select();
    return;
  }
  if (!window.confirm(`¿Confirmas que deseas añadir el área “${areaName}”?`)) {
    carAreaMessage.textContent = "La creación fue cancelada. No se realizaron cambios.";
    return;
  }
  carDepartments.push(areaName);
  selectedDepartments = new Set([areaName]);
  saveCarDepartments();
  await syncRemoteState();
  carAreaForm.reset();
  carAreaMessage.textContent = `Área “${areaName}” añadida correctamente.`;
  resetProgramForm();
  renderBrands();
});

deleteCarAreaButton.addEventListener("click", async () => {
  const activeDepartment = [...selectedDepartments][0];
  if (!activeDepartment) {
    carAreaMessage.textContent = "Selecciona primero el área que deseas eliminar.";
    return;
  }
  if (!window.confirm(`¿Confirmas que deseas eliminar el área “${activeDepartment}” y todos sus programas? Esta acción no se puede deshacer.`)) {
    carAreaMessage.textContent = "La eliminación fue cancelada. El área se mantiene sin cambios.";
    return;
  }
  carDepartments = carDepartments.filter(department => department !== activeDepartment);
  brandProgramRecords = brandProgramRecords.filter(record => !(record.brandId === "car" && record.department === activeDepartment));
  selectedDepartments.clear();
  saveCarDepartments();
  localStorage.setItem(brandProgramsStorageKey, JSON.stringify(brandProgramRecords));
  await syncRemoteState();
  carAreaForm.reset();
  carAreaMessage.textContent = `El área “${activeDepartment}” y sus programas fueron eliminados.`;
  resetProgramForm();
  renderBrands();
});

programForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedBrand) return;
  const name = programName.value.trim();
  const month = Number(programMonth.value);
  const year = Number(programYear.value);
  const activityIds = [...programForm.querySelectorAll('input[name="programActivity"]:checked')].map(input => input.value);
  const department = selectedBrand === "car" ? [...selectedDepartments][0] || "" : "";
  if (!name || month < 1 || month > 12 || year < 2000 || year > 2100) {
    programFormMessage.textContent = "Completa el nombre, el mes y el año del programa.";
    return;
  }
  if (selectedBrand === "car" && !department) return;
  const action = editingProgramId ? `guardar los cambios de “${name}”` : `añadir el programa “${name}”`;
  if (!window.confirm(`¿Confirmas que deseas ${action}?`)) {
    programFormMessage.textContent = "La acción fue cancelada. No se realizaron cambios.";
    return;
  }
  if (editingProgramId) {
    const record = brandProgramRecords.find(item => item.id === editingProgramId);
    if (record) Object.assign(record, { name, month, year, activityIds, department, updatedAt: Date.now() });
  } else {
    brandProgramRecords.push({ id: `program-${Date.now()}-${Math.random().toString(16).slice(2)}`, brandId: selectedBrand, department, name, month, year, activityIds, createdAt: Date.now() });
  }
  localStorage.setItem(brandProgramsStorageKey, JSON.stringify(brandProgramRecords));
  await syncRemoteState();
  resetProgramForm();
  renderBrandPrograms();
});

programList.addEventListener("click", event => {
  const editButton = event.target.closest("[data-program-edit]");
  if (editButton) {
    const record = brandProgramRecords.find(item => item.id === editButton.dataset.programEdit);
    if (!record) return;
    editingProgramId = record.id;
    programName.value = record.name;
    const recordDate = programDateParts(record);
    programMonth.value = String(recordDate.month);
    programYear.value = String(recordDate.year);
    cancelProgramEdit.hidden = false;
    saveProgramButton.innerHTML = "Guardar cambios <span>✓</span>";
    renderBrandPrograms();
    programName.value = record.name;
    programMonth.value = String(recordDate.month);
    programYear.value = String(recordDate.year);
    programName.focus();
    return;
  }
  const deleteButton = event.target.closest("[data-program-delete]");
  if (!deleteButton) return;
  const record = brandProgramRecords.find(item => item.id === deleteButton.dataset.programDelete);
  pendingProgramDeleteId = deleteButton.dataset.programDelete;
  programAuthForm.reset();
  programAuthMessage.textContent = "";
  programAuthDialog.querySelector(".program-delete-name").textContent = record?.name || "este programa";
  programAuthDialog.showModal();
  setTimeout(() => programAuthDialog.querySelector(".program-auth-cancel").focus(), 50);
});

function closeProgramAuthDialog() {
  pendingProgramDeleteId = "";
  programAuthForm.reset();
  programAuthMessage.textContent = "";
  programAuthDialog.close();
}

document.querySelector(".close-program-auth-dialog").addEventListener("click", closeProgramAuthDialog);
document.querySelector(".program-auth-cancel").addEventListener("click", closeProgramAuthDialog);
programAuthDialog.addEventListener("click", event => { if (event.target === programAuthDialog) closeProgramAuthDialog(); });
programAuthForm.addEventListener("submit", async event => {
  event.preventDefault();
  const id = pendingProgramDeleteId;
  const button = programAuthForm.querySelector(".program-auth-confirm");
  button.disabled = true;
  try {
    brandProgramRecords = brandProgramRecords.filter(item => item.id !== id);
    localStorage.setItem(brandProgramsStorageKey, JSON.stringify(brandProgramRecords));
    await syncRemoteState();
    if (editingProgramId === id) resetProgramForm();
    closeProgramAuthDialog();
    renderBrandPrograms();
  } catch (error) {
    programAuthMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

cancelProgramEdit.addEventListener("click", () => {
  resetProgramForm();
  renderBrandPrograms();
});

function normalize(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function categoryName(category) {
  return category === "activador" ? "Activador" : "Dispositivo";
}

function cardTemplate(item) {
  const favorite = favorites.has(item.id);
  return `<article class="activity-card" data-id="${item.id}" data-accent="${item.accent}">
    <div class="card-art" data-open="${item.id}" role="button" tabindex="0" aria-label="Abrir ficha: ${item.shortTitle}">
      <span class="category-pill">${categoryName(item.category)}</span>
      <button class="favorite-button ${favorite ? "active" : ""}" type="button" data-favorite="${item.id}" aria-label="${favorite ? "Quitar de" : "Agregar a"} favoritos" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button>
      <span class="art-symbol" aria-hidden="true">${item.symbol}</span>
    </div>
    <div class="card-body">
      <h3>${item.shortTitle}</h3>
      <p>${item.summary}</p>
      <div class="card-meta">
        <span>◷ ${item.durationLabel}</span>
        <span>◎ ${item.participantsLabel}</span>
        <span>${item.mode === "virtual" ? "⌁" : "⌖"} ${item.mode}</span>
      </div>
      <div class="card-footer">
        <small>${item.skills.map(skill => skill.charAt(0).toUpperCase() + skill.slice(1)).join(" · ")}</small>
        <span class="card-actions">
          <button class="edit-card-name" type="button" data-edit-id="${item.id}" aria-label="Editar ficha ${item.shortTitle}" title="Editar ficha">✎</button>
          <button class="view-detail" type="button" data-open="${item.id}" aria-label="Ver más información">↗</button>
        </span>
      </div>
    </div>
  </article>`;
}

function matchesDuration(item) {
  if (!state.duration) return true;
  if (state.duration === "corta") return item.duration <= 20;
  if (state.duration === "media") return item.duration > 20 && item.duration <= 45;
  return item.duration > 45;
}

function matchesParticipants(item) {
  if (!state.participants) return true;
  if (state.participants === "pequeno") return item.participants <= 12;
  if (state.participants === "mediano") return item.participants > 12 && item.participants <= 20;
  return item.participants > 20;
}

function filteredActivities() {
  const query = normalize(state.query);
  return activities.filter(item => {
    const searchable = normalize([
      item.title, item.shortTitle, item.summary, item.keywords, item.durationLabel,
      item.participantsLabel, item.category, item.mode, item.publicLabel,
      item.skills.join(" "), item.html.replace(/<[^>]+>/g, " ")
    ].join(" "));
    const categoryMatch =
      state.category === "todos" ||
      (state.category === "favoritos" ? favorites.has(item.id) : item.category === state.category);
    return categoryMatch &&
      (!query || searchable.includes(query)) &&
      matchesDuration(item) &&
      matchesParticipants(item) &&
      (!state.mode || item.mode === state.mode) &&
      (!state.skill || item.skills.includes(state.skill)) &&
      (!state.difficulty || item.difficulty === state.difficulty) &&
      (!state.audience || item.audience === state.audience);
  });
}

function renderActivities() {
  const filtered = filteredActivities();
  activityGrid.innerHTML = filtered.map(cardTemplate).join("");
  activityGrid.hidden = filtered.length === 0;
  emptyState.hidden = filtered.length !== 0;
  resultSummary.textContent = `Mostrando ${filtered.length} ${filtered.length === 1 ? "experiencia" : "experiencias"}`;
  updateFavoriteCounts();
  updateCategoryCounts();
  renderBrandPrograms();
}

function updateCategoryCounts() {
  const counts = {
    todos: activities.length,
    activador: activities.filter(item => item.category === "activador").length,
    dispositivo: activities.filter(item => item.category === "dispositivo").length
  };
  Object.entries(counts).forEach(([category, total]) => {
    const count = document.querySelector(`.quick-tab[data-filter-category="${category}"] span`);
    if (count) count.textContent = total;
  });
}

function setCategory(category) {
  state.category = category;
  document.querySelectorAll(".quick-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.filterCategory === category);
  });
  renderActivities();
}

function showCatalogView(category = "todos") {
  const selectedCategory = catalogCategories.has(category) ? category : "todos";
  document.body.classList.add("catalog-view");
  document.querySelector("#catalogo").hidden = false;
  setCategory(selectedCategory);
}

function updateFavoriteCounts() {
  document.querySelectorAll(".favorite-count").forEach(count => count.textContent = favorites.size);
}

function toggleFavorite(id) {
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  localStorage.setItem("cfc-favoritos", JSON.stringify([...favorites]));
  renderActivities();
}

function activeAdvancedFilters() {
  return ["duration", "participants", "mode", "skill", "difficulty", "audience"]
    .filter(key => state[key]).length;
}

function syncFilterCount() {
  const total = activeAdvancedFilters();
  activeFilterCount.textContent = total;
  activeFilterCount.classList.toggle("visible", total > 0);
}

function resetAdvancedFilters() {
  document.querySelectorAll(".filter-panel select").forEach(select => select.value = "");
  ["duration", "participants", "mode", "skill", "difficulty", "audience"].forEach(key => state[key] = "");
  syncFilterCount();
  renderActivities();
}

function resetAll() {
  state.query = "";
  searchInput.value = "";
  searchBox.classList.remove("has-value");
  setCategory("todos");
  resetAdvancedFilters();
  closeSuggestions();
}

function suggestionTemplate(item) {
  return `<button class="suggestion" type="button" role="option" data-suggestion="${item.id}">
    <span>${item.symbol}</span>
    <span><strong>${item.shortTitle}</strong><small>${categoryName(item.category)} · ${item.durationLabel}</small></span>
  </button>`;
}

function updateSuggestions() {
  const query = normalize(searchInput.value.trim());
  if (!query) return closeSuggestions();
  const matches = activities.filter(item =>
    normalize(`${item.shortTitle} ${item.keywords} ${item.summary}`).includes(query)
  ).slice(0, 5);
  suggestions.innerHTML = matches.map(suggestionTemplate).join("");
  suggestions.classList.toggle("visible", matches.length > 0);
}

function closeSuggestions() {
  suggestions.classList.remove("visible");
  suggestions.innerHTML = "";
}

function openDetail(id) {
  const item = activities.find(activity => activity.id === id);
  if (!item) return;
  const included = new Set(String(item.structuredFields?.["SECCIONES INCLUIDAS"] || "summary,duration,participants,mode").split(",").filter(Boolean));
  const badges = [categoryName(item.category), included.has("duration") ? item.durationLabel : "", included.has("participants") ? item.participantsLabel : "", included.has("mode") ? item.mode : ""].filter(Boolean);
  dialog.querySelector(".detail-badges").innerHTML = badges.map(value => `<span>${safeText(value)}</span>`).join("");
  dialog.querySelector(".detail-icon").textContent = item.symbol;
  dialog.querySelector("#dialogTitle").textContent = item.title;
  const detailSummary = dialog.querySelector(".detail-summary");
  detailSummary.textContent = included.has("summary") ? item.summary : "";
  detailSummary.hidden = !included.has("summary");
  dialog.querySelector(".detail-content").innerHTML = item.html;
  dialog.querySelector(".edit-detail-name").dataset.editId = item.id;
  const downloadButton = dialog.querySelector(".download-button");
  const originalButton = dialog.querySelector(".original-file-button");
  if (currentUploadedUrl) URL.revokeObjectURL(currentUploadedUrl);
  if (currentOriginalUrl) URL.revokeObjectURL(currentOriginalUrl);
  currentUploadedUrl = "";
  currentOriginalUrl = "";
  originalButton.hidden = !item.uploaded || item.createdInPortal;
  if (item.uploaded) {
    sessionStorage.setItem("cfc-ficha-actual", JSON.stringify(item));
    downloadButton.href = "ficha.html";
    downloadButton.target = "_self";
    downloadButton.removeAttribute("download");
    if (item.remoteFileUrl) {
      originalButton.href = item.remoteFileUrl;
      originalButton.download = item.fileName;
    } else if (item.fileBlob) {
      currentOriginalUrl = URL.createObjectURL(item.fileBlob);
      originalButton.href = currentOriginalUrl;
      originalButton.download = item.fileName;
    }
  } else {
    downloadButton.href = `descargas/${item.id}.html`;
    downloadButton.target = "_self";
    downloadButton.removeAttribute("download");
  }
  dialog.showModal();
  document.body.style.overflow = "hidden";
}

function buildOfficialSheet(item) {
  const title = safeText(item.title || item.shortTitle || "Ficha técnica");
  const summary = safeText(item.summary || "");
  const category = safeText(categoryName(item.category));
  const duration = safeText(item.durationLabel || "Por definir");
  const participants = safeText(item.participantsLabel || "Por definir");
  const mode = safeText(item.mode || "presencial");
  const symbol = safeText(item.symbol || (item.category === "activador" ? "◷" : "◇"));
  const base = `${window.location.origin}/`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><title>${title}</title><link rel="stylesheet" href="css/styles.css"><style>body{background:#eee4d3;padding:35px}.sheet{max-width:850px;margin:auto;background:#fffaf0;box-shadow:var(--shadow)}.sheet .detail-banner{padding:55px}.sheet .detail-content{padding:50px 55px}.printbar{max-width:850px;margin:0 auto 18px;display:flex;justify-content:space-between;align-items:center;gap:12px}.printbar a,.printbar button{border:0;border-radius:12px;padding:12px 18px;font-weight:700;cursor:pointer;text-decoration:none}.printbar a{color:#111;background:white}.printbar button{background:var(--wine);color:white}.sheet-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}.sheet-meta span{border:1px solid #555;border-radius:9px;padding:7px 10px;font:700 10px Manrope,sans-serif;text-transform:uppercase}@media(max-width:650px){body{padding:12px}.sheet .detail-banner,.sheet .detail-content{padding:30px 22px}.printbar{align-items:stretch;flex-direction:column}.printbar a,.printbar button{text-align:center}}@media print{body{padding:0;background:white}.printbar{display:none}.sheet{box-shadow:none}.detail-banner{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="printbar"><a href="index.html">← Volver a la bitácora</a><button onclick="window.print()">Guardar como PDF / Imprimir</button></div><main class="sheet"><header class="detail-banner"><div class="sheet-meta"><span>${category}</span><span>${duration}</span><span>${participants}</span><span>${mode}</span></div><span class="detail-icon">${symbol}</span><h2>${title}</h2><p class="detail-summary">${summary}</p></header><article class="detail-content">${item.html || ""}</article></main></body></html>`;
}

searchInput.addEventListener("input", () => {
  state.query = searchInput.value.trim();
  searchBox.classList.toggle("has-value", Boolean(state.query));
  updateSuggestions();
  renderActivities();
});

searchInput.addEventListener("focus", updateSuggestions);
document.querySelector(".clear-search").addEventListener("click", () => {
  searchInput.value = "";
  state.query = "";
  searchBox.classList.remove("has-value");
  searchInput.focus();
  closeSuggestions();
  renderActivities();
});

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape") closeSuggestions();
  if (event.key === "Escape" && !brandsDrawer.hidden) closeBrandsDrawer();
});

document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    event.stopPropagation();
    openEditActivity(editButton.dataset.editId);
    return;
  }
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    event.stopPropagation();
    toggleFavorite(favoriteButton.dataset.favorite);
    return;
  }
  const openButton = event.target.closest("[data-open]");
  if (openButton) {
    openDetail(openButton.dataset.open);
    return;
  }
  const suggestion = event.target.closest("[data-suggestion]");
  if (suggestion) {
    const item = activities.find(activity => activity.id === suggestion.dataset.suggestion);
    searchInput.value = item.shortTitle;
    state.query = item.shortTitle;
    searchBox.classList.add("has-value");
    closeSuggestions();
    renderActivities();
    return;
  }
  if (!event.target.closest(".search-shell")) closeSuggestions();
});

document.addEventListener("keydown", event => {
  const openTarget = event.target.closest(".card-art[data-open]");
  if (openTarget && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openDetail(openTarget.dataset.open);
  }
});

document.querySelectorAll(".quick-tab").forEach(tab =>
  tab.addEventListener("click", () => setCategory(tab.dataset.filterCategory))
);

document.querySelectorAll("[data-nav-filter]").forEach(link =>
  link.addEventListener("click", () => {
    setCategory(link.dataset.navFilter);
    menu.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  })
);

const selectMap = {
  durationFilter: "duration",
  participantsFilter: "participants",
  modeFilter: "mode",
  skillFilter: "skill",
  difficultyFilter: "difficulty",
  audienceFilter: "audience"
};
Object.entries(selectMap).forEach(([id, key]) => {
  document.querySelector(`#${id}`).addEventListener("change", event => {
    state[key] = event.target.value;
    syncFilterCount();
    renderActivities();
  });
});

filterToggle.addEventListener("click", () => {
  const open = filterPanel.classList.toggle("open");
  filterToggle.setAttribute("aria-expanded", String(open));
});
document.querySelector(".reset-filters").addEventListener("click", resetAdvancedFilters);
document.querySelector(".reset-all").addEventListener("click", resetAll);

menuToggle.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

function resetUploadForm() {
  editingActivityId = "";
  uploadForm.reset();
  uploadMessage.textContent = "";
  uploadMessage.classList.remove("success");
  importMessage.textContent = "";
  importMessage.classList.remove("success");
  document.querySelector("#uploadTitle").textContent = "Crear una nueva ficha";
  uploadForm.querySelector(".upload-submit").innerHTML = "Crear ficha <span>→</span>";
  uploadForm.querySelector(".upload-cancel").textContent = "Cancelar";
  syncSelectedSourceFile();
  backupMessage.textContent = "";
  syncCreateType();
  syncGridBuilder();
  if (typeof resetLevelsBuilder === "function") resetLevelsBuilder();
}

function setCreateValue(name, value) {
  const control = uploadForm.elements.namedItem(name);
  if (control && value !== undefined && value !== null) control.value = value;
}

function openEditActivity(id) {
  const item = activities.find(activity => activity.id === id);
  if (!item) return;
  if (dialog.open) dialog.close();
  resetUploadForm();
  editingActivityId = id;
  const categoryInput = uploadForm.querySelector(`input[name='uploadCategory'][value='${item.category}']`);
  if (categoryInput) categoryInput.checked = true;
  syncCreateType();
  document.querySelector("#uploadTitle").textContent = "Editar ficha";
  uploadForm.querySelector(".upload-submit").innerHTML = "Guardar cambios <span>✓</span>";
  uploadForm.querySelector(".upload-cancel").textContent = "Cancelar edición";
  const fields = item.structuredFields || {};
  const fieldMap = {
    activityName: item.shortTitle,
    summary: fields["RESUMEN PARA TARJETA"] || item.summary,
    objective: fields["OBJETIVO GENERAL"] || "",
    duration: fields["DURACIÓN"] || item.durationLabel,
    participants: fields["PARTICIPANTES"] || item.participantsLabel,
    mode: fields["MODALIDAD"] || item.mode,
    skills: fields["COMPETENCIAS"] || (item.skills || []).join(", "),
    audience: fields["PÚBLICO OBJETIVO"] || item.publicLabel || item.audience,
    materials: fields["MATERIALES"], preparation: fields["PREPARACIÓN DEL ESPACIO"], initialInstruction: fields["INSTRUCCIÓN INICIAL"],
    activatorMoment: fields["MOMENTO RECOMENDADO"], activatorEnergy: fields["NIVEL DE ENERGÍA"], activatorDevelopment: fields["DESARROLLO DEL ACTIVADOR"], activatorQuestions: fields["PREGUNTAS DE CIERRE"], activatorLearning: fields["APRENDIZAJE ESPERADO"], activatorNotes: fields["VARIACIONES"] || fields["OBSERVACIONES PARA FACILITACIÓN"],
    deviceDifficulty: fields["NIVEL DE DIFICULTAD"] || item.difficulty, deviceMethodology: fields["METODOLOGÍA"], deviceStorytelling: fields["STORYTELLING"], deviceRules: fields["ACUERDOS O REGLAS"], deviceDevelopment: fields["DESARROLLO DEL DISPOSITIVO"], deviceFacilitator: fields["ROL DE LA PERSONA FACILITADORA"], deviceSafety: fields["SEGURIDAD Y CUIDADOS"], deviceCompletion: fields["CRITERIO DE FINALIZACIÓN"], deviceQuestions: fields["PREGUNTAS DE DEBRIEFING"], deviceLearning: fields["APRENDIZAJE ESPERADO"], deviceResults: fields["RESULTADOS O REGISTRO"], deviceNotes: fields["VARIACIONES"] || fields["OBSERVACIONES PARA FACILITACIÓN"],
    gridTitle: fields["TÍTULO DE CUADRÍCULA"], gridXAxis: fields["EJE X"], gridYAxis: fields["EJE Y"], gridColumns: fields["COLUMNAS DE CUADRÍCULA"], gridRows: fields["FILAS DE CUADRÍCULA"], gridColumnLabels: fields["ENCABEZADOS DE COLUMNAS"], gridRowLabels: fields["ETIQUETAS DE FILAS"], gridFooter: fields["TEXTO INFERIOR DE CUADRÍCULA"]
  };
  Object.entries(fieldMap).forEach(([name, value]) => setCreateValue(name, value));
  if (fields["SECCIONES INCLUIDAS"]) {
    const included = new Set(fields["SECCIONES INCLUIDAS"].split(","));
    uploadForm.querySelectorAll("input[name='includeSections']:not(:disabled)").forEach(input => { input.checked = included.has(input.value); });
  }
  const gridEnabled = fields["CUADRÍCULA ACTIVA"] === "sí";
  if (gridToggle) gridToggle.checked = gridEnabled;
  syncGridBuilder();
  if (fields["NIVELES ACTIVOS"] === "sí" && levelsToggle) {
    levelsToggle.checked = true;
    syncLevelsBuilder();
    try {
      const levels = JSON.parse(fields["NIVELES"] || "[]");
      levelsList.innerHTML = "";
      levels.forEach(() => addLevel());
      levels.forEach((level, index) => {
        const card = levelsList.children[index];
        card.querySelector("[data-level-name]").value = level.name || "";
        card.querySelector("[data-level-duration]").value = level.duration || "";
        card.querySelector("[data-level-description]").value = level.description || "";
      });
    } catch (error) { /* conserva el editor vacío */ }
  }
  syncInclusionFields();
  renderUploadedManager();
  uploadDialog.showModal();
  document.body.style.overflow = "hidden";
  uploadDialog.querySelector(".upload-shell").scrollTop = 0;
}

function closeUploadDialog() {
  uploadDialog.close();
  document.body.style.overflow = "";
}

document.querySelectorAll("[data-upload-toggle]").forEach(button => button.addEventListener("click", () => {
  resetUploadForm();
  renderUploadedManager();
  uploadDialog.showModal();
  menu.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "hidden";
}));
document.querySelector(".close-upload-dialog").addEventListener("click", closeUploadDialog);
document.querySelector(".upload-cancel").addEventListener("click", closeUploadDialog);
uploadDialog.addEventListener("click", event => { if (event.target === uploadDialog) closeUploadDialog(); });
uploadDialog.addEventListener("close", () => { document.body.style.overflow = ""; });

downloadBackupButton.addEventListener("click", async () => {
  downloadBackupButton.disabled = true;
  backupMessage.textContent = "Preparando el respaldo…";
  try {
    const backup = await createLibraryBackup();
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `respaldo-cfc-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    backupMessage.textContent = "Respaldo descargado correctamente. Guárdalo en una ubicación segura.";
  } catch (error) {
    backupMessage.textContent = "No fue posible crear el respaldo. Inténtalo nuevamente.";
  } finally {
    downloadBackupButton.disabled = false;
  }
});

restoreBackupButton.addEventListener("click", () => restoreBackupFile.click());
restoreBackupFile.addEventListener("change", async () => {
  const file = restoreBackupFile.files[0];
  if (!file) return;
  restoreBackupButton.disabled = true;
  backupMessage.textContent = "Restaurando información…";
  try {
    const backup = JSON.parse(await file.text());
    await restoreLibraryBackup(backup);
    backupMessage.textContent = "Respaldo restaurado. Actualizando la biblioteca…";
    setTimeout(() => location.reload(), 700);
  } catch (error) {
    backupMessage.textContent = "El archivo no corresponde a un respaldo válido del CFC.";
    restoreBackupFile.value = "";
    restoreBackupButton.disabled = false;
  }
});

uploadedList.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    event.stopPropagation();
    openEditActivity(editButton.dataset.editId);
    return;
  }
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  const item = activities.find(activity => activity.id === button.dataset.deleteId);
  if (!item) return;
  pendingDeleteId = item.id;
  deleteForm.reset();
  deleteMessage.textContent = "";
  deleteDialog.querySelector(".delete-activity-name").textContent = item.shortTitle;
  deleteDialog.showModal();
  setTimeout(() => deleteDialog.querySelector(".delete-cancel").focus(), 50);
});

function openRenameDialog(id) {
  const item = activities.find(activity => activity.id === id);
  if (!item) return;
  pendingRenameId = item.id;
  renameForm.reset();
  renameMessage.textContent = "";
  renameActivityName.value = item.shortTitle;
  renameDialog.showModal();
  setTimeout(() => renameActivityName.select(), 50);
}

function closeRenameDialog() {
  pendingRenameId = "";
  renameForm.reset();
  renameMessage.textContent = "";
  renameDialog.close();
}

document.querySelector(".close-rename-dialog").addEventListener("click", closeRenameDialog);
document.querySelector(".rename-cancel").addEventListener("click", closeRenameDialog);
renameDialog.addEventListener("click", event => { if (event.target === renameDialog) closeRenameDialog(); });

renameForm.addEventListener("submit", async event => {
  event.preventDefault();
  const item = activities.find(activity => activity.id === pendingRenameId);
  const newName = renameActivityName.value.trim();
  if (!item || !newName) return;
  if (!window.confirm(`¿Confirmas que deseas cambiar el nombre de “${item.shortTitle}” a “${newName}”?`)) {
    renameMessage.textContent = "La edición fue cancelada. El nombre se mantiene sin cambios.";
    return;
  }
  const confirmButton = renameForm.querySelector(".rename-confirm");
  confirmButton.disabled = true;
  renameMessage.textContent = "Guardando nombre…";
  try {
    item.title = newName;
    item.shortTitle = newName;
    if (remoteMode) {
      await remoteRequest("rename", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, name: newName }) });
      if (!item.uploaded) {
        renamedActivities[item.id] = newName;
        localStorage.setItem(renamedStorageKey, JSON.stringify(renamedActivities));
      }
    } else if (item.uploaded) {
      await saveUploadedActivity(item);
    } else {
      renamedActivities[item.id] = newName;
      localStorage.setItem(renamedStorageKey, JSON.stringify(renamedActivities));
    }
    closeRenameDialog();
    renderUploadedManager();
    renderActivities();
    if (dialog.open && dialog.querySelector(".edit-detail-name").dataset.renameId === item.id) {
      dialog.querySelector("#dialogTitle").textContent = newName;
    }
  } catch (error) {
    renameMessage.textContent = "No fue posible guardar el nombre. Inténtalo nuevamente.";
  } finally {
    confirmButton.disabled = false;
  }
});

function closeDeleteDialog() {
  pendingDeleteId = "";
  deleteForm.reset();
  deleteMessage.textContent = "";
  deleteDialog.close();
}

document.querySelector(".close-delete-dialog").addEventListener("click", closeDeleteDialog);
document.querySelector(".delete-cancel").addEventListener("click", closeDeleteDialog);
deleteDialog.addEventListener("click", event => { if (event.target === deleteDialog) closeDeleteDialog(); });

deleteForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  const confirmButton = deleteForm.querySelector(".delete-confirm");
  confirmButton.disabled = true;
  deleteMessage.textContent = "Eliminando ficha…";
  try {
    const item = activities.find(activity => activity.id === id);
    if (remoteMode) {
      await remoteRequest("activity", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      if (!item?.uploaded) {
        deletedActivityIds.add(id);
        localStorage.setItem(deletedStorageKey, JSON.stringify([...deletedActivityIds]));
      }
    } else if (item?.uploaded) {
      await deleteUploadedActivity(id);
    } else {
      deletedActivityIds.add(id);
      localStorage.setItem(deletedStorageKey, JSON.stringify([...deletedActivityIds]));
    }
    activities = activities.filter(item => item.id !== id);
    favorites.delete(id);
    localStorage.setItem("cfc-favoritos", JSON.stringify([...favorites]));
    closeDeleteDialog();
    renderUploadedManager();
    renderActivities();
  } catch (error) {
    deleteMessage.textContent = "No fue posible eliminar la ficha. Inténtalo nuevamente.";
  } finally {
    confirmButton.disabled = false;
  }
});

function syncInclusionFields() {
  const category = new FormData(uploadForm).get("uploadCategory") || "activador";
  const included = new Set([...uploadForm.querySelectorAll("input[name='includeSections']:checked:not(:disabled)")].map(input => input.value));
  uploadForm.querySelectorAll("[data-section-field]").forEach(field => {
    const keys = field.dataset.sectionField.split(/\s+/);
    const typeSection = field.closest("[data-create-type]");
    const active = keys.some(key => included.has(key)) && (!typeSection || typeSection.dataset.createType === category);
    field.hidden = !active;
    field.querySelectorAll("input, select, textarea").forEach(control => {
      if (!Object.prototype.hasOwnProperty.call(control.dataset, "originalRequired")) control.dataset.originalRequired = control.required ? "true" : "false";
      control.disabled = !active;
      control.required = active && control.dataset.originalRequired === "true";
    });
  });
  uploadForm.querySelectorAll("[data-section-group]").forEach(group => {
    group.hidden = ![...group.querySelectorAll("[data-section-field]")].some(field => !field.hidden);
  });
}

function syncCreateType() {
  const category = new FormData(uploadForm).get("uploadCategory") || "activador";
  uploadForm.querySelectorAll("[data-create-type]").forEach(section => {
    const active = section.dataset.createType === category;
    section.hidden = !active;
    section.querySelectorAll("input, select, textarea, button").forEach(control => { control.disabled = !active; });
    section.querySelectorAll("[data-required='true']").forEach(field => { field.required = active; });
  });
  uploadForm.querySelectorAll(".inclusion-options label[data-include-for]").forEach(label => {
    const active = label.dataset.includeFor.split(/\s+/).includes(category);
    const input = label.querySelector("input");
    label.hidden = !active;
    if (input) input.disabled = !active;
  });
  const inclusionHelp = uploadForm.querySelector(".inclusion-help");
  if (inclusionHelp) inclusionHelp.textContent = category === "activador"
    ? "El activador conserva solo la información esencial de una experiencia breve. Al desmarcar un apartado también desaparecerá su campo del formulario y de la ficha final."
    : "Para un dispositivo están disponibles los apartados de diseño, facilitación, seguridad y resultados. Puedes desmarcar los que no necesites.";
  const typeNumber = uploadForm.querySelector(`[data-create-type='${category}'] .upload-section-heading > span`);
  if (typeNumber) typeNumber.textContent = category === "activador" ? "04" : "06";
  syncInclusionFields();
}

function syncSelectedSourceFile() {
  if (!selectedSourceFile) return;
  const file = importSourceFile?.files?.[0] || null;
  selectedSourceFile.textContent = file ? `Archivo seleccionado: ${file.name}` : "Ningún archivo seleccionado.";
  selectedSourceFile.classList.toggle("has-file", Boolean(file));
  if (file && !uploadForm.elements.namedItem("importName").value.trim()) {
    uploadForm.elements.namedItem("importName").value = file.name.replace(/\.(?:docx|pdf)$/i, "").replace(/[_-]+/g, " ");
  }
}

uploadForm.querySelectorAll("input[name='uploadCategory']").forEach(radio => radio.addEventListener("change", syncCreateType));
importSourceFile?.addEventListener("change", syncSelectedSourceFile);
uploadForm.querySelectorAll("input[name='includeSections']").forEach(checkbox => checkbox.addEventListener("change", syncInclusionFields));
syncCreateType();

const gridToggle = uploadForm.elements.namedItem("gridEnabled");
const gridFields = uploadForm.querySelector("[data-grid-fields]");
function syncGridBuilder() {
  if (!gridToggle || !gridFields) return;
  gridFields.hidden = !gridToggle.checked;
}
gridToggle?.addEventListener("change", syncGridBuilder);
syncGridBuilder();

const levelsToggle = uploadForm.elements.namedItem("levelsEnabled");
const levelsFields = uploadForm.querySelector("[data-levels-fields]");
const levelsList = uploadForm.querySelector("[data-levels-list]");
const addLevelButton = uploadForm.querySelector(".add-level-button");

function levelCardTemplate(number) {
  return `<article class="level-card"><div class="level-card-heading"><span>Nivel ${number}</span><button type="button" data-remove-level aria-label="Eliminar nivel">×</button></div><div class="create-field-grid"><label><span>Nombre del nivel</span><input data-level-name type="text" maxlength="80" placeholder="Ej.: Nivel 1 · Exploración"></label><label><span>Duración del nivel</span><input data-level-duration type="text" maxlength="50" placeholder="Ej.: 10 minutos"></label><label class="field-span"><span>Contexto y explicación del nivel</span><textarea data-level-description rows="4" placeholder="Explica qué ocurre, cuál es el reto y qué debe lograr el grupo en este nivel."></textarea></label></div></article>`;
}

function renumberLevels() {
  levelsList?.querySelectorAll(".level-card").forEach((card, index) => { card.querySelector(".level-card-heading span").textContent = `Nivel ${index + 1}`; });
}

function addLevel() {
  if (!levelsList) return;
  levelsList.insertAdjacentHTML("beforeend", levelCardTemplate(levelsList.children.length + 1));
}

function syncLevelsBuilder() {
  if (!levelsToggle || !levelsFields) return;
  levelsFields.hidden = !levelsToggle.checked;
  if (levelsToggle.checked && levelsList && !levelsList.children.length) addLevel();
}

function resetLevelsBuilder() {
  if (levelsList) levelsList.innerHTML = "";
  syncLevelsBuilder();
}

levelsToggle?.addEventListener("change", syncLevelsBuilder);
addLevelButton?.addEventListener("click", addLevel);
levelsList?.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-level]");
  if (!button) return;
  button.closest(".level-card")?.remove();
  renumberLevels();
});
syncLevelsBuilder();

function createFieldsFromForm(category) {
  const value = name => String(uploadForm.elements.namedItem(name)?.value || "").trim();
  const includedSections = [...uploadForm.querySelectorAll("input[name='includeSections']:checked:not(:disabled)")].map(input => input.value);
  const levels = [...uploadForm.querySelectorAll(".level-card")].map((card, index) => ({
    number: index + 1,
    name: card.querySelector("[data-level-name]")?.value.trim() || "",
    duration: card.querySelector("[data-level-duration]")?.value.trim() || "",
    description: card.querySelector("[data-level-description]")?.value.trim() || ""
  })).filter(level => level.name || level.duration || level.description).map((level, index) => ({ ...level, number: index + 1, name: level.name || `Nivel ${index + 1}` }));
  const fields = {
    [category === "activador" ? "NOMBRE DEL ACTIVADOR" : "NOMBRE DEL DISPOSITIVO"]: value("activityName"),
    "RESUMEN PARA TARJETA": value("summary"),
    "OBJETIVO GENERAL": value("objective"),
    "DURACIÓN": value("duration"),
    "PARTICIPANTES": value("participants"),
    "MODALIDAD": value("mode"),
    "COMPETENCIAS": value("skills"),
    "PÚBLICO OBJETIVO": value("audience"),
    "MATERIALES": value("materials"),
    "PREPARACIÓN DEL ESPACIO": value("preparation"),
    "INSTRUCCIÓN INICIAL": value("initialInstruction"),
    "SECCIONES INCLUIDAS": includedSections.join(","),
    "NIVELES ACTIVOS": uploadForm.elements.namedItem("levelsEnabled")?.checked ? "sí" : "no",
    "NIVELES": JSON.stringify(levels)
  };
  if (category === "activador") Object.assign(fields, {
    "MOMENTO RECOMENDADO": value("activatorMoment"),
    "NIVEL DE ENERGÍA": value("activatorEnergy"),
    "DESARROLLO DEL ACTIVADOR": value("activatorDevelopment"),
    "PREGUNTAS DE CIERRE": value("activatorQuestions"),
    "APRENDIZAJE ESPERADO": value("activatorLearning"),
    "VARIACIONES": value("activatorNotes"),
    "OBSERVACIONES PARA FACILITACIÓN": value("activatorNotes")
  });
  else Object.assign(fields, {
    "NIVEL DE DIFICULTAD": value("deviceDifficulty"),
    "METODOLOGÍA": value("deviceMethodology"),
    "STORYTELLING": value("deviceStorytelling"),
    "ACUERDOS O REGLAS": value("deviceRules"),
    "DESARROLLO DEL DISPOSITIVO": value("deviceDevelopment"),
    "ROL DE LA PERSONA FACILITADORA": value("deviceFacilitator"),
    "SEGURIDAD Y CUIDADOS": value("deviceSafety"),
    "CRITERIO DE FINALIZACIÓN": value("deviceCompletion"),
    "PREGUNTAS DE DEBRIEFING": value("deviceQuestions"),
    "APRENDIZAJE ESPERADO": value("deviceLearning"),
    "RESULTADOS O REGISTRO": value("deviceResults"),
    "VARIACIONES": value("deviceNotes"),
    "OBSERVACIONES PARA FACILITACIÓN": value("deviceNotes"),
    "CUADRÍCULA ACTIVA": uploadForm.elements.namedItem("gridEnabled")?.checked ? "sí" : "no",
    "TÍTULO DE CUADRÍCULA": value("gridTitle"),
    "EJE X": value("gridXAxis"),
    "EJE Y": value("gridYAxis"),
    "COLUMNAS DE CUADRÍCULA": value("gridColumns"),
    "FILAS DE CUADRÍCULA": value("gridRows"),
    "ENCABEZADOS DE COLUMNAS": value("gridColumnLabels"),
    "ETIQUETAS DE FILAS": value("gridRowLabels"),
    "TEXTO INFERIOR DE CUADRÍCULA": value("gridFooter")
  });
  return fields;
}

function createLocalActivity(item, fields) {
  const lines = value => String(value || "").split(/\n+/).map(line => line.trim()).filter(Boolean);
  const included = new Set(String(fields["SECCIONES INCLUIDAS"] || "").split(",").filter(Boolean));
  const prose = value => lines(value).map(line => `<p>${safeText(line)}</p>`).join("");
  const list = (value, ordered = false) => {
    const tag = ordered ? "ol" : "ul";
    const content = lines(value).map(line => line.replace(/^(?:[•▪◦*+-]|\d+[.)-])\s*/, ""));
    return content.length ? `<${tag} class="detail-list${ordered ? " ordered-list" : ""}">${content.map(line => `<li>${safeText(line)}</li>`).join("")}</${tag}>` : "";
  };
  const section = (key, title, value, type = "prose") => {
    if (!included.has(key) || !String(value || "").trim()) return "";
    if (type === "questions") return `<h2>${safeText(title)}</h2><div class="questions">${lines(value).map((question, index) => `<p><span>${index + 1}</span>${safeText(question.replace(/^\d+[.)-]\s*/, ""))}</p>`).join("")}</div>`;
    return `<h2>${safeText(title)}</h2>${type === "list" ? list(value) : type === "ordered" ? list(value, true) : prose(value)}`;
  };
  const category = item.category;
  const developmentKey = category === "activador" ? "DESARROLLO DEL ACTIVADOR" : "DESARROLLO DEL DISPOSITIVO";
  const questionsKey = category === "activador" ? "PREGUNTAS DE CIERRE" : "PREGUNTAS DE DEBRIEFING";
  let levelsHTML = "";
  if (fields["NIVELES ACTIVOS"] === "sí") {
    try {
      const levels = JSON.parse(fields["NIVELES"] || "[]").filter(level => level.name || level.duration || level.description);
      if (levels.length) levelsHTML = `<section class="experience-levels"><div class="experience-levels-heading"><small>Progresión de la experiencia</small><h2>Niveles</h2></div><div class="experience-level-list">${levels.map((level, index) => `<article class="experience-level"><span class="experience-level-number">${String(index + 1).padStart(2, "0")}</span><div><div class="experience-level-title"><h3>${safeText(level.name || `Nivel ${index + 1}`)}</h3>${level.duration ? `<span>${safeText(level.duration)}</span>` : ""}</div>${level.description ? prose(level.description) : ""}</div></article>`).join("")}</div></section>`;
    } catch (error) {
      levelsHTML = "";
    }
  }
  let grid = "";
  if (category === "dispositivo" && fields["CUADRÍCULA ACTIVA"] === "sí") {
    const columnLabels = lines(fields["ENCABEZADOS DE COLUMNAS"]);
    const rowLabels = lines(fields["ETIQUETAS DE FILAS"]);
    const columnCount = Math.min(10, Math.max(1, Number(fields["COLUMNAS DE CUADRÍCULA"]) || columnLabels.length || 1));
    const rowCount = Math.min(20, Math.max(1, Number(fields["FILAS DE CUADRÍCULA"]) || rowLabels.length || 1));
    const headers = Array.from({ length: columnCount }, (_, index) => columnLabels[index] || `Columna ${index + 1}`);
    const rows = Array.from({ length: rowCount }, (_, index) => rowLabels[index] || `Fila ${index + 1}`);
    const xAxis = fields["EJE X"] || "";
    const yAxis = fields["EJE Y"] || "";
    grid = `<section class="record-grid-section"><div class="record-grid-heading"><small>Herramienta de registro</small><h2>${safeText(fields["TÍTULO DE CUADRÍCULA"] || "Planilla de registro")}</h2>${xAxis ? `<p><strong>Eje X:</strong> ${safeText(xAxis)}</p>` : ""}${yAxis ? `<p><strong>Eje Y:</strong> ${safeText(yAxis)}</p>` : ""}</div><div class="record-grid-scroll"><table class="record-grid"><thead><tr><th>${safeText(yAxis || "Registro")}</th>${headers.map(header => `<th>${safeText(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr><th>${safeText(row)}</th>${headers.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody></table></div>${fields["TEXTO INFERIOR DE CUADRÍCULA"] ? `<p class="record-grid-footer">${safeText(fields["TEXTO INFERIOR DE CUADRÍCULA"])}</p>` : ""}</section>`;
  }
  const html = (included.has("objective") && fields["OBJETIVO GENERAL"] ? `<p class="lead"><strong>Objetivo:</strong> ${safeText(fields["OBJETIVO GENERAL"])}</p>` : "") +
    section("materials", "Materiales", fields["MATERIALES"], "list") + section("preparation", "Preparación del espacio", fields["PREPARACIÓN DEL ESPACIO"]) +
    section("moment", "Momento recomendado", fields["MOMENTO RECOMENDADO"]) + section("moment", "Nivel de energía", fields["NIVEL DE ENERGÍA"]) +
    section("methodology", "Metodología", fields["METODOLOGÍA"]) + section("storytelling", "Storytelling", fields["STORYTELLING"]) +
    section("instruction", "Instrucción inicial", fields["INSTRUCCIÓN INICIAL"]) + section("rules", "Acuerdos o reglas", fields["ACUERDOS O REGLAS"], "list") +
    section("development", category === "activador" ? "Desarrollo del activador" : "Desarrollo del dispositivo", fields[developmentKey], "ordered") + levelsHTML +
    section("facilitator", "Rol de la persona facilitadora", fields["ROL DE LA PERSONA FACILITADORA"]) + section("safety", "Seguridad y cuidados", fields["SEGURIDAD Y CUIDADOS"]) +
    section("completion", "Criterio de finalización", fields["CRITERIO DE FINALIZACIÓN"]) +
    section("questions", category === "activador" ? "Preguntas de cierre" : "Preguntas de debriefing", fields[questionsKey], "questions") +
    section("learning", "Aprendizaje esperado", fields["APRENDIZAJE ESPERADO"]) + section("results", "Resultados o registro", fields["RESULTADOS O REGISTRO"]) +
    section("variations", "Variaciones", fields["VARIACIONES"]) + section("notes", "Observaciones para facilitación", fields["OBSERVACIONES PARA FACILITACIÓN"]) + grid;
  const durationLabel = fields["DURACIÓN"];
  const participantsLabel = fields["PARTICIPANTES"];
  const skills = fields["COMPETENCIAS"].split(/[,;\n]+/).map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 6);
  return {
    ...item,
    summary: included.has("summary") ? item.summary : "",
    duration: Number(String(durationLabel).match(/\d+/)?.[0] || 0), durationLabel,
    participants: Number(String(participantsLabel).match(/\d+/)?.[0] || 0), participantsLabel,
    mode: fields["MODALIDAD"] || item.mode, skills,
    difficulty: String(fields["NIVEL DE DIFICULTAD"] || item.difficulty || "inicial").toLowerCase(),
    audience: fields["PÚBLICO OBJETIVO"] || "general", publicLabel: fields["PÚBLICO OBJETIVO"] || "Público general",
    keywords: `${item.title} ${item.summary} ${fields["OBJETIVO GENERAL"]} ${skills.join(" ")}`,
    html, structuredFields: fields, extracted: true, extractionVersion: 4, templateVersion: "PORTAL-LOCAL-CFC-2026-01"
  };
}

uploadForm.addEventListener("submit", async event => {
  event.preventDefault();
  const category = new FormData(uploadForm).get("uploadCategory");
  const name = uploadName.value.trim();
  if (!name || !uploadForm.reportValidity()) {
    uploadMessage.textContent = "Completa los campos necesarios para construir la ficha.";
    return;
  }
  const existing = editingActivityId ? activities.find(activity => activity.id === editingActivityId) : null;
  if (existing && !window.confirm(`¿Confirmas que deseas guardar los cambios realizados en “${existing.shortTitle}”?`)) {
    uploadMessage.textContent = "La edición fue cancelada. La ficha se mantiene sin cambios.";
    return;
  }
  const item = {
    ...(existing || {}),
    id: existing?.id || `ficha-${Date.now()}`,
    title: name,
    shortTitle: name,
    summary: uploadForm.elements.namedItem("summary").value.trim(),
    category,
    duration: 0,
    durationLabel: "Por definir",
    participants: 0,
    participantsLabel: "Por definir",
    mode: "presencial",
    skills: ["aprendizaje"],
    difficulty: "inicial",
    audience: "general",
    accent: category === "activador" ? "pink" : "red",
    symbol: category === "activador" ? "◷" : "◇",
    publicLabel: "General",
    keywords: `${name} ${category} ficha técnica`,
    html: "",
    uploaded: true,
    createdInPortal: true
  };
  const submitButton = uploadForm.querySelector(".upload-submit");
  submitButton.disabled = true;
  uploadMessage.textContent = existing ? "Guardando todos los cambios…" : "Creando la tarjeta y la ficha visual…";
  try {
    const fields = createFieldsFromForm(category);
    let savedLocally = !remoteMode;
    if (remoteMode) {
      try {
        const result = await remoteRequest("create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ activity: item, fields })
        });
        Object.assign(item, result.activity);
      } catch (remoteError) {
        savedLocally = true;
        Object.assign(item, createLocalActivity(item, fields));
        await saveUploadedActivity(item);
      }
    } else {
      const generated = createLocalActivity(item, fields);
      if (existing && !existing.structuredFields) {
        const detailedKeys = ["OBJETIVO GENERAL", "MATERIALES", "PREPARACIÓN DEL ESPACIO", "INSTRUCCIÓN INICIAL", "MOMENTO RECOMENDADO", "DESARROLLO DEL ACTIVADOR", "PREGUNTAS DE CIERRE", "METODOLOGÍA", "STORYTELLING", "ACUERDOS O REGLAS", "DESARROLLO DEL DISPOSITIVO", "ROL DE LA PERSONA FACILITADORA", "SEGURIDAD Y CUIDADOS", "CRITERIO DE FINALIZACIÓN", "PREGUNTAS DE DEBRIEFING", "APRENDIZAJE ESPERADO", "RESULTADOS O REGISTRO", "VARIACIONES"];
        const rebuiltContent = detailedKeys.some(key => String(fields[key] || "").trim());
        if (!rebuiltContent) generated.html = existing.html;
      }
      Object.assign(item, generated);
      await saveUploadedActivity(item);
    }
    if (existing) activities = activities.map(activity => activity.id === item.id ? item : activity);
    else activities.push(item);
    renderUploadedManager();
    uploadMessage.textContent = existing
      ? "Ficha actualizada correctamente. Todos los cambios quedaron guardados."
      : `Ficha agregada correctamente a ${category === "activador" ? "Activadores" : "Dispositivos"}${savedLocally ? " y guardada en este navegador" : ""}.`;
    uploadMessage.classList.add("success");
    setCategory(category);
    setTimeout(() => {
      closeUploadDialog();
      window.location.href = `?categoria=${encodeURIComponent(category)}#catalogo`;
    }, 650);
  } catch (error) {
    uploadMessage.textContent = error.message || "No se pudo guardar la ficha. Inténtalo nuevamente.";
  } finally {
    submitButton.disabled = false;
  }
});

importSubmit?.addEventListener("click", async () => {
  const file = importSourceFile?.files?.[0];
  const category = new FormData(uploadForm).get("importCategory") || "activador";
  const name = String(uploadForm.elements.namedItem("importName")?.value || "").trim();
  const summary = String(uploadForm.elements.namedItem("importSummary")?.value || "").trim();
  if (!file || !name || !summary) {
    importMessage.textContent = "Selecciona el archivo y completa el nombre y el resumen.";
    return;
  }
  const durationLabel = String(uploadForm.elements.namedItem("importDuration")?.value || "Por definir").trim() || "Por definir";
  const participantsLabel = String(uploadForm.elements.namedItem("importParticipants")?.value || "Por definir").trim() || "Por definir";
  const item = {
    id: `ficha-${Date.now()}`, title: name, shortTitle: name, summary, category,
    duration: Number(durationLabel.match(/\d+/)?.[0] || 0), durationLabel,
    participants: Number(participantsLabel.match(/\d+/)?.[0] || 0), participantsLabel,
    mode: "presencial", skills: ["aprendizaje"], difficulty: "inicial", audience: "general",
    accent: category === "activador" ? "pink" : "red", symbol: category === "activador" ? "◷" : "◇",
    publicLabel: "General", keywords: `${name} ${summary} ${category}`,
    html: `<p class="lead">${safeText(summary)}</p><h2>Ficha técnica completada</h2><p>El documento original se encuentra disponible en el botón de descarga de esta ficha.</p>`,
    uploaded: true, createdInPortal: true, importedFromTemplate: true,
    fileName: file.name, fileType: file.type, fileBlob: file
  };
  importSubmit.disabled = true;
  importMessage.textContent = "Cargando la ficha en la biblioteca…";
  try {
    await saveUploadedActivity(item);
    activities.push(item);
    renderUploadedManager();
    renderActivities();
    importMessage.textContent = `Ficha añadida correctamente a ${category === "activador" ? "Activadores" : "Dispositivos"}.`;
    importMessage.classList.add("success");
    importSourceFile.value = "";
    syncSelectedSourceFile();
    ["importName", "importSummary", "importDuration", "importParticipants"].forEach(field => setCreateValue(field, ""));
  } catch (error) {
    importMessage.textContent = "No fue posible guardar la ficha. Inténtalo nuevamente.";
  } finally {
    importSubmit.disabled = false;
  }
});

dialog.querySelector(".close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener("close", () => { document.body.style.overflow = ""; });

const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) {
    entry.target.classList.add("visible");
    revealObserver.unobserve(entry.target);
  }
}), { threshold: .12 });
document.querySelectorAll(".reveal").forEach(element => revealObserver.observe(element));

const sections = ["inicio", "catalogo", "acerca"].map(id => document.getElementById(id));
const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  document.querySelectorAll(".main-nav a").forEach(link => link.classList.remove("active"));
  const target = entry.target.id === "catalogo" ? document.querySelector(`.main-nav [data-nav-filter="${state.category}"]`) : document.querySelector(`.main-nav a[href$="#${entry.target.id}"]`);
  target?.classList.add("active");
}), { rootMargin: "-35% 0px -60%" });
sections.forEach(section => navObserver.observe(section));

async function initializeLibrary() {
  try {
    await navigator.storage?.persist?.();
  } catch (error) {
    console.info("El navegador administrará el almacenamiento local.");
  }
  await loadUploadedActivities();
  if (catalogCategories.has(requestedCatalogCategory)) showCatalogView(requestedCatalogCategory);
  renderActivities();
  renderUploadedManager();
  syncFilterCount();
  carPanel.hidden = selectedBrand !== "car";
  renderBrands();
}

initializeLibrary();
