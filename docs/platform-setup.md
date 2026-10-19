# Platforma FinestMe – postavitev računov, oblaka in domene

Stanje kode: vse spodaj je pripravljeno in testirano v repozitoriju. Aplikacija ostaja **samo lokalna**, dokler v `js/config.js` ni vpisan Supabase projekt. Vklop torej ne zahteva sprememb kode, samo spodnje korake.

Arhitektura (potrjeno 19. 10. 2026):
- prijava brez gesla z e-pošto iz webshopa (povezava + 6-mestna koda);
- Supabase v EU (Frankfurt);
- naročila iz webshopa → račun;
- Klaviyo;
- domena `app.naturesfinest.eu`.

---

## 1. Lastništvo in dostopi (CEO / IT) – najprej
| Korak | Zakaj |
|---|---|
| GitHub repo prenesi iz osebnega računa v **GitHub organizacijo Nutrisslim** (Settings → Transfer) | Brez odvisnosti od ene osebe, enostaven offboarding |
| Supabase **organizacija na podjetje** (račun na službeni e-naslov, 2 lastnika, 2FA) | Isti razlog; plačilo na podjetje |
| Vse skrivnosti samo v Supabase *Secrets* in v WooCommerce, nikoli v kodi ali chatu | `service_role` ključ ima poln dostop do baze |

## 2. Supabase (razvoj)
1. Nov projekt: regija **Central EU (Frankfurt)**, plan Pro (~25 $/mes): dnevne varnostne kopije, brez pavze.
2. Shema:
   ```bash
   supabase link --project-ref <ref>
   supabase db push              # supabase/migrations/*.sql (platform_init, devices)
   ```
3. **Auth → URL configuration**:
   - Site URL `https://app.naturesfinest.eu`;
   - Redirect URLs: dodaj še `https://bojankrzic-cyber.github.io/home-workout-app/` (prehodno obdobje).
4. **Auth → Email**:
   - lasten SMTP (Postmark, Amazon SES ali Brevo), pošiljatelj `app@naturesfinest.eu`. Privzeti Supabase SMTP pošlje le nekaj e-mailov na uro, kar za produkcijo ni uporabno.
   - V DNS domene nastavi SPF, DKIM in DMARC.
5. **Auth → Email Templates → Magic Link** (in "Confirm signup"): vsebina iz `supabase/templates/magic_link.html` (povezava + koda `{{ .Token }}`).
6. **Funkcije**:
   ```bash
   supabase secrets set WC_WEBHOOK_SECRET=… SHOP_ID=naturesfinest-si KLAVIYO_API_KEY=… KLAVIYO_LIST_ID=… WEBHOOK_TOKEN=…
   supabase functions deploy shop-order --no-verify-jwt
   supabase functions deploy klaviyo-sync --no-verify-jwt
   ```
7. **Database → Webhooks** (INSERT na `consents`, `workouts`, `activities`) → `https://<ref>.supabase.co/functions/v1/klaviyo-sync`, header `Authorization: Bearer <WEBHOOK_TOKEN>`.
8. V `js/config.js` vpiši `supabaseUrl` in `supabaseAnonKey`. Anon ključ je javen po zasnovi. `privacyUrl` nastavi na točno stran politike zasebnosti.

### Prijava z Googlom
1. Google Cloud Console (projekt podjetja) → **APIs & Services → OAuth consent screen**:
   - tip External;
   - ime aplikacije FinestMe, logotip in domena `naturesfinest.eu`;
   - povezava na politiko zasebnosti;
   - scope samo `email`, `profile`, `openid`.
2. **Credentials → Create OAuth client ID** (Web application) → Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → **Google**: vpiši Client ID in Secret ter vklopi.
4. V aplikaciji je gumb "Continue with Google" že pripravljen (`authProviders: ['google']` v `js/config.js`). Privolitev za podatke je obvezna tudi tu; shrani se pred preusmeritvijo.
5. Ko izide iOS aplikacija z Google prijavo, App Store zahteva še **Sign in with Apple**:
   - v `authProviders` dodaj `'apple'`;
   - v Supabase vklopi Apple (Services ID + ključ iz Apple Developer).

## 3. WooCommerce (webshop)
- WooCommerce → Settings → Advanced → Webhooks → dodaj **Order created** in **Order updated**:
  - Delivery URL `https://<ref>.supabase.co/functions/v1/shop-order`;
  - Secret = `WC_WEBHOOK_SECRET`;
  - API v3.
- Naročila se povežejo z računom po e-naslovu za plačilo. Račun, ustvarjen kasneje, samodejno prevzame starejša naročila.
- Za več trgov (35+): en webhook na trgovino, vsak z lastnim `SHOP_ID`. Funkcija je ena sama.

## 4. Klaviyo
- Ustvari list "FinestMe app". Njegov ID je `KLAVIYO_LIST_ID`. Double opt-in nastavi na listu.
- Private API key s scope-i `profiles:write`, `lists:write`, `subscriptions:write`, `events:write`.
- Kaj gre v Klaviyo:
  - samo marketinška privolitev (subscribe/unsubscribe);
  - dogodka `App Workout Completed` in `App Activity Recorded`, samo za ljudi z marketinško privolitvijo, in samo z grobimi podatki (šport, minute, km).
- **Kaj ne gre v Klaviyo:** GPS sledi, srčni utrip, teža in zdravstveni podatki.
- Predlagani flowi:
  - welcome za app;
  - "7 dni brez aktivnosti" (winback);
  - "zaloga izdelka gre h koncu" (naslednji korak: rutina dopolnil × datum naročila).

## 5. Pametne naprave (samodejna sinhronizacija)
Ure, zapestnice in tehtnice pošiljajo aktivnosti in meritve v aplikacijo samodejno, brez ročnega uvoza.

**Kaj je pripravljeno (neodvisno od ponudnika):**
- tabela `device_connections`: kateri račun pri ponudniku (Garmin, Polar …) pripada kateremu članu gospodinjstva. Uporabnik povezave vidi in jih lahko prekine (izbriše), ustvari pa jih samo strežnik (OAuth callback);
- tabela `body_measurements`: teža, % maščobe, mišična masa (pametne tehtnice, kasneje body tracker);
- funkcija `device-ingest`: edina vstopna točka za vse ponudnike. Aktivnosti zapiše v `activities`, zato se v aplikaciji pokažejo kot vse ostale. Če je uporabnik aktivnost izbrisal v aplikaciji, je ponovna sinhronizacija ne vrne.

**Pogodba za adapterje:**
- Adapter = tanek strežniški del (webhook agregatorja ali Garmin API), ki podatke pretvori v obliko aplikacije in pokliče `POST https://<ref>.supabase.co/functions/v1/device-ingest`.
- Header `Authorization: Bearer <INGEST_TOKEN>`. Skrivnost poznajo samo adapterji: `supabase secrets set INGEST_TOKEN=…`, `supabase functions deploy device-ingest --no-verify-jwt`.
- Telo: `{ provider, external_user_id, activities: [...], measurements: [...] }`, največ 500 aktivnosti na klic. Neznana ali prekinjena povezava → 404, napačni podatki → 400.

**Priporočilo:**
- **En agregator z gostovanjem v EU in DPA** (Thryve ali Terra) za Garmin, Polar, Suunto, Coros, Fitbit, Oura, Whoop in Withings. Ena integracija namesto osmih; adapter je ena funkcija.
- **Garmin Connect Developer Program** (brezplačen, odobritev za podjetja) za Garmin Training API: pošiljanje FinestMe treningov na uro.
- **Apple Health in Health Connect** samo prek nativne aplikacije (spletna aplikacija do njiju nima dostopa).

**Omejitve in privolitve:**
- Podatkov iz Apple HealthKit in Android Health Connect po pravilih Apple in Google ne smemo uporabiti za marketing ali oglaševanje. `klaviyo-sync` takih aktivnosti ne pošlje v Klaviyo.
- Za vsako povezano napravo **ločena privolitev** (kateri podatki, kateremu članu, namen). Prekinitev povezave ustavi sinhronizacijo; podatki ostanejo, dokler jih uporabnik ne izbriše.
- Agregator je obdelovalec zdravstvenih podatkov: DPA in vpis v DPIA (poglavje 7).

## 6. Domena `app.naturesfinest.eu`
1. DNS (pri registrarju za `naturesfinest.eu`): `CNAME app → bojankrzic-cyber.github.io`. Po prenosu v organizacijo: `<org>.github.io`.
2. GitHub → repo Settings → Pages → Custom domain `app.naturesfinest.eu` → **Enforce HTTPS**.
3. **Pozor, podatki na napravi:** stara github.io povezava in nova domena sta za brskalnik dve različni "stranki", zato podatki na napravi ne preidejo sami. Pravilni vrstni red:
   1. vklopi Supabase (korak 2);
   2. na stari povezavi se prijavi (podatki gredo v oblak);
   3. odpri novo domeno in se prijavi (podatki pridejo nazaj).

   Alternativa: Settings → Backup → Export/Import.

## 7. Pravno (DPO / pravna služba) – pred javnim zagonom
- **Posebna kategorija osebnih podatkov (čl. 9 GDPR):** podatki o vadbi, telesu in zdravju. Pravna podlaga je izrecna privolitev. Ta je v aplikaciji obvezna ob ustvarjanju računa in shranjena z različico besedila (`consents`, `v1-2026-10`).
- **DPIA** za aplikacijo (zdravstveni podatki + lokacija/GPS).
- **Pogodbe o obdelavi (DPA):** s Supabase, z e-poštnim ponudnikom (SMTP) in z agregatorjem pametnih naprav. Klaviyo DPA že obstaja.
- **Politika zasebnosti:** nov razdelek "FinestMe aplikacija" (namen, hramba, pravice, brisanje). Povezava gre v `privacyUrl`.
- **Pravica do izbrisa:** gumb "Delete account & cloud data" izbriše račun in vse podatke aplikacije. Naročila ostanejo zaradi računovodstva, vendar brez povezave na račun.
- **Navodila za uporabo izdelkov (rutina):** odmerki v `js/products.js` (`use.dose`) se morajo ujemati z etiketo. Regulatorno jih je treba potrditi pred zagonom.

## 8. Stroški (ocena, mesečno)
| Postavka | € |
|---|---|
| Supabase Pro | ~25 |
| Transakcijska e-pošta (do ~10k/mes) | 0–15 |
| Zemljevid (MapTiler/Stadia), ko preseže pilot | 25–100 |
| GitHub Pages | 0 |
