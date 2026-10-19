# FinestMe – komplementarni izdelki in cikli ponovnega nakupa (iz podatkov)

*Vir: TrackDaddy (BFF Postgres: `orders`, `order_line_items`, `products`, `product_sku_id_mappings`, `stores`). Samo branje. Pripravljeno 19. 10. 2026.*

## Povzetek (5 točk)

1. **Košarica je predvsem paketna, ne "organska".** 89 % prodanih vrstic je del vnaprej sestavljenih paketov (npr. Detox Belly Burn + Hormone Balance PRO sta skupaj v 95 % naročil Hormone Balance, LIVER CLEANSE + Bio DETOX mix v 98 %). Klasičen "lift v isti košarici" zato meri naše pakete, ne potrebe kupca. Pare smo zato preverili s štirimi signali: lift v košarici, "organski" lift (izven istega paketa), naslednji nakup v 120 dneh in vpliv na 180-dnevno retencijo.
2. **Najmočnejši pari (podprti z več signali hkrati):** PROstate Support ↔ TestoPRO Extreme, Cellulite PRO ↔ Bronze PRO, Kolagen SkinCare ↔ Beauty Hyaluron, Hair Vitamins → Kolagen SkinCare, Vitamin D3 → IMUNUP, LIVER CLEANSE / Bio DETOX mix → OK!FatBurn, GLP-1 ProBoost → Night GLP-1 ProBoost, Night FatBurn Extreme → D-FatBurner.
3. **Retencija: le nekaj parov res dvigne ponovni nakup.** Novi kupci s parom v prvem naročilu proti kupcem samo A: Cellulite PRO + Bronze PRO 46 % proti 21 % (180 dni), Hair Vitamins + Kolagen 37 % proti 21 %, Vitamin D3 + IMUNUP 32 % proti 22 %, Kolagen + Beauty Hyaluron 30 % proti 28 %. Privzeti paket Detox Belly Burn + Hormone Balance PRO ne prinese nič (19,4 % proti 19,8 %). Vzorci so pri najboljših parih majhni (39–210 kupcev) – to je smer za test, ni še dokaz.
4. **Cikel zaloge je jasen: približno 30 dni na enoto pri kapsulah, mediana med ponovnimi nakupi je 55–80 dni** (kupci vzamejo 1,3–2,6 enote na naročilo). Isti izdelek v 45 dneh ponovno kupi le 3–9 % kupcev, v 180 dneh pa 5–19 %. Opomnik "zaloga gre h koncu" naj se računa iz kupljenih enot: **dan opomnika = enote × dni na enoto − 7**.
5. **Fitnes starterji v aplikaciji imajo v podatkih zelo malo volumna** (6 mesecev: Creatine 458 naročil, Recovery Shake 42, Bio Vegan Protein 49, Hydration + Energy 7). Njihovi pari so zato *nizke zanesljivosti*. Najbolj zanesljiva para za starterje sta Magnezij → Vitamin D3 in Vitamin D3 → IMUNUP; drugo so hipoteze za A/B test. Pozor: WooCommerce ID-ji v `products.js` veljajo za SI trgovino, ID 852097 v DE/CH kaže na drug izdelek.

## Metoda in časovno okno

| Analiza | Okno | Populacija |
|---|---|---|
| a) Skupni nakup (support, confidence, lift) | 19. 4. 2026 – 18. 10. 2026 (6 mes.); kontrola na 12 mes. (19. 10. 2025 – 18. 10. 2026, 1,117 mio naročil) | 581.842 zaključenih naročil (`status = completed`), vrstice s ceno > 0 |
| b) Naslednji nakup v 120 dneh | prvi nakup A: 19. 4. 2025 – 18. 6. 2026, opazovanje do 18. 10. 2026 | 5 % naključni vzorec kupcev (customer_id mod 20); manjši izdelki na celotni populaciji |
| c) Ponovni nakup istega izdelka | nakupi od 1. 1. 2025; kohorta prvega nakupa 19. 4. 2025 – 19. 4. 2026 (zadnjih 180 dni opazovanja) | vsi kupci; razmiki 7–365 dni |
| d) Retencija A+B proti samo A | novi kupci s prvim naročilom 19. 4. 2025 – 18. 4. 2026, 180 dni po prvem naročilu | 10 % vzorec (≈ 68 tisoč novih kupcev; osnovna 180-dnevna stopnja ponovnega nakupa 20,9 %) |
| e) Trgi | 6 mesecev | HU, PL, IT, CZ, ES (top 5 po prihodku 12 mes.) + SI |

**Definicije.** Izdelek = komponentni SKU (paketne vrstice `PanStoreGrouped-*` z 0 € so izločene), ime brez pripone "(Bundle: …)". Združeno: Creatine (5842, 5843 Lemon), Magnezij citrat (1504, 5487, 5487-488), Vitamin D3 (1503, 5547, 5547-548), Bio Vegan Protein (5858, 5039-40), TestoPRO (1507, 5696), Metabolism Booster (1511, 5726).
*Confidence* = P(B | A v naročilu). *Lift* = confidence / P(B). *Organski lift* šteje samo naročila, kjer A in B **nista v istem paketu**: to pokrije samostojen dodatek v košarico, order bump ali upsell. *Next-share* = delež kohorte A, ki ima B v prvem naslednjem naročilu (≤ 120 dni); *indeks* = ta delež / delež B v naslednjem naročilu vseh novih kupcev. *Retencija* = delež kupcev z vsaj enim dodatnim naročilom v 180 dneh; *LTV180* = bruto prihodek prvega in naslednjih naročil v 180 dneh (`total_eur`).

## Priporočen komplement po sidrnem izdelku

Top 40 po prihodku (12 mes.). Vsi so blagovna znamka Nature's Finest (polja "brand" v bazi ni, glej opozorila). Stolpec "Lift / conf." je za isto košarico v 6 mesecih (vse vrstice, v oklepaju organski lift). Pri "Retencija" je zapisano A+B proti samo A (n = kupci z A+B).

| # | Sidro A (12 mes. prihodek) | → Komplement B | Lift (org.) / conf. | Next-share 120 d (indeks) | Retencija 180 d / LTV180 | Ocena in opomba |
|---|---|---|---|---|---|---|
| 1 | Detox Belly Burn (8,2 mio €) | Night FatBurn Extreme | 1,05 (0,17) / 16 % | 6,3 % (1,4×) | 20,8 % proti 19,4 %; 93 € proti 54 € (n = 6.137) | **Srednje.** Dan + noč; Hormone Balance je že privzeti paket (64 % naročil DBB) in retencije ne dvigne |
| 2 | Hormone Balance PRO (4,1 mio €) | KSM-66 Ashwagandha® | 0,05 / <1 % | 1,2 % (1,6×) | n = 18 (premalo) | **Šibko.** Kupec ima DBB že v paketu; edini tematski signal je zaporedni |
| 3 | Night FatBurn Extreme (4,0 mio €) | D-FatBurner | 5,8 (0,35) / 18 % | 1,9 % (2,9×) | 24,4 % proti 21,6 % (n = 397) | **Močno.** Konsistentno na vseh trgih (lift 3,8–7,8) |
| 4 | LIVER CLEANSE (2,4 mio €) | OK!FatBurn | 4,9 (0,30) / 20 % | 4,4 % (3,3×) | 22,1 % proti 21,3 %; 72 € proti 61 € | **Močno.** Bio DETOX mix je že v paketu (96 %) |
| 5 | Bio DETOX mix (2,3 mio €) | OK!FatBurn | 5,0 (0,29) / 20 % | 4,3 % (3,3×) | 22,1 % proti 21,3 % | **Močno** (isti "jetrni" režim) |
| 6 | KSM-66 Ashwagandha® prah (2,2 mio €) | Hormone Balance PRO | – / <1 % | 3,9 % (1,4×) | n = 18 (premalo) | **Šibko.** Alternativa OK!FatBurn (lift 2,2, conf. 8,6 %) |
| 7 | KSM-66 Ashwagandha® kapsule (1,8 mio €) | – (ni signala) | vsi lifti < 1 | – | – | Samo replenishment, brez cross-sella |
| 8 | PROstate Support (1,8 mio €) | TestoPRO Extreme | 5,3 (0,15) / 29 % | 5,7 % (5,6×) | 21,2 % proti 24,3 %; po-prihodek 21 € proti 16 € | **Močno.** Moški paket, na vseh trgih lift 3,3–8,1 |
| 9 | Cellulite PRO (1,4 mio €) | Bronze PRO | 9,7 (0,28) / 25 % | 1,9 % (6,6×) | **46 % proti 21 %; 114 € proti 58 €** (n = 39) | **Močno** (največji dvig retencije, majhen n) |
| 10 | TestoPRO Extreme (1,2 mio €) | PROstate Support | 5,3 / 25 % | 6,9 % (5,5×) | 21,2 % proti 20,8 %; 92 € proti 60 € | **Močno** |
| 11 | OK!FatBurn Coffee (0,9 mio €) | Collagen Coffee | 2,5 (2,5) / 1,9 % | FatBurn Tea 1,5 % (2,2×) | n = 7 | **Šibko** (kavna rutina) |
| 12 | Kolagen SkinCare (0,8 mio €) | Beauty Hyaluron | 21,6 (4,2) / 14 % | 2,3 % (14×) | 30,0 % proti 27,7 %; 88 € proti 75 € (n = 210) | **Močno.** Alternativa Hair Vitamins (retencija 37 % proti 28 %) |
| 13 | OK!FatBurn (0,8 mio €) | LIVER CLEANSE | 4,9 / 53 % | 7,4 % (3,0×) | 22,1 % proti 22,7 % | **Srednje** (paketno); organsko Waistline PRO (lift 5,7) |
| 14 | Hair Vitamins (0,6 mio €) | Kolagen SkinCare | 3,9 (1,5) / 6,5 % | 1,7 % (3,2×) | **37 % proti 21 %; 104 € proti 52 €** (n = 51) | **Močno** (lepota od znotraj) |
| 15 | Bronze PRO (0,5 mio €) | Cellulite PRO | 9,7 / 57 % | 5,5 % (7,4×) | glej #9 | **Močno** |
| 16 | D-FatBurner (0,5 mio €) | Night FatBurn Extreme | 5,8 / 89 % | 15,4 % (3,4×) | 24,4 % proti 24,6 % | **Srednje.** Organsko Metabolism Booster (indeks 10,6×) |
| 17 | OK!WaterOut (0,4 mio €) | Anti Cellulite piling od kave | 26,3 / 72 % | 2,7 % (5,4×) | – | **Srednje.** Night FatBurn Extreme ima next-share 9,2 % (2,0×), retencija pa je slabša (21 % proti 24 %) |
| 18 | GLP-1 ProBoost (0,4 mio €) | Night GLP-1 ProBoost | 91,7 / 51 % | 4,3 % (13×) | 19,5 % proti 19,4 %; 74 € proti 63 € | **Močno** (dan + noč, ni v HU) |
| 19 | Beauty Creatine (0,36 mio €) | – (ni signala) | Beauty Hyaluron 0,85 | – | nov izdelek (od 06/2026) | Samo replenishment |
| 20 | OK!Sterol Forte (0,29 mio €) | – (šibko: IMUNUP, org. lift 2,3, n = 25) | – | – | – | Samo replenishment (najboljši 180-d repeat: 17,5 %) |
| 21 | Night GLP-1 ProBoost (0,28 mio €) | GLP-1 ProBoost | 91,7 / 93 % | – | – | Paketno |
| 22 | Anti Cellulite piling (0,27 mio €) | OK!WaterOut | 26,3 / 93 % | – | – | Paketno |
| 23 | Golden Curcuma latte (0,26 mio €) | IMUNUP | 9,4 (org.) / 2,5 % | – | – | Srednje (order bump) |
| 24 | PROSTATE Support (kapsule, 0,24 mio €) | TestoPRO Extreme | 0,9 / 4,8 % | – | – | Šibko |
| 25 | MELAclear+ (0,22 mio €) | SKINclear+ | 4,6 (org.) / 0,5 % | – | – | Šibko (koža) |
| 26 | Golden Collagen (0,19 mio €) | Kolagen SkinCare | 3,6 (org.) / 6,2 % | 2,8 % (5,3×) | – | Srednje |
| 27 | OK!Meno (0,17 mio €) | Hormone Balance PRO | 0,5 / 12 % | 5,5 % (2,0×) | – | Srednje (zaporedno) |
| 28 | Metabolism Booster Extreme | D-FatBurner | 2,2 (org.) / 6,8 % | 3,1 % (4,6×) | – | Srednje |
| 29 | FatBurn Tea | Detox Anti-Age | 12,9 (org.) / 12 % | – | 20,9 % proti 24,1 % (obratna smer) | Order-bump par, retencija ni boljša |
| 30 | GutPRO | – | vsi < 1 | – | – | Samo replenishment |
| 31 | Detox Anti-Age | IMUNUP | 18,3 (org.) / 4,9 % | 1,9 % (11×) | – | Srednje (oba sta order bump) |
| 32 | LD12 / FD17 / CR15 / ES13 (šifre) | Detox Anti-Age, FatBurn Tea | 5–7 (org.) | – | – | Šifre izdelkov niso razložene v bazi |
| 33 | Detox Aqua Attack / Detox Digest | Night FatBurn Extreme (paket), org. No Bloat Tea | 6,0–6,4 / 83–94 % | – | – | Paketno |
| 34 | Beauty Hyaluron | Kolagen SkinCare | 21,6 / 37 % | 7,9 % (15×) | glej #12 | **Močno** |
| 35 | Collagen Coffee | Golden Q10 | 45,2 (org.) / 15 % | – | 25,0 % proti 21,0 % (n = 44) | Srednje (upsell, konsistentno na vseh trgih) |
| 36 | Mushroom Coffee | Night Detox Tea | 3,8 (org.) / 1,5 % | – | – | Šibko (nov izdelek) |
| 37 | THYROID | GLP-1 ProBoost (paket) | 85,6 / 87 % | – | – | Paketno |
| 38 | Vitamin D3 + Kalcij | Coconut Slim Latte (paket) | 32,5 / 13 % | – | – | Paketno |

**Druge blagovne znamke.** Malie (Vitamin D3, Kalcij, Vitamin C, kaše) ima v 6 mesecih manj kot 60 naročil na izdelek, zato zanesljivih parov ni. Babe's se v bazi pojavi samo kot darilni SKU (`5526-GIFT`). Naturz v imenih izdelkov ni prepoznaven.

### Šest starter izdelkov aplikacije (preslikava ID-jev in priporočilo)

`products.js` hrani **WooCommerce product ID** (`product_sku_id_mappings.product_id`, SI trgovina, store_id 4), ne SKU-ja.

| App | Woo ID → interni SKU | 6 mes. naročil | Komplement (v app katalogu) | Dokaz | Komplement izven kataloga | Zanesljivost |
|---|---|---|---|---|---|---|
| Creatine Monohydrate | 786110 → 5842 (+5843 Lemon) | 458 | Bio Vegan Protein | lift 130, conf. 1,1 % (5 naročil); 8 od 45 kupcev proteina je kupilo tudi kreatin | Isotonic (Hydration) lift 47; TestoPRO (2,5× na ravni kupca) | Nizka |
| Recovery Shake | 567616 → 5728 | 42 | Vitamin D3 | na ravni kupca 13,5 % (12,8×), v košarici ni signala | Vitamin C (16,6×) | Nizka |
| Bio Vegan Protein | 978562 → 5858 | 49 | Magnezij (citrat) | lift 44, conf. 16 % (8 naročil) | Creatine (lift 130, conf. 10 %) | Nizka |
| Hydration + Energy | 804496 → paket PanStoreGrouped-662 (Isotonic 5673 + Vitaminska voda Antioxidant 5532 + Magnezij + B-kompleks 5542) | 7 (paket); Isotonic 134 | Creatine Monohydrate | Isotonic → Creatine lift 47, conf. 3,7 % (5 naročil) | Vitamin D3 (10,6× na ravni kupca), IMUNUP | Nizka |
| Magnesium (citrate) | 852097 → 1504 / 5487 | 2.180 | **Vitamin D3** | 18,5 % kupcev magnezija kupi D3 (17,6×); 578 skupnih naročil od 1/2025 | Night Detox Tea (org. lift 27, conf. 10,6 %, na 5 od 6 trgov lift 22–31), B-kompleks | Srednja |
| Vitamin D3 2000 IU | 852053 → 1503 / 5547 | 2.427 | Magnezij (citrat) | 5,9 % kupcev (17,6×) | **IMUNUP** (org. lift 47, conf. 12,8 %, next-share 12×, retencija 32 % proti 22 %, LTV +41 €) | Visoka (IMUNUP) |

**Priporočilo:** za fitnes starterje začni z vzorcem kot A/B test (komplement proti brez ponudbe), s ciljno metriko "naročilo v 60 dneh". Takoj ko je mogoče, v app dodaj sidra z volumnom in dokazanim parom (Night FatBurn Extreme → D-FatBurner, PROstate → TestoPRO, Kolagen → Beauty Hyaluron, Vitamin D3 → IMUNUP). Preveri `cartId` po trgih: 567616 (Recovery Shake) velja na vseh trgih, 852097 pa je v DE/CH paket "2x Healthy Liver + Magnesium + B-Complex"; ostali ID-ji so preslikani samo za SI.

## Cikel zaloge in ponovni nakup istega izdelka

Ponovni nakup = naslednje naročilo istega izdelka pri istem kupcu (razmik 7–365 dni). Stopnje 45/90/180 dni veljajo za kohorto prvih nakupov 19. 4. 2025 – 19. 4. 2026. Za starterje kohorta še ni zrela, zato so stopnje izračunane za kohorto 4–8/2026 in označene z *. Dni na enoto = mediana / povprečno število enot na naročilo (zadnji 3 meseci).
**Opomnik "zaloga gre h koncu"** = enote × dni na enoto − 7 (dostava 2–5 dni). Če aplikacija enot ne pozna, uporabi "mediana − 7".

| Izdelek | Kohorta | Ponovni nakup ≤45 d | ≤90 d | ≤180 d | Mediana dni (P25–P75) | Enote/nar. | Dni/enoto | **Opomnik: dan** (1 enota / mediana) |
|---|---|---|---|---|---|---|---|---|
| Detox Belly Burn | 355.150 | 5,1 % | 9,6 % | 12,9 % | 72 (41–129) | 1,53 | 47 | 40 / 65 |
| Hormone Balance PRO | 173.014 | 3,3 % | 6,8 % | 9,4 % | 68 (39–111) | 1,35 | 50 | 43 / 61 |
| Night FatBurn Extreme | 139.659 | 6,9 % | 11,9 % | 14,8 % | 64 (37–113) | 2,10 | 30 | 23 / 57 |
| LIVER CLEANSE | 132.219 | 7,1 % | 11,1 % | 13,7 % | 60 (33–117) | 1,49 | 40 | 33 / 53 |
| Bio DETOX mix | 131.183 | 7,0 % | 10,8 % | 13,5 % | 61 (33–118) | 1,45 | 42 | 35 / 54 |
| PROstate Support | 55.495 | 5,6 % | 12,0 % | 16,4 % | 76 (46–122) | 2,56 | 30 | 23 / 69 |
| TestoPRO Extreme | 53.460 | 5,5 % | 9,8 % | 12,3 % | 60 (38–107) | 1,94 | 31 | 24 / 53 |
| OK!FatBurn | 43.708 | 5,5 % | 8,3 % | 10,2 % | 55 (31–107) | 1,47 | 37 | 30 / 48 |
| OK!WaterOut | 38.062 | 4,3 % | 6,6 % | 7,7 % | 53 (31–98) | 1,35 | 39 | 32 / 46 |
| Cellulite PRO | 32.396 | 4,0 % | 8,3 % | 11,0 % | 70 (41–113) | 2,21 | 32 | 25 / 63 |
| KSM-66 Ashwagandha® prah | 31.224 | 2,6 % | 5,7 % | 8,7 % | 65 (36–101) | 2,26 | 29 | 22 / 58 |
| KSM-66 Ashwagandha® kapsule* | 10.043* | 5,0 %* | 12,5 %* | – | 44 (29–60) | 1,50 | 29 | 22 / 37 |
| FatBurn Tea | 26.206 | 2,7 % | 4,0 % | 4,9 % | 56 (29–110) | 1,50 | 37 | 30 / 49 |
| OK!FatBurn Coffee | 22.166 | 9,0 % | 13,5 % | 15,8 % | 54 (31–91) | 3,16 | 17 | 10 / 47 |
| Hair Vitamins | 21.970 | 5,4 % | 10,5 % | 14,0 % | 80 (45–137) | 2,71 | 30 | 23 / 73 |
| Kolagen SkinCare | 20.120 | 6,6 % | 13,4 % | **18,6 %** | 82 (49–138) | 2,74 | 30 | 23 / 75 |
| GLP-1 ProBoost | 17.085 | 4,5 % | 7,8 % | 9,2 % | 52 (31–82) | 1,31 | 40 | 33 / 45 |
| D-FatBurner | 15.271 | 5,6 % | 8,4 % | 10,2 % | 48 (30–89) | 1,54 | 31 | 24 / 41 |
| Detox Anti-Age | 12.172 | 3,3 % | 5,5 % | 7,2 % | 67 (35–124) | 1,15 | 58 | 51 / 60 |
| OK!Meno | 11.075 | 3,2 % | 9,3 % | 13,9 % | 91 (61–135) | 2,21 | 41 | 34 / 84 |
| Golden Curcuma latte | 9.743 | 3,6 % | 5,9 % | 8,0 % | 80 (41–143) | 3,36 | 24 | 17 / 73 |
| Beauty Hyaluron | 8.524 | 3,3 % | 6,2 % | 8,4 % | 81 (41–147) | 1,39 | 58 | 51 / 74 |
| Bronze PRO | 8.474 | 4,5 % | 8,9 % | 11,8 % | 65 (38–110) | 1,96 | 33 | 26 / 58 |
| Golden Collagen | 7.988 | 4,6 % | 7,7 % | 9,7 % | 62 (35–117) | 2,33 | 27 | 20 / 55 |
| OK!Sterol Forte | 4.779 | 6,8 % | 13,6 % | **17,5 %** | 67 (43–104) | 2,84 | 24 | 17 / 60 |
| GutPRO | 3.300 | 1,9 % | 5,2 % | 6,9 % | 69 (42–101) | 2,23 | 31 | 24 / 62 |
| Collagen Coffee | 5.409 | 3,1 % | 4,9 % | 6,3 % | 56 (28–110) | 1,13 | 50 | 43 / 49 |
| IMUNUP | 5.239 | 3,8 % | 6,4 % | 8,7 % | 63 (34–119) | 1,60 | 39 | 32 / 56 |
| Golden Q10 | 3.566 | 3,1 % | 5,4 % | 7,2 % | 75 (36–130) | 1,38 | 54 | 47 / 68 |
| Beauty Creatine* | 3.245* | 5,4 %* | – | – | 34 (21–56) | 1,48 | 23 | 16 / 27 |
| **Vitamin D3** (starter) | 8.879 | 2,2 % | 4,1 % | 6,1 % | 76 (41–140) | 1,33 | 57 | 50 / **69** |
| **Magnezij citrat** (starter) | 1.878 | 2,8 % | 5,5 % | 8,6 % | 71 (33–138) | 1,28 | 55 | 48 / **64** |
| **Hydration + Energy** (Isotonic, proxy) | 286 | 4,5 % | 5,9 % | 7,3 % | 72 (40–106) | – | – | **65** |
| **Creatine Monohydrate*** (starter) | 177* | 2,3 %* | – | – | 46 (31–72), n = 13 | – | – | **39** (glej opombo) |
| **Recovery Shake** (starter) | 128 | 4,7 % | 5,5 % | 7,0 % | 39 (23–96), n = 14 | – | – | **32** |
| **Bio Vegan Protein*** (starter) | 15* | 20 %* | – | – | 30, n = 3 | – | – | **23** |

Za Creatine, Recovery Shake in Bio Vegan Protein je razmikov premalo (n ≤ 14). Za te tri naj aplikacija opomnik računa iz porcij v pakiranju in dnevne uporabe iz check-inov (Creatine: 85 porcij pomeni opomnik okoli dneva 75–78). Dan iz podatkov zgoraj velja le kot zgornja meja, dokler se ne nabere več podatkov.

**Interpretacija:** pri kapsulah je ritem približno 30 dni na enoto. Kupec, ki vzame paket "1+1", bo naslednje naročilo realno potreboval okoli 60. dne, a ga v 180 dneh odda le 10–15 %. Opomnik ob pravem dnevu je zato največja posamezna vzvodna točka aplikacije. Pomembnejši je od cross-sella.

## Razlike po trgih (6 mes., vse vrstice; confidence / lift)

| Par | HU | PL | IT | CZ | ES | SI |
|---|---|---|---|---|---|---|
| Detox Belly Burn → Night FatBurn Extreme | 21 % / 1.3 | 4 % / 0.3 | **58 % / 2.5** | 17 % / 1.0 | 14 % / 0.9 | 15 % / 1.1 |
| Night FatBurn Extreme → D-FatBurner | 17 % / 5.3 | 28 % / 7.8 | 20 % / 3.8 | 6 % / 4.8 | 23 % / 6.2 | 8 % / 5.4 |
| LIVER CLEANSE → OK!FatBurn | 26 % / 5.9 | 15 % / 5.1 | 23 % / 3.6 | 10 % / 4.0 | 23 % / 5.3 | 13 % / 6.0 |
| PROstate Support → TestoPRO Extreme | 23 % / 3.3 | 15 % / 4.5 | **38 % / 8.1** | 21 % / 5.9 | 28 % / 5.2 | 19 % / 4.0 |
| Cellulite PRO → Bronze PRO | 17 % / 7.7 | **59 % / 12.3** | 8 % / 3.4 | 39 % / 24.6 | 23 % / 8.0 | 50 % / 8.1 |
| Kolagen SkinCare → Beauty Hyaluron | 15 % / 34.5 | 4 % / 17.9 | 20 % / 12.6 | 5 % / 7.4 | 19 % / 12.6 | 19 % / 30.3 |
| Hair Vitamins → Kolagen SkinCare | 2 % / 7.0 | 15 % / 11.9 | 17 % / 3.9 | 3 % / 1.5 | 9 % / 2.8 | 5 % / 3.2 |
| GLP-1 ProBoost → Night GLP-1 ProBoost | – | 47 % / 61.2 | 49 % / 77.7 | 50 % / 64.3 | 61 % / 79.9 | – |
| Vitamin D3 → IMUNUP | 21 % / 40.0 | 13 % / 78.7 | 7 % / 31.4 | 7 % / 40.6 | 10 % / 57.0 | **26 % / 35.0** |
| Magnezij (citrat) → Night Detox Tea | 8 % / 23.2 | 10 % / 31.3 | 13 % / 29.8 | 11 % / 27.4 | 9 % / 21.8 | 1 % / 3.2 |
| Collagen Coffee → Golden Q10 | 15 % / 54.5 | 18 % / 66.0 | 16 % / 44.2 | 15 % / 13.4 | 7 % / 58.6 | 18 % / 31.6 |

Smer para drži na vseh trgih. Velikost se razlikuje zaradi lokalnih paketov: v IT je DBB + NFE paket, v PL pa Cellulite + Bronze. Komplement je zato smiselno izbirati **po trgu**, s tabelo pravil v aplikaciji (trg × sidro → B). Trgi po prihodku v 12 mesecih: HU 11,6 mio €, PL 7,8, IT 5,0, CZ 3,2, ES 2,9 … SI 0,9 (16. mesto).

## Opozorila (kakovost podatkov)

- **Blagovne znamke ni v bazi.** Vseh 28 trgovin je "Nature's Finest", tabela `products` nima polja brand. Malie je prepoznavna samo po imenu, Babe's samo kot darilni SKU, Naturz sploh ne. Za ločitev po znamkah je treba dodati mapping SKU → brand.
- **Paketi izkrivljajo lift.** 89 % vrstic je del paketov, zato je visok lift v isti košarici pogosto posledica merchandisinga. Organski lift vključuje tudi order bumpe in upselle (FatBurn Tea, Detox Anti-Age, Golden Q10, IMUNUP, Collagen Coffee), kjer visok lift odraža postavitev ponudbe in ne potrebe. Vzročni učinek potrdi samo test s kontrolno skupino.
- **Retencija je opazovalna.** Kupci z večjo košarico se razlikujejo od drugih (samoizbira). Pri najboljših parih je n = 39–210 v 10 % vzorcu, zato so intervali široki. Zaporedna analiza (5 % vzorec) in retencija (10 % vzorec) sta vzorčni zaradi omejitve časa poizvedbe.
- **Identiteta kupca.** `customer_id` je vezan na e-pošto (unikaten v `customers`). Isti človek z drugim e-naslovom ali nakupom kot gost šteje kot nov kupec, zato je ponovni nakup verjetno **podcenjen**.
- **Samo `completed`.** Zavrnjene pošiljke po povzetju (cancelled ~7 %), failed in pending so izločeni. `total_eur` je bruto (z DDV in poštnino).
- **Imena in variante.** Kanonizacija je po imenu (HR/EN mešano: Magnezij/Magnesium, Kolagen). Variante, kot so Magnesium 400, Magnezij + B-kompleks, PROSTATE Support (kapsule) in KSM-66 30 kapsul, so ostale ločene. Šifre LD12, FD17, CR15, ES13, CX9, SY14 … v bazi nimajo opisa.
- **Novi izdelki.** Creatine (06/2026), Beauty Creatine (06/2026), Bio Vegan Protein (08/2026) in KSM-66 kapsule nimajo zrele 180-dnevne kohorte, zato so označeni z *.
- **ID-ji v aplikaciji.** `products.js` uporablja WooCommerce product ID-je SI trgovine; ti so po trgih različni (852097 v DE/CH = drug izdelek). `cartId` je treba preslikati po trgu prek `product_sku_id_mappings`.

*Strojno berljiva različica za 6 starter izdelkov: `docs/health-complements.json`.*
