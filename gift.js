/* F4 GIFT AND PREPAID TABLE TIME on the player site (Austin 2026-11-07 "yes", the five-features page section 4).

   gift.html            GIVE TABLE TIME: the venues selling it (one = picked), the venue's prices, To, From, a short
   gift.html?v=<venue>  message, PAY. The order goes to the cloud (tw_gt_phone 'order') with the hash of a secret this
                        phone makes; that venue's box makes the checkout with its own payment company (Stripe, split to
                        the venue like table time) and the phone goes to Stripe's page.
   gift.html?o=<order>  back from Stripe: this phone knows the order's secret (localStorage) -> the gift page.
   gift.html?g=<secret> THE GIFT PAGE (the link to send): who it is for, the venue, the minutes left, the message, the
                        code once paid (TW-XXXX-XX) and how to use it. Use it in parts. It never expires.

   Only the phone's gift function (tw_gt_phone) with the public anon key; the cloud keeps only the secret's hash. */
(() => {
  const CFG = window.TW_PLAYER_SITE || {};
  const app = document.getElementById('app');
  const qs = new URLSearchParams(location.search);
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* a private window: the link still works */ } },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  const BUG = '<div class="bug"><b><i>TABLE WARS</i></b><span><i>GIFT TIME</i></span></div>';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const newSecret = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
  const mine = () => { try { const m = JSON.parse(ls.get('tw.gifts') || '{}'); return m && typeof m === 'object' ? m : {}; } catch { return {}; } };
  const keep = (order, secret) => { const m = mine(); m[order] = secret; ls.set('tw.gifts', JSON.stringify(m)); };

  async function rpc(action, args) {
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    let r;
    try {
      r = await fetch(`${url}/rest/v1/rpc/tw_gt_phone`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_action: action, p_args: args || {} }) });
    } catch { const e = new Error("Can't reach Table Wars. Check your phone's internet."); e.offline = true; throw e; }
    let j = null; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) throw new Error((j && j.message) || `Something went wrong (${r.status})`);
    return j;
  }
  const page = (html) => { app.innerHTML = BUG + html; };
  const errLine = (m) => `<div class="msg" role="alert">${esc(m)}</div>`;

  // ---------------------------------------------------------------- GIVE TABLE TIME
  const F = { venues: [], v: null, pk: null, busy: false };
  async function give() {
    page('<div class="gwait"><i></i>LOADING</div>');
    try { F.venues = await rpc('venues', qs.get('v') ? { v: qs.get('v') } : {}); }
    catch (e) { return page(`<h1 class="hl metal">GIVE TABLE TIME</h1>${errLine(e.message)}`); }
    if (!F.venues.length) {
      return page('<h1 class="hl metal">GIVE TABLE TIME</h1><div class="empty">' +
        (qs.get('v') ? "This venue isn't selling gift time right now. Try again later." : 'No venue is selling gift time right now.') + '</div>');
    }
    F.v = F.venues.length === 1 ? F.venues[0] : null;
    paintGive();
  }
  function paintGive(msg = '') {
    if (!F.v) {
      page('<h1 class="hl metal">GIVE TABLE TIME</h1><div class="line">Pick the venue.</div>' +
        `<div class="board"><div class="rbtitle">VENUES</div>${F.venues.map((v, i) => `<button class="row pick" type="button" data-vi="${i}"><div><b>${esc(v.name)}</b><small>${v.packages.map((p) => esc(p.label)).join(' · ')}</small></div></button>`).join('')}</div>`);
      return;
    }
    const v = F.v;
    if (!F.pk || !v.packages.some((p) => p.id === F.pk)) F.pk = (v.packages[1] || v.packages[0]).id;
    const keepVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const to = keepVal('gTo'), from = keepVal('gFrom'), note = keepVal('gMsg');
    page(`<h1 class="hl metal">GIVE TABLE TIME</h1><div class="line" id="gAt">At <b>${esc(v.name)}</b></div>` +
      `<div class="board"><div class="rbtitle">HOW MUCH TIME</div><div class="gpick" role="radiogroup">${v.packages.map((p) =>
        `<button class="btn${p.id === F.pk ? ' sel' : ''}" type="button" role="radio" aria-checked="${p.id === F.pk}" data-pk="${esc(p.id)}"><span>${esc(p.label)}</span><span class="p">${money(p.price_cents)}</span></button>`).join('')}</div></div>` +
      '<div class="gfield"><label for="gTo">To</label><input id="gTo" maxlength="16" autocomplete="off" placeholder="SAM"></div>' +
      '<div class="gfield"><label for="gFrom">From</label><input id="gFrom" maxlength="16" autocomplete="off" placeholder="JAX"></div>' +
      '<div class="gfield"><label for="gMsg">A short message</label><textarea id="gMsg" maxlength="80" rows="2" placeholder="Happy birthday!"></textarea><small>80 letters at most. Optional.</small></div>' +
      `${msg ? errLine(msg) : ''}<button class="btn primary" type="button" id="gPay"${F.busy ? ' disabled' : ''}>PAY ${money(v.packages.find((p) => p.id === F.pk).price_cents)}</button>` +
      `<div class="line dim">You pay on the payment company's own page. Then you get a link to send. The time works at any table at ${esc(v.name)}, in parts, and never expires.</div>` +
      (F.venues.length > 1 ? '<button class="tap" type="button" id="gOther">Another venue</button>' : ''));
    document.getElementById('gTo').value = to; document.getElementById('gFrom').value = from; document.getElementById('gMsg').value = note;
  }
  async function pay() {
    const to = document.getElementById('gTo').value.trim(), from = document.getElementById('gFrom').value.trim();
    const message = document.getElementById('gMsg').value.trim();
    if (!to || !from) return paintGive('Type who it is for and who it is from.');
    F.busy = true;
    const secret = newSecret();
    let o;
    try { o = await rpc('order', { v: F.v.v, package: F.pk, to, from, message, token: secret }); }
    catch (e) { F.busy = false; return paintGive(e.message); }
    keep(o.order, secret);
    page(`<h1 class="hl metal">GIVE TABLE TIME</h1><div class="gwait"><i></i>OPENING THE PAYMENT PAGE</div><div class="line dim">${esc(F.v.name)} is getting it ready.</div>`);
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      await sleep(1000);
      let g;
      try { g = await rpc('gift', { token: secret }); } catch { continue; }
      if (g.state === 'checkout' && g.checkout_url) { location.href = g.checkout_url; return; }
      if (g.state === 'failed') break;
    }
    F.busy = false;
    paintGive(`${F.v.name} can't take payments right now. Nothing was charged. Try again later.`);
  }
  app.addEventListener('click', (e) => {
    const vi = e.target.closest('[data-vi]');
    if (vi) { F.v = F.venues[Number(vi.dataset.vi)]; F.pk = null; paintGive(); return; }
    const pk = e.target.closest('[data-pk]');
    if (pk) { F.pk = pk.dataset.pk; paintGive(); return; }
    if (e.target.closest('#gPay') && !F.busy) { pay(); return; }
    if (e.target.closest('#gOther')) { F.v = null; paintGive(); return; }
    if (e.target.closest('#gSend')) { send(); return; }
    if (e.target.closest('#gRepay') && G.view && G.view.checkout_url) { location.href = G.view.checkout_url; }
  });

  // ---------------------------------------------------------------- THE GIFT PAGE
  const G = { secret: null, view: null, timer: null };
  const link = () => `${location.origin}${location.pathname}?g=${G.secret}`;
  async function send() {
    const url = link();
    try { if (navigator.share) { await navigator.share({ title: 'Table time for you', url }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); document.getElementById('gSent').textContent = 'Link copied. Paste it in a message.'; }
    catch { document.getElementById('gSent').textContent = 'Copy the link above and send it.'; }
  }
  async function gift(secret) {
    G.secret = secret;
    page('<div class="gwait"><i></i>LOADING</div>');
    for (;;) {
      try { G.view = await rpc('gift', { token: secret }); }
      catch (e) { return page(`<h1 class="hl metal">THE GIFT</h1>${errLine(e.message)}`); }
      paintGift();
      if (G.view.state !== 'checkout' && G.view.state !== 'new') return;
      if (qs.get('cancel')) return;
      await sleep(2000);
    }
  }
  function paintGift() {
    const g = G.view;
    const mins = (n) => `${n} minute${n === 1 ? '' : 's'}`;
    const head = `<div class="gcard"><div class="for">FOR ${esc(g.to)}</div><div class="what">${esc(mins(g.minutes))} of table time at <b>${esc(g.venue)}</b>, from ${esc(g.from)}</div>` +
      (g.message ? `<div class="note">&ldquo;${esc(g.message)}&rdquo;</div>` : '');
    if (g.state === 'paid') {
      const left = Number(g.minutes_left);
      page(`${head}<div class="gcode" id="gCode">${esc(g.code)}</div>` +
        `<div class="gleft">${left ? `<b>${left} MIN</b> LEFT` : 'ALL USED'}</div></div>` +
        `<div class="ghow"><div><b>How to use it:</b> at ${esc(g.venue)}, hold a puck at any table. Point at <b>HAVE A CODE</b> on the TV and tap. Type this code.</div>` +
        '<div>Use it in parts. It never expires.</div></div>' +
        `<div class="board"><div class="rbtitle">SEND THIS GIFT</div><div class="pbody" style="padding:12px;display:flex;flex-direction:column;gap:10px">` +
        `<div class="glink">${esc(link())}</div><button class="btn primary" type="button" id="gSend">SEND THE LINK</button><div class="status" id="gSent"></div></div></div>`);
      return;
    }
    if (g.state === 'checkout' && qs.get('cancel')) {
      page(`${head}</div><div class="line">The payment isn't finished. Nothing was charged.</div><button class="btn primary" type="button" id="gRepay">PAY ${money(g.price_cents)}</button>`);
      return;
    }
    if (g.state === 'new' || g.state === 'checkout') {
      page(`${head}</div><div class="gwait"><i></i>WAITING FOR THE PAYMENT</div><div class="line dim">This takes a few seconds after you pay.</div>`);
      return;
    }
    const why = g.why === 'prices' ? `${g.venue} changed its prices. Nothing was charged.`
      : g.state === 'expired' ? 'The payment page timed out. Nothing was charged.'
        : `${g.venue} can't take payments right now. Nothing was charged.`;
    page(`${head}</div><div class="line">${esc(why)}</div><a class="btn" href="gift.html${g.v ? `?v=${esc(g.v)}` : ''}">START AGAIN</a>`);
  }

  // ---------------------------------------------------------------- which page
  const g = (qs.get('g') || '').replace(/[^a-f0-9]/g, '');
  const o = (qs.get('o') || '').replace(/[^a-z0-9_]/g, '');
  if (g.length >= 32) gift(g);
  else if (o) {
    const s = mine()[o];
    if (s) { history.replaceState(null, '', `${location.pathname}?g=${s}${qs.get('cancel') ? '&cancel=1' : ''}`); gift(s); }
    else page('<h1 class="hl metal">THE GIFT</h1><div class="empty">Open the gift link on the phone you paid with. The gift is safe: the link shows the code once the payment arrives.</div>');
  } else give();
})();
