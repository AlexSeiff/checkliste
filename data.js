// ============================================================
// Opas Haushalt – Daten
// Routine anpassen? Einfach hier editieren, in sw.js die
// Cache-Version hochzählen und pushen.
// ============================================================

const ROUTINE = [
  {
    id: "hoerbuch",
    title: "Fragen: Hörbuch?",
    detail: "Möchte Opa (weiter) Hörbuch hören?",
  },
  {
    id: "lebensmittel",
    title: "Lebensmittel überprüfen",
    detail: "Alles durchgehen und abhaken. Was fehlt oder zur Neige geht: mit dem Korb-Knopf direkt auf die Einkaufsliste.",
    einkauf: true,
    items: [
      "Wurstaufschnitt",
      "Schnittkäse",
      "Butter",
      "Kleine Tomaten",
      "Geschnittenes Brot",
      "Schrippen",
      "Sojajoghurt",
      "Süßkramobst",
      "Richtiges Obst (nicht zu viel, nicht zu hart)",
      "Marmelade",
      "Honig",
      "Kekse",
      "Pfefferminztee",
      "Kaffee",
      "Kaffeefilter",
      "Magnesium"
    ],
  },
  {
    id: "haushalt",
    title: "Haushaltsartikel überprüfen",
    detail: "Gucken ob genug da ist, auch im Keller auf Vorrat, wenn nicht auffüllen oder auf die Liste setzen. ",
    einkauf: true,
    items: [
      "Taschentücher",
      "Toilettenpapier",
      "Handseife oben",
      "Handseife unten",
      "Mülltüten",
      "Waschmittel",
      "Fit (Spülmittel)",
      "Geschirrspültabs",
    ],
  },
  {
    id: "bad",
    title: "Bad: fragen und nachgucken",
    detail: "Fehlendes wieder mit dem Korb-Knopf auf die Einkaufsliste setzen. Kosmetikartikel beschriftet ? (Kreppband und Stift liegt im Keller) Beim Kontrollieren gleich sortieren: Zahnputzartikel zusammen (möglichst in den Schrank, oberstes Fach), Rasierartikel zusammen (möglichst Schrank, 2. Fach), Deo „Beine“ und „Gesicht“ auf das Bord über dem Waschbecken. Vorräte in die Schublade.",
    einkauf: true,
    items: [
      "Duschbad",
      "Shampoo",
      "Gebissreiniger",
      "Zahncreme",
      "Creme",
      "Tagescreme"
    ],
  },
  {
    id: "einkaufen",
    title: "Wenn nötig: einkaufen ;)",
    detail: "Alles, was du gerade markiert hast, steht jetzt auf der Einkaufsliste (über die Übersicht erreichbar).",
  },
  {
    id: "geschirr",
    title: "Geschirr angucken",
    detail: "Tassen in den Schrank oder auf die Fläche neben der Spüle, ggf. in den Geschirrspüler. Achtung: Der Geschirrspüler ist sehr leise und Opa sieht die Restzeit nicht – deshalb landet ab und zu schmutziges Geschirr im Schrank.",
  },
  {
    id: "kaffeekanne",
    title: "Kaffeekanne ausspülen",
    detail: "Steht in der Küche.",
  },
  {
    id: "muell",
    title: "Müll checken",
    detail: "Meist ist der Plastemüll voll (die hintere Abteilung). Die Tonne steht vor der Garage. Danach die Plastemüll-Schublade leeren und sofort eine neue Mülltüte einsetzen!!! Sonst gibt es Glibberschlabber. Hier die nächsten Abholtermine:",
    dynamic: "muell",
  },
  {
    id: "rollstuhl",
    title: "Runde mit dem Rollstuhl?",
    detail: "Bei einem Spaziergang nach 16:30 Uhr: Zettel für den Pflegedienst hinlegen, dass ihr unterwegs seid. Kleinen roten Eierbecher für die Medis hinstellen. Smiley zeichnen ;)",
  },
  {
    id: "floradix",
    title: "Nahrungsergänzungsmittel checken",
    detail: "Stehen auf dem Fensterbrett.",
  },
  {
    id: "rundgang",
    title: "Unauffälliger Rundgang",
    detail: "Je nach Laune in allen Räumen nach kleinen Katastrophen gucken – unauffällig ;)",
  },
  {
    id: "ladekabel",
    title: "Ladekabel-Check",
    detail: "Das Kabel für Handy und Tablet hat einen weißen Bauch. Es liegt in der Küche bei der Kaffeemaschine oder bei Opas Sessel in der Leiste. Steckt es in der Dose, sieht man es nicht – weil der weiße Bauch dann weg ist ;)",
  },
  {
    id: "kalender",
    title: "Kalender für nächste Woche checken",
    detail: "Welche Termine stehen nächste Woche an? Danach die Wäsche für die Woche als Text in den Kalender eintragen:",
    punkte: [
      "3× Pullover und Hemd wechseln – gut über die Woche verteilt",
      "1× Hose waschen",
      "Einmal im Monat, immer am 15.: Bettwäsche wechseln",
    ],
    dynamic: "kalender",
  },
];

// Schnell-Vorschläge für die Einkaufsliste (aus den beiden Check-Schritten)
const EINKAUF_VORSCHLAEGE = ROUTINE.filter((s) => s.einkauf).flatMap((s) => s.items);

// Start-Einträge für „Gut zu wissen“ – nach dem ersten App-Start direkt in der App editierbar
// "key" muss eindeutig bleiben: Daran erkennt die App, welche Einträge schon
// einmal eingespielt wurden. Neue Einträge landen so auch bei bestehenden
// Installationen oben in der Liste – gelöschte kommen aber nicht zurück.
// Telefonnummern im Text werden automatisch zum Antippen (Anrufen/Kopieren).
const INFOS = [
  { key: "notfallknopf", icon: "🚨", text: "Notfall und keine Ahnung, was zu tun ist? Den blauen Knopf am Notfallarmband drücken (im Flur)." },
  { key: "keil-telefon", icon: "☎️", text: "Fr. Dr. Keil: 030 6480902" },
  { key: "sprechstunde", icon: "📞", text: "Bei Sorge wegen der Gesundheit: anrufen oder hinfahren – jede erste Stunde der Öffnungszeit ist eine Notfallsprechstunde." },
];

// Diese Einträge gab es schon vor dem "key"-System – wer die App da schon
// benutzt hat, hat sie bereits (oder bewusst gelöscht).
const INFOS_ALT = ["sprechstunde"];

// Überholte Einträge, die auf bestehenden Geräten einmalig gelöscht werden.
// "steckt" ist ein Textstück, an dem der Eintrag erkannt wird.
const INFOS_ENTFERNT = [
  { key: "keil-urlaub", steckt: "Fr. Dr. Keil ist im Urlaub" },
  { key: "wiegen", steckt: "Jeden 2. Tag wiegen" },
];

// Abfuhrtermine (aus Abfuhrkalender.ics der BSR generiert, bis 30.12.2026)
const ABFUHR = [
  { d: "2026-07-01", t: "Hausmüll" },
  { d: "2026-07-09", t: "Biogut" },
  { d: "2026-07-14", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-07-15", t: "Hausmüll" },
  { d: "2026-07-23", t: "Biogut" },
  { d: "2026-07-28", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-07-29", t: "Hausmüll" },
  { d: "2026-08-06", t: "Biogut" },
  { d: "2026-08-11", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-08-12", t: "Hausmüll" },
  { d: "2026-08-20", t: "Biogut" },
  { d: "2026-08-25", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-08-26", t: "Hausmüll" },
  { d: "2026-09-03", t: "Biogut" },
  { d: "2026-09-08", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-09-09", t: "Hausmüll" },
  { d: "2026-09-17", t: "Biogut" },
  { d: "2026-09-22", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-09-23", t: "Hausmüll" },
  { d: "2026-10-01", t: "Biogut" },
  { d: "2026-10-06", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-10-07", t: "Hausmüll" },
  { d: "2026-10-15", t: "Biogut" },
  { d: "2026-10-20", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-10-21", t: "Hausmüll" },
  { d: "2026-10-29", t: "Biogut" },
  { d: "2026-11-03", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-11-04", t: "Hausmüll" },
  { d: "2026-11-12", t: "Biogut" },
  { d: "2026-11-17", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-11-19", t: "Hausmüll" },
  { d: "2026-11-26", t: "Biogut" },
  { d: "2026-12-01", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-12-02", t: "Hausmüll" },
  { d: "2026-12-10", t: "Biogut" },
  { d: "2026-12-15", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-12-16", t: "Hausmüll" },
  { d: "2026-12-23", t: "Biogut" },
  { d: "2026-12-29", t: "Wertstoffe (Plastemüll)" },
  { d: "2026-12-30", t: "Hausmüll" }
];
