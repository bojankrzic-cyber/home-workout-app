# Translating FinestMe

FinestMe (by Nature's Finest, a European food-supplement brand) is a personal well-being coach app:
- the daily supplement routine (one-tap check-in, rewards, reorder before a pack runs out);
- guided home and gym workouts (exercise names, technique cues, sets and reps);
- GPS tracking for running, walking and riding ("Trail");
- body weight and progress.

The buddy character is called **Finn**. The voice is warm, short and encouraging, with no guilt, like a good coach texting a friend.

## Files
- **Source:** `tools/i18n/source.json` is an array of English keys. The same keys are split into `tools/i18n/chunk00.json` … `chunk07.json`, about 300 keys each.
- **Output:** for each chunk NN, write `tools/i18n/out/<lang>.partNN.json`. It is a JSON object `{ "<English key exactly as given>": "<translation>" }` and must cover every key of that chunk.
- **Validate:** `python3 tools/i18n/check.py <lang>`. It reports missing keys and token mismatches and joins the parts into `out/<lang>.json`. Fix every problem it reports and run it again until it says 0 problems.

## Rules
1. **Keep tokens exactly.**
   - `{0}`, `{1}` … are numbers. `{product}` and `{n}` are inserted values.
   - `<0>…</0>` and `<1/>` are formatting tags around words.
   - Every token in the key must appear in the translation with the same name. Tags may move to fit the grammar but must stay paired.
2. **Keep these unchanged:**
   - emoji and symbols: → ← ＋ ✓ · – … × % ⬆︎;
   - units: kg, km, m, min, s, bpm, km/h, /km, g, ml, IU;
   - brand and product names: FinestMe, Nature's Finest, Finn, Google, Apple, Apple Watch, Garmin, Polar, Suunto, COROS, Fitbit, Samsung, Strava, HYROX, WhatsApp, Klaviyo, and product names such as "Detox - Belly Burn".
3. **Register: informal and friendly everywhere** (du / tu / ti / te …), the way leading fitness apps (Freeletics, Strava, adidas Running) talk to users in your language. Be consistent. `tools/i18n/seed_qr.json` holds earlier translations of some keys. Use it for terminology only and rewrite to the informal register where it is formal.
4. **Short UI text stays short.** Buttons, chips and labels should be about the length of the English. Capitalise as your language does: no English title case, sentence case for headings.
5. **Sport and fitness terms:** use what people in your country actually say at the gym. English loanwords are fine where they are the norm (e.g. "Burpee", "Plank", "HIIT", "Zone 2" → your word for zone + 2). Exercise names should be recognisable.
6. **Food supplements:** use the legal term of your language (e.g. Nahrungsergänzungsmittel, prehransko dopolnilo, étrend-kiegészítő, integratore alimentare, complément alimentaire). Translate faithfully and never add or strengthen any health or effect claim.
7. **Fragments:** some keys are pieces of a longer sentence ("seconds. Next up:") or single words. Translate them so they still read naturally when shown on their own.
8. **App sections:** Today, Progress, Me and Health should be translated naturally. "Trail" and "Gym" may stay as they are if those words are common in your language; otherwise use a short natural equivalent. Use the same choice everywhere.
9. **Untranslatable keys** (pure codes, a lone letter): copy them unchanged.
10. **Self-check:** reread your output for natural phrasing and consistency of the same term across keys before you finish.
