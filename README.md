# FinestMe — by Nature's Finest

Logotip je besedni znak brez lista: **FORM**SHAPER v ozki poševni športni pisavi Barlow Condensed (»SHAPER« v zeleni barvi Nature's Finest `#0ba74b`), pod njim razprto »BY NATURE'S FINEST«. Ikona aplikacije je poševni monogram »F«. V isti pisavi so časovniki v predvajalniku (videz semaforja). Ostali UI: Rethink Sans 400–600.

Osebni trener za domačo telovadnico, narejen **izključno za opremo, ki jo imaš**, in optimiziran za **TV zaslon (10-foot UI, upravljanje z daljincem)**.

| Oprema | Uporaba v programu |
|---|---|
| Sobno kolo | ogrevanje (cona 2), HIIT intervali 20/40 |
| Veslač (lesen, vodni) | ogrevanje, tehnika, intervali 30/30 in 60/60 |
| Kettlebells | swing, goblet počep, mrtvi dvig, potisk nad glavo |
| Dumbbells | potisk (ravna/poševna klop), veslanje, RDL, bolgarski počep, hip thrust, step-up, rame, biceps |
| Klop za trebušne in hrbet | zaprt = trebušnjaki, pol-odprt = iztegovanje hrbta (45°) |
| Nastavljiva klop za uteži | ravna / poševna / skoraj pokončna klop za uteži, opora za veslanje, step-up, razteg |
| Cable station | potisk za prsa, veslanje, poteg navzdol, face pull, triceps, pull-through, sekanje drv – breme v **stopnjah 0–20** |
| Stena (drog + dvig nog) | zgibi, dvig kolen/nog v visenju, visenje |

**63 vaj, vsaka z animacijo** (2D skeletna animacija s pravilnim zaporedjem gibanja, faznimi napisi "Spuščaj 3 s / Pavza / Potisni", poudarjenimi delovnimi mišicami, navodili in pogostimi napakami).

### Kako je prikazana pravilna izvedba
- **Človeška figura** (koža, oblačila, obraz, lasje, čevlji, mišični trebuhi) namesto paličnega moža. Mišice, ki delajo, **zasvetijo**: glavne močno in utripajo, pomožne mehko.
- **Oznake mišic** na figuri (npr. "Kvadriceps", "Zadnjica") in **kontrolne točke**: koti kolena/kolka/komolca v živo in linija hrbtenice pri zgibih v kolkih.
- **Zemljevid mišic** spredaj/zadaj z glavnimi in pomožnimi mišicami za vseh 63 vaj.
- **Faze giba** (npr. 1 Spuščaj 3 s → 2 Pavza spodaj → 3 Potisni gor) se med animacijo osvetljujejo v živo; pod njimi ključne točke in pogoste napake.
- **Fotografije pravih oseb** (generirane, preverjene glede pravilne izvedbe): kartice v knjižnici (fokus z daljincem preklopi na animacijo), domači zaslon, sličica "Prava izvedba" v predvajalniku, predogledu in podrobnostih (povečava čez cel zaslon). Kjer fotografije še ni, ostane animacija. Prompti za manjkajoče so v `tools/photo_prompts.json`; po dodajanju slik v `img/ex/` zaženi `python3 tools/build_photos.py`.

### Osebni profil (cilj, telo, srčni utrip, omejitve)
- **Cilj** (Build muscle / Get stronger / Lose fat / Endurance / hybrid race race / Stay fit) dejansko spremeni program: *Get stronger* zniža ponovitve glavnih vaj (npr. 8–10 → 5–7) in podaljša počitek; *Lose fat / Endurance / hybrid race* skrajšajo počitek in dodajo intervale; *Endurance* poveča ponovitve pomožnih vaj in dolžino kardia. Ciljna teža, ciljni datum (npr. dan tekme) in "My why" se prikažejo na domačem zaslonu.
- **Telo:** spol, starost, višina, teža → BMI, ocena kcal po treningu (MET × kg × čas), dnevnik teže s trendom v *Progress*.
- **Srčni utrip:** max HR (Tanaka 208 − 0,7 × starost ali izmerjen), mirovni HR → cone Z1–Z5 (Karvonen); med kardiom app pokaže ciljni utrip (Zone 2 / intervali).
- **Trening:** nivo, 3×/4× tedensko, preferenčni dnevi (pike v tedenskem traku), dolžina treninga (30–75 min – app skrajša pomožne serije, nikoli ogrevanja).
- **Omejitve** (kolena, spodnji hrbet, ramena, zapestja): vaje, ki obremenjujejo sklep, zamenja z nežnejšo iz istega gibalnega vzorca; če alternative ni, jo označi z opozorilom.

### Oprema po profilu
Vsaka oseba v profilu izbere svojo opremo (zaslon *Moja oprema*: ilustracije, število odklenjenih vaj, hitre izbire *Domača telovadnica / Samo lastna teža / Polno opremljen fitnes*). Na voljo je 25 naprav – tvojih 8 in dodatne: **tekalna steza, Ski machine, olimpijska palica + stojalo, sandbag, wall ball, plyo škatla, elastike, sani, kolebnica**.

- **Programi se prilagodijo samodejno**: vsaka vaja ima vzorec gibanja (počep, zgib v kolkih, horizontalni potisk …). Če oseba nima opreme, se vaja zamenja z najboljšo razpoložljivo iz istega vzorca (npr. potisk na klopi → sklece, kolo → tek na mestu); v pregledu treninga piše "⇄ namesto …". Kar nima enakovrednika (npr. vlečenje brez opreme), se izpusti in to je jasno izpisano.
- **hybrid race z realno opremo**: če ima oseba tekalno stezo, Ski machine, sani, wall ball in sandbag, simulacija uporabi prave postaje z uradnimi razdaljami (8 × 1 km tek, 1000 m Ski machine, 50 m sani, 100 wall balls …).
- **Generator** pri polni opremi da prednost osnovnim vajam s palico; dveh težkih vaj s palico nikoli ne združi v superset.
- **Knjižnica** privzeto kaže *Mojo opremo*; *Vse vaje* prikaže tudi zaklenjene z napisom, kaj manjka.

#### Dodatna oprema (8 novih naprav, 16 animiranih vaj)
| Oprema | Vaje |
|---|---|
| **Suspenzijski trak** (sidrišče nad glavo / na vratih) | veslanje, potisk za prsi, asistiran počep, »fallout« za trup |
| **Kolo za trebušnjake** (ab wheel) | izteg iz klečanja |
| **Slam žoga** | udarec nad glavo, rotacijski udarec (izmenično) |
| **Bojne vrvi** (battle ropes) | izmenični valovi (intervali) |
| **Valj za masažo** (foam roller) | zgornji del hrbta, sprednja stegna |
| **Stojalo za dipe / bradlje** | dipi, L-sed |
| **Landmine nastavek** (potrebuje tudi olimpijsko palico) | enoročni landmine potisk, T-bar veslanje |
| **Zračno kolo** (air bike) | šprint intervali, Zona 2 |

- Nove vaje so dodane **na konec** obstoječih vzorcev gibanja, zato se programi za domačo opremo (8 naprav) ne spremenijo; nova oprema ni del *Domače telovadnice*, je pa vključena v *Polno opremljen fitnes*.
- **Landmine potisk** je ramenom prijazna različica potiska nad glavo: pri omejitvi *rama* program zdaj najde varno zamenjavo zanj (dipi in fallout pa so na seznamu za ramo).
- Graditelj kardio treninga ponuja **zračno kolo**, **bojne vrvi** in **slam žogo** (zadnji dve samo kot intervale – ogrevanje in ohlajanje sta na napravi za enakomerno vožnjo).

### hybrid race (na tvoji opremi)
Tri formati: **celotna simulacija** (8 × tek + postaja), **polovica** (4 postaje) in **trening postaj** (3 krogi). Način *na čas*: race ura, vmesni časi po postajah, povzetek na koncu. Količine: napreden = uradne (1000 m veslanja, 100 m izpadnih korakov ≈ 50, 50 thrusterjev ...), srednji 80 %, začetnik 60 %.

| hybrid race postaja | Nadomestek doma |
|---|---|
| Tek 1 km | Kolo, ~4 min RPE 7 |
| Ski machine 1000 m | Cable – Ski machine poteg (visoka škripca, zgib v kolkih) |
| Sled push 50 m | Kolo stoje, težak upor (55–65 obr./min) |
| Sled pull 50 m | Cable – vlečenje roka-čez-roko |
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
**Hitra prijava:** naprava si zapomni, kdo je nazadnje treniral, in ob zagonu odpre neposredno njegov domači zaslon (če ima PIN, takoj tipkovnico s povezavo *Izberi osebo*). Zamenjava osebe je en klik zgoraj desno. Nov profil = ime + barva + nivo, ostalo (treningi/teden, oprema, PIN) je pod *Več možnosti* ali kasneje v Nastavitvah. Izbirnik *Kdo trenira?* deluje kot pri Netflixu. Vsaka oseba ima **svoj program (3×/4×), nivo, teže, progresijo, zgodovino in shranjene treninge**. Neobvezni 4-mestni PIN zaklene profil na skupnem TV-ju (zasebnost, ne varnost – podatki so v brskalniku). Obstoječi podatki se ob nadgradnji samodejno prenesejo v profil "Jaz".

### Trening po izbiri
- **Sestavi trening**: vrsta (**Moč / Kardio / Moč + kardio**) × fokus (noge, zadnjica, prsa, hrbet, rame, roke, trup – več izbir ali "celo telo") × trajanje (20/30/45/60 min). Generator vzame samo tvojo opremo, najprej večsklepne vaje, pare v supersete in prilagodi število vaj času in tvojemu nivoju. Vsako vajo lahko **zamenjaš** (⇄) ali **odstraniš**, trening pa **shraniš** med priljubljene.
- **Kardio**: kolo / veslač / oboje × cona 2 / intervali / mešano.
- **Hitri treningi** na domačem zaslonu (celo telo, noge & zadnjica, zgornji del, trup, kardio intervali, cona 2).
- **Knjižnica**: filter po fokusu in opremi; pri vsaki vaji gumb **"Treniraj to vajo"**.

### Today (domača stran) in meni ＋ Start
- **Today:**
  - **Finn**, buddy, pozdravi po imenu in poda eno sporočilo glede na dan: trening, počitek, dopolnila, ki so na vrsti, ali "vse opravljeno".
  - **Dnevni načrt:** dopolnila po urah, trening dneva (na prost dan pa lahek sprehod) in tedensko tehtanje. Krog prikazuje, koliko je opravljeno.
  - Trak tedna (gym / trail), nazadnje opravljeno in priporočila izdelkov.
- **＋ Start** (gumb na sredini navigacije) ima tri svetove:
  - **Trail:** tek, hoja, pohod, kolo z GPS; drug šport; uvoz iz ure.
  - **Gym:** današnji trening, izbira treninga, sestavi svojega, knjižnica.
  - **Health:** "vzemi dopolnila zdaj", rutina dopolnil, teža, napredek.
- **Rutina dopolnil:** izdelki Nature's Finest (odmerek in čas z etikete, `js/products.js` → `use`) ali lastni. Za vsakega izbereš čas dneva in ali ga jemlješ vsak dan ali samo na trening dneve.
- Navigacija: **Today · Gym · ＋ Start · Progress · Me**.

### Račun Nature's Finest (pripravljeno, vklop s konfiguracijo)
- Prijava z **Googlom** ali brez gesla z e-pošto iz webshopa: povezava ali 6-mestna koda. Koda deluje tudi na TV in v aplikaciji na domačem zaslonu.
- Sinhronizacija med napravami: profili, treningi, aktivnosti, rutina.
- Povezana naročila iz webshopa, privolitve (GDPR) in izbris računa.
- Postavitev: [`docs/platform-setup.md`](docs/platform-setup.md).

### Ure in senzorji (Garmin, Apple Watch, Polar, Suunto, COROS, Fitbit, pasovi)
- **Uvoz z ure:**
  - formati FIT, TCX, GPX in ZIP (tudi Garminov "Export Original");
  - prenese pot, splits in **srčni utrip**;
  - ista vadba s telefona in z ure se **združi**, ne podvoji.
- **Srčni utrip v živo** prek Bluetooth: pas ali ura v načinu "broadcast HR" (Android/računalnik). Prikaže se med snemanjem in shrani z aktivnostjo, s conami srčnega utripa.
- **Navodila po znamki:** Me › Watches & sensors ali Start › Trail › Watch & heart rate.
- **Samodejna sinhronizacija:** strežniški sloj `device-ingest` je pripravljen za agregatorja ali Garmin API (glej `docs/platform-setup.md`). Apple Health in Health Connect pridejo z nativno aplikacijo.

### Deljenje na družbena omrežja
- Gumb **↗ Share** je na aktivnosti, na koncu treninga, pri tedenskem pregledu (Today, Progress) in pri rekordih.
- **Slika:** story 9:16, objava 1:1 ali prosojna nalepka čez lastno fotografijo. Lahko dodaš svojo fotografijo za ozadje.
- **Share…** odpre sistemski meni telefona (Instagram, TikTok, WhatsApp, Facebook, X …). Na računalniku sliko shraniš ali uporabiš povezave za posamezna omrežja.
- **Zasebnost:** začetek in konec poti sta privzeto skrita.
- **Atribucija:** povezava nosi `utm_source=share`.

### Sport tracker (GPS)
- **Record** (rdeč gumb na sredini navigacije): tek, hoja, pohod, kolo. Prikazuje živ zemljevid, gibalni čas, razdaljo, trenutni in povprečni tempo (oz. hitrost pri kolesu) ter vzpon. Ob vsakem km je pisk in glasovni povzetek.
- **Kako deluje:** zgladi GPS šum, zavrže slabe meritve in nemogoče skoke ter se samodejno ustavi (auto-pause), ko stojiš. Ročna pavza ne riše črte čez pavzo. Krog (lap) se doda na zahtevo. Zaključek je z zadržanjem gumba ("hold to finish"), da se v žepu ne konča po nesreči.
- **iPhone ob zaklenjenem zaslonu ustavi GPS.** Snemanje zato drži zaslon prižgan, kratke vrzeli pa premosti z ravno črto, če je hitrost realna.
- **Snemanje preživi** osvežitev ali zaprt zavihek: povzetek se shrani vsakih ~4 s, domača stran pokaže "Recording paused – Resume".
- **Povzetek:** zemljevid, km splits, graf tempa in višine, best efforts (400 m … maraton) s PR oznako, napor 1–10 in opombe.
- **Ostalo:**
  - ročni vnos katerega koli športa (nogomet, tenis, padel, plavanje, joga …);
  - uvoz GPX iz ure ali druge aplikacije;
  - seznam aktivnosti;
  - v Progress tedenski volumen in tekaški rekordi;
  - aktivnosti štejejo v tedenski trak na domači strani.

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

**Avtomatska progresija (dvojna progresija):** aplikacija si zapomni teže in ponovitve vsake vaje. Ko na vseh serijah dosežeš zgornjo mejo razpona → naslednjič predlaga +2 kg (DB), +4 kg (KB) ali +1 stopnjo (cable station). Če dvakrat zapored ne dosežeš spodnje meje → zmanjša breme.

**Rotacija namesto koledarja:** naslednji trening je vedno naslednji v zaporedju — izpuščen dan ne podre plana.

---

## Reverse engineering — kaj je prevzeto od vodilnih aplikacij

| Vzorec | Vir (analiza) | Implementacija tukaj |
|---|---|---|
| Predlog teže na podlagi zgodovine | Fitbod, Caliber | dvojna progresija + spomin po vaji |
| Generiranje treninga iz razpoložljive opreme | Fitbod | celotna knjižnica = samo tvoja oprema |
| Bloki z deloadom in RIR | Future, Juggernaut, RP | 4-tedenski blok, RIR 3→2→1→deload |
| TV-first layout: velika animacija levo, metrika desno, "Naslednje" spodaj | Apple Fitness+, premium apps | predvajalnik 16:9 z robnim napredkom |
| Odštevanje 3-2-1, zvočni signali, glasovni napovednik | premium apps, Apple Fitness+ | WebAudio piski + sintetizator govora (angleški glas en-GB/en-US) |
| Kartica vaje: navodila + pogoste napake | Nike Training Club | `cues` + `mistakes` pri vsaki vaji |
| cable station upor v stopnjah | cable Mywellness | breme cable station v stopnjah 0–20, ne kg |
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
js/app.js             jedro: zasloni, navigacija (tudi daljinec), vodeni trening, TV predogled + modulni API (window.App)
js/track.js           sport tracker engine (GPS filtri, auto-pause, splits, best efforts, GPX, kalorije) – brez DOM, testiran v Node
js/sport.js           modul sport trackerja: Record, aktivnost, seznam, ročni vnos/GPX, panel v Progress
js/today.js           modul Today: buddy, dnevni načrt, meni ＋ Start (Trail · Gym · Health), rutina dopolnil
js/cloud.js           račun + local-first sinhronizacija (Supabase), čisto jedro testirano v Node
js/account.js         modul računa: prijava (povezava/koda), privolitve, naročila, odjava, izbris
js/config.js          Supabase projekt (prazno = samo lokalno)
supabase/             shema + RLS, edge funkciji shop-order (WooCommerce) in klaviyo-sync, e-mail predloga
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
NODE_PATH=$(npm root -g) node tools/hyrox.cjs ./out                # hybrid race, race ura, vmesni časi, HUD predvajalnika
NODE_PATH=$(npm root -g) node tools/equipment.cjs ./out            # oprema po profilu, zamenjave, hybrid race z realno opremo
NODE_PATH=$(npm root -g) node tools/visual.cjs ./out               # posnetki glavnih zaslonov za vizualni pregled
NODE_PATH=$(npm root -g) node tools/snap.cjs c.png kb_swing "&h=520&labels=1"   # animacija z oznakami mišic in koti
```

Nova vaja = en objekt v `js/exercises.js` (+ vnos v `js/program.js`, če naj bo v programu).

**Moduli platforme:**
- Vsak nov sklop (sport tracker; naslednji: body tracker, rutina prehranskih dopolnil s QR) je svoja datoteka.
- Datoteka se registrira prek `window.FS_MODULES` in dobi `App`.
- Prek `App` doda zaslone (`App.SCREENS.x`) in panele na Home in Progress (`App.hooks.home` / `.progress`).
- Jedra se ne spreminja.

```bash
node tools/track.cjs                                               # GPS engine: razdalja, auto-pause, splits, GPX, rekordi
NODE_PATH=$(npm root -g) node tools/sport.cjs ./out                # sport tracker E2E s simuliranim GPS (telefon)
NODE_PATH=$(npm root -g) node tools/mobile.cjs ./out               # vsi zasloni na telefonu: preliv, gumb Back
NODE_PATH=$(npm root -g) node tools/today.cjs ./out                # Today, meni Start, rutina dopolnil
NODE_PATH=$(npm root -g) node tools/account.cjs ./out              # račun: prijava s kodo, privolitve, naročila, izbris
node tools/cloud.cjs                                               # sinhronizacija med dvema napravama (lažni backend)
node --experimental-strip-types tools/functions.mjs                # edge funkciji (WooCommerce HMAC, Klaviyo)
sh tools/db/test.sh                                                # migracija + RLS na lokalnem Postgresu
```

---

## Omejitve (odkrito)

- Animacije so stilizirana **2D stranska projekcija**, ne video. Rotacijske vaje (sekanje drv) so prikazane v projekciji — besedilna navodila to dopolnjujejo.
- Profili in podatki so shranjeni **na napravi** (TV ≠ telefon) – ni oblačne prijave. Za prenos uporabi izvoz/uvoz v Nastavitvah (izvoz vsebuje vse profile).
- Aplikacija je v angleščini (vmesnik in govor). Če naprava nima angleškega glasu, uporabi zvočne signale.
- Sport tracker v brskalniku: ob zaklenjenem zaslonu iPhone ne beleži GPS (vrzel se premosti z ravno črto). Srčnega utripa iz ure ne bere (iOS v brskalniku nima Bluetooth); ura → GPX uvoz. Rešitev za oboje je nativna ovojnica (Capacitor) z ozadnim GPS in HealthKit / Health Connect.
- Zemljevid uporablja OpenStreetMap ploščice (pilot). Za produkcijo potreben komercialni ponudnik (MapTiler/Stadia/Mapbox) – sprememba ene vrstice v `js/sport.js`.
- Začetne teže so ocena; prvi teden jih prilagodi (aplikacija si jih nato zapomni).

## QR on the pack
Every product QR (dynamic, QRCode Studio) can point to `?p=<SKU>&src=qr`: the guide opens instantly in the phone's language from the official label (`data/labels/`, 17 languages), one tap starts the routine with day 1 already ticked, then the account / home-screen asks. Catalog: `tools/catalog/fetch_labels.py` + `build_catalog.py` → `js/catalog.js`, `data/labels/`, `docs/qr-audit.csv`. Strategy: `docs/qr-strategy.md`. Test: `tools/qr.cjs`.
