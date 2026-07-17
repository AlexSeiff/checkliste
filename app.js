// ============================================================
// Opas Haushalt – App-Logik (v3)
// ============================================================

// ---- 1. Datenhaltung (localStorage) ----
const STORAGE_KEY = "checklist-data";

const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

function load() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    d = {};
  }
  return {
    lists: d.lists ?? [],       // eigene Listen
    shopping: d.shopping ?? [], // Einkaufsliste
    run: d.run ?? null,         // heutiger Routine-Durchlauf
    weights: d.weights ?? [],   // Gewichtsliste [{ id, date, kg }], neueste zuerst
    events: d.events ?? [],     // eigene Termine [{ id, date, text }]
    // "Gut zu wissen": beim allerersten Start mit den Standard-Infos befüllen,
    // danach lebt die Liste im localStorage und ist frei editierbar
    notes: d.notes ?? INFOS.map((i) => ({ id: uid(), text: i.icon + " " + i.text })),
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = load();
let view = "home"; // home | routine | shopping | lists | listDetail | weight | calendar | notes
let activeListId = null;
let zeigeVorschlaege = false;

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

// ---- 3. Gewicht & Termine ----
const letztesGewicht = () => data.weights[0] ?? null;

const gewichtsWarnung = () => {
  const g = letztesGewicht();
  return g !== null && g.kg > 75;
};

function fmtKg(kg) {
  return kg.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}

function naechsterTermin() {
  const heute = dateStr();
  return (
    data.events
      .filter((e) => e.date >= heute)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

// ---- 4. DOM-Referenzen & Helfer ----
const titleEl = document.getElementById("title");
const backBtn = document.getElementById("back-btn");
const actionBtn = document.getElementById("header-action");
const mainEl = document.getElementById("main");
const footerEl = document.getElementById("footer");
const inputEl = document.getElementById("new-entry");
const addBtn = document.getElementById("add-btn");
const toastEl = document.getElementById("toast");

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
  inputEl.inputMode = opts.inputmode ?? "text"; // "decimal" -> Zahlentastatur am Handy
}

// ---- 5. Routine-Durchlauf ----
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

function teileEinkaufsliste() {
  const offene = data.shopping.filter((i) => !i.done).map((i) => "- " + i.text);
  if (offene.length === 0) {
    toast("Die Liste ist leer");
    return;
  }
  const text = "Einkaufsliste:\n" + offene.join("\n");
  if (navigator.share) {
    // Handy: öffnet das Teilen-Menü (WhatsApp, Mail, ...)
    navigator.share({ text: text }).catch(() => {});
  } else {
    // Desktop: in die Zwischenablage
    navigator.clipboard
      .writeText(text)
      .then(() => toast("Liste kopiert – z. B. in WhatsApp einfügen"))
      .catch(() => toast("Kopieren nicht möglich"));
  }
}

// ---- 6. Rendering ----
function render() {
  mainEl.innerHTML = "";
  if (view === "home") renderHome();
  else if (view === "routine") renderRoutine();
  else if (view === "shopping") renderShopping();
  else if (view === "lists") renderLists();
  else if (view === "listDetail") renderListDetail();
  else if (view === "weight") renderWeight();
  else if (view === "calendar") renderCalendar();
  else if (view === "notes") renderNotes();
  window.scrollTo(0, 0);
}

// --- Ansicht: Übersicht ---
function renderHome() {
  setChrome({ titel: "Opas Haushalt", zurueck: false, footer: false });

  // Warnung, solange der letzte Gewichtseintrag über 75 kg liegt
  if (gewichtsWarnung()) {
    const warn = el("button", "card warn-card");
    warn.append(el("div", "warn-title", "⚠️ Opa braucht zusätzliche Entwässerungstabletten"));
    warn.append(el("div", "warn-sub", "Letztes Gewicht: " + fmtKg(letztesGewicht().kg) + " – antippen für die Gewichtsliste"));
    warn.addEventListener("click", () => { view = "weight"; render(); });
    mainEl.append(warn);
  }

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

  // Termine
  const t = naechsterTermin();
  mainEl.append(navCard("Termine", t ? "als Nächstes: " + fmtDate(t.date) + " – " + t.text : "nichts Eigenes geplant", () => {
    view = "calendar";
    render();
  }));

  // Einkaufsliste
  const offen = data.shopping.filter((i) => !i.done).length;
  mainEl.append(navCard("Einkaufsliste", offen ? offen + " offen" : "leer", () => {
    view = "shopping";
    render();
  }));

  // Gewichtsliste
  const g = letztesGewicht();
  mainEl.append(navCard("Gewichtsliste", g ? "zuletzt " + fmtKg(g.kg) + " (" + fmtDate(g.date) + ")" : "noch kein Eintrag", () => {
    view = "weight";
    render();
  }));

  // Eigene Listen
  const anz = data.lists.length;
  mainEl.append(navCard("Eigene Listen", anz ? anz + (anz === 1 ? " Liste" : " Listen") : "noch keine", () => {
    view = "lists";
    render();
  }));

  // Gut zu wissen (editierbar über "Bearbeiten")
  const info = el("section", "card");
  const kopf = el("div", "card-head");
  kopf.append(el("h2", "card-title", "Gut zu wissen"));
  const edit = el("button", "edit-link", "Bearbeiten");
  edit.addEventListener("click", () => { view = "notes"; render(); });
  kopf.append(edit);
  info.append(kopf);
  if (data.notes.length === 0) {
    info.append(el("p", "muted", "Keine Einträge – über „Bearbeiten“ etwas hinzufügen."));
  }
  for (const n of data.notes) {
    info.append(el("div", "info-row", n.text));
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

  if (schritt.dynamic === "muell") {
    const box = el("div", "muell-box");
    for (const t of naechsteAbfuhren(3)) box.append(abfuhrZeile(t));
    card.append(box);
  }

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

  const leiste = el("div", "toolbar");
  const toggle = el("button", "chips-toggle", zeigeVorschlaege ? "Vorschläge ausblenden" : "Vorschläge einblenden");
  toggle.addEventListener("click", () => {
    zeigeVorschlaege = !zeigeVorschlaege;
    render();
  });
  const teilen = el("button", "chips-toggle", "Liste verschicken");
  teilen.addEventListener("click", teileEinkaufsliste);
  leiste.append(toggle, teilen);
  mainEl.append(leiste);

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

// --- Ansicht: Gewichtsliste ---
function renderWeight() {
  setChrome({
    titel: "Gewichtsliste",
    zurueck: true,
    footer: true,
    placeholder: "Gewicht in kg, z. B. 74,5",
    inputmode: "decimal",
  });

  if (gewichtsWarnung()) {
    const warn = el("div", "card warn-card");
    warn.append(el("div", "warn-title", "⚠️ Opa braucht zusätzliche Entwässerungstabletten"));
    mainEl.append(warn);
  }

  mainEl.append(el("p", "muted small hint", "Jeden 2. Tag wiegen. Schnelle Zunahme ist meist Wassereinlagerung – ab 75 kg erscheint hier die Warnung."));

  const ul = el("ul");
  if (data.weights.length === 0) {
    ul.append(emptyHint("Noch kein Eintrag – unten das erste Gewicht eintragen."));
  }
  data.weights.forEach((w, i) => {
    const li = el("li", "row");
    const main = el("div", "row-main static");
    main.append(el("span", "weight-kg", fmtKg(w.kg)));
    const aelter = data.weights[i + 1]; // Differenz zum vorherigen Eintrag
    if (aelter) {
      const diff = w.kg - aelter.kg;
      const diffTxt = (diff > 0 ? "+" : "") +
        diff.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      main.append(el("span", "weight-diff" + (diff > 0 ? " up" : ""), diffTxt));
    }
    main.append(el("span", "count", fmtDate(w.date)));
    const del = deleteButton(() => {
      data.weights = data.weights.filter((x) => x.id !== w.id);
      save();
      render();
    });
    li.append(main, del);
    ul.append(li);
  });
  mainEl.append(ul);
}

// --- Ansicht: Termine (Kalender) ---
function renderCalendar() {
  setChrome({ titel: "Termine", zurueck: true, footer: false });

  // Eingabe: Datum + Beschreibung
  const form = el("div", "event-form");
  const dateInput = el("input", "field");
  dateInput.type = "date";
  dateInput.value = dateStr();
  const textInput = el("input", "field");
  textInput.type = "text";
  textInput.placeholder = "Was steht an? z. B. Fußpflege";
  const addB = el("button", "btn primary", "Termin eintragen");
  addB.addEventListener("click", () => {
    const txt = textInput.value.trim();
    if (!dateInput.value || !txt) {
      toast("Datum und Beschreibung angeben");
      return;
    }
    data.events.push({ id: uid(), date: dateInput.value, text: txt });
    save();
    render();
  });
  form.append(dateInput, textInput, addB);
  mainEl.append(form);

  const heute = dateStr();

  // Kommende Einträge: eigene Termine + Mülltermine, gemischt sortiert
  const kommende = [
    ...data.events
      .filter((e) => e.date >= heute)
      .map((e) => ({ id: e.id, date: e.date, text: e.text, muell: false })),
    ...ABFUHR
      .filter((a) => a.d >= heute)
      .map((a) => ({ id: null, date: a.d, text: a.t, muell: true })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const ul = el("ul");
  if (kommende.length === 0) ul.append(emptyHint("Nichts geplant."));
  for (const e of kommende) {
    const li = el("li", "row");
    const main = el("div", "row-main static");
    if (e.muell) {
      const dot = el("span", "dot");
      dot.style.background = tonnenFarbe(e.text);
      main.append(dot);
    }
    const info = el("div", "event-info");
    info.append(el("div", "event-text", e.text), el("div", "muted small", fmtDate(e.date)));
    main.append(info);
    if (e.date === heute) main.append(el("span", "badge", "heute"));
    li.append(main);
    if (!e.muell) {
      li.append(deleteButton(() => {
        data.events = data.events.filter((x) => x.id !== e.id);
        save();
        render();
      }));
    }
    ul.append(li);
  }
  mainEl.append(ul);

  // Vergangene eigene Termine (Mülltermine werden nicht mitgeschleppt)
  const vergangene = data.events
    .filter((e) => e.date < heute)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (vergangene.length) {
    mainEl.append(el("p", "section-label", "Vergangen"));
    const ul2 = el("ul");
    for (const e of vergangene) {
      const li = el("li", "row done");
      const main = el("div", "row-main static");
      const info = el("div", "event-info");
      info.append(el("div", "event-text item-text", e.text), el("div", "muted small", fmtDate(e.date)));
      main.append(info);
      li.append(main, deleteButton(() => {
        data.events = data.events.filter((x) => x.id !== e.id);
        save();
        render();
      }));
      ul2.append(li);
    }
    mainEl.append(ul2);
  }
}

// --- Ansicht: Gut zu wissen bearbeiten ---
function renderNotes() {
  setChrome({ titel: "Gut zu wissen", zurueck: true, footer: true, placeholder: "Neuer Eintrag…" });

  mainEl.append(el("p", "muted small hint", "Diese Einträge stehen auf der Übersicht. Neues unten eintippen (Emojis gehen mit), Überholtes mit × löschen."));

  const ul = el("ul");
  if (data.notes.length === 0) {
    ul.append(emptyHint("Keine Einträge – leg unten einen an."));
  }
  for (const n of data.notes) {
    const li = el("li", "row");
    const main = el("div", "row-main static");
    main.append(el("span", "note-text", n.text));
    li.append(main, deleteButton(() => {
      data.notes = data.notes.filter((x) => x.id !== n.id);
      save();
      render();
    }));
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

// ---- 7. Aktionen (Kopf- und Fußzeile) ----
function addEntry() {
  const text = inputEl.value.trim();
  if (!text) return;

  if (view === "shopping") {
    data.shopping.push({ id: uid(), text: text, done: false });
  } else if (view === "lists") {
    data.lists.push({ id: uid(), name: text, items: [] });
  } else if (view === "listDetail") {
    aktiveListe().items.push({ id: uid(), text: text, done: false });
  } else if (view === "notes") {
    data.notes.push({ id: uid(), text: text });
  } else if (view === "weight") {
    const kg = parseFloat(text.replace(",", ".")); // "74,5" -> 74.5
    if (isNaN(kg) || kg <= 0 || kg >= 300) {
      toast("Bitte ein Gewicht in kg eingeben, z. B. 74,5");
      return;
    }
    data.weights.unshift({ id: uid(), date: dateStr(), kg: Math.round(kg * 10) / 10 });
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
    view = "home"; // Pause: Fortschritt bleibt gespeichert
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

// ---- 8. Service Worker registrieren ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

// ---- Start ----
render();
