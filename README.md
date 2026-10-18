# Formshaper — by Nature's Finest

Znak uporablja **originalni list Nature's Finest** (`#0ba74b`) in sestavo, ki sledi logotipu "nature's / FINEST / BY NUTRISSLIM": serif v malih črkah (Fraunces 600) "formshaper" → razprt napis "BY NATURE'S FINEST". UI: Rethink Sans (400–600, brez ultra-krepkih rezov), listno in temno zelena `#006837`.

Osebni trener za domačo telovadnico, narejen **izključno za opremo, ki jo imaš**, in optimiziran za **TV zaslon (10-foot UI, upravljanje z daljincem)**.

| Oprema | Uporaba v programu |
|---|---|
| Sobno kolo | ogrevanje (cona 2), HIIT intervali 20/40 |
| Veslač (lesen, vodni) | ogrevanje, tehnika, intervali 30/30 in 60/60 |
| Kettlebells | swing, goblet počep, mrtvi dvig, potisk nad glavo |
| Dumbbells | potisk (ravna/poševna klop), veslanje, RDL, bolgarski počep, hip thrust, step-up, rame, biceps |
| NOHrD TriaTrainer (trebušne/hrbet) | zaprt = trebušnjaki, pol-odprt = iztegovanje hrbta (45°) |
| NOHrD klop | ravna / poševna / skoraj pokončna klop za uteži, opora za veslanje, step-up, razteg |
| Technogym Kinesis Personal | potisk za prsa, veslanje, poteg navzdol, face pull, triceps, pull-through, sekanje drv – breme v **stopnjah 0–20** |
| Stena (drog + dvig nog) | zgibi, dvig kolen/nog v visenju, visenje |

**63 vaj, vsaka z animacijo** (2D skeletna animacija s pravilnim zaporedjem gibanja, faznimi napisi "Spuščaj 3 s / Pavza / Potisni", poudarjenimi delovnimi mišicami, navodili in pogostimi napakami).

### Kako je prikazana pravilna izvedba
- **Človeška figura** (koža, oblačila, obraz, lasje, čevlji, mišični trebuhi) namesto paličnega moža. Mišice, ki delajo, **zasvetijo**: glavne močno in utripajo, pomožne mehko.
- **Oznake mišic** na figuri (npr. "Kvadriceps", "Zadnjica") in **kontrolne točke**: koti kolena/kolka/komolca v živo in linija hrbtenice pri zgibih v kolkih.
- **Zemljevid mišic** spredaj/zadaj z glavnimi in pomožnimi mišicami za vseh 63 vaj.
- **Faze giba** (npr. 1 Spuščaj 3 s → 2 Pavza spodaj → 3 Potisni gor) se med animacijo osvetljujejo v živo; pod njimi ključne točke in pogoste napake.
- **Fotografije pravih oseb** (generirane, preverjene glede pravilne izvedbe): kartice v knjižnici (fokus z daljincem preklopi na animacijo), domači zaslon, sličica "Prava izvedba" v predvajalniku, predogledu in podrobnostih (povečava čez cel zaslon). Kjer fotografije še ni, ostane animacija. Prompti za manjkajoče so v `tools/photo_prompts.json`; po dodajanju slik v `img/ex/` zaženi `python3 tools/build_photos.py`.

### Oprema po profilu
Vsaka oseba v profilu izbere svojo opremo (zaslon *Moja oprema*: ilustracije, število odklenjenih vaj, hitre izbire *Domača telovadnica / Samo lastna teža / Polno opremljen fitnes*). Na voljo je 17 naprav – tvojih 8 in dodatne: **tekalna steza, SkiErg, olimpijska palica + stojalo, sandbag, wall ball, plyo škatla, elastike, sani, kolebnica**.

- **Programi se prilagodijo samodejno**: vsaka vaja ima vzorec gibanja (počep, zgib v kolkih, horizontalni potisk …). Če oseba nima opreme, se vaja zamenja z najboljšo razpoložljivo iz istega vzorca (npr. potisk na klopi → sklece, kolo → tek na mestu); v pregledu treninga piše "⇄ namesto …". Kar nima enakovrednika (npr. vlečenje brez opreme), se izpusti in to je jasno izpisano.
- **HYROX z realno opremo**: če ima oseba tekalno stezo, SkiErg, sani, wall ball in sandbag, simulacija uporabi prave postaje z uradnimi razdaljami (8 × 1 km tek, 1000 m SkiErg, 50 m sani, 100 wall balls …).
- **Generator** pri polni opremi da prednost osnovnim vajam s palico; dveh težkih vaj s palico nikoli ne združi v superset.
- **Knjižnica** privzeto kaže *Mojo opremo*; *Vse vaje* prikaže tudi zaklenjene z napisom, kaj manjka.

### HYROX (na tvoji opremi)
Tri formati: **celotna simulacija** (8 × tek + postaja), **polovica** (4 postaje) in **trening postaj** (3 krogi). Način *na čas*: race ura, vmesni časi po postajah, povzetek na koncu. Količine: napreden = uradne (1000 m veslanja, 100 m izpadnih korakov ≈ 50, 50 thrusterjev ...), srednji 80 %, začetnik 60 %.

| HYROX postaja | Nadomestek doma |
|---|---|
| Tek 1 km | Kolo, ~4 min RPE 7 |
| SkiErg 1000 m | Kinesis – SkiErg poteg (visoka škripca, zgib v kolkih) |
| Sled push 50 m | Kolo stoje, težak upor (55–65 obr./min) |
| Sled pull 50 m | Kinesis – vlečenje roka-čez-roko |
| Burpee broad jumps 80 m | Burpee s skokom v daljino |
| Veslanje 1000 m | Veslač 1000 m (OK, ko monitor pokaže razdaljo) |
| Farmers carry 200 m | Kmečka hoja s KB |
| Sandbag lunges 100 m | Izpadni koraki s KB (goblet) |
| Wall balls 100 | DB thruster |

### Predvajalnik (UX po vzorcih z Mobbina)
Vzorci iz [Ladder](https://mobbin.com/screens/d1169c75-4219-4bf1-aa2c-f5eb8fc0187a), [Ladder – počitek](https://mobbin.com/screens/f17aa38b-027a-4a2b-85e7-f1e80d2e7270), [Gymshark](https://mobbin.com/screens/f4cdbd47-9666-4c67-ae63-c75f2094254d), [Hevy](https://mobbin.com/screens/6f5fad08-23a6-4698-9868-2289969a1d5e), [Runna](https://mobbin.com/screens/d016e28e-df59-456a-8635-51345b522294), [Strava](https://mobbin.com/screens/f8747488-3929-468c-a75f-cb9cd86fe90c):
- **vedno viden skupni čas** (race način: rumena race ura) + razdeljen napredek po blokih in %,
- **kartica "Naslednje →"** z mini animacijo; med počitkom se na velikem zaslonu že predvaja tehnika naslednje vaje,
- **en velik obroč**: odštevanje za časovne postaje/intervale/počitek, **tempo števec ponovitev** (štetje po ritmu animacije) za serije s ponovitvami, čas za razdaljo,
- počitek **−15 s / +15 s / preskoči**, pike serij, barvno kodiranje (zeleno delo, mint počitek, jantar močno/race),
- povzetek: čas, serije, ponovitve, volumen (kg), vmesni časi.

### Več oseb (profili)
Ob zagonu izbereš, kdo trenira (kot pri Netflixu). Vsaka oseba ima **svoj program (3×/4×), nivo, teže, progresijo, zgodovino in shranjene treninge**. Neobvezni 4-mestni PIN zaklene profil na skupnem TV-ju (zasebnost, ne varnost – podatki so v brskalniku). Obstoječi podatki se ob nadgradnji samodejno prenesejo v profil "Jaz".

### Trening po izbiri
- **Sestavi trening**: vrsta (**Moč / Kardio / Moč + kardio**) × fokus (noge, zadnjica, prsa, hrbet, rame, roke, trup – več izbir ali "celo telo") × trajanje (20/30/45/60 min). Generator vzame samo tvojo opremo, najprej večsklepne vaje, pare v supersete in prilagodi število vaj času in tvojemu nivoju. Vsako vajo lahko **zamenjaš** (⇄) ali **odstraniš**, trening pa **shraniš** med priljubljene.
- **Kardio**: kolo / veslač / oboje × cona 2 / intervali / mešano.
- **Hitri treningi** na domačem zaslonu (celo telo, noge & zadnjica, zgornji del, trup, kardio intervali, cona 2).
- **Knjižnica**: filter po fokusu in opremi; pri vsaki vaji gumb **"Treniraj to vajo"**.

---

## Kako jo naložiš na TV

1. **Objava (enkrat):** v GitHub repozitoriju → *Settings → Pages → Source: GitHub Actions*. Ob vsakem push-u na `main` se aplikacija samodejno objavi na `https://bojankrzic-cyber.github.io/home-workout-app/`.
2. **Na TV-ju** (Samsung Tizen, LG webOS, Android/Google TV z brskalnikom) odpri ta URL in ga dodaj med zaznamke. Po prvem nalaganju deluje **tudi brez interneta** (service worker).
3. **Alternativa:** odpri na prenosniku v Chromu → *Cast tab* na Chromecast/Google TV, ali AirPlay iz Maca/iPada na Apple TV. Ali enostavno HDMI.

Lokalno: odpri `index.html` neposredno v brskalniku (deluje tudi prek `file://`, brez strežnika in brez build koraka).

### Daljinec
`← ↑ → ↓` premikanje · `OK` izberi / *serija opravljena* · `Nazaj` · `▶❚❚` pavza. Teže in ponovitve vneseš s `−` / `+` (D-pad), privzeto je že predlagana vrednost — v praksi pritisneš samo `OK`.

---

## Kako je program zasnovan

**Izbira 3× ali 4× tedensko** (Nastavitve):

- **4× – Upper/Lower**: Spodnji del – moč · Zgornji del – potisk & poteg · Zadnja veriga & kondicija · Zgornji del – volumen & trup. Vsaka mišična skupina 2× tedensko, ~10–16 serij/teden.
- **3× – Celo telo A/B/C**: ko je teden natrpan. Vsaka skupina 2–3× tedensko z manj serijami na trening.

Struktura vsakega treninga (~50–60 min): ogrevanje na kolesu/veslaču → glavna vaja → supersets (A1/A2 nekonkurenčnih mišic, prihranek ~30 % časa) → trup → kardio finisher → ohlajanje.

**Periodizacija – 4-tedenski bloki:**

| Teden | Napor | Opomba |
|---|---|---|
| 1 | RIR 3 | uvajanje, tehnika |
| 2 | RIR 2 | gradnja |
| 3 | RIR 1 | vrh |
| 4 | RIR 4, −40 % serij | razbremenitev (deload) |

**Avtomatska progresija (dvojna progresija):** aplikacija si zapomni teže in ponovitve vsake vaje. Ko na vseh serijah dosežeš zgornjo mejo razpona → naslednjič predlaga +2 kg (DB), +4 kg (KB) ali +1 stopnjo (Kinesis). Če dvakrat zapored ne dosežeš spodnje meje → zmanjša breme.

**Rotacija namesto koledarja:** naslednji trening je vedno naslednji v zaporedju — izpuščen dan ne podre plana.

---

## Reverse engineering — kaj je prevzeto od vodilnih aplikacij

| Vzorec | Vir (analiza) | Implementacija tukaj |
|---|---|---|
| Predlog teže na podlagi zgodovine | Fitbod, Caliber | dvojna progresija + spomin po vaji |
| Generiranje treninga iz razpoložljive opreme | Fitbod | celotna knjižnica = samo tvoja oprema |
| Bloki z deloadom in RIR | Future, Juggernaut, RP | 4-tedenski blok, RIR 3→2→1→deload |
| TV-first layout: velika animacija levo, metrika desno, "Naslednje" spodaj | Apple Fitness+, Peloton | predvajalnik 16:9 z robnim napredkom |
| Odštevanje 3-2-1, zvočni signali, glasovni napovednik | Peloton, Apple Fitness+ | WebAudio piski + sintetizator govora (sl-SI, če ga naprava ima) |
| Kartica vaje: navodila + pogoste napake | Nike Training Club | `cues` + `mistakes` pri vsaki vaji |
| Kinesis upor v stopnjah | Technogym Mywellness | breme Kinesis v stopnjah 0–20, ne kg |
| Predogled vaj pred treningom | Apple Fitness+ "preview" | 📺 način: vse vaje treninga v zanki, nastavljiva dolžina |
| Supersets za časovno učinkovitost | Future, Ladder | A1/A2/A3 bloki, kratek prehod 15 s |
| Rotacija sej namesto fiksnih dni | Fitbod, Juggernaut | `nextSessionKey()` |

---

## Arhitektura

Brez build koraka, brez odvisnosti, brez backenda — maksimalna kompatibilnost s TV brskalniki.

```
index.html
css/app.css           design tokens, 10-foot UI, fokus stanja za D-pad
js/figure.js          animacijski engine: FK + 2-kostna IK + "pin" kontakta s tlemi, SVG renderer, rekviziti, samodejna kamera
js/exercises.js       knjižnica 36 vaj (keyframe animacije, navodila, napake, mišice, tempo, začetno breme)
js/program.js         programi, 4-tedenski bloki, dvojna progresija, generator treningov po fokusu, sploščitev v korake (supersets)
js/store.js           profili (localStorage), PIN, migracija v1→v2, izvoz/uvoz JSON
js/app.js             zasloni, prostorska navigacija za daljinec, vodeni trening, TV predogled
sw.js                 offline cache
tools/                razvojna orodja (contact sheet vseh animacij, UI smoke test)
```

**Animacijski engine:** vsaka vaja je zaporedje ključnih poz (koti sklepov), interpolacija z easing krivuljami. Inverzna kinematika drži stopala na pedalih/podnožju veslača, roke na ročaju; "pin" drži stopala na tleh ali roke na drogu. Kamera se samodejno prilagodi vaji.

### Razvoj / QA

```bash
NODE_PATH=$(npm root -g) node tools/snap.cjs contact.png          # vse animacije v 4 fazah
NODE_PATH=$(npm root -g) node tools/snap.cjs c.png kb_swing,pullup # izbrane vaje
NODE_PATH=$(npm root -g) node tools/ui.cjs ./out                   # UI smoke test + posnetki zaslonov
NODE_PATH=$(npm root -g) node tools/profiles.cjs ./out             # profili, PIN, sestavljalnik, knjižnica
NODE_PATH=$(npm root -g) node tools/hyrox.cjs ./out                # HYROX, race ura, vmesni časi, HUD predvajalnika
NODE_PATH=$(npm root -g) node tools/equipment.cjs ./out            # oprema po profilu, zamenjave, HYROX z realno opremo
NODE_PATH=$(npm root -g) node tools/visual.cjs ./out               # posnetki glavnih zaslonov za vizualni pregled
NODE_PATH=$(npm root -g) node tools/snap.cjs c.png kb_swing "&h=520&labels=1"   # animacija z oznakami mišic in koti
```

Nova vaja = en objekt v `js/exercises.js` (+ vnos v `js/program.js`, če naj bo v programu).

---

## Omejitve (odkrito)

- Animacije so stilizirana **2D stranska projekcija**, ne video. Rotacijske vaje (sekanje drv) so prikazane v projekciji — besedilna navodila to dopolnjujejo.
- Profili in podatki so shranjeni **na napravi** (TV ≠ telefon) – ni oblačne prijave. Za prenos uporabi izvoz/uvoz v Nastavitvah (izvoz vsebuje vse profile).
- Slovenski glas za govor večina TV-jev nima — takrat aplikacija uporabi zvočne signale.
- Začetne teže so ocena; prvi teden jih prilagodi (aplikacija si jih nato zapomni).
