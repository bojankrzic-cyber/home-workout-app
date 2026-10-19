# FinestMe – QR na embalaži → aplikacija → navada → ponaročilo

Stanje: tok je zgrajen v aplikaciji in testiran (`js/qr.js`, `js/catalog.js`, `data/labels/`, test `tools/qr.cjs`). Podlaga je izvoz iz QRCode Studio z dne 19. 10. 2026, revizija vseh kod je v `docs/qr-audit.csv`. Strategija rutine je v `docs/health-program.md`.

## 1. Priporočilo
**QR kode na embalaži preusmerimo z PDF etikete na aplikacijo**, na naslov `https://app.naturesfinest.eu/?p=<SKU>&src=qr`. Kode so dinamične, zato tiskanje ni potrebno, vrnitev nazaj pa traja minuto.

Kaj se zgodi ob skeniranju, po vrsti:
1. **Navodila takoj, brez prijave in brez obrazca.** Prikažejo se v jeziku telefona in iz uradne etikete. Stranka vidi odmerek, kdaj ga vzame, kako pogosto in koliko dni zdrži paket.
2. **En gumb:** "Začni mojo 25-dnevno rutino". Današnji dan se že šteje kot 1. dan ✓.
3. **Eno vprašanje:** "Kdaj ga boste vzeli?" Odgovori so ☕ ob kavi, 🍳 ob zajtrku, 🥗 ob kosilu ali 🌙 zvečer.
4. **Šele nato prošnji:** shrani v račun (Google ali e-pošta iz webshopa) in dodaj na začetni zaslon.
5. **Naprej teče rutina iz `health-program.md`:** dnevna kljukica, nagrade 7/30/60/90, opomnik pred koncem paketa, ponaročilo v trgovini stranke, po 21 dneh komplementarni izdelek.

## 2. Zakaj
### Imamo že ogromen, brezplačen kanal
| Podatek (QRCode Studio, kumulativno) | Vrednost |
|---|---|
| QR kode | 479, od tega 327 na izdelkih (325 SKU) |
| Skeniranja skupaj | **1,75 mio**, od tega 96 % na izdelkih |
| Koncentracija | top 5 SKU = 54 % skeniranj izdelkov, top 20 = 79 %, top 50 = 92 % |
| Struktura | 87 % prehranska dopolnila, 10 % napitki (latte, kava, čaj), 3 % hrana |
| Največji | Detox Belly Burn, Liver Cleanse, Night Fatburn, Bio Detox, OK!FatBurn |

Danes vsako skeniranje konča na večjezičnem PDF-ju. To je slepa ulica brez naslednjega koraka, brez podatka in brez ponaročila.

### Vzvod je ponaročilo
- Pri top izdelkih paket zdrži 25–30 dni (Belly Burn 25, Liver Cleanse 25, OK!FatBurn 15).
- Mediana do ponovnega nakupa je 55–80 dni, 180-dnevni ponovni nakup istega izdelka pa le 5–19 % (TrackDaddy).
- Razlika med "paket je prazen" in "kupim znova" je točno luknja, ki jo zapolni opomnik 5 dni pred koncem, vezan na dejanski paket.

### Vsak korak sledi dokazani praksi
| Odločitev | Dokaz |
|---|---|
| Vrednost pred računom | Duolingo je s prestavitvijo registracije za prvo lekcijo dvignil DAU za ~20 %. Prisilen račun je pri nakupu razlog za odhod pri ~26 % kupcev (Baymard). |
| Brez prijavnega zidu, hitro nalaganje | Ko se čas nalaganja s 1 s podaljša na 3 s, se verjetnost odhoda poveča za 32 % (Google). Navodila so ~15 KB in se naložijo takoj. |
| 1. dan že odkljukan | Endowed progress: kartica z 2 od 10 že žigosanih polj je bila dokončana pri 34 % strank, prazna pri 19 % (Nunes & Drèze 2006). |
| "Ob kavi", ne "ob 8:00" | Sidranje na obstoječo rutino gradi avtomatizem, gola opomnika pa ne (Stawarz, CHI 2015). Implementacijski nameni imajo učinek d = 0,65 (Gollwitzer 2006). |
| Kljukice se seštevajo, en izpad ne briše | Navada nastane v mediani 66 dni, en izpuščen dan na to ne vpliva (Lally 2010). |
| Prošnja za začetni zaslon po prvi vrednosti | Spletni push na iOS deluje samo za aplikacijo na začetnem zaslonu (iOS 16.4+). Opt-in za spletni push je 10–15 %, s primingom 2–3× več. |
| Jezik telefona in trg stranke | En QR je na embalaži za vse trge, etikete so v 17 jezikih. Ponaročilo gre v trgovino stranke (HU → naturesfinest.hu, AT → natures-finest.at). |

## 3. Tveganja in trade-offi (kjer plan ne drži)
1. **Jeziki – rešeno (v33).** Celotna aplikacija je v 21 jezikih vseh naših trgov, s samodejnim zaznavanjem in izbiro jezika na prvem zaslonu, v nastavitvah in na vsakem vodiču. Prevodi so strojni (AI) in pred zagonom potrebujejo pregled maternega govorca na trg (`tools/i18n/out/<jezik>.json`).
2. **Opomniki zunaj telefona so zgrajeni (`docs/reminders.md`),** z anonimnim računom samo za opomnike. **Vklop Supabase ostaja ozko grlo št. 1:** brez projekta, VAPID ključev in pg_cron se ne pošlje nič.
3. **37 kod je pokvarjenih** (~10.900 skeniranj): 404, prazna HTML stran pri Babe's IT, napačni izdelek ali stara domena .uk.
   - Pokvarjena koda ruši zaupanje: 86 % tistih, ki naletijo na mrtvo povezavo, pravi, da jim to zmanjša zaupanje v blagovno znamko.
   - Popravek je neodvisen od aplikacije in ga je treba narediti takoj (`docs/qr-audit.csv`, stolpec `status`).
4. **Parser ni regulativa.**
   - Odmerek in dni na paket so razbrani iz angleške etikete in pokrivajo 97 % skeniranj.
   - 126 SKU (11 % skeniranj) ima zastavico `needs_check`. Pri teh aplikacija vpraša stranko po velikosti paketa.
   - Besedila navodil in opozoril so dobesedno z etikete, aplikacija jih ne prepisuje. Prevodi gumbov pa so strojni in rabijo native pregled.
5. **Detox in fatburn izdelki so regulativno občutljivi.** V aplikaciji ni nobene trditve o učinku. Tedenski pregled ne pripisuje sprememb izdelku, besedila govorijo samo o navadi.
6. **GDPR.** Dnevnik jemanja dopolnil je verjetno zdravstveni podatek (čl. 9; CJEU C-21/23 velja za naročila iz lekarn). Ostaja tako:
   - lokalno do prijave;
   - ob prijavi izrecna, ločena privolitev (že zgrajeno);
   - v Klaviyo gredo samo dogodki, nikoli vsebina dnevnika.
7. **Merjenje.**
   - Javnega benchmarka za pretvorbo od skena do registracije ni, zato rabimo lastno kontrolno skupino.
   - Priporočam 10 % novih skeniranj brez rutine, ki vidijo samo navodila in PDF, 60 dni. Samo tako dokažemo inkrementalno ponaročilo.
   - Vklopi se šele, ko so računi živi.
8. **Ne preusmeriti vsega naenkrat.** Top 5 SKU nosi polovico prometa. Napaka tam pomeni 50 % slabo izkušnjo.

## 4. Implementacija
### Zgrajeno (v31 → v32)
- **Katalog iz etiket** (`tools/catalog/`):
  - 325 SKU, 288 etiket v 17 jezikih;
  - za vsak izdelek: vrsta, velikost paketa, dnevni odmerek, dni na paket, čas jemanja;
  - ponovna gradnja ob novem izvozu: `fetch_labels.py <xlsx> <cache>` in nato `build_catalog.py <cache> .`
- **Vodič izdelka:**
  - jezik iz telefona z ročnim preklopom;
  - povzetek (količina, kdaj, kako pogosto, dni na paket);
  - besedilo navodil in opozoril z etikete;
  - PDF kot rezerva;
  - za izdelek brez etikete vljudno obvestilo namesto mrtve strani.
- **Začetek rutine:**
  - nov obiskovalec dobi tiho lokalno osebo, profilni obrazec ga ne čaka;
  - 1. dan je odkljukan, paket se nastavi na dni z etikete, shrani se sidro (kava, zajtrk …);
  - ponovni sken istega izdelka ne podvoji rutine, ampak ponudi "odprl sem nov paket".
- **Prošnje po vrednosti:**
  - na zaslonu 1. dneva sta račun (Google ali e-pošta) in začetni zaslon (Android namestitev, iOS navodilo);
  - na Today je od 2. kljukice naprej ena prošnja naenkrat, ki se lahko odloži za 7 dni.
- **Ponaročilo v trgu stranke:**
  - deluje prek iskanja v trgovini, ker se ID-ji izdelkov razlikujejo po trgih;
  - z `cartId` na trg postane en dotik z dodajanjem v košarico.
- **Dogodki za Klaviyo:** `guide_viewed`, `routine_started` (z jezikom in dnevi na paket), `account_prompt_shown`, `install_prompt`. K temu obstoječi `product_scans`, `supply_low`, `reward_unlocked` …

### Komunikacijski ritem (kanal: najprej aplikacija, nato e-pošta, WhatsApp samo za zalogo)
| Kdaj | Kaj | Kanal |
|---|---|---|
| D0 sken | Navodila, 1. dan ✓, sidro, povabilo | aplikacija |
| D0 po prijavi | Dobrodošlica z navodili tega izdelka in "jutri ob kavi te počakam" | e-pošta |
| D1–D6 | Kljukica. Opomnik samo, če ni kljukice 3 ure po sidru | aplikacija, e-pošta |
| D3 | "3 od 3 – prvi teden je najtežji, ti ga že zmaguješ" | aplikacija |
| D7 | 🎁 Nagrada. Za unovčenje je potreben račun (naravni drugi poziv za registracijo) | aplikacija, e-pošta |
| Vsako nedeljo | Tedenski pregled (3 tapi) | aplikacija |
| Paket −5 dni | "Še 5 dni – naroči, da se rutina ne prekine" s kodo | aplikacija, e-pošta, WhatsApp |
| Paket 0 | "Zadnja merica" (zadnji klic) | e-pošta |
| D21+ | En komplementarni izdelek, največ enkrat na 30 dni | aplikacija |
| 3 dni tišine | Druga ura, manj opomnikov ali premor (brez krivde) | aplikacija, e-pošta |
| 14 dni tišine | Ponedeljek ali 1. v mesecu: "nov začetek" (fresh start) | e-pošta |
| D30 / 60 / 90 | Nagrade in deljiva 90-dnevna zgodba | aplikacija, e-pošta |

### Dodatni vhodi (isti tok, drug `src`)
- **E-pošta s potrditvijo naročila:** za vsak naročeni izdelek gumb "Kako ga jemati", ki vodi na `?p=<SKU>&src=order`. Aktivacija se zgodi še pred prihodom paketa.
- **Kartice v paketu (INSERTI):** namesto produktne strani na trgu `?p=<SKU>&src=insert`.
- **Embalaža ob naslednjem tisku:** jasen poziv k dejanju zraven kode: "Skeniraj: navodila + 🎁 nagrade". V Evropi le 8 % ljudi pogosto skenira QR kode, brez poziva jih je še manj.

### KPI (tedensko, po SKU in jeziku)
| Korak | Cilj v pilotu |
|---|---|
| Sken → odprt vodič | > 95 % (merilo hitrosti) |
| Vodič → začeta rutina | 25–35 % |
| Začeta rutina → račun v 7 dneh | 30 % |
| D7 (≥ 5 kljukic v prvem tednu) | 40 % |
| D30 (≥ 20 kljukic) | 25 % |
| Ponaročilo pred koncem paketa | +30 % proti kontrolni skupini |
| Čas do 2. naročila | pod mediano 55–80 dni |

Primerjava: aplikacije za zdravje in fitnes v povprečju zadržijo ~13 % uporabnikov na D7 in ~8 % na D30.

## 5. Naslednji korak
| # | Naloga | Kdo | Rok |
|---|---|---|---|
| 1 | Supabase projekt (EU) in URL ter anon ključ v `js/config.js`, Google OAuth | razvoj | 1 teden |
| 2 | Domena `app.naturesfinest.eu` na aplikacijo | IT | 1 teden |
| 3 | Popravek 37 pokvarjenih kod (do takrat na novo ciljno stran, ne na 404) | packaging / web | takoj |
| 4 | Pregled odmerkov in dni na paket za top 50 SKU, nato za vse z `needs_check` | regulativa / produkt | 2 tedna |
| 5 | Native pregled prevodov (17 jezikov) | country managerji | 2 tedna |
| 6 | Prevod celotnega zdravstvenega dela (Today, program, opomniki) | razvoj | 3 tedne |
| 7 | **Pilot:** preusmeritev 3 SKU srednjega obsega (Detox Digest 5633, Magnesium 5487, Collagen 5467; ~34k skeniranj skupaj) za 3 tedne | e-commerce | po 1–2 |
| 8 | Klaviyo flowi po tabeli zgoraj, e-pošta s potrditvijo naročila (`src=order`) | CRM | vzporedno |
| 9 | Ob doseženih KPI pilota: top 20 (79 % skeniranj), nato vse | CEO odločitev | pilot + 3 tedne |
