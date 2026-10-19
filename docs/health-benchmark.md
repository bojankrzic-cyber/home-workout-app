# FinestMe Health: primerjava z najboljšimi (okt. 2026)

Namen dokumenta: preveriti plan modula Health (opomniki, dnevna kljukica, nagrade za 7/30/60/90 kljukic, napoved, kdaj izdelek poide, in ponovno naročilo z enim dotikom, WhatsApp) na podlagi preverljivih mehanik in podatkov. Kar ni preverjeno v primarnem viru, je označeno z **(nepreverjeno)**.

## 1. Povzetek: kaj zmagovalci delajo in kaj moramo kopirati

- **Ena akcija na dan, zelo nizek prag.** Duolingo je pravilo, da en kratek korak ohrani niz, preveril z A/B testom: število uporabnikov z nizom 7+ dni je zraslo za več kot 40 %, D14 pa za 3,3 % (relativno). Pri nas je ta korak »vzel sem«, ne vprašalnik.
- **Zaščita niza namesto kazni.** Duolingo omogoča največ 2 zamrznitvi niza in plačljivo popravilo niza. Finch in Apple Fitness (od iOS 18) imata pavzo, ki niz zamrzne. Pozabljeni dan ne sme izbrisati napredka.
- **Opomnik, ki ga sistem uči.** Duolingo izbira čas in besedilo opomnika z algoritmom bandit: +0,5 % DAU in +2 % zadržanja novih uporabnikov. SMS opomniki pri zdravilih podvojijo verjetnost jemanja (OR 2,11). Opomnik je jedro produkta, ne dodatek.
- **Zaloga je merjena, opomnik za ponovno naročilo sledi zalogi.** Medisafe in Apple Health štejeta odmerke in pošljeta opomnik pred koncem zaloge. Klaviyo poroča o +83 % ponovnih nakupov pri znamki Balance Me, ki je opomnike časovno prilagodila vsakemu kupcu.
- **Naročnina kot udobje, nagrade izven cene.** AG1 ob prvi naročnini podari fizični komplet (welcome kit), Huel ponuja stalni popust (10 % v EU) ter preskok in prestavitev pošiljke, Myprotein ima stopnje s fizičnimi darili. Nedenarne nagrade bolj krepijo zvestobo obstoječih kupcev (Melnyk & Bijmolt, 9.783 potrošnikov).

## 2. Primerjalna tabela

| Aplikacija | Mehanika | Kaj uporabnik vidi | Zakaj deluje | Vir |
|---|---|---|---|---|
| Duolingo | Niz z 1 lekcijo/dan | Števec z ognjem, mejnik 7 dni | Uporabniki z nizom 7 dni imajo 2,4-krat večjo verjetnost, da se naslednji dan vrnejo (korelacija). Pri testu stave na niz (Streak Wager) se je D7 izboljšal za 14 % (iz sekundarnega vira, nepreverjeno). | [blog](https://blog.duolingo.com/improving-the-streak) |
| Duolingo | Zamrznitev in popravilo niza | »0 of 2 equipped«, popravilo za gems | Izguba niza je glavni razlog za opustitev, zato jo blažijo | [blog](https://blog.duolingo.com/protecting-streaks-from-site-issues), [AA](https://androidauthority.com/duolingo-revive-broken-streak-event-3673004/) |
| Duolingo | Opomnik z algoritmom bandit | Besedilo in čas se prilagajata | +0,5 % DAU, +2 % zadržanja novih (KDD 2020) | [paper](https://research.duolingo.com/papers/yancey.kdd20.pdf) |
| Finch | Igra brez krivde + App Pause | Ptiček ne »umre«; pavza ohrani niz | Odstrani sram, ki povzroča odhod | [Finch Team](https://lr.in.psf.lt/r/finch/comments/1k1ik78/app_pause/mnmgaqd/?context=3) (zrcalo Reddita) |
| Headspace | Skrivanje niza | Stikalo za skritje niza | Manj tesnobe ob prekinjenem nizu | [Built for Mars](https://builtformars.com/ux-bites/hiding-your-headspace-streaks) |
| Apple Health | Zdravila: »Taken/Skipped« + opomnik po 30 min | Obvestilo z dvema gumboma | Enoklik iz obvestila, brez odpiranja aplikacije | [Apple](https://support.apple.com/en-ca/105064) |
| Apple Fitness (iOS 18) | Pavza obročev | Pavza brez izgube niza | Bolezen ali dopust ne prekineta niza | [Tom's Guide](https://www.tomsguide.com/phones/iphones/how-to-pause-your-move-ring-in-the-ios-18-fitness-app) |
| Medisafe | Štetje tablet + opomnik za ponovno naročilo, Medfriend | Vnos zaloge, opozorilo pred koncem; svojec prejme obvestilo ob izpustu | Zaloga se zmanjšuje samodejno; družbena odgovornost | [App Store](https://apple.co/3Cu64qK), [Medisafe](https://medisafe.com/amazing-woman-saves-hours-every-day-using-one-thing/) |
| Ritual | Aplikacija za kljukico in niz (2019–21) | 1 dotik, niz, primerjava | Aplikacija je od 2021 brez posodobitev in ima oceno 1,5 (3 ocene). Samostojna aplikacija za navado se ni prijela. | [AppFollow](https://apps.appfollow.io/ios/ritual/1473355253?country=us) |
| AG1 | Welcome kit samo ob 1. naročnini | Posoda, stresalnik, potovalne vrečke | Fizično darilo namesto popusta | [GGR](https://www.garagegymreviews.com/athletic-greens-coupon-code) (nepreverjeno pri AG1) |
| Seed | Kozarec + polnila | Steklen kozarec, nato kompostabilne vrečke | Embalaža je »sidro« navade in oteži menjavo znamke | [Healthline](https://www.healthline.com/nutrition/seed-probiotics-review) |
| Huel | Naročnina: −10 % EU / −20 % ZDA, preskok, prestavitev | Upravljanje v računu | Fleksibilnost zmanjša odpovedi | [Huel EU](https://eu.huel.com/pages/huel-subscription-guide) |
| Myprotein | 4 stopnje (Bronze–Platinum) | Točke, darila za rojstni dan, VIP box | Status in darila namesto zgolj popusta | [Myprotein](https://www.myprotein.com/c/loyalty/) |
| Hims & Hers | Naročnina kot privzeti model | Samodejno polnjenje | 2,51 mio naročnikov, 83 $/mes na naročnika (2025) | [IR](https://investors.hims.com/news/news-details/2026/Hims--Hers-Health-Inc--Reports-Fourth-Quarter-and-Full-Year-2025-Financial-Results/default.aspx) |
| Care/of (zaprt jun. 2024) | Personalizirani paketi + naročnina | Vse naročnine preklicane 17. 6. 2024 | Bayer je ustavil financiranje. Šibka diferenciacija na polici (Target), padec povpraševanja po pandemiji. | [Retail Dive](https://www.retaildive.com/news/careof-is-shutting-down/719106), [NutraIngredients](https://www.nutraingredients.com/Article/2024/06/28/The-rise-and-fall-of-Care-of-A-financial-perspective) |

## 3. Kaj iz ChatGPT plana drži in kaj ne

**Drži:**
- Dnevna kljukica z enim dotikom, ki deluje tudi iz obvestila (vzorec Apple Health), pavza, ki zamrzne napredek, in pristop brez krivde (Finch, Apple Fitness, Duolingo).
- Napoved, kdaj izdelek poide, in ponovno naročilo z enim dotikom (Medisafe, Klaviyo). Pri nas je lažje, ker poznamo velikost pakiranja in datum dostave.
- Naročnino ponudimo ob ponovnem naročilu, ne ob prvem nakupu, ko kupec izdelka še ni preizkusil. Ta zaporedja nismo preverili v nobenem viru **(nepreverjeno)**, je pa skladna s pristopom Huel (preskok, prestavitev).

**Ne drži ali je treba popraviti:**
1. **Popust pri 7 kljukicah je prezgoden in ga je mogoče zlorabiti.** Kljukico si uporabnik podeli sam, zato lahko kdorkoli 7 dni tapka in dobi kodo. Duolingo uporablja mejnik 7 dni samo kot psihološki signal (2,4-krat), ne kot denarno nagrado. Predlog: dan 7 naj prinese značko in vsebino. Denarna nagrada naj bo vezana na **nakup** (2. naročilo), ne na tapkanje.
2. **Niz ali skupno število.** Plan štejejo »check-ine« 7/30/60/90, kar je pravilno, saj je **skupno število** odpornejše od niza. Niz naj bo le vizualni sloj, s 2 zamrznitvama.
3. **Nedenarno pred denarnim.** Darilo komplementarnega vzorca in brezplačna dostava sta smiselna, ker nedenarne nagrade bolje krepijo zvestobo (Melnyk & Bijmolt). Fiksna cena pri 90 dneh ima smisel samo za naročnike.
4. **WhatsApp v EU stane in zahteva soglasje.** Od 1. 7. 2025 Meta zaračunava vsako sporočilo. Sporočila tipa utility (npr. »zaloga poide čez 5 dni«) so v 24-urnem oknu po kupčevem sporočilu brezplačna, zunaj njega pa plačljiva (DE okoli 0,06). Sporočila tipa marketing (cross-sell) stanejo okoli 0,11–0,16 € v DE in FR (vir BSP, nepreverjeno pri Meti). Potrebujemo izrecno in ločeno soglasje po GDPR, double opt-in priporočajo BSP-ji. Dnevni opomnik po WhatsAppu pri 35 trgih je predrag, zato dnevni opomnik pošiljamo s push obvestilom ali e-pošto, WhatsApp pa uporabimo samo za zalogo in ponovno naročilo.
5. **Kataloge s prehranskimi dopolnili Meta lahko zadržuje ob pregledu** (WATI, nepreverjeno), zato ponovno naročilo naj vodi na lastni checkout z vnaprej izpolnjeno košarico.
6. **»Kaj lahko pričakuješ« krši Uredbo 1924/2006, če ni dobesedno odobrena trditev.** Uredba velja za vso komercialno komunikacijo, tudi za aplikacijo in WhatsApp. Splošne trditve (»boljša energija«) so dovoljene le skupaj z odobreno specifično trditvijo (čl. 10(3)), npr. »magnezij prispeva k zmanjšanju utrujenosti in izčrpanosti«. Za vsak SKU in jezik potrebujemo knjižnico odobrenih besedil. Tedenski vprašalnik (energija, spanec, razpoloženje) ne sme trditi, da je izboljšanje posledica izdelka.
7. **Komplementarni izdelek po dnevu 21, največ 1-krat mesečno** je razumna meja proti utrujenosti zaradi obvestil, vendar te meje nismo preverili v nobenem viru **(nepreverjeno)**. Treba jo je A/B testirati.
8. **Lekcija Care/of in Ritual:** samostojna aplikacija za navado ali personalizacija sama po sebi ne zadrži kupcev. Odločata ekonomika naročnine in diferenciacija izdelka.

## 4. Priporočena mehanika za FinestMe (po prioriteti)

| # | Mehanika | KPI (cilj določimo po 1. kohorti) |
|---|---|---|
| 1 | Opomnik po urniku jemanja + kljukica z enim dotikom iz obvestila (push/e-pošta) + opomnik čez 30 min | Delež kljukic D7 in D30, delež aktivacije opomnikov |
| 2 | Napoved zaloge iz datuma dostave in velikosti pakiranja (popravek ob izpuščenih dneh) → opomnik 7 in 3 dni pred koncem, košarica z enim dotikom | Delež ponovnih naročil **pred** koncem zaloge, mediana dni brez izdelka |
| 3 | Naročnina, ponujena ob 1. ponovnem naročilu (preskok, prestavitev, pavza v 1 kliku) | Delež sprejetih naročnin pri ponovnem naročilu, churn naročnin M3 |
| 4 | Skupno število kljukic + niz z 2 zamrznitvama + pavza (zamrzne napredek) + sporočila brez krivde | Delež povratnikov po izpadu (vrnitev v 7 dneh po zlomu niza) |
| 5 | Lestvica nagrad: 7 = značka in vsebina; 30 = vzorec komplementarnega izdelka **ob 2. naročilu**; 60 = brezplačna dostava; 90 = fiksna cena (naročniki) + 90-dnevni povzetek | Delež 2. naročil, strošek nagrad na zadržanega kupca |
| 6 | Komplementarni izdelek po D21, največ 1-krat mesečno, samo z odobrenimi trditvami | Delež nakupa 2. izdelka, odjave in izklopi obvestil |
| 7 | Tedenski vprašalnik v 20 s (samo samoocena, brez vzročnih trditev) | Delež izpolnjenih vprašalnikov, korelacija z zadržanjem |
| 8 | WhatsApp samo za zalogo in naročilo (utility), ločeno soglasje, kontrolna skupina | Inkrementalni dvig ponovnih naročil proti e-pošti, € na sporočilo / € prihodka |

Pravilo merjenja: vsaka mehanika ima kontrolno skupino (5–10 %), ker so podatki dobaviteljev (npr. »+34–52 %« dvig ponovnih naročil prek WhatsAppa) večinoma neodvisno nepreverjeni.

## 5. Viri

- Duolingo: https://blog.duolingo.com/improving-the-streak · https://research.duolingo.com/papers/yancey.kdd20.pdf · https://blog.duolingo.com/protecting-streaks-from-site-issues · https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks
- Finch: https://lr.in.psf.lt/r/finch/comments/1k1ik78/app_pause/mnmgaqd/?context=3 · Headspace: https://builtformars.com/ux-bites/hiding-your-headspace-streaks
- Apple: https://support.apple.com/en-ca/105064 · https://www.tomsguide.com/phones/iphones/how-to-pause-your-move-ring-in-the-ios-18-fitness-app
- Medisafe: https://apple.co/3Cu64qK · https://medisafe.com/amazing-woman-saves-hours-every-day-using-one-thing/
- SMS in adherenca (Thakkar, JAMA IM 2016): https://www.ehidc.org/sites/default/files/resources/files/Thakkar%202016%20JAMA%20text%20messaging%20meta%20analysis.pdf
- Ritual: https://apps.appfollow.io/ios/ritual/1473355253?country=us · AG1: https://www.garagegymreviews.com/athletic-greens-coupon-code · Seed: https://www.healthline.com/nutrition/seed-probiotics-review
- Huel: https://eu.huel.com/pages/huel-subscription-guide · Myprotein: https://www.myprotein.com/c/loyalty/ · Hims & Hers: https://investors.hims.com/news/news-details/2026/Hims--Hers-Health-Inc--Reports-Fourth-Quarter-and-Full-Year-2025-Financial-Results/default.aspx
- Care/of: https://www.retaildive.com/news/careof-is-shutting-down/719106 · https://www.nutraingredients.com/Article/2024/06/28/The-rise-and-fall-of-Care-of-A-financial-perspective
- Klaviyo, Balance Me: https://www.klaviyo.com/uk/customers/case-studies/balanceme-replenishment-emails
- Nagrade: https://www.rug.nl/feb/news/2016/tammo-bijmolt-wins-best-paper-award-for-paper-on-the-effects-of-loyalty-programs · https://research.wu.ac.at/en/publications/attracting-new-customers-to-loyalty-programs-the-effectiveness-of-7/
- WhatsApp: https://developers.facebook.com/docs/whatsapp/pricing · https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits.md · https://docs.gallabox.com/pricing-and-billing-modules/new-per-message-pricing-effective-july-1-2025 · https://chatarmin.com/en/blog/whats-app-messaging-limits · https://www.wati.io/blog/whatsapp-catalog
- Uredba 1924/2006: https://eur-lex.europa.eu/legal-content/SL/TXT/?uri=CELEX:32006R1924 · register trditev: https://food.ec.europa.eu/food-safety/labelling-and-nutrition/nutrition-and-health-claims/eu-register-nutrition-and-health-claims_en
