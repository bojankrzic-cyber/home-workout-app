# HomeGym Coach

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

**36 vaj, vsaka z animacijo** (2D skeletna animacija s pravilnim zaporedjem gibanja, faznimi napisi "Spuščaj 3 s / Pavza / Potisni", poudarjenimi delovnimi mišicami, navodili in pogostimi napakami).

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
```

Nova vaja = en objekt v `js/exercises.js` (+ vnos v `js/program.js`, če naj bo v programu).

---

## Omejitve (odkrito)

- Animacije so stilizirana **2D stranska projekcija**, ne video. Rotacijske vaje (sekanje drv) so prikazane v projekciji — besedilna navodila to dopolnjujejo.
- Profili in podatki so shranjeni **na napravi** (TV ≠ telefon) – ni oblačne prijave. Za prenos uporabi izvoz/uvoz v Nastavitvah (izvoz vsebuje vse profile).
- Slovenski glas za govor večina TV-jev nima — takrat aplikacija uporabi zvočne signale.
- Začetne teže so ocena; prvi teden jih prilagodi (aplikacija si jih nato zapomni).
