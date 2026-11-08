// ============================================================
// Opas Haushalt – App-Logik (v7)
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
    events: [],      // eigene Termine [{ id, date, text }]
    notes: [],       // "Gut zu wissen"
    infosGesehen: [], // keys aus INFOS, die schon einmal eingespielt wurden
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
  // Durchläufe aus älteren App-Versionen kennen die Unterpunkte noch nicht
  if (n.run && typeof n.run.sub !== "object") n.run.sub = {};
  // Daten von vor dem "key"-System: die alten Start-Infos sind schon drin
  if (d && typeof d === "object" && !Array.isArray(d.infosGesehen)) {
    n.infosGesehen = [...INFOS_ALT];
  }
  return n;
}

// Neue "Gut zu wissen"-Einträge aus data.js oben einsortieren – jeder nur einmal,
// damit Gelöschtes nicht bei jedem Start wieder auftaucht.
function ergaenzeInfos(d) {
  const neu = INFOS.filter((i) => !d.infosGesehen.includes(i.key));
  if (neu.length === 0) return false;
  d.notes.unshift(...neu.map((i) => ({ id: uid(), text: i.icon + " " + i.text })));
  d.infosGesehen.push(...neu.map((i) => i.key));
  return true;
}

// Überholte Einträge einmalig entfernen (gemerkt als "-entfernt" in infosGesehen)
function entferneAlteInfos(d) {
  let geaendert = false;
  for (const alt of INFOS_ENTFERNT) {
    const marke = alt.key + "-entfernt";
    if (d.infosGesehen.includes(marke)) continue;
    d.notes = d.notes.filter((n) => !n.text.includes(alt.steckt));
    d.infosGesehen.push(marke);
    geaendert = true;
  }
  return geaendert;
}

function pflegeInfos(d) {
  const a = entferneAlteInfos(d);
  const b = ergaenzeInfos(d);
  return a || b;
}

function load() {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    d = null;
  }
  const daten = normalisiere(d);
  // "Gut zu wissen": beim ersten Start alle Standard-Infos, später nur neu
  // hinzugekommene. Danach lebt die Liste im localStorage und ist frei editierbar.
  if (pflegeInfos(daten)) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(daten));
    } catch {
      /* egal – beim nächsten Speichern landet es ohnehin drin */
    }
  }
  return daten;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = load();
// home | routine | steps | shopping | lists | listDetail | calendar | notes | backup
let view = "home";
let rueckweg = null; // Ansicht, zu der "Zurück" führt, wenn man aus der Routine abgebogen ist
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

// ---- 3. Termine ----
function naechsterTermin() {
  const heute = dateStr();
  return (
    data.events
      .filter((e) => e.date >= heute)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

// Nächste Kalenderwoche (Montag bis Sonntag) als { von, bis } im Format JJJJ-MM-TT
function naechsteWoche() {
  const t = new Date();
  const bisMontag = (8 - t.getDay()) % 7 || 7;
  const mo = new Date(t.getFullYear(), t.getMonth(), t.getDate() + bisMontag);
  const so = new Date(mo.getFullYear(), mo.getMonth(), mo.getDate() + 6);
  return { von: dateStr(mo), bis: dateStr(so) };
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

// Text mit antippbaren Telefonnummern: Tippen ruft an, daneben ein Kopier-Knopf
// (z. B. am Computer oder wenn man die Nummer weitergeben will).
const TELEFON_MUSTER = /\+?\d[\d /-]{4,}\d/g;

function textMitTelefon(text) {
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const m of text.matchAll(TELEFON_MUSTER)) {
    frag.append(text.slice(pos, m.index));
    const nummer = m[0];
    const wahl = nummer.replace(/[^\d+]/g, "");
    const link = el("a", "tel-link", nummer);
    link.href = "tel:" + wahl;
    const kopie = el("button", "tel-copy", "Kopieren");
    kopie.setAttribute("aria-label", nummer + " kopieren");
    kopie.addEventListener("click", () => kopiere(wahl, "Nummer kopiert"));
    frag.append(link, " ", kopie);
    pos = m.index + nummer.length;
  }
  frag.append(text.slice(pos));
  return frag;
}

function kopiere(text, meldung) {
  if (!navigator.clipboard) {
    toast("Kopieren nicht möglich");
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => toast(meldung))
    .catch(() => toast("Kopieren nicht möglich"));
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
  rueckweg = null;
  view = "routine";
  render();
}

// Nur Ergebnisse von Schritten zählen, die es (noch) gibt
const bearbeiteteSchritte = (lauf) => ROUTINE.filter((s) => lauf.res[s.id]).length;

// Nach dem Abhaken zum nächsten offenen Schritt – auch wenn man vorher
// über die Übersicht gesprungen ist. Ist alles bearbeitet: Abschluss.
function schrittWeiter(erg) {
  const lauf = aktuellerLauf();
  lauf.res[ROUTINE[lauf.idx].id] = erg;
  let naechster = ROUTINE.length;
  for (let k = 1; k <= ROUTINE.length; k++) {
    const i = (lauf.idx + k) % ROUTINE.length;
    if (!lauf.res[ROUTINE[i].id]) { naechster = i; break; }
  }
  lauf.idx = naechster;
  save();
  render();
}

// Aus der Schritt-Übersicht direkt zu einem Schritt springen
function springeZuSchritt(i) {
  if (!aktuellerLauf()) data.run = { date: dateStr(), idx: 0, res: {}, sub: {} };
  data.run.idx = i;
  save();
  rueckweg = null;
  view = "routine";
  render();
}

function oeffneAusRoutine(ziel) {
  rueckweg = "routine";
  view = ziel;
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
  const felder = ["lists", "shopping", "events", "notes"];
  if (!roh || typeof roh !== "object" || !felder.some((k) => Array.isArray(roh[k]))) {
    toast("Das ist keine gültige Sicherung");
    return;
  }
  const neu = normalisiere(roh);
  pflegeInfos(neu);
  const zusammenfassung =
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
  else if (view === "steps") renderSteps();
  else if (view === "shopping") renderShopping();
  else if (view === "lists") renderLists();
  else if (view === "listDetail") renderListDetail();
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

  // Besuchs-Routine – der Grund, warum man die App überhaupt aufmacht
  const rout = el("section", "card hero");
  const lauf = aktuellerLauf();
  rout.append(el("div", "hero-label", "Besuchs-Routine"));
  if (lauf && lauf.idx >= ROUTINE.length) {
    const erledigt = ROUTINE.filter((s) => lauf.res[s.id] === "done").length;
    rout.append(el("h2", "hero-title", "Heute geschafft ✓"));
    rout.append(el("p", "hero-sub", erledigt + " von " + ROUTINE.length + " Schritten erledigt."));
    const nochmal = el("button", "btn ghost", "Nochmal durchgehen");
    nochmal.addEventListener("click", starteLauf);
    rout.append(nochmal);
  } else if (lauf) {
    const fertig = bearbeiteteSchritte(lauf);
    rout.append(el("h2", "hero-title", fertig + " von " + ROUTINE.length + " Schritten erledigt"));
    rout.append(el("p", "hero-sub", "Als Nächstes: " + ROUTINE[lauf.idx].title));
    const prog = el("div", "progress");
    const fill = el("div", "progress-fill");
    fill.style.width = Math.round((fertig / ROUTINE.length) * 100) + "%";
    prog.append(fill);
    rout.append(prog);
    const weiter = el("button", "btn primary", "Fortsetzen");
    weiter.addEventListener("click", () => { view = "routine"; render(); });
    rout.append(weiter);
  } else {
    rout.append(el("h2", "hero-title", "Heute noch nicht gestartet"));
    rout.append(el("p", "hero-sub", ROUTINE.length + " Schritte – vom Hörbuch bis zum Kalender-Check."));
    const start = el("button", "btn primary", "Routine starten");
    start.addEventListener("click", starteLauf);
    rout.append(start);
  }
  const alle = el("button", "btn ghost", "Alle Schritte ansehen");
  alle.addEventListener("click", () => { view = "steps"; render(); });
  rout.append(alle);
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
    const zeile = el("div", "info-row");
    const txt = el("span"); // eigener Textblock, damit Link & Knopf im Fließtext bleiben
    txt.append(textMitTelefon(n.text));
    zeile.append(txt);
    info.append(zeile);
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

  // Fortschritt + Sprung in die Übersicht aller Schritte
  const kopf = el("div", "step-head");
  const prog = el("div", "progress");
  const fill = el("div", "progress-fill");
  fill.style.width = Math.round((bearbeiteteSchritte(lauf) / ROUTINE.length) * 100) + "%";
  prog.append(fill);
  const alle = el("button", "step-overview-link", "Alle Schritte");
  alle.addEventListener("click", () => oeffneAusRoutine("steps"));
  kopf.append(prog, alle);
  mainEl.append(kopf);

  // Schritt-Karte
  const card = el("section", "card step-card");
  const bisher = lauf.res[schritt.id];
  if (bisher) {
    card.append(el("span", "badge step-badge", bisher === "done" ? "schon erledigt" : "vorhin übersprungen"));
  }
  card.append(el("h2", "step-title", schritt.title));
  if (schritt.detail) card.append(el("p", "step-detail", schritt.detail));
  if (schritt.punkte) {
    const pl = el("ul", "step-points");
    for (const p of schritt.punkte) pl.append(el("li", null, p));
    card.append(pl);
  }

  if (schritt.dynamic === "kalender") card.append(kalenderBox());

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

// Kalender-Schritt: eigene Termine der nächsten Woche + Hinweis auf den 15.
function kalenderBox() {
  const box = el("div", "kalender-box");
  const woche = naechsteWoche();
  box.append(el("p", "section-label kalender-label",
    "Nächste Woche · " + fmtDate(woche.von) + " – " + fmtDate(woche.bis)));

  const termine = data.events
    .filter((e) => e.date >= woche.von && e.date <= woche.bis)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (termine.length === 0) {
    box.append(el("p", "muted small", "In der App ist für nächste Woche nichts eingetragen."));
  }
  for (const e of termine) {
    const row = el("div", "abfuhr-row");
    const info = el("div", "abfuhr-info");
    info.append(el("div", "abfuhr-label", e.text), el("div", "muted small", fmtDate(e.date)));
    row.append(info);
    box.append(row);
  }

  // Liegt ein 15. in der nächsten Woche? Dann sind Bettwäsche und Zahnbürste dran.
  for (let d = alsDatum(woche.von); dateStr(d) <= woche.bis; d.setDate(d.getDate() + 1)) {
    if (d.getDate() !== 15) continue;
    const hinweis = el("div", "card note-card kalender-hinweis");
    hinweis.append(el("div", "note-title", "🛏️ " + fmtDate(dateStr(d)) + " ist der 15."));
    hinweis.append(el("div", "note-sub", "Bettwäsche wechseln und Zahnbürste wechseln mit eintragen!"));
    box.append(hinweis);
  }

  const oeffnen = el("button", "chips-toggle", "Termine in der App öffnen ›");
  oeffnen.addEventListener("click", () => oeffneAusRoutine("calendar"));
  box.append(oeffnen);
  return box;
}

// --- Ansicht: alle Schritte auf einen Blick ---
function renderSteps() {
  const lauf = aktuellerLauf();
  setChrome({ titel: "Alle Schritte", zurueck: true, footer: false });

  mainEl.append(el("p", "muted small hint",
    lauf
      ? "Antippen, um direkt zu diesem Schritt zu springen. Was schon erledigt ist, bleibt erledigt."
      : "Antippen, um die Routine bei diesem Schritt zu beginnen."));

  const ul = el("ul", "step-list");
  ROUTINE.forEach((s, i) => {
    const erg = lauf ? lauf.res[s.id] : null;
    const aktuell = !!lauf && lauf.idx === i;
    const li = el("li", "row step-row" +
      (erg === "done" ? " done" : "") +
      (erg === "skip" ? " skipped" : "") +
      (aktuell ? " current" : ""));
    const main = el("button", "row-main");
    main.append(el("span", "step-num", erg === "done" ? "✓" : String(i + 1)));
    const info = el("div", "step-row-info");
    info.append(el("div", "item-text", s.title));
    const unter = [];
    if (aktuell) unter.push("du bist hier");
    if (erg === "done") unter.push("erledigt");
    if (erg === "skip") unter.push("übersprungen");
    if (s.items) unter.push(s.items.length + " Punkte");
    if (unter.length) info.append(el("div", "muted small", unter.join(" · ")));
    main.append(info, el("span", "chevron", "›"));
    main.addEventListener("click", () => springeZuSchritt(i));
    li.append(main);
    ul.append(li);
  });
  mainEl.append(ul);

  if (!lauf) {
    const start = el("button", "btn primary", "Routine von vorn starten");
    start.addEventListener("click", starteLauf);
    mainEl.append(start);
  }
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
    "Alles – Termine, Einkaufsliste, Notizen, eigene Listen – liegt nur im Speicher dieses Browsers. " +
    "Neues Handy, gelöschte Browserdaten oder eine lange ungenutzte App: dann ist alles weg. " +
    "Schick dir ab und zu eine Sicherung, zur Not per Mail an dich selbst."));

  const stand = el("div", "backup-stats");
  stand.append(
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
  if (rueckweg && aktuellerLauf()) {
    // aus der Routine kurz abgebogen (Übersicht, Termine) -> zurück zum Schritt
    view = rueckweg;
    rueckweg = null;
    render();
    return;
  }
  rueckweg = null;
  if (view === "routine") {
    // Einen Schritt zurück. Das Ergebnis bleibt stehen und wird beim
    // erneuten Abhaken einfach überschrieben.
    const lauf = aktuellerLauf();
    if (lauf && lauf.idx > 0) {
      lauf.idx = Math.min(lauf.idx, ROUTINE.length) - 1;
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
