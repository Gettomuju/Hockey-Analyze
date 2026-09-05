// Hakee liiga.fi:n omasta rajapinnasta kauden pelaajatilastojen summat (kenttäpelaajat JA
// maalivahdit tulevat samassa vastauksessa) ja tallentaa ne data/pelaajat.csv:hen.
//
// Tämä on tarkoituksella oma, update-results.mjs:stä riippumaton skripti: jos pelaajahaku
// jostain syystä epäonnistuu (esim. liiga.fi muuttaa rajapintaansa), se ei saa estää
// ottelutulosten päivitystä. Ajetaan samalla GitHub Actions -ajolla, samalla 23:50/FORCE_RUN
// -suojalla kuin update-results.mjs:ssä (ks. sen tiedoston kommentit).
//
// HUOM pelaajarajapinnasta (tutkittu 2026-09): dataType-parametrin arvot
// (basicStats/basicStatsGk/shotStats/skatingStats/gameTime) palauttavat kaikki saman
// ~40 kentän objektin per pelaaja, myös maalivahdeille. Rajapinta EI tällä hetkellä sisällä
// maalivahtien torjuntaprosenttia, päästettyjä maaleja tai voittoja pelaajakohtaisesti —
// niitä ei siis näytetä sovelluksessa keksittyinä/arvattuina lukuina. Maalivahdeista
// tallennetaan vain oikeasti saatavilla olevat luvut (ottelut, jäähän aika, +/-).
// Jos liiga.fi joskus lisää nämä kentät (esim. "savePercentage", "goalsAgainst"), ne on
// helppo lisätä alla olevaan toRow()-funktioon.

import { writeFileSync, mkdirSync } from "fs";

const FORCE_RUN = process.env.FORCE_RUN === "true";

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

// Liiga nimeää kauden sen päättymisvuoden mukaan (esim. 2026-27-runkosarja on kausi "2027").
// Vaihtuu heinäkuun alussa, kun uusi kausi alkaa valmistautua (turvamarginaali kesätaukoon).
function currentSeason(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  return m >= 6 ? y + 1 : y;
}

async function fetchPlayers(season) {
  const url = `https://liiga.fi/api/v2/players/stats/summed/${season}/${season}/runkosarja/true?dataType=basicStats`;
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
    console.error(`Vastaus ei ollut JSONia. HTTP ${res.status}. Ensimmäiset 500 merkkiä:`);
    console.error(rawText.slice(0, 500));
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error(`Vastauksesta ei löytynyt pelaajataulukkoa. HTTP ${res.status}. Sisältö:`);
    console.error(JSON.stringify(parsed).slice(0, 500));
    return [];
  }

  return parsed;
}

// CSV-rivi, sama muoto kaikille pelaajille (maalivahdin maalit/syötöt/pisteet ovat luonnostaan 0).
// Sarakejärjestys: rooli;joukkue;nimi;ottelut;maalit;syotot;pisteet;jaanaikaKaSek;plusmiinus
function toRow(p) {
  const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
  const role = p.goalkeeper ? "MV" : "H";
  const teamName = p.teamName ?? "Tuntematon";
  const fields = [
    role,
    teamName,
    name,
    p.playedGames ?? 0,
    p.goals ?? 0,
    p.assists ?? 0,
    p.points ?? 0,
    Math.round(p.timeOnIceAvg ?? 0),
    p.plusMinus ?? 0,
  ];
  // Semikoolonit tai rivinvaihdot pelaajan nimessä olisivat teoriassa mahdollisia (esim.
  // ulkomaalaisten nimissä), varmistetaan ettei sellainen riko CSV-riviä.
  return fields.map((f) => String(f).replace(/[;\n\r]/g, " ")).join(";");
}

async function main() {
  const { date, hour } = helsinkiNow();

  if (!FORCE_RUN && hour !== 23) {
    console.log(`Suomen aikaa klo ${hour}, ei 23 — ohitetaan tämä ajo (kesä/talviaika-suoja).`);
    return;
  }

  const season = process.env.SEASON ? Number(process.env.SEASON) : currentSeason(date);
  const players = await fetchPlayers(season);

  // Ei kirjoiteta tiedostoa jos haku epäonnistui tai palautti tyhjää — säilytetään edellinen
  // hyvä data mieluummin kuin ylikirjoitetaan se tyhjällä.
  if (players.length === 0) {
    console.log("Ei pelaajadataa (tyhjä vastaus tai virhe) — data/pelaajat.csv jätetään koskematta.");
    return;
  }

  const current = players.filter((p) => p.current !== false);
  current.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));

  const csv = current.map(toRow).join("\n") + "\n";
  mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../data/pelaajat.csv", import.meta.url), csv, "utf-8");

  console.log(`Tallennettu ${current.length} pelaajan tilastot (kausi ${season}).`);
}

main().catch((err) => {
  console.error("Virhe pelaajatilastojen päivityksessä:", err);
  process.exit(1);
});
