// ============================================================
// Opas Haushalt – App-Logik (v6)
// ============================================================

// ---- 1. Datenhaltung (localStorage) ----
const STORAGE_KEY = "checklist-data";

const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

function leereDaten() {
  return {
    lists: [],       // eigene Listen
    shopping: [],    // Einkaufsliste
    run: null,       // heutiger Routine-Durchlauf
    weights: [],     // Gewichtsliste [{ id, date, kg }], neueste zuerst
    events: [],      // eigene Termine [{ id, date, text }]
    notes: [],       // "Gut zu wissen"
  };
}

function normalisiere(d) {
  const n = leereDaten();
  if (d && typeof d === "object") {
    for (const k of Object.keys(n)) {
      if (k === "run") n.run = d.run ?? null;
      else if (Array.isArray(d[k])) n[k] = d[k];
    }
  }
  // Gewichte immer neueste zuerst – die Differenz-Anzeige verlässt sich darauf
  n.weights.sort((a, b) => b.date.localeCompare(a.date));
  // Durchläufe aus älteren App-Versionen kennen die Unterpunkte noch nicht
  if (n.run && typeof n.run.sub !== "object") n.run.sub = {};
  return n;
}

function load() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    d = null;
  }
  const neu = d === null;
  const daten = normalisiere(d);
  // "Gut zu wissen": beim allerersten Start mit den Standard-Infos befüllen,
  // danach lebt die Liste im localStorage und ist frei editierbar
  if (neu) {
    daten.notes = INFOS.map((i) => ({ id: uid(), text: i.icon + " " + i.text }));
  }
  return daten;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = load();
// home | routine | shopping | lists | listDetail | weight | calendar | notes | backup
let view = "home";
let activeListId = null;
let zeigeVorschlaege = false;
let zeigeAlleAbfuhr = false;

// ---- 2. Datum & Müll ----
function dateStr(dt = new Date()) {
  return (
    dt.getFullYear() + "-" +
    String(dt.getMonth() + 1).padStart(2, "0") + "-" +
    String(dt.getDate()).padStart(2, "0")
  );
}

function alsDatum(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Abstand in ganzen Tagen: tageDiff("2026-08-14", "2026-08-11") === 3
function tageDiff(a, b) {
  return Math.round((alsDatum(a) - alsDatum(b)) / 86400000);
}

function morgenStr() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return dateStr(t);
}

function fmtDate(s) {
  return alsDatum(s).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function fmtTage(n) {
  return n === 1 ? "einem Tag" : n + " Tagen";
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
  return "#7d8794"; // Hausmüll / Rest
}

function abfuhrHinweis(d) {
  if (d === dateStr()) return "wird heute geholt";
  if (d === morgenStr()) return "heute Abend rausstellen!";
  return null;
}

// Wie viele Tage reicht der eingespielte Abfuhrkalender noch?
// null = noch lange genug, sonst die verbleibenden Tage (0 = heute ist der letzte).
function abfuhrReichweite() {
  const letzte = ABFUHR[ABFUHR.length - 1];
  if (!letzte) return 0;
  const rest = tageDiff(letzte.d, dateStr());
  return rest <= 28 ? Math.max(rest, 0) : null;
}

// ---- 3. Gewicht & Termine ----
const letztesGewicht = () => data.weights[0] ?? null;

const gewichtsWarnung = () => {
  const g = letztesGewicht();
  return g !== null && g.kg > 75;
};

// Schnelle Zunahme ist das eigentliche Alarmsignal für Wassereinlagerung:
// niedrigsten Wert der letzten 4 Tage mit dem aktuellen vergleichen.
function trendWarnung() {
  const neu = letztesGewicht();
  if (!neu) return null;
  let tief = null;
  for (let i = 1; i < data.weights.length; i++) {
    const alt = data.weights[i];
    const t = tageDiff(neu.date, alt.date);
    if (t <= 0) continue;
    if (t > 4) break;
    if (!tief || alt.kg < tief.kg) tief = alt;
  }
  if (!tief) return null;
  const diff = Math.round((neu.kg - tief.kg) * 10) / 10;
  if (diff < 1) return null;
  return { diff: diff, tage: tageDiff(neu.date, tief.date) };
}

// Erinnerung ans Wiegen (laut Routine jeden 2. Tag)
function tageSeitWiegen() {
  const g = letztesGewicht();
  return g ? tageDiff(dateStr(), g.date) : null;
}

function fmtKg(kg) {
  return kg.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}

function fmtDiff(diff) {
  return (diff > 0 ? "+" : "") +
    diff.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

// Kurzes Tacken beim Abhaken – auf Android spürbar, sonst wirkungslos
function buzz() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* egal */
  }
}

let toastTimer;
function toast(msg, onUndo) {
  toastEl.textContent = "";
  toastEl.append(el("span", "toast-text", msg));
  if (onUndo) {
    const b = el("button", "toast-undo", "Rückgängig");
    b.addEventListener("click", () => {
      clearTimeout(toastTimer);
      toastEl.classList.remove("show");
      onUndo();
    });
    toastEl.append(b);
  }
  toastEl.classList.toggle("with-undo", !!onUndo);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), onUndo ? 5000 : 1700);
}

// Löschen ist auf dem Handy schnell mal ein Fehltipper – deshalb rückholbar
function loescheMitUndo(arr, id, bezeichnung) {
  const idx = arr.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const [entfernt] = arr.splice(idx, 1);
  save();
  render();
  toast(bezeichnung + " gelöscht", () => {
    arr.splice(idx, 0, entfernt);
    save();
    render();
  });
}

function setChrome(opts) {
  titleEl.textContent = opts.titel;
  backBtn.hidden = !opts.zurueck;
  footerEl.hidden = !opts.footer;
  if (opts.placeholder) inputEl.placeholder = opts.placeholder;
  inputEl.inputMode = opts.inputmode ?? "text"; // "decimal" -> Zahlentastatur am Handy
  aktualisiereAktion();
}

// Die Kopfzeilen-Aktion hängt am Datenstand und muss auch ohne
// Neuzeichnen stimmen (z. B. direkt nach dem Abhaken einer Zeile).
function aktualisiereAktion() {
  let aktion = null;
  if (view === "routine") {
    aktion = aktuellerLauf() && aktuellerLauf().idx < ROUTINE.length ? "Pause" : null;
  } else if (view === "shopping") {
    aktion = data.shopping.some((i) => i.done) ? "Gekaufte entfernen" : null;
  } else if (view === "listDetail") {
    const list = aktiveListe();
    aktion = list && list.items.some((i) => i.done) ? "Erledigte löschen" : null;
  }
  actionBtn.hidden = !aktion;
  if (aktion) actionBtn.textContent = aktion;
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

// ---- 6. Sicherung (Export / Import) ----
const BACKUP_MARKE = "opas-haushalt";

function backupText() {
  return JSON.stringify(
    { app: BACKUP_MARKE, stand: new Date().toISOString(), data: data },
    null,
    2
  );
}

const backupDateiname = () => "opas-haushalt-" + dateStr() + ".json";

function backupHerunterladen() {
  const blob = new Blob([backupText()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a");
  a.href = url;
  a.download = backupDateiname();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Sicherung gespeichert");
}

async function backupVerschicken() {
  const text = backupText();

  // 1. Wahl: als Datei teilen – kommt in Mail und WhatsApp heil an
  let datei = null;
  try {
    datei = new File([text], backupDateiname(), { type: "application/json" });
  } catch {
    datei = null;
  }
  if (datei && navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: "Opas Haushalt – Sicherung" });
    } catch {
      /* vom Nutzer abgebrochen */
    }
    return;
  }

  // 2. Wahl: als Text teilen
  if (navigator.share) {
    try {
      await navigator.share({ title: "Opas Haushalt – Sicherung", text: text });
    } catch {
      /* vom Nutzer abgebrochen */
    }
    return;
  }

  // 3. Wahl (Desktop): in die Zwischenablage
  try {
    await navigator.clipboard.writeText(text);
    toast("Sicherung kopiert – irgendwo sicher einfügen");
  } catch {
    toast("Teilen ging nicht – bitte als Datei speichern");
  }
}

function backupEinlesen(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    toast("Das ist keine gültige Sicherung");
    return;
  }
  const roh = obj && typeof obj === "object" && obj.data ? obj.data : obj;
  const felder = ["lists", "shopping", "weights", "events", "notes"];
  if (!roh || typeof roh !== "object" || !felder.some((k) => Array.isArray(roh[k]))) {
    toast("Das ist keine gültige Sicherung");
    return;
  }
  const neu = normalisiere(roh);
  const zusammenfassung =
    neu.weights.length + " Gewichtseinträge, " +
    neu.events.length + " Termine, " +
    neu.shopping.length + " Einkaufseinträge, " +
    neu.lists.length + " eigene Listen, " +
    neu.notes.length + " Notizen";
  if (!confirm(
    "Sicherung einlesen?\n\n" + zusammenfassung +
    "\n\nAlles, was jetzt in der App steht, wird dabei ersetzt."
  )) return;
  data = neu;
  save();
  view = "home";
  render();
  toast("Sicherung eingelesen ✓");
}

// ---- 7. Rendering ----
// Nach oben scrollen nur, wenn sich der Inhalt wirklich austauscht – nicht
// bei jedem Häkchen. Der Routine-Schritt zählt dabei als eigener "Ort".
function ortsSchluessel() {
  const lauf = view === "routine" ? aktuellerLauf() : null;
  return [view, activeListId ?? "", lauf ? lauf.idx : ""].join("|");
}

let letzterOrt = null;

// Sonst stellt der Browser beim Neuladen die alte Scroll-Position wieder her
// und die App öffnet mitten in einer Liste statt oben.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function render() {
  const ort = ortsSchluessel();
  const gewechselt = ort !== letzterOrt;

  mainEl.innerHTML = "";
  if (view === "home") renderHome();
  else if (view === "routine") renderRoutine();
  else if (view === "shopping") renderShopping();
  else if (view === "lists") renderLists();
  else if (view === "listDetail") renderListDetail();
  else if (view === "weight") renderWeight();
  else if (view === "calendar") renderCalendar();
  else if (view === "notes") renderNotes();
  else if (view === "backup") renderBackup();

  if (gewechselt) {
    window.scrollTo(0, 0);
    mainEl.classList.remove("view-in");
    void mainEl.offsetWidth; // Neustart der Einblend-Animation erzwingen
    mainEl.classList.add("view-in");
  }
  letzterOrt = ortsSchluessel();
}

// Zeile direkt umschalten statt alles neu zu zeichnen: die Liste bleibt
// stehen, wo sie ist, und der Haken kann sauber animieren.
function toggleZeile(li, traeger, schluessel) {
  traeger[schluessel] = !traeger[schluessel];
  save();
  li.classList.toggle("done", !!traeger[schluessel]);
  buzz();
  aktualisiereAktion();
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

  // Schnelle Zunahme – unabhängig vom absoluten Gewicht
  const trend = trendWarnung();
  if (trend) {
    const warn = el("button", "card warn-card");
    warn.append(el("div", "warn-title", "⚠️ " + fmtDiff(trend.diff) + " kg in " + fmtTage(trend.tage)));
    warn.append(el("div", "warn-sub", "Schnelle Zunahme spricht für Wassereinlagerung – Beine anschauen, bei Mama nachfragen."));
    warn.addEventListener("click", () => { view = "weight"; render(); });
    mainEl.append(warn);
  }

  // Ans Wiegen erinnern (laut Routine jeden 2. Tag)
  const seit = tageSeitWiegen();
  if (seit !== null && seit >= 3) {
    const hint = el("button", "card note-card");
    hint.append(el("div", "note-title", "⚖️ Seit " + fmtTage(seit) + " nicht gewogen"));
    hint.append(el("div", "note-sub", "Eigentlich jeden 2. Tag – antippen zum Eintragen."));
    hint.addEventListener("click", () => { view = "weight"; render(); });
    mainEl.append(hint);
  }

  // Besuchs-Routine – der Grund, warum man die App überhaupt aufmacht
  const rout = el("section", "card hero");
  const lauf = aktuellerLauf();
  rout.append(el("div", "hero-label", "Besuchs-Routine"));
  if (lauf && lauf.idx >= ROUTINE.length) {
    const erledigt = Object.values(lauf.res).filter((r) => r === "done").length;
    rout.append(el("h2", "hero-title", "Heute geschafft ✓"));
    rout.append(el("p", "hero-sub", erledigt + " von " + ROUTINE.length + " Schritten erledigt."));
    const nochmal = el("button", "btn ghost", "Nochmal durchgehen");
    nochmal.addEventListener("click", starteLauf);
    rout.append(nochmal);
  } else if (lauf) {
    rout.append(el("h2", "hero-title", "Schritt " + (lauf.idx + 1) + " von " + ROUTINE.length));
    rout.append(el("p", "hero-sub", "Du warst schon dabei – einfach weitermachen."));
    const prog = el("div", "progress");
    const fill = el("div", "progress-fill");
    fill.style.width = Math.round((lauf.idx / ROUTINE.length) * 100) + "%";
    prog.append(fill);
    rout.append(prog);
    const weiter = el("button", "btn primary", "Fortsetzen");
    weiter.addEventListener("click", () => { view = "routine"; render(); });
    rout.append(weiter);
  } else {
    rout.append(el("h2", "hero-title", "Heute noch nicht gestartet"));
    rout.append(el("p", "hero-sub", ROUTINE.length + " Schritte – vom Getränk bis zum Ladekabel-Check."));
    const start = el("button", "btn primary", "Routine starten");
    start.addEventListener("click", starteLauf);
    rout.append(start);
  }
  mainEl.append(rout);

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
  const rest = abfuhrReichweite();
  if (rest !== null && termine.length) {
    muell.append(el("p", "muted small hint-top",
      "Der Abfuhrkalender reicht nur noch " + fmtTage(rest) + " – neuen Kalender der BSR eintragen lassen."));
  }
  mainEl.append(muell);

  // Alles Weitere als kompakte Gruppe statt als vier gleich große Karten
  const gruppe = el("div", "nav-group");

  const t = naechsterTermin();
  gruppe.append(navRow("Termine", t ? "als Nächstes: " + fmtDate(t.date) + " – " + t.text : "nichts Eigenes geplant", () => {
    view = "calendar";
    render();
  }));

  const offen = data.shopping.filter((i) => !i.done).length;
  gruppe.append(navRow("Einkaufsliste", offen ? offen + " offen" : "leer", () => {
    view = "shopping";
    render();
  }));

  const g = letztesGewicht();
  gruppe.append(navRow("Gewichtsliste", g ? "zuletzt " + fmtKg(g.kg) + " (" + fmtDate(g.date) + ")" : "noch kein Eintrag", () => {
    view = "weight";
    render();
  }));

  const anz = data.lists.length;
  gruppe.append(navRow("Eigene Listen", anz ? anz + (anz === 1 ? " Liste" : " Listen") : "noch keine", () => {
    view = "lists";
    render();
  }));

  mainEl.append(gruppe);

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

  // Sicherung
  const sicherung = el("div", "nav-group");
  sicherung.append(navRow("Daten sichern", "Alles liegt nur auf diesem Gerät", () => {
    view = "backup";
    render();
  }));
  mainEl.append(sicherung);
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

function navRow(titel, untertitel, onClick) {
  const card = el("button", "nav-row");
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
      main.addEventListener("click", () => toggleZeile(li, sub, i));
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
  // Beim Öffnen der Liste rutscht Gekauftes nach unten, damit die offenen
  // Posten zusammenstehen. Während des Einkaufs bleibt alles an Ort und Stelle.
  const sortiert = [...data.shopping].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  for (const item of sortiert) {
    const li = el("li", "row" + (item.done ? " done" : ""));
    const main = el("button", "row-main");
    main.append(el("span", "checkbox", "✓"), el("span", "item-text", item.text));
    main.addEventListener("click", () => toggleZeile(li, item, "done"));
    const del = deleteButton(() => loescheMitUndo(data.shopping, item.id, item.text));
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
    warn.append(el("div", "warn-sub", "Letztes Gewicht: " + fmtKg(letztesGewicht().kg)));
    mainEl.append(warn);
  }

  const trend = trendWarnung();
  if (trend) {
    const warn = el("div", "card warn-card");
    warn.append(el("div", "warn-title", "⚠️ " + fmtDiff(trend.diff) + " kg in " + fmtTage(trend.tage)));
    warn.append(el("div", "warn-sub", "Schnelle Zunahme spricht für Wassereinlagerung – Beine anschauen, bei Mama nachfragen."));
    mainEl.append(warn);
  }

  const seit = tageSeitWiegen();
  if (seit !== null && seit >= 3) {
    const hint = el("div", "card note-card");
    hint.append(el("div", "note-title", "⚖️ Seit " + fmtTage(seit) + " nicht gewogen"));
    mainEl.append(hint);
  }

  mainEl.append(el("p", "muted small hint", "Jeden 2. Tag wiegen. Schnelle Zunahme ist meist Wassereinlagerung – gewarnt wird ab 75 kg und bei mehr als 1 kg Zunahme in wenigen Tagen."));

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
      const diff = Math.round((w.kg - aelter.kg) * 10) / 10;
      main.append(el("span", "weight-diff" + (diff > 0 ? " up" : ""), fmtDiff(diff)));
    }
    main.append(el("span", "count", fmtDate(w.date)));
    const del = deleteButton(() => loescheMitUndo(data.weights, w.id, fmtKg(w.kg)));
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

  // Mülltermine laufen über Monate – ungekürzt begraben sie die eigenen
  // Termine. Deshalb nur die nächsten paar, der Rest auf Wunsch.
  const alleAbfuhr = ABFUHR.filter((a) => a.d >= heute);
  const abfuhrAnzahl = zeigeAlleAbfuhr ? alleAbfuhr.length : 5;

  const kommende = [
    ...data.events
      .filter((e) => e.date >= heute)
      .map((e) => ({ id: e.id, date: e.date, text: e.text, muell: false })),
    ...alleAbfuhr
      .slice(0, abfuhrAnzahl)
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
      li.append(deleteButton(() => loescheMitUndo(data.events, e.id, e.text)));
    }
    ul.append(li);
  }
  mainEl.append(ul);

  if (alleAbfuhr.length > 5) {
    const mehr = el("button", "chips-toggle",
      zeigeAlleAbfuhr
        ? "Nur die nächsten Mülltermine zeigen"
        : "Alle " + alleAbfuhr.length + " Mülltermine zeigen");
    mehr.addEventListener("click", () => {
      zeigeAlleAbfuhr = !zeigeAlleAbfuhr;
      render();
    });
    mainEl.append(mehr);
  }

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
      li.append(main, deleteButton(() => loescheMitUndo(data.events, e.id, e.text)));
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
    li.append(main, deleteButton(() => loescheMitUndo(data.notes, n.id, "Eintrag")));
    ul.append(li);
  }
  mainEl.append(ul);
}

// --- Ansicht: Sicherung ---
function renderBackup() {
  setChrome({ titel: "Daten sichern", zurueck: true, footer: false });

  const info = el("section", "card");
  info.append(el("h2", "card-title", "Warum das wichtig ist"));
  info.append(el("p", "muted",
    "Alles – Gewichtsliste, Termine, Notizen, eigene Listen – liegt nur im Speicher dieses Browsers. " +
    "Neues Handy, gelöschte Browserdaten oder eine lange ungenutzte App: dann ist alles weg. " +
    "Schick dir ab und zu eine Sicherung, zur Not per Mail an dich selbst."));

  const stand = el("div", "backup-stats");
  stand.append(
    el("div", "info-row", "⚖️ " + data.weights.length + " Gewichtseinträge"),
    el("div", "info-row", "📅 " + data.events.length + " eigene Termine"),
    el("div", "info-row", "🛒 " + data.shopping.length + " Einkaufseinträge"),
    el("div", "info-row", "📋 " + data.lists.length + " eigene Listen"),
    el("div", "info-row", "💡 " + data.notes.length + " Notizen")
  );
  info.append(stand);

  const verschicken = el("button", "btn primary", "Sicherung verschicken");
  verschicken.addEventListener("click", backupVerschicken);
  const speichern = el("button", "btn ghost", "Als Datei speichern");
  speichern.addEventListener("click", backupHerunterladen);
  info.append(verschicken, speichern);
  mainEl.append(info);

  const zurueck = el("section", "card");
  zurueck.append(el("h2", "card-title", "Sicherung einlesen"));
  zurueck.append(el("p", "muted", "Ersetzt alles, was gerade in der App steht. Vorher wird nachgefragt."));

  const datei = el("input", "file-input");
  datei.type = "file";
  datei.accept = "application/json,.json";
  datei.addEventListener("change", () => {
    const f = datei.files?.[0];
    if (!f) return;
    f.text().then(backupEinlesen).catch(() => toast("Datei ließ sich nicht lesen"));
    datei.value = "";
  });
  zurueck.append(datei);

  const feld = el("textarea", "field textarea");
  feld.placeholder = "…oder den Text der Sicherung hier einfügen";
  feld.rows = 4;
  const einlesen = el("button", "btn ghost", "Eingefügten Text einlesen");
  einlesen.addEventListener("click", () => {
    const txt = feld.value.trim();
    if (!txt) {
      toast("Erst den Text der Sicherung einfügen");
      return;
    }
    backupEinlesen(txt);
  });
  zurueck.append(feld, einlesen);
  mainEl.append(zurueck);
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
    const del = deleteButton(() => loescheMitUndo(data.lists, list.id, "Liste „" + list.name + "“"));
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
  });

  const ul = el("ul");
  if (list.items.length === 0) {
    ul.append(emptyHint("Diese Liste ist noch leer."));
  }
  for (const item of list.items) {
    const li = el("li", "row" + (item.done ? " done" : ""));
    const main = el("button", "row-main");
    main.append(el("span", "checkbox", "✓"), el("span", "item-text", item.text));
    main.addEventListener("click", () => toggleZeile(li, item, "done"));
    const del = deleteButton(() => loescheMitUndo(list.items, item.id, item.text));
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

// ---- 8. Aktionen (Kopf- und Fußzeile) ----
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
    const vorher = [...data.shopping]; // für "Rückgängig" inklusive Reihenfolge
    const anzahl = data.shopping.filter((i) => i.done).length;
    data.shopping = data.shopping.filter((i) => !i.done);
    save();
    render();
    toast(anzahl + (anzahl === 1 ? " Eintrag" : " Einträge") + " entfernt", () => {
      data.shopping = vorher;
      save();
      render();
    });
  } else if (view === "listDetail") {
    const list = aktiveListe();
    const vorher = [...list.items];
    const anzahl = list.items.filter((i) => i.done).length;
    list.items = list.items.filter((i) => !i.done);
    save();
    render();
    toast(anzahl + (anzahl === 1 ? " Eintrag" : " Einträge") + " gelöscht", () => {
      const l = aktiveListe();
      if (l) l.items = vorher;
      save();
      render();
    });
  }
});

// ---- 9. Service Worker registrieren ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const neu = reg.installing;
      if (!neu) return;
      neu.addEventListener("statechange", () => {
        // Nur melden, wenn vorher schon eine Version lief – sonst ist es
        // die Erstinstallation und es gibt nichts zu erneuern.
        if (neu.state === "installed" && navigator.serviceWorker.controller) {
          toast("Neue Version geladen – App einmal schließen und neu öffnen");
        }
      });
    });
  }).catch(() => {
    /* ohne Service Worker läuft die App auch, nur nicht offline */
  });
}

// ---- Start ----
render();
