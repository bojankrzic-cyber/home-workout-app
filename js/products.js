/*
 * Nature's Finest product tips – contextual, goal-aware recommendations.
 *
 * Edit this file to change products, copy, URLs or switch the feature on for everyone.
 * Rules the app enforces:
 *   - matching runs only on this device (goal/age never leave the browser; links carry UTM only)
 *   - adults only: a profile needs an age of 18+ before any tip is shown
 *   - never during a workout; at most one card on the finish screen
 *   - claims: use only EU-authorised health-claim wording (Reg. 1924/2006, 432/2012) as approved for the webshop
 */
(function (global) {
  'use strict';

  var CONFIG = {
    // false = pilot: tips are off by default, each profile can switch them on in Settings
    live: false,
    market: 'si',
    shop: 'https://www.naturesfinest.si',
    utm: { utm_source: 'nf-app', utm_medium: 'app' },   // name-agnostic: survives app renames
    minAge: 18,
    disclaimer: 'Food supplements are not a substitute for a varied, balanced diet and a healthy lifestyle.',
    // Health program reward ladder (js/health.js). Pilot: shared codes – before launch replace with unique
    // per-customer codes created server-side (WooCommerce REST) so codes can't be passed around.
    // Percentages are a commercial decision (margin) – TODO CEO/commercial.
    // "never run out": subscription at reorder. live:false = the app shows it and counts interest
    // (event subscription_interest) until the webshop can take subscriptions – TODO commercial: discount
    subscription: { live: false, discount: 10 },
    // free sample of the suggested complement in the next package (webshop reads ?fm_sample=<sku>) – TODO ops
    sample: true,
    rewards: {
      // 7: non-cash + tied to a purchase (check-ins are self-reported – a cash code at day 7 invites farming)
      7: { code: 'FINESTME-SHIP', text: 'Member badge + free shipping on your next reorder' },
      30: { code: 'FINESTME15', text: '15% off + a free sample chosen for your goal in your next package' },
      60: { text: 'Free shipping on every order while you stay in the program' },
      90: { text: 'Your routine price locked + your 90-day story' }
    }
  };

  // goals: muscle | strength | fatloss | endurance | hyrox | general
  // cartId: WooCommerce product id for one-tap reorder (?add-to-cart=) – TODO verify ids per market
  // pack.servings: servings per pack from the label – TODO fill for every product (else the user picks 30/60/90)
  // use: default for the daily routine (Today screen). dose MUST match the product label –
  // TODO regulatory: confirm each dose/timing against the current label before going live.
  var ITEMS = [
    {
      id: 'creatine', sku: 786110, cartId: 786110, pack: { servings: 85 }, name: 'Creatine Monohydrate', price: 14.99,
      url: '/izdelek/creatine-monohydrate/', img: 'img/products/creatine.webp',
      claim: 'Creatine increases physical performance in successive bursts of short-term, high-intensity exercise.',
      note: 'Beneficial effect with a daily intake of 3 g · 85 servings · vegan',
      goals: { strength: 3, muscle: 3, hyrox: 2, general: 1 }, moments: ['home', 'race'],
      use: { dose: '3 g (1 scoop) in water or a shake', slot: 'morning', days: 'daily', tip: 'Every day, rest days too – consistency matters more than timing.' }
    },
    {
      id: 'recovery', sku: 567616, cartId: 567616, name: 'Recovery Shake', price: 9.99,
      url: '/izdelek/recovery-shake/', img: 'img/products/recovery.webp',
      claim: 'Magnesium and calcium contribute to normal muscle function. B vitamins contribute to the reduction of tiredness and fatigue.',
      note: 'Whey protein + carbs 3:1 + electrolytes · rated 4.9/5',
      goals: { muscle: 3, strength: 2, hyrox: 3, endurance: 2 }, moments: ['finish', 'home', 'race'],
      use: { dose: '1 serving in water', slot: 'post', days: 'training', tip: 'Within an hour after training.' }
    },
    {
      id: 'protein', sku: 978562, cartId: 978562, name: 'Bio Vegan Protein – Matcha & Vanilla', price: 14.59,
      url: '/izdelek/bio-vegan-protein-matcha-vanilla/', img: 'img/products/protein.webp',
      claim: '19 g plant protein (pea, rice, chia) and 2.7 g BCAA per serving, no added sugar.',
      note: 'Organic · vegan',
      goals: { fatloss: 3, general: 3, muscle: 2 }, moments: ['finish', 'home'],
      use: { dose: '1 scoop in water or plant milk', slot: 'post', days: 'daily', tip: 'After training, or between meals on rest days.' }
    },
    {
      id: 'hydration', sku: 804496, cartId: 804496, name: 'Hydration + Energy', price: 22.27,
      url: '/izdelek/hydration-energy-for-hot-weather/', img: 'img/products/hydration.webp',
      claim: 'Magnesium contributes to electrolyte balance and normal muscle function, and to the reduction of tiredness and fatigue.',
      note: 'Magnesium + B vitamins · dissolves fully · rated 4.9/5',
      goals: { endurance: 3, hyrox: 3, fatloss: 1 }, moments: ['finish', 'home', 'race'], cardio: true,
      use: { dose: '1 serving in 500 ml water', slot: 'pre', days: 'training', tip: 'Sip it during longer or hot sessions.' }
    },
    {
      id: 'magnesium', sku: 852097, cartId: 852097, name: 'Magnesium (citrate)', price: 6.99,
      url: '/izdelek/magnezij-kapsule/', img: 'img/products/magnesium.webp',
      claim: 'Magnesium contributes to normal muscle function and to the reduction of tiredness and fatigue.',
      note: 'Premium citrate form · vegan',
      goals: { endurance: 2, general: 2, strength: 1, muscle: 1, fatloss: 1 }, moments: ['home'],
      use: { dose: '1 capsule', slot: 'evening', days: 'daily', tip: 'Evenings suit most people.' }
    },
    {
      id: 'vitd3', sku: 852053, cartId: 852053, name: 'Vitamin D3 2000 IU', price: 9.99,
      url: '/izdelek/vitamin-d3-kapsule/', img: 'img/products/vitd3.webp',
      claim: 'Vitamin D contributes to the maintenance of normal muscle function and normal bones.',
      note: 'Especially relevant October–April',
      goals: { general: 2, muscle: 1, strength: 1, endurance: 1, fatloss: 1, hyrox: 1 }, moments: ['home'], winter: true,
      use: { dose: '1 capsule with a meal', slot: 'morning', days: 'daily', tip: 'Take it with a meal that contains some fat.' }
    }
  ];

  function link(item, campaign) {
    var q = Object.keys(CONFIG.utm).map(function (k) { return k + '=' + encodeURIComponent(CONFIG.utm[k]); });
    q.push('utm_campaign=' + encodeURIComponent(campaign), 'utm_content=' + encodeURIComponent(item.id));
    return CONFIG.shop + item.url + '?' + q.join('&');
  }

  function age(s) { return s.birthYear ? new Date().getFullYear() - s.birthYear : null; }

  // Is the feature on for this profile? (explicit choice wins, else the global pilot switch)
  function enabled(state) {
    var s = state.settings;
    return s.tips === true || (s.tips == null && CONFIG.live);
  }
  function eligible(state) { var a = age(state.settings); return a != null && a >= CONFIG.minAge; }

  // Best products for a profile and moment ('home' | 'finish' | 'race'), highest goal score first
  function pick(state, moment, n, ctx) {
    if (!enabled(state) || !eligible(state)) return [];
    var goal = state.settings.goal || 'general', month = new Date().getMonth();
    var winter = month >= 9 || month <= 3;
    return ITEMS.filter(function (it) { return it.moments.indexOf(moment) >= 0 && (!it.winter || winter); })
      .map(function (it) {
        var sc = (it.goals[goal] || 0) * 10;
        if (ctx && ctx.cardio && it.cardio) sc += 15;
        return { it: it, sc: sc };
      })
      .filter(function (x) { return x.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc; })
      .slice(0, n || 1)
      .map(function (x) { return x.it; });
  }

  global.Products = { CONFIG: CONFIG, ITEMS: ITEMS, link: link, pick: pick, enabled: enabled, eligible: eligible };
})(window);
