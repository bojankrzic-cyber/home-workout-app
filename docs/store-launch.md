# Rutina v App Store in Google Play – vodič za zagon

**Lastnik računov:** Capita Holding (razvijalec v trgovinah) · **App:** Rutina – by Nature's Finest · **ID aplikacije:** `eu.naturesfinest.rutina`
**Tehnologija:** ista spletna koda kot https://bojankrzic-cyber.github.io/home-workout-app/, zapakirana s Capacitor (mapi `ios/` in `android/` v repozitoriju). Vsaka sprememba appa gre hkrati v splet, iPhone in Android.

---

## 0. Kritična pot in odgovorni

| # | Korak | Kdo | Rok | Odvisno od |
|---|---|---|---|---|
| 1 | D-U-N-S številka za Capita Holding | pravna / finance | 5–14 dni | – |
| 2 | Službeni Apple ID in Google račun za razvijalca (ne osebni) | IT | 1 dan | – |
| 3 | Apple Developer Program – organizacija | pooblaščena oseba Capita Holding | 1–3 dni po D-U-N-S | 1, 2 |
| 4 | Google Play Console – organizacija | pooblaščena oseba Capita Holding | 2–7 dni (preverjanje) | 1, 2 |
| 5 | Politika zasebnosti in pogoji za app (javni URL) | pravna | 1 teden | – |
| 6 | Podpisni ključi v GitHub Secrets | IT (lastnik repozitorija) | 1 dan | 3, 4 |
| 7 | Opisi, posnetki zaslonov, obrazci za zasebnost | razvoj (osnutki pripravljeni) + marketing + pravna | 1 teden | 5 |
| 8 | Interni test (TestFlight / Play Internal testing) | ekipa | 1 teden | 3, 4, 6 |
| 9 | Oddaja v pregled → objava | razvoj | Apple 1–3 dni, Google 1–7 dni | 8 |

**Realno: 4–6 tednov.** Koraki 1, 2, 5 in 7 lahko tečejo vzporedno že danes.

---

## 1. D-U-N-S številka (brezplačno)

D-U-N-S je mednarodna identifikacijska številka podjetja (Dun & Bradstreet). Apple in Google z njo preverita, da je razvijalec pravna oseba.

**Postopek (priporočeno prek Applovega brezplačnega obrazca):**
1. Odpri https://developer.apple.com/enroll/duns-lookup/ in se prijavi s službenim Apple ID (korak 2).
2. Najprej **preveri, ali Capita Holding številko že ima** (holdingi jo pogosto imajo zaradi bank ali izvoza). Če jo ima, jo samo uporabi.
3. Če je nima, izpolni zahtevek. Podatki morajo biti **točno takšni kot v AJPES / sodnem registru**:
   - polno pravno ime družbe (npr. »Capita Holding d.o.o.« – preveri točen zapis)
   - naslov sedeža, poštna številka, kraj, država
   - matična številka in davčna številka
   - telefonska številka podjetja (javljajo se na njej)
   - ime, priimek, funkcija in službeni e-naslov kontaktne osebe
   - spletna stran družbe
4. D&B lahko pokliče ali piše za potrditev – kontaktna oseba naj odgovori v istem dnevu.
5. Ko številko prejmeš, **počakaj 1–2 delovna dni**, da se prenese v Applove sisteme, šele nato začni korak 3.

**Pogosta napaka:** ime ali naslov se razlikujeta od registra (npr. »d.o.o.« manjka, star naslov) → zavrnitev in nov krog (+2 tedna).

---

## 2. Službeni računi (ne osebni)

- **Apple ID:** npr. `apps@capitaholding.…` ali `apps@naturesfinest.…`, z vklopljeno dvostopenjsko prijavo, telefon podjetja kot zaupanja vredna naprava.
- **Google račun:** isti službeni e-naslov kot Google račun (Google Workspace ali »uporabi obstoječi e-naslov«).
- Gesla v firmin upravitelj gesel (dostop vsaj 2 osebi – brez odvisnosti od ene osebe). **Gesel ne pošiljajte v klepet ali e-pošto.**

---

## 3. Apple Developer Program – organizacija (99 USD / leto)

1. https://developer.apple.com/programs/enroll/ → »Enroll as an organization«.
2. Potrebno: D-U-N-S, pravno ime (mora se ujemati z D-U-N-S), spletna stran podjetja, **oseba s pooblastilom za podpis pogodb v imenu Capita Holding** (direktor ali prokurist; Apple jo lahko pokliče).
3. Plačilo s kartico podjetja.
4. **Pomembno – ime prodajalca:** v App Store pod imenom aplikacije piše **ime pravne osebe** (»Capita Holding …«). Ime aplikacije ostane »Rutina – by Nature's Finest«.
5. Po odobritvi v **App Store Connect**:
   - Users and Access → dodaj člane ekipe (vloga *Developer* / *App Manager*), ne deli glavnega računa.
   - Integrations → **App Store Connect API key** (vloga *App Manager*) → shrani *Issuer ID*, *Key ID* in datoteko `.p8` → v GitHub Secrets (korak 6). S tem bo gradnja samodejno nalagala v TestFlight.
   - Agreements, Tax, and Banking → podpiši pogodbo »Free Apps« (za brezplačen app zadošča; »Paid« šele ob plačljivih funkcijah).

## 4. Google Play Console – organizacija (25 USD enkratno)

1. https://play.google.com/console/signup → **Organization**.
2. Potrebno: D-U-N-S, pravno ime in naslov, javni kontaktni e-naslov in telefon za uporabnike, spletna stran (preverjena v Google Search Console).
3. Google preveri organizacijo z dokumenti (izpis iz registra) – 2–7 dni.
4. Prednost organizacije: **ni obveznega 14-dnevnega zaprtega testa z 12 testerji**, ki velja za osebne račune.
5. Ustvari aplikacijo »Rutina – by Nature's Finest«, paket `eu.naturesfinest.rutina`, vklopi **Play App Signing** (Google hrani ključ za podpis; mi hranimo le »upload key«).

## 5. Pravna besedila (javni URL-ji)

- **Politika zasebnosti** z razdelkom za app: katere podatke zbira, zakaj, kje so shranjeni (EU, Supabase), kdo jih obdeluje (Klaviyo za e-pošto), koliko časa, pravice uporabnika. Trenutno `js/config.js → privacyUrl` kaže na splošno stran – dopolniti.
- **Pogoji uporabe** (kratki).
- **Brisanje računa:** v appu že obstaja (Nastavitve → Račun → Izbriši). Google zahteva še **spletni URL** za zahtevo izbrisa – dodamo stran.
- **Podpora:** e-naslov in URL (npr. stran podpore Nature's Finest).
- **Zdravstvene trditve:** v appu in opisih **ne obljubljamo učinkov** dopolnil (EU 1924/2006). Besedila z etiket so odobrena; vse ostalo ostane nevtralno (»tvoja dnevna rutina«, ne »okrepi imunost«).

**Kaj app zbira (za obrazca App Privacy in Data safety – pravna potrdi):**

| Podatek | Kje | Zakaj | Povezano z osebo |
|---|---|---|---|
| Profil (ime, cilj, starost, teža, višina, oprema) | v napravi; v oblaku samo z računom | prilagojen program | da (z računom) |
| Vadbe, aktivnosti, GPS sledi | v napravi; v oblaku z računom | napredek, zemljevid | da (z računom) |
| Rutina dopolnil, kljukice | v napravi; v oblaku z računom | opomniki, nagrade | da (z računom) |
| E-naslov | samo z računom ali opomniki po e-pošti | prijava, opomniki (Klaviyo) | da |
| Dogodki uporabe (npr. »rutina začeta«) | samo z računom | izboljšave, opomniki | da |
| Lokacija | samo med snemanjem Trail | pot, razdalja | ne deli se tretjim |
| Kamera | samo med skeniranjem | branje QR / črtne kode | slike se ne shranjujejo |

Ni oglaševanja, ni sledenja med aplikacijami (ATT ni potreben), podatki se ne prodajajo.

## 6. Ključi v GitHub Secrets (dela lastnik repozitorija – ne pošiljati v klepet)

Repozitorij → Settings → Secrets and variables → Actions:

| Secret | Vsebina |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | upload keystore (`base64 upload.jks`) |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | gesla in alias ključa |
| `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_P8_BASE64` | App Store Connect API key (korak 3) |
| `APPLE_TEAM_ID` | Team ID iz Apple Developer računa |

Upload keystore ustvari IT: `keytool -genkeypair -v -keystore upload.jks -alias rutina -keyalg RSA -keysize 2048 -validity 10000` – datoteko in gesla shrani v firmin trezor gesel (kopija na 2 mestih).

## 7. Vsebina za trgovini

- **Ime:** Rutina – by Nature's Finest (App Store max 30 znakov ✓)
- **Podnaslov (App Store, 30):** »Tvoja dnevna rutina« / »Daily routine, done right«
- **Kategorija:** Health & Fitness (Zdravje in fitnes)
- **Starostna ocena:** 12+ (nasveti o dopolnilih le odraslim – app to že upošteva)
- **Opisi:** v 20 jezikih trgov – osnutek pripravi razvoj iz obstoječih prevodov, marketing potrdi.
- **Posnetki zaslonov:** iPhone 6,9″ in 6,5″, Android telefon (1080×1920+), opcijsko tablica. Generiramo jih samodejno iz appa (svetla tema, 5–6 zaslonov: Danes, skener, vodič za izdelek, vadba, Trail, napredek).
- **Ikona:** `assets/icon-only.png` (1024×1024, brez prosojnosti) ✓ · **Napis:** `icons/rutina-logo.svg`

## 8. Tveganja pri pregledu in kako jih zapiramo

| Tveganje | Smernica | Ukrep |
|---|---|---|
| »Le spletna stran v ovoju« | Apple 4.2 | ob oddaji: native obvestila, native skener, Apple Health (v razvoju) |
| Prijava z Googlom brez Apple | Apple 4.8 | »Sign in with Apple« (gumb obstaja, native priklop v razvoju) |
| Zdravstvene trditve | Apple 1.4.1, EU 1924/2006 | samo odobrena besedila z etiket |
| Brisanje računa | Apple 5.1.1(v), Google | v appu ✓, spletni URL – dodati |
| Zasebnost | Apple 5.1, Google Data safety | obrazca po tabeli v točki 5 |
| Ime »Rutina« zasedeno | – | v trgovini vedno »Rutina – by Nature's Finest«; znamka: glej `docs/brand.md` |

## 9. Kako gredo posodobitve po objavi

1. Spremembe dizajna in funkcij gredo kot doslej v `main` → splet se posodobi takoj.
2. Ista koda se samodejno zgradi za iOS in Android (`.github/workflows/native.yml`).
3. Za trgovini: nova verzija → TestFlight / Internal testing → oddaja → pregled (Apple običajno 1 dan). Priporočen ritem: izdaja vsakih 2–4 tedne, nujni popravki takoj.
4. Pozneje (opcijsko): »live updates« (npr. Capgo) za manjše popravke vsebine brez pregleda – dovoljeno, dokler se namen appa ne spremeni (Apple 3.3.2).

## 10. Stanje razvoja (repozitorij)

- ✓ Capacitor projekt `ios/` in `android/`, ID `eu.naturesfinest.rutina`, ime »Rutina«
- ✓ ikone in začetni zaslon (svetel/temen) za vse velikosti (`assets/` → `npm run assets`)
- ✓ dovoljenja z razlago (kamera, lokacija, fotografije)
- ✓ native plast `js/native.js`: statusna vrstica po temi, zunanje povezave v brskalniku, Android gumb nazaj, brez »dodaj na začetni zaslon«
- ✓ samodejna gradnja: Android APK za test + AAB za Play, iOS gradnja za simulator
- ☐ native obvestila (APNs + Firebase) – potrebuje Apple račun in Firebase projekt
- ☐ Apple Health / Health Connect, Sign in with Apple, native skener
- ☐ samodejno nalaganje v TestFlight / Play – po koraku 6
- ☐ samodejni posnetki zaslonov za trgovini

**Lokalno:** `npm ci && npm run sync` → `npx cap open ios` (Xcode na Macu) ali `npx cap open android` (Android Studio).
