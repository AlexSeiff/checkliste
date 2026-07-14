// ============================================================
// Opas Haushalt – App-Logik
// ============================================================

// ---- 1. Datenhaltung (localStorage) ----
const STORAGE_KEY = "checklist-data";

let data = load();
let view = "home"; // home | routine | shopping | lists | listDetail
let activeListId = null;
let zeigeVorschlaege = false;

function load() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    d = {};
  }
  return {
    lists: d.lists ?? [],       // eigene Listen (wie bisher)
    shopping: d.shopping ?? [], // Einkaufsliste
    run: d.run ?? null,         // heutiger Routine-Durchlauf
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

// ---- 2. Datum & Müll ----
function dateStr(dt = new Date()) {
  return (
    dt.getFullYear() + "-" +
    String(dt.getMonth() + 1).padStart(2, "0") + "-" +
    String(dt.getDate()).padStart(2, "0")
  );
}

function morgenStr() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return dateStr(t);
}

function fmtDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function naechsteAbfuhren(anzahl) {
  const heute = dateStr();
  return ABFUHR.filter((e) => e.d >= heute).slice(0, anzahl);
}

function tonnenFarbe(label) {
  const l = label.toLowerCase();
  if (l.includes("wertstoff") || l.includes("plaste") || l.includes("gelb")) return "#d99000";
  if (l.includes("bio")) return "#7a5230";
  if (l.includes("papier")) return "#2456e6";
  return "#4a5361"; // Hausmüll / Rest
}

function abfuhrHinweis(d) {
  if (d === dateStr()) return "wird heute geholt";
  if (d === morgenStr()) return "heute Abend rausstellen!";
  return null;
}

// ---- 3. DOM-Referenzen & Helfer ----
const titleEl = document.getElementById("title");
const backBtn = document.getElementById("back-btn");
const actionBtn = document.getElementById("header-action");
const mainEl = document.getElementById("main");
const footerEl = document.getElementById("footer");
const inputEl = document.getElementById("new-entry");
const addBtn = document.getElementById("add-btn");
const toastEl = document.getElementById("toast");

// kleiner Baukasten: Element mit Klasse und Text erzeugen (XSS-sicher)
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1700);
}

// Kopfzeile + Fußzeile je Ansicht konfigurieren
function setChrome(opts) {
  titleEl.textContent = opts.titel;
  backBtn.hidden = !opts.zurueck;
  if (opts.action) {
    actionBtn.hidden = false;
    actionBtn.textContent = opts.action;
  } else {
    actionBtn.hidden = true;
  }
  footerEl.hidden = !opts.footer;
  if (opts.placeholder) inputEl.placeholder = opts.placeholder;
}

// ---- 4. Routine-Durchlauf ----
const aktuellerLauf = () =>
  data.run && data.run.date === dateStr() ? data.run : null;

function starteLauf() {
  data.run = { date: dateStr(), idx: 0, res: {}, sub: {} };
  save();
  view = "routine";
  render();
}

function schrittWeiter(ergebnis) {
  const lauf = aktuellerLauf();
  lauf.res[ROUTINE[lauf.idx].id] = ergebnis;
  lauf.idx++;
  save();
  render();
}

function zurEinkaufsliste(text) {
  const schonDrauf = data.shopping.some((i) => !i.done && i.text === text);
  if (schonDrauf) {
    toast("Steht schon auf der Einkaufsliste");
    return;
  }
  data.shopping.push({ id: uid(), text: text, done: false });
  save();
  toast(text + " → Einkaufsliste ✓");
}

// ---- 5. Rendering ----
function render() {
  mainEl.innerHTML = "";
  if (view === "home") renderHome();
  else if (view === "routine") renderRoutine();
  else if (view === "shopping") renderShopping();
  else if (view === "lists") renderLists();
  else if (view === "listDetail") renderListDetail();
  window.scrollTo(0, 0);
}

// --- Ansicht: Übersicht ---
function renderHome() {
  setChrome({ titel: "Opas Haushalt", zurueck: false, footer: false });

  // Mülltonnen
  const muell = el("section", "card");
  muell.append(el("h2", "card-title", "Mülltonnen"));
  const termine = naechsteAbfuhren(3);
  if (termine.length === 0) {
    muell.append(el("p", "muted", "Keine Termine mehr im Kalender – Zeit, den neuen Abfuhrkalender einzuspielen."));
  }
  for (const t of termine) {
    muell.append(abfuhrZeile(t));
  }
  mainEl.append(muell);

  // Besuchs-Routine
  const rout = el("section", "card");
  rout.append(el("h2", "card-title", "Besuchs-Routine"));
  const lauf = aktuellerLauf();
  if (lauf && lauf.idx >= ROUTINE.length) {
    const erledigt = Object.values(lauf.res).filter((r) => r === "done").length;
    rout.append(el("p", "muted", "Heute abgeschlossen ✓ – " + erledigt + " von " + ROUTINE.length + " Schritten erledigt."));
    const nochmal = el("button", "btn ghost", "Nochmal durchgehen");
    nochmal.addEventListener("click", starteLauf);
    rout.append(nochmal);
  } else if (lauf) {
    rout.append(el("p", "muted", "Du warst schon dabei – einfach weitermachen."));
    const weiter = el("button", "btn primary", "Fortsetzen – Schritt " + (lauf.idx + 1) + " von " + ROUTINE.length);
    weiter.addEventListener("click", () => { view = "routine"; render(); });
    rout.append(weiter);
  } else {
    rout.append(el("p", "muted", ROUTINE.length + " Schritte – vom Getränk bis zum Ladekabel-Check."));
    const start = el("button", "btn primary", "Routine starten");
    start.addEventListener("click", starteLauf);
    rout.append(start);
  }
  mainEl.append(rout);

  // Einkaufsliste
  const offen = data.shopping.filter((i) => !i.done).length;
  mainEl.append(navCard("Einkaufsliste", offen ? offen + " offen" : "leer", () => {
    view = "shopping";
    render();
  }));

  // Eigene Listen
  const anz = data.lists.length;
  mainEl.append(navCard("Eigene Listen", anz ? anz + (anz === 1 ? " Liste" : " Listen") : "noch keine", () => {
    view = "lists";
    render();
  }));

  // Gut zu wissen
  const info = el("section", "card");
  info.append(el("h2", "card-title", "Gut zu wissen"));
  for (const i of INFOS) {
    const row = el("div", "info-row");
    row.append(el("span", "info-icon", i.icon), el("span", null, i.text));
    info.append(row);
  }
  mainEl.append(info);
}

function abfuhrZeile(t) {
  const row = el("div", "abfuhr-row");
  const dot = el("span", "dot");
  dot.style.background = tonnenFarbe(t.t);
  const info = el("div", "abfuhr-info");
  info.append(el("div", "abfuhr-label", t.t), el("div", "muted small", fmtDate(t.d)));
  row.append(dot, info);
  const hinweis = abfuhrHinweis(t.d);
  if (hinweis) row.append(el("span", "badge", hinweis));
  return row;
}

function navCard(titel, untertitel, onClick) {
  const card = el("button", "card nav-card");
  const box = el("div");
  box.append(el("div", "nav-title", titel), el("div", "muted small", untertitel));
  card.append(box, el("span", "chevron", "›"));
  card.addEventListener("click", onClick);
  return card;
}

// --- Ansicht: geführte Routine ---
function renderRoutine() {
  const lauf = aktuellerLauf();
  if (!lauf) { view = "home"; render(); return; }

  // Abschluss-Bildschirm
  if (lauf.idx >= ROUTINE.length) {
    setChrome({ titel: "Geschafft!", zurueck: true, footer: false });
    const card = el("section", "card center");
    card.append(el("div", "big-check", "✓"));
    const erledigt = ROUTINE.filter((s) => lauf.res[s.id] === "done");
    const uebersprungen = ROUTINE.filter((s) => lauf.res[s.id] === "skip");
    card.append(el("h2", "step-title", erledigt.length + " erledigt · " + uebersprungen.length + " übersprungen"));
    if (uebersprungen.length) {
      card.append(el("p", "muted", "Übersprungen: " + uebersprungen.map((s) => s.title).join(", ")));
    }
    const offen = data.shopping.filter((i) => !i.done).length;
    if (offen) {
      card.append(el("p", "muted", "Auf der Einkaufsliste warten " + offen + " Einträge."));
    }
    const fertig = el("button", "btn primary", "Zur Übersicht");
    fertig.addEventListener("click", () => { view = "home"; render(); });
    card.append(fertig);
    mainEl.append(card);
    return;
  }

  const schritt = ROUTINE[lauf.idx];
  setChrome({
    titel: "Schritt " + (lauf.idx + 1) + " von " + ROUTINE.length,
    zurueck: true,
    footer: false,
    action: "Pause",
  });

  // Fortschrittsbalken
  const prog = el("div", "progress");
  const fill = el("div", "progress-fill");
  fill.style.width = Math.round((lauf.idx / ROUTINE.length) * 100) + "%";
  prog.append(fill);
  mainEl.append(prog);

  // Schritt-Karte
  const card = el("section", "card step-card");
  card.append(el("h2", "step-title", schritt.title));
  if (schritt.detail) card.append(el("p", "step-detail", schritt.detail));

  // dynamischer Block: nächste Abholtermine
  if (schritt.dynamic === "muell") {
    const box = el("div", "muell-box");
    for (const t of naechsteAbfuhren(3)) box.append(abfuhrZeile(t));
    card.append(box);
  }

  // Unterpunkte zum Abhaken (mit Korb-Knopf für die Einkaufsliste)
  if (schritt.items) {
    const sub = (lauf.sub[schritt.id] ??= {});
    const ul = el("ul", "sub-list");
    schritt.items.forEach((text, i) => {
      const li = el("li", "row" + (sub[i] ? " done" : ""));
      const main = el("button", "row-main");
      main.append(el("span", "checkbox", "✓"), el("span", "item-text", text));
      main.addEventListener("click", () => {
        sub[i] = !sub[i];
        save();
        render();
      });
      li.append(main);
      if (schritt.einkauf) {
        const korb = el("button", "cart", "🛒");
        korb.setAttribute("aria-label", text + " auf die Einkaufsliste setzen");
        korb.addEventListener("click", () => zurEinkaufsliste(text));
        li.append(korb);
      }
      ul.append(li);
    });
    card.append(ul);
  }

  mainEl.append(card);

  // Aktions-Buttons
  const actions = el("div", "step-actions");
  const done = el("button", "btn primary", "✓ Erledigt");
  done.addEventListener("click", () => schrittWeiter("done"));
  const skip = el("button", "btn ghost", "Überspringen");
  skip.addEventListener("click", () => schrittWeiter("skip"));
  actions.append(done, skip);
  mainEl.append(actions);
}

// --- Ansicht: Einkaufsliste ---
function renderShopping() {
  setChrome({
    titel: "Einkaufsliste",
    zurueck: true,
    footer: true,
    placeholder: "Neuer Eintrag…",
    action: data.shopping.some((i) => i.done) ? "Gekaufte entfernen" : null,
  });

  const toggle = el("button", "chips-toggle", zeigeVorschlaege ? "Vorschläge ausblenden" : "Vorschläge einblenden");
  toggle.addEventListener("click", () => {
    zeigeVorschlaege = !zeigeVorschlaege;
    render();
  });
  mainEl.append(toggle);

  if (zeigeVorschlaege) {
    const wrap = el("div", "chips");
    const offeneTexte = new Set(data.shopping.filter((i) => !i.done).map((i) => i.text));
    for (const v of EINKAUF_VORSCHLAEGE) {
      if (offeneTexte.has(v)) continue;
      const chip = el("button", "chip", "+ " + v);
      chip.addEventListener("click", () => {
        zurEinkaufsliste(v);
        render();
      });
      wrap.append(chip);
    }
    if (!wrap.children.length) {
      wrap.append(el("p", "muted small", "Alle Vorschläge stehen schon auf der Liste."));
    }
    mainEl.append(wrap);
  }

  const ul = el("ul");
  if (data.shopping.length === 0) {
    ul.append(emptyHint("Die Einkaufsliste ist leer."));
  }
  for (const item of data.shopping) {
    const li = el("li", "row" + (item.done ? " done" : ""));
    const main = el("button", "row-main");
    main.append(el("span", "checkbox", "✓"), el("span", "item-text", item.text));
    main.addEventListener("click", () => {
      item.done = !item.done;
      save();
      render();
    });
    const del = deleteButton(() => {
      data.shopping = data.shopping.filter((i) => i.id !== item.id);
      save();
      render();
    });
    li.append(main, del);
    ul.append(li);
  }
  mainEl.append(ul);
}

// --- Ansicht: eigene Listen (Übersicht) ---
function renderLists() {
  setChrome({ titel: "Eigene Listen", zurueck: true, footer: true, placeholder: "Neue Liste…" });

  const ul = el("ul");
  if (data.lists.length === 0) {
    ul.append(emptyHint("Noch keine Listen – leg unten eine an!"));
  }
  for (const list of data.lists) {
    const li = el("li", "row");
    const main = el("button", "row-main");
    const doneCount = list.items.filter((i) => i.done).length;
    const count = el("span", "count", doneCount + "/" + list.items.length);
    main.append(el("span", null, list.name), count);
    main.addEventListener("click", () => {
      activeListId = list.id;
      view = "listDetail";
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
    ul.append(li);
  }
  mainEl.append(ul);
}

// --- Ansicht: eine eigene Liste ---
const aktiveListe = () => data.lists.find((l) => l.id === activeListId);

function renderListDetail() {
  const list = aktiveListe();
  if (!list) { view = "lists"; render(); return; }

  setChrome({
    titel: list.name,
    zurueck: true,
    footer: true,
    placeholder: "Neuer Eintrag…",
    action: list.items.some((i) => i.done) ? "Erledigte löschen" : null,
  });

  const ul = el("ul");
  if (list.items.length === 0) {
    ul.append(emptyHint("Diese Liste ist noch leer."));
  }
  for (const item of list.items) {
    const li = el("li", "row" + (item.done ? " done" : ""));
    const main = el("button", "row-main");
    main.append(el("span", "checkbox", "✓"), el("span", "item-text", item.text));
    main.addEventListener("click", () => {
      item.done = !item.done;
      save();
      render();
    });
    const del = deleteButton(() => {
      list.items = list.items.filter((i) => i.id !== item.id);
      save();
      render();
    });
    li.append(main, del);
    ul.append(li);
  }
  mainEl.append(ul);
}

function emptyHint(text) {
  return el("li", "empty", text);
}

function deleteButton(onClick) {
  const btn = el("button", "delete", "×");
  btn.setAttribute("aria-label", "Löschen");
  btn.addEventListener("click", onClick);
  return btn;
}

// ---- 6. Aktionen (Kopf- und Fußzeile) ----
function addEntry() {
  const text = inputEl.value.trim();
  if (!text) return;

  if (view === "shopping") {
    data.shopping.push({ id: uid(), text: text, done: false });
  } else if (view === "lists") {
    data.lists.push({ id: uid(), name: text, items: [] });
  } else if (view === "listDetail") {
    aktiveListe().items.push({ id: uid(), text: text, done: false });
  } else {
    return;
  }
  inputEl.value = "";
  save();
  render();
  inputEl.focus();
}

addBtn.addEventListener("click", addEntry);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addEntry();
});

backBtn.addEventListener("click", () => {
  if (view === "routine") {
    const lauf = aktuellerLauf();
    if (lauf && lauf.idx > 0) {
      // einen Schritt zurück (Antwort des Schritts verwerfen)
      lauf.idx--;
      delete lauf.res[ROUTINE[lauf.idx].id];
      save();
      render();
    } else {
      view = "home";
      render();
    }
  } else if (view === "listDetail") {
    activeListId = null;
    view = "lists";
    render();
  } else {
    view = "home";
    render();
  }
});

actionBtn.addEventListener("click", () => {
  if (view === "routine") {
    // Pause: Fortschritt bleibt gespeichert
    view = "home";
    render();
  } else if (view === "shopping") {
    data.shopping = data.shopping.filter((i) => !i.done);
    save();
    render();
  } else if (view === "listDetail") {
    const list = aktiveListe();
    list.items = list.items.filter((i) => !i.done);
    save();
    render();
  }
});

// ---- 7. Service Worker registrieren ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

// ---- Start ----
render();
