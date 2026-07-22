// ============================================================
// Opas Haushalt – Daten
// Routine anpassen? Einfach hier editieren, in sw.js die
// Cache-Version hochzählen und pushen.
// ============================================================

const ROUTINE = [
  {
    id: "ankommen",
    title: "Getränk & Kleinigkeit hinstellen",
    detail: "Zu trinken hinstellen, gern geschnittenes Obst dazu (Apfelspalten nochmal halbieren – eher Würfel) oder einen Keks. 5 Minuten reden.",
  },
  {
    id: "alles-ok",
    title: "Fragen: Ist alles ok?",
    detail: "Kurz nachhören, wie es Opa geht und ob irgendwas ansteht.",
  },
  {
    id: "hoerbuch",
    title: "Fragen: Hörbuch?",
    detail: "Möchte Opa (weiter) Hörbuch hören?",
  },
  {
    id: "joghurt",
    title: "Joghurt für morgen anmischen",
    detail: "„So! Ich mix dir deinen Joghurt“ – ohne Laktose, Süßkramobst, bisschen Chia-Samen. Mit Löffel in den Kühlschrank für morgen.",
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
      "Trinknahrung",
    ],
  },
  {
    id: "bad",
    title: "Bad: fragen und nachgucken",
    detail: "Fehlendes wieder mit dem Korb-Knopf auf die Einkaufsliste setzen. Kosmetikartikel beschriftet ? (Kreppband und Stift liegt im Keller)",
    einkauf: true,
    items: [
      "Duschbad",
      "Gebissreiniger",
      "Zahncreme",
      "Creme",
      "Taschentücher",
      "Toilettenpapier",
      "Handseife oben",
      "Handseife unten",
      "Tagescreme",
      "Spraydose (Panthenol)"
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
    detail: "Meist ist der Plastemüll voll (die hintere Abteilung). Die Tonne steht vor der Garage. Hier die nächsten Abholtermine:",
    dynamic: "muell",
  },
  {
    id: "rollstuhl",
    title: "Runde mit dem Rollstuhl?",
    detail: "Bei einem Spaziergang nach 16:30 Uhr: Zettel für den Pflegedienst hinlegen, dass ihr unterwegs seid. Kleinen roten Eierbecher für die Medis hinstellen. Smiley zeichnen ;)",
  },
  {
    id: "wiegen",
    title: "Wiegen (jeden 2. Tag) & Beine checken",
    detail: "Zunahme ist meist Wassereinlagerung – und die ist gefährlich. Beine dick? Also superdick? Ab 75 kg Mama wegen der Medis aus dem Korb fragen, erst mit Brennnesseltee versuchen ;) Wirkt sowieso frühestens am Folgetag.",
  },
  {
    id: "floradix",
    title: "Floradix geben",
    detail: "Der Saft mit Eisen – steht auf dem Fensterbrett.",
  },
  {
    id: "waesche",
    title: "Bei Bedarf: Wäsche waschen",
    detail: "Wichtig: erst den Wasserhahn für die Waschmaschine aufdrehen! Am besten dabeibleiben, bis die Maschine richtig losläuft.",
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
];

// Schnell-Vorschläge für die Einkaufsliste (aus den beiden Check-Schritten)
const EINKAUF_VORSCHLAEGE = ROUTINE.filter((s) => s.einkauf).flatMap((s) => s.items);

// Start-Einträge für „Gut zu wissen“ – nach dem ersten App-Start direkt in der App editierbar
const INFOS = [
  { icon: "🩺", text: "Fr. Dr. Keil ist im Urlaub: 20.07. bis 10.08." },
  { icon: "📞", text: "Bei Sorge wegen der Gesundheit: anrufen oder hinfahren – jede erste Stunde der Öffnungszeit ist eine Notfallsprechstunde." },
  { icon: "⚖️", text: "Jeden 2. Tag wiegen – die Gewichtsliste kommt separat." },
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
