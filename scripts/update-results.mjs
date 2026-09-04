// Hakee liiga.fi:n omasta rajapinnasta (sama jota liiga.fi:n sivu itse käyttää)
// viimeisten päivien päättyneet ottelut ja lisää uudet rivit data/ottelut.csv:hen.
//
// Ajetaan GitHub Actionsin kautta kahdesti illassa (talvi- ja kesäajan vuoksi),
// mutta tekee oikean päivityksen vain kun Suomen aikaa on juuri klo 23 —
// muina hetkinä skripti lopettaa heti ilman muutoksia. Käsiajossa
// (workflow_dispatch) tarkistus ohitetaan FORCE_RUN-muuttujalla.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const CSV_PATH = new URL("../data/ottelut.csv", import.meta.url);
const FORCE_RUN = process.env.FORCE_RUN === "true";
const LOOKBACK_DAYS = 3; // varmuuden vuoksi, jos edellinen ajo epäonnistui

function helsinkiNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

function dateMinus(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchGamesForDate(date) {
  const url = `https://liiga.fi/api/v2/games?tournament=runkosarja&date=${date}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      referer: "https://liiga.fi/fi",
    },
  });

  const rawText = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    console.error(`(${date}) Vastaus ei ollut JSONia. HTTP ${res.status}. Ensimmäiset 500 merkkiä:`);
    console.error(rawText.slice(0, 500));
    return [];
  }

  // liiga.fi:n date-parametrilla haettu rajapinta kääntää tulokset {games:[...]}-objektiin,
  // week-parametrilla haettu palauttaa suoran taulukon — tuetaan molempia.
  const games = Array.isArray(parsed) ? parsed : parsed.games;

  if (!Array.isArray(games)) {
    console.error(`(${date}) Vastauksesta ei löytynyt otteluita. HTTP ${res.status}. Sisältö:`);
    console.error(JSON.stringify(parsed).slice(0, 500));
    return [];
  }

  return games
    .filter((g) => g.ended)
    .map((g) => ({
      date: g.start.slice(0, 10),
      home: g.homeTeam.teamName,
      hg: g.homeTeam.goals,
      away: g.awayTeam.teamName,
      ag: g.awayTeam.goals,
    }));
}

function loadExistingRows() {
  if (!existsSync(CSV_PATH)) return [];
  const text = readFileSync(CSV_PATH, "utf-8");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [date, home, hg, away, ag] = line.split(";");
      return { date, home, hg: Number(hg), away, ag: Number(ag) };
    });
}

function rowKey(r) {
  return `${r.date}|${r.home}|${r.away}`;
}

async function main() {
  const { date: today, hour } = helsinkiNow();

  if (!FORCE_RUN && hour !== 23) {
    console.log(`Suomen aikaa klo ${hour}, ei 23 — ohitetaan tämä ajo (kesä/talviaika-suoja).`);
    return;
  }

  const existing = loadExistingRows();
  const existingKeys = new Set(existing.map(rowKey));

  let fetched = [];
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    const d = dateMinus(today, i);
    const games = await fetchGamesForDate(d);
    fetched = fetched.concat(games);
  }

  const newRows = fetched.filter((r) => !existingKeys.has(rowKey(r)));

  if (newRows.length === 0) {
    console.log("Ei uusia päättyneitä otteluita.");
    return;
  }

  const all = [...existing, ...newRows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const csv = all.map((r) => `${r.date};${r.home};${r.hg};${r.away};${r.ag}`).join("\n") + "\n";
  mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
  writeFileSync(CSV_PATH, csv, "utf-8");

  console.log(`Lisätty ${newRows.length} uutta ottelua:`);
  newRows.forEach((r) => console.log(`  ${r.date} ${r.home} ${r.hg}-${r.ag} ${r.away}`));
}

main().catch((err) => {
  console.error("Virhe päivityksessä:", err);
  process.exit(1);
});
