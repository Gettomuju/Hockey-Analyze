# Liiga-ennuste

Pieni tilastollinen työkalu SM-liigan ottelujen todennäköisyyksien arviointiin (Poisson-malli +
Elo-reittaus). Ei vedonlyöntiä varten — tarkoitettu kaveriporukan omaan hupikäyttöön.

## Tiedostot

- `index.html` — itse sovellus. Ei vaadi build-vaihetta, toimii suoraan GitHub Pagesilla.
- `data/ottelut.csv` — ottelutulokset muodossa `pvm;koti;kotimaalit;vieras;vierasmaalit`.
  Tämä tiedosto päivittyy automaattisesti (katso alla).
- `scripts/update-results.mjs` — Node-skripti, joka hakee uudet päättyneet ottelut liiga.fi:n
  omasta rajapinnasta ja lisää ne `data/ottelut.csv`:hen.
- `.github/workflows/update-results.yml` — GitHub Actions -automaatio, joka ajaa yllä olevan
  skriptin joka ilta n. klo 23:50 Suomen aikaa ja committaa muutokset takaisin repoon.

## Käyttöönotto

1. Lataa kaikki tässä kansiossa olevat tiedostot (kansiorakenne mukaan lukien) GitHubiin
   repon "Add file → Upload files" -toiminnolla. **Tärkeää:** `.github/workflows/`-kansion
   polku pitää säilyä sellaisenaan, jotta GitHub tunnistaa automaation.
2. Ota käyttöön GitHub Pages: repon **Settings → Pages**, valitse "Deploy from a branch",
   haara `main`, kansio `/ (root)`. Sivu ilmestyy muutamassa minuutissa osoitteeseen
   `https://KÄYTTÄJÄNIMESI.github.io/REPON-NIMI`.
3. Tarkista, että automaatio on käytössä: repon **Actions**-välilehdellä pitäisi näkyä
   "Päivitä Liiga-tulokset" -työnkulku.

## Automaation testaus heti (ei tarvitse odottaa klo 23:50 asti)

Repon **Actions**-välilehdellä → valitse "Päivitä Liiga-tulokset" → **Run workflow**
-painike oikealta. Tämä ajaa päivityksen heti kellonajasta riippumatta ("force"-asetus
on oletuksena päällä käsiajossa). Näet lokista, löytyikö uusia päättyneitä otteluita.

## Miksi kaksi kellonaikaa (cron) työnkulussa?

GitHub Actionsin ajastus on aina UTC-ajassa, eikä se tiedä Suomen kesä-/talviajasta.
23:50 Suomen aikaa on joko 20:50 UTC (kesäaika) tai 21:50 UTC (talviaika). Työnkulku
ajaa molemmat ajat joka päivä, mutta itse skripti tarkistaa oikean Suomen kellonajan ja
tekee varsinaisen päivityksen vain kerran — toinen ajo poistuu heti tekemättä mitään.

## Mallin muokkaus

Kaikki mallin parametrit (kotietu, Elo:n K-kerroin, muodon painotus) ovat `index.html`:n
ja `update-results.mjs`:n alussa selkeästi nimettyinä vakioina — niitä voi säätää suoraan
tiedostoissa GitHubin selainpohjaisella muokkaimella (kynäkuvake tiedoston kohdalla).
