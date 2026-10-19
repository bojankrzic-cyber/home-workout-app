# FinestMe – strategija opomnikov (aplikacija, push, e-pošta)

Opomnik je zaščita navade, ne kanal za prodajo. Vsako sporočilo mora stranki prihraniti trud ali ji zavarovati rutino. Kar ne izpolni tega pogoja, se ne pošlje.

## 1. Priporočilo
- **Push ob trenutku stranke, samo če dan še ni odkljukan.**
  - Trenutek je sidro, ki ga je izbrala: ☕ kava 07:30, 🍳 zajtrk 08:00, 🥗 kosilo 12:30, 🌙 večer 20:00, ali lastna ura.
  - Ko imamo ≥ 4 kljukice, opomnik pride 15 minut pred časom, ko se stranka dejansko odkljuka (mediana zadnjih 7 dni).
- **E-pošta samo za tri stvari,** ki jih stranka ceni: paket gre h koncu, 3 tihi dnevi in nov začetek po 2 tednih.
- **Opomnik brez računa:** push deluje takoj po začetku rutine z izrecno privolitvijo. V ozadju se ustvari anonimni račun (Supabase), ki ga stranka pozneje z e-pošto ali Googlom nadgradi brez izgube podatkov.

## 2. Pravila (koda: `supabase/functions/_shared/reminder_plan.ts`)
| Opomnik | Kdaj | Kanal | Pogoj |
|---|---|---|---|
| Dnevni (☕ "Čas za kavo …") | Sidro ali naučen čas | push z gumbom ✅ Opravljeno | Dan ni odkljukan. Pri ritmu "3× tedensko" (po 1. nagradi) samo pon, sre in pet |
| Niz v nevarnosti 🔥 | 19:30 | push | Niz ≥ 3, dan odprt, ta dan še ni bilo dnevnega opomnika |
| Zaloga | 5 dni pred koncem paketa ob sidru | push + e-pošta | Enkrat na paket |
| Zadnji odmerek | Na dan konca ob sidru | e-pošta | Enkrat na paket |
| 3 tihi dnevi 💚 | Ob sidru | push + e-pošta | Enkrat na tišino, brez krivde. Ponudi drugo uro, manj opomnikov ali premor. Dnevni opomniki se ustavijo |
| Nov začetek 🌱 | Ponedeljek 08:00 | e-pošta + push | ≥ 14 dni tišine, enkrat (fresh start) |
| Tedenski pregled 📊 | Nedelja 18:00 | push | Teden še ni izpolnjen, rutina je stara ≥ 5 dni |

**Omejitve, ki veljajo vedno:**
- največ 1 push in 1 e-pošta na lokalni dan;
- tihi čas 21:30–07:00 po lokalnem času;
- med premorom nič;
- zamujen opomnik (več kot 2 uri) se ne pošlje;
- vsak opomnik največ enkrat na priložnost (`reminder_log`, unikaten ključ).

**Prednost ob trku:** zaloga > tišina > dnevni > tedenski > niz.

## 3. Zakaj tako
- **Sidranje bolj kot ura:** opomnik ob obstoječi rutini gradi avtomatizem, opomnik na fiksno uro pa samo ponavljanje (Stawarz, CHI 2015).
- **Opomnik samo, ko je potreben,** in pogostost, ki pada (vsak dan, nato 3× tedensko): s tem zmanjšamo utrujenost in odjave.
- **Spletni push:** priming pred sistemskim vprašanjem po izkušnjah industrije dvigne pristanek 2–3×. Zato najprej naše kartice ("Želiš opomnik, če pozabiš?"), sistemsko okno pa šele po "Da".
- **iOS:** spletni push deluje le iz aplikacije na začetnem zaslonu (iOS 16.4+). Aplikacija to razloži in ponudi e-pošto kot alternativo.
- **E-pošta za redke, pomembne dogodke:** dnevna e-pošta bi pokvarila dostavljivost in sproti odjavljala. Opomnik za zalogo je hkrati najmočnejši vzvod za ponaročilo.

## 4. Kdaj aplikacija vpraša
1. **Prvi poziv (Today):** po 1. kljukici, ko stranka že čuti vrednost, se pod kartico rutine prikaže "🔔 Želiš opomnik, če pozabiš?". Po "Ne zdaj" se znova pojavi šele čez 7 dni.
2. **Okno s pogoji:**
   - samo na dneve brez kljukice, nikoli ponoči, 5 dni pred koncem paketa, izklop z enim dotikom;
   - kljukica za privolitev (zdravstveni podatki, EU), če stranka še nima računa.
3. **Nastavitve programa:** čas opomnika, kanali (🔔 ta telefon / ✉️ e-pošta), ritem (vsak dan / 3× / izklop) in premor.
4. **Gumb na obvestilu:** "✅ Opravljeno" odpre aplikacijo in takoj odkljuka dan (`?a=checkin`).

## 5. Arhitektura
- **Aplikacija (`js/reminders.js`):**
  - po vsaki spremembi zapiše eno vrstico `reminder_state` z urnikom: časovni pas, jezik, sidro, naučen čas, ritem, premor, zadnja kljukica, niz, datum konca paketa;
  - nobenih vsebin dnevnika.
- **Strežnik (`supabase/functions/reminders`):**
  - pg_cron ga pokliče vsakih 15 minut;
  - planer odloči, kaj je na vrsti;
  - push gre neposredno prek Web Push (VAPID);
  - e-pošta postane dogodek `reminder_due` → `klaviyo-sync` → Klaviyo metrika **"App Reminder Due"**. Besedilo je že v jeziku stranke (21 jezikov), zato je v Klaviyo dovolj **en flow** s predlogo `{{ event.title }}` / `{{ event.body }}` / `{{ event.url }}`.
- **Privolitve:**
  - push zahteva izrecno privolitev (zdravstveni podatki + opomniki);
  - e-pošta zahteva privolitev `reminders` (ali `marketing_email`), kar preveri `klaviyo-sync`;
  - anonimni račun nima e-pošte, zato dobi samo push;
  - brisanje računa izbriše urnik, telefone in dnevnik pošiljanj (cascade).

## 6. Vklop (razvoj, ~1 dan)
1. Uveljavi migracije: `supabase db push` (vključno z `20261020000000_reminders.sql`).
2. V Auth vklopi **Anonymous sign-ins** in **Manual linking** (v `config.toml` je že nastavljeno). Za anonimne prijave vklopi še CAPTCHA (Turnstile) proti zlorabi.
3. Ustvari VAPID ključe: `npx web-push generate-vapid-keys`.
   - Javni ključ gre v `js/config.js → vapidPublicKey`.
   - Zasebni ključ **samo** v Supabase Secrets: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT=mailto:app@naturesfinest.eu`.
4. V Supabase Secrets dodaj `CRON_SECRET` (naključni niz). V Vault dodaj `reminders_url` (`https://<ref>.supabase.co/functions/v1/reminders`) in `reminders_secret` (isti niz kot `CRON_SECRET`).
5. Vklopi razširitvi **pg_cron** in **pg_net** ter ponovno uveljavi migracijo, da se ustvari urnik.
6. Objavi funkcijo: `supabase functions deploy reminders`.
7. Klaviyo (CRM): flow s sprožilcem metrike "App Reminder Due", filter `finestme_reminders = true`, ena predloga.

## 7. KPI (tedensko, z 10 % kontrolno skupino brez opomnikov)
- **Pristanek na opomnike:** cilj ≥ 40 % strank z začeto rutino.
- **Klik na push:** cilj ≥ 15 %. Dan odkljukan v 2 h po opomniku: cilj ≥ 50 %.
- **D30 kljukice:** z opomniki proti kontrolni skupini (cilj +10 o.t.).
- **Ponaročilo pred koncem paketa:** opomnik za zalogo proti kontrolni skupini (cilj +30 %).
- **Odjave od opomnikov:** < 5 % na mesec. Če je več, znižamo pogostost.
