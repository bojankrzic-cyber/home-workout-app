# FinestMe Health – rutina od nakupa do ponaročila

Stanje: zgrajeno v aplikaciji (`js/health.js`) in testirano (`tools/health.cjs`, `tools/program.cjs`). Strežniški dogodki za opomnike prek Klaviyo so pripravljeni (`app_events`, `klaviyo-sync`). Podlaga: plan "rutina od nakupa do ponaročila", primerjava s konkurenco (`docs/health-benchmark.md`) in analiza sočasnih nakupov (`docs/health-complements.md`).

## Kaj stranka doživi
| Faza | V aplikaciji | Strežnik → Klaviyo |
|---|---|---|
| QR na embalaži / letaku | `?p=<izdelek>&src=pack` odpre vodič izdelka (odmerek, čas, kako pogosto) → "Začni rutino – paket odprt danes". Nov uporabnik najprej naredi profil, nato se vodič odpre sam | `product_scans` (tudi brez prijave) |
| Aktivacija | izbira trenutka: ☕ ob kavi / 🍳 ob zajtrku / 🥗 ob kosilu / 🌙 zvečer | `routine_started` |
| Vsak dan | Today: "Took your supplements today?" **[✅ Done] [⏰ Later] [Not today]**, en tap za vse izdelke. Ob tem vrstica z napredkom "še 4 do prve nagrade" | `checkin_streak` |
| Prvi teden | 7 kljukic → 🎁 značka + brezplačna dostava ob naslednjem ponaročilu (koda). Opomniki se nato znižajo na 3× tedensko ("gre ti že samo") | `reward_unlocked` |
| Tedni 2–3 | nedelja: 3 tapi (energija, spanec, vprašanje po cilju); Moj program: primerjava s prejšnjim tednom in graf | `weekly_review` |
| Pred koncem zaloge | 5 dni prej kartica "Kreatin: še 5 dni – naroči, da se rutina ne prekine" → **🛒 Reorder** (add-to-cart, koda, UTM) ali "Čez 3 dni" | `supply_low` (enkrat na paket), `reorder_clicked` |
| 30 kljukic | 🏅 15 % + brezplačen vzorec, izbran za cilj, v naslednjem paketu | `reward_unlocked` |
| Po 21 dneh | "Priporočeno za tvoj cilj": en izdelek, največ enkrat na 30 dni, "Dodaj v naslednji paket" / "Ne, hvala" (se ne ponovi) | `complement_suggested` |
| 60 / 90 | 🚚 brezplačna dostava, dokler je stranka aktivna; 🏆 zaklenjena cena in 90-dnevna zgodba (deljenje na socialna omrežja) | `reward_unlocked` |
| Izpadi | "Not today" ni izpad. 3 tihi dnevi → "Life gets busy" **[Spremeni uro] [Manj opomnikov] [Premor 1 teden]**. Premor zamrzne vse | `checkins_missed`, `program_paused` |

## Pravila, ki držijo sistem (iz plana in konkurence)
1. **Kljukice se seštevajo, ne brišejo.** Nagrade temeljijo na skupnem številu, niz je samo motivacijski sloj z 2 "zamrznitvama" (kot Duolingo).
2. **En tap na dan, 20 sekund na teden.**
3. **Brez krivde.** Odziv na izpad je ponudba (druga ura, manj opomnikov, premor), ne očitek.
4. **Vsaka prodaja je zaščita ali nagrada.** Ponaročilo ščiti rutino in vključuje kodo. Komplementarni izdelek je darilo ali nasvet, nikoli katalog.
5. **Brez zdravstvenih trditev zunaj odobrenih.** Besedila "kaj pričakovati" govorijo o navadi in doslednosti, ne o učinku. Tedenski pregled ne pripisuje izboljšav izdelku.

## Kje sem plan ChatGPT spremenil (in zakaj)
- **7 kljukic = ni gotovinski popust.** Kljukice stranka označi sama, zato bi kodo dobil vsak, ki 7 dni tapa. Nagrada je zato značka in brezplačna dostava, ki se unovči šele z naročilom. Pravi popust je pri 30 kljukicah.
- **WhatsApp samo za zalogo in ponaročilo, ne za dnevni opomnik.** Od 1. 7. 2025 se v EU plača vsako marketinško sporočilo (~0,11–0,16 € na sporočilo v DE/FR, podatki ponudnikov), utility sporočila pa so brezplačna le v 24-urnem oknu. Dnevni opomnik zato ostane v aplikaciji in e-pošti.
- **Kode morajo biti unikatne na stranko.** V pilotu so skupne (`js/products.js → CONFIG.rewards`); pred zagonom jih mora ustvarjati strežnik prek WooCommerce REST API.
- **Pari za cross-sell iz podatkov** (`docs/health-complements.md`), ne iz intuicije. Aplikacija bere `HEALTH_COMPLEMENTS`; če ga ni, uporabi pravila glede na cilj.

## Kaj pravijo naši podatki (TrackDaddy, `docs/health-complements.md`)
- **Ponaročilo je največji vzvod.**
  - Mediana do ponovnega nakupa istega izdelka je 55–80 dni, to je ~30 dni na enoto.
  - V 90 dneh isti izdelek ponovno naroči le 4–13 % kupcev, v 180 dneh pa 5–19 %.
  - Opomnik pred koncem zaloge, ki je vezan na dejanski paket stranke, cilja točno to luknjo.
- **Pari v isti košarici so večinoma naši paketi**, zato je osnova za cross-sell naslednji nakup in vpliv na ponovni nakup v 180 dneh, ne košarica:
  - D3 + IMUNUP: 32 % proti 22 %;
  - Cellulite + Bronze: 46 % proti 21 %;
  - Hair + Kolagen: 37 % proti 21 %.

  Vzorci so majhni, zato so to kandidati za A/B test. Privzeti paket Detox Belly Burn + Hormone Balance PRO retencije ne poveča.
- **V aplikaciji:** `js/complements.js` (iz `tools/build_complements.py`), npr. Magnesium → D3, Protein → Magnesium/Creatine, Creatine → Protein/Hydration.
- **Trgi:** ID-ji izdelkov in moč parov se razlikujejo po trgih (HU, PL, IT, CZ, ES so največji). Komplement in `cartId` je treba določiti po trgu.

## Odločitve za vas (CEO / komerciala)
- **Višina nagrad:** 30 kljukic → % popusta (predlog 15 %); 60 → brezplačna dostava; 90 → zaklenjena cena. Vse to bremeni maržo ponaročila, kar je strošek retencije, ne akvizicije.
- **Naročnina:** ponudba šele ob prvem ponaročilu ("nikoli več brez"), z možnostmi preskoči / premakni / premor pred preklicem.
- **WhatsApp ponudnik:** Klaviyo WhatsApp (če ga imate v računu) ali 360dialog / Infobip.

## Kaj manjka do zagona (kdo)
| Naloga | Kdo |
|---|---|
| Velikost paketa (`pack.servings`) in ID izdelka za košarico (`cartId`) za vsak izdelek in trg | e-commerce |
| Potrditev odmerkov in časa jemanja (`use`) glede na etikete; knjižnica odobrenih trditev po jeziku | regulativa |
| Unikatne kode nagrad prek WooCommerce REST (strežniška funkcija) | razvoj |
| `?coupon=` v URL-ju (vtičnik ali lastna koda) in povezava "add to cart" za vse trge | webshop |
| Klaviyo flowi po dogodkih (opisano v `docs/platform-setup.md`) | marketing / CRM |
| QR kode na embalaži in letakih: `https://app.naturesfinest.eu/?p=<id>&src=pack&b=<serija>` | packaging |
| Vklop računov (Supabase), brez katerega ni opomnikov po e-pošti | razvoj |

## KPI (vsak mehanizem z 5–10 % kontrolno skupino)
- **Aktivacija:** % kupcev s QR skeniranjem ali začeto rutino v 7 dneh.
- **Kljukice:** D7 in D30 (cilj D7 > 60 %, D30 > 35 %).
- **Ponaročilo:** ponaročilo pred koncem zaloge in čas do 2. naročila (primerjava z mediano cikla iz TrackDaddy).
- **Naročnina:** delež sprejetih naročnin ob ponaročilu.
- **Cross-sell:** delež strank z 2. izdelkom v 60 dneh in vzorec → nakup.
- **Utrujenost od opomnikov:** odjava od opomnikov in uporaba premora.
