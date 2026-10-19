# Moja polica – promocija kot storitev

Koda: `js/shelf.js`, test `tools/shelf.cjs`. Podatki v `js/catalog.js`, ki ga gradi `tools/catalog/build_catalog.py`:
- `img`: slika paketa iz TrackDaddy `products.image_url` (`tools/catalog/images.json`, 230 od 325 SKU);
- `x`: komplementarni izdelki iz naročil (`tools/catalog/complements.json`, 16 SKU z jasnim parom);
- `b`: EAN iz Pantheona.

| Kaj | Kje | Pravilo |
|---|---|---|
| Zaloga na izdelek | Today (trak pod skenerjem), Moja polica | Vrstica in »še X dni · do datuma«. Ko je do konca ≤ 5 dni, je kartica poudarjena |
| Ponaročilo | Polica, kartica za zalogo | Trgovina trga stranke, koda nagrade, UTM `utm_campaign=shelf` |
| »Nikoli ne zmanjka« | Polica, samo ko je do konca ≤ 5 dni | `Products.CONFIG.subscription`. Dokler `live: false`, aplikacija samo šteje interes (dogodek `subscription_interest`) |
| Dopolni rutino | Polica in Moj program | Po 21. dnevu, največ enkrat na 30 dni, en izdelek. »Ne, hvala« velja 30 dni |
| Brezplačen vzorec | Gumb pri predlogu | Povezava za ponaročilo lastnega izdelka z `&fm_sample=<SKU>` |

## Za druge ekipe
- **Webshop (razvoj):**
  - parameter `fm_sample=<SKU>` doda vzorec v naročilo (brezplačna postavka ali opomba za skladišče);
  - nato `cartId` po trgih za neposredno košarico. Zdaj ponaročilo odpre iskanje v trgovini, ker ID-ji v `product_sku_id_mappings` niso WooCommerce ID-ji.
- **Komerciala:**
  - popust za naročnino, predlog 10 %. Odločitev naj temelji na številu dogodkov `subscription_interest` v pilotu;
  - proračun za vzorce, ~1–2 € na stranko.
- **CRM:** brez obvestil za promocije. Push in e-pošta ostajata samo za zalogo, nagrade in opomnike.
