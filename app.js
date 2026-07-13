// ============================================================
// Checklisten-App – Logik
// ============================================================

// ---- 1. Datenhaltung (localStorage) ----
// Datenmodell:
// { lists: [ { id, name, items: [ { id, text, done } ] } ] }
const STORAGE_KEY = "checklist-data";

let data = load();
let activeListId = null; // null = Listenübersicht, sonst ID der offenen Liste

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? { lists: [] };
  } catch {
    return { lists: [] };
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Eindeutige IDs, z. B. "m5x1kz-a8b2c"
const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

// ---- 2. DOM-Referenzen ----
const titleEl  = document.getElementById("title");
const backBtn  = document.getElementById("back-btn");
const listEl   = document.getElementById("list-container");
const inputEl  = document.getElementById("new-entry");
const addBtn   = document.getElementById("add-btn");
const clearBtn = document.getElementById("clear-done-btn");

const activeList = () => data.lists.find((l) => l.id === activeListId);

// ---- 3. Rendering ----
function render() {
  listEl.innerHTML = "";
  if (activeListId === null) {
    renderOverview();
  } else {
    renderDetail();
  }
}

// Ansicht A: alle Listen
function renderOverview() {
  titleEl.textContent = "Meine Listen";
  backBtn.hidden = true;
  clearBtn.hidden = true;
  inputEl.placeholder = "Neue Liste…";

  if (data.lists.length === 0) {
    listEl.appendChild(emptyHint("Noch keine Listen – leg unten eine an!"));
    return;
  }

  for (const list of data.lists) {
    const li = document.createElement("li");
    li.className = "row";

    const main = document.createElement("button");
    main.className = "row-main";

    const name = document.createElement("span");
    name.textContent = list.name;

    const doneCount = list.items.filter((i) => i.done).length;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = doneCount + "/" + list.items.length;

    main.append(name, count);
    main.addEventListener("click", () => {
      activeListId = list.id;
      render();
    });

    const del = deleteButton(() => {
      if (confirm('Liste "' + list.name + '" löschen?')) {
        data.lists = data.lists.filter((l) => l.id !== list.id);
        save();
        render();
      }
    });

    li.append(main, del);
    listEl.appendChild(li);
  }
}

// Ansicht B: eine geöffnete Liste
function renderDetail() {
  const list = activeList();
  if (!list) { activeListId = null; render(); return; }

  titleEl.textContent = list.name;
  backBtn.hidden = false;
  clearBtn.hidden = !list.items.some((i) => i.done);
  inputEl.placeholder = "Neuer Eintrag…";

  if (list.items.length === 0) {
    listEl.appendChild(emptyHint("Diese Liste ist noch leer."));
    return;
  }

  for (const item of list.items) {
    const li = document.createElement("li");
    li.className = "row" + (item.done ? " done" : "");

    const main = document.createElement("button");
    main.className = "row-main";

    const check = document.createElement("span");
    check.className = "checkbox";
    check.textContent = "✓";

    const text = document.createElement("span");
    text.className = "item-text";
    text.textContent = item.text;

    main.append(check, text);
    main.addEventListener("click", () => {
      item.done = !item.done; // abhaken / wieder aktivieren
      save();
      render();
    });

    const del = deleteButton(() => {
      list.items = list.items.filter((i) => i.id !== item.id);
      save();
      render();
    });

    li.append(main, del);
    listEl.appendChild(li);
  }
}

function emptyHint(text) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = text;
  return li;
}

function deleteButton(onClick) {
  const btn = document.createElement("button");
  btn.className = "delete";
  btn.setAttribute("aria-label", "Löschen");
  btn.textContent = "×";
  btn.addEventListener("click", onClick);
  return btn;
}

// ---- 4. Aktionen ----
function addEntry() {
  const text = inputEl.value.trim();
  if (!text) return;

  if (activeListId === null) {
    data.lists.push({ id: uid(), name: text, items: [] });
  } else {
    activeList().items.push({ id: uid(), text: text, done: false });
  }

  inputEl.value = "";
  save();
  render();
  inputEl.focus(); // praktisch, um mehrere Einträge hintereinander zu tippen
}

addBtn.addEventListener("click", addEntry);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addEntry();
});

backBtn.addEventListener("click", () => {
  activeListId = null;
  render();
});

clearBtn.addEventListener("click", () => {
  const list = activeList();
  list.items = list.items.filter((i) => !i.done);
  save();
  render();
});

// ---- 5. Service Worker registrieren (Offline-Fähigkeit, siehe Schritt 7) ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

// ---- Start ----
render();