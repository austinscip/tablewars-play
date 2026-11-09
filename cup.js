/* C2 CUP MONEY on the player site: a HOUSE CUP's phone sign-up (Austin 2026-11-07 "yep" on the cups page's Money).

   cup.html?c=<CODE>          the cup at the venue: its game, its ENTRY FEE (it covers your table time for every cup
                              match), its PRIZES (fixed prizes from the venue), a name (DUOS: two), ENTER. With a fee the
                              venue's box makes the checkout with its own payment company and this phone goes to that
                              page; back here it waits for the box to see the payment.
   ...&back=1 / &cancel=1     back from the payment page (paid / not finished)
   Then where this phone stands: YOU'RE IN (paid / free), ON THE WAITLIST, UNPAID (pay at the counter), REFUNDED.
   Only the phone's cup function (tw_cup_phone) with the public anon key and this phone's own token (localStorage);
   the cloud keeps only the token's hash. */
(() => {
  const CFG = window.TW_PLAYER_SITE || {};
  const app = document.getElementById('app');
  const qs = new URLSearchParams(location.search);
  const code = String(qs.get('c') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* a private window */ } },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  const BUG = '<div class="bug"><b><i>TABLE WARS</i></b><span><i>HOUSE CUP</i></span></div>';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const PLACE = ['1ST', '2ND', '3RD'];
  function token() {
    let t = ls.get('tw.cup.token');
    if (!t || t.length < 40) {
      const b = new Uint8Array(32); crypto.getRandomValues(b);
      t = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      ls.set('tw.cup.token', t);
    }
    return t;
  }
  async function rpc(action, args) {
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    let r;
    try {
      r = await fetch(`${url}/rest/v1/rpc/tw_cup_phone`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token(), p_action: action, p_args: { code, ...(args || {}) } }) });
    } catch { const e = new Error("Can't reach Table Wars. Check your phone's internet."); e.offline = true; throw e; }
    let j = null; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) throw new Error((j && j.message) || `Something went wrong (${r.status})`);
    return j;
  }
  const page = (html) => { app.innerHTML = BUG + html; };
  const errLine = (m) => `<div class="msg" role="alert">${esc(m)}</div>`;
  const S = { v: null, busy: false, left: false };

  function cupHead(c) {
    const fee = Number(c.fee_cents) || 0;
    const prizes = (c.prizes || []).map((p, i) => (p ? `<div class="row"><div><b>${PLACE[i]}</b><small>${esc(String(p).toUpperCase())}</small></div></div>` : '')).join('');
    return `<h1 class="hl metal">HOUSE CUP</h1><div class="line">At <b>${esc(c.venue)}</b>${c.game ? ` &middot; ${esc(c.game)}` : ''}${c.kind === 'duos' ? ' &middot; DUOS' : ''}</div>` +
      `<div class="gcard cfee"><div class="for">${fee ? `${money(fee)} TO ENTER` : 'FREE TO ENTER'}</div>` +
      (fee ? '<div class="what">It covers your table time for <b>every cup match</b>. A cancelled cup gives it back. No-shows and quits don\'t get it back.</div>' : '<div class="what">No table clock runs in a cup match.</div>') + '</div>' +
      (prizes ? `<div class="board"><div class="rbtitle">PRIZES</div>${prizes}</div>` : '');
  }
  function form(msg = '') {
    const c = S.v.cup;
    const fee = Number(c.fee_cents) || 0;
    const keep = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const nm = keep('cName'), pn = keep('cPartner');
    const late = c.state === 'running';
    page(cupHead(c) + (late ? '<div class="line">The cup has started. You go on the <b>WAITLIST</b>: you play when a spot opens.</div>' : '') +
      '<div class="gfield"><label for="cName">Your name</label><input id="cName" maxlength="12" autocomplete="off" placeholder="JAX"><small>On the TV. Letters, numbers, a space or -.</small></div>' +
      (c.kind === 'duos' ? '<div class="gfield"><label for="cPartner">Your partner</label><input id="cPartner" maxlength="12" autocomplete="off" placeholder="SAM"></div>' : '') +
      `${msg ? errLine(msg) : ''}<button class="btn primary" type="button" id="cGo"${S.busy ? ' disabled' : ''}>${fee ? `PAY ${money(fee)} AND ENTER` : 'ENTER'}</button>` +
      (fee ? `<div class="line dim">You pay on the payment company's own page. Or tap ENTER here later and pay at the counter.</div>` : ''));
    document.getElementById('cName').value = nm;
    if (document.getElementById('cPartner')) document.getElementById('cPartner').value = pn;
  }
  function status() {
    const { cup: c, me } = S.v;
    const fee = Number(c.fee_cents) || 0;
    let big, line, extra = '';
    const who = esc(me.partner ? `${me.name} + ${me.partner}` : me.name);
    if (me.status === 'refused') return form(me.why ? `${String(me.why).replace(/^./, (x) => x.toUpperCase())}.` : 'That name did not go in.');
    if (c.state === 'cancelled') {
      big = 'THE CUP WAS CANCELLED';
      line = me.pay === 'refunded' ? `Your ${money(me.amount_cents || fee)} is on its way back to your card.` : me.pay === 'paid' ? `Your ${money(me.amount_cents || fee)} is coming back.` : 'Nothing was charged.';
    } else if (me.pay === 'refunded') {
      big = 'REFUNDED'; line = `Your ${money(me.amount_cents || fee)} is on its way back to your card.`;
    } else if (me.status === 'new' || (fee && !me.pay && me.status === 'taken')) {
      big = 'ONE MOMENT'; line = `${esc(c.venue)} is putting your name in.`; extra = '<div class="gwait"><i></i>WAITING</div>';
    } else if (me.pay === 'checkout') {
      if (qs.get('cancel') || S.left) {
        big = 'NOT PAID YET'; line = `The payment isn't finished. Nothing was charged.`;
        extra = `<a class="btn primary" href="${esc(me.checkout_url)}">PAY ${money(me.amount_cents || fee)}</a><div class="line dim">Or pay at the counter.</div>`;
      } else {
        big = 'WAITING FOR THE PAYMENT'; line = 'This takes a few seconds after you pay.'; extra = '<div class="gwait"><i></i>WAITING</div>';
      }
    } else if (me.pay === 'unpaid') {
      big = 'PAY AT THE COUNTER'; line = `<b>${who}</b> is in the cup, UNPAID. Pay ${money(fee)} at the counter before your first match.`;
    } else if (me.spot === 'waitlist') {
      big = "YOU'RE ON THE WAITLIST"; line = `<b>${who}</b>${me.pay === 'paid' ? `, paid ${money(me.amount_cents || fee)}` : ''}. You play when a spot opens. Stay close to the TV.`;
    } else if (me.spot === 'out') {
      big = 'NOT IN THIS CUP'; line = 'Your spot went to the waitlist.' + (me.pay === 'paid' ? ' Your fee is coming back.' : '');
    } else {
      big = "YOU'RE IN"; line = `<b>${who}</b>${me.pay === 'paid' ? ` &middot; PAID ${money(me.amount_cents || fee)}` : ''}. Watch the TV: it calls your match.`;
    }
    const v = c.view || {};
    let next = '';
    const mine = (v.matches || []).find((m) => (m.status === 'called' || m.status === 'playing' || m.status === 'ready') && (m.sides || []).some((s) => s && s.split(' + ').includes(me.name)));
    if (mine && c.state === 'running') {
      const opp = (mine.sides || []).find((s) => s && !s.split(' + ').includes(me.name)) || '?';
      next = `<div class="board"><div class="rbtitle">${mine.status === 'called' ? "YOU'RE UP" : 'YOUR NEXT MATCH'}</div><div class="row"><div><b>VS ${esc(opp)}</b><small>${esc(mine.label)}${mine.table ? ` &middot; TABLE ${esc(mine.table)}` : ''}</small></div></div></div>`;
    }
    if (c.state === 'done' && v.champion) next = `<div class="board"><div class="rbtitle">CHAMPION</div><div class="row"><div><b>${esc(v.champion)}</b>${(c.prizes || [])[0] ? `<small>WINS ${esc(String(c.prizes[0]).toUpperCase())}</small>` : ''}</div></div></div>`;
    page(cupHead(c) + `<div class="gcard"><div class="for">${big}</div><div class="what">${line}</div></div>${extra}${next}`);
  }
  async function load() {
    try { S.v = await rpc('view'); } catch (e) { page(`<h1 class="hl metal">HOUSE CUP</h1>${errLine(e.message)}`); return false; }
    if (!S.v.me) form(); else status();
    return true;
  }
  async function enter() {
    const name = document.getElementById('cName').value.trim();
    const pEl = document.getElementById('cPartner');
    const partner = pEl ? pEl.value.trim() : '';
    if (!name) return form('Type your name.');
    if (pEl && !partner) return form("Type your partner's name.");
    S.busy = true;
    try { await rpc('enter', { name, partner: partner || null }); } catch (e) { S.busy = false; return form(e.message); }
    S.busy = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      await sleep(1000);
      try { S.v = await rpc('view'); } catch { continue; }
      const me = S.v.me || {};
      if (me.pay === 'checkout' && me.checkout_url) { location.href = me.checkout_url; return; }
      // the box takes the name first, then (a fee) makes the payment page: wait for both
      if (me.status !== 'new' && (me.pay || !(Number(S.v.cup.fee_cents) > 0) || me.status === 'refused')) { status(); return; }
    }
    status();
  }
  app.addEventListener('click', (e) => { if (e.target.closest('#cGo') && !S.busy) enter(); });
  (async () => {
    if (!code) { page('<h1 class="hl metal">HOUSE CUP</h1><div class="empty">Scan the code on the TV to sign up for a cup.</div>'); return; }
    if (!(await load())) return;
    // keep following this phone's entry and the cup (paid, the waitlist, the call, the champion)
    for (;;) {
      await sleep(S.v && S.v.me && (S.v.me.status === 'new' || S.v.me.pay === 'checkout') ? 2000 : 5000);
      const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
      if (typing || !S.v || !S.v.me) continue;
      try { S.v = await rpc('view'); status(); } catch { /* next time */ }
      if (S.v.cup.state === 'done' || S.v.cup.state === 'cancelled') { if (S.v.me.pay !== 'paid') return; }
    }
  })();
})();
