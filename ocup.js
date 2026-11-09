/* C3 THE ONLINE CUP on the player site (Austin 2026-11-07 "proceed how u deem necessary"; the plan: the cups page's
   "ONLINE CUP · many venues", YOUR PATH).

   ocup.html                  the upcoming online cups, and MY CUP PLACES (every cup this profile finished)
   ocup.html?c=<CUP>          one cup: PICK YOUR VENUE (the venues in it, the spots left at each), your name (your
                              profile's nickname unless you type one), PAY $5 AND ENTER (the venue box makes the payment
                              page at the cup's split; a HOUSE CUP champion's free seat pays it) or the WAITLIST when the
                              venue or the cup is full; then CHECK IN AT THE TV (from 30 minutes before); once it runs
                              YOUR PATH: your matches so far, the bracket you're in now, your next opponent, their venue
                              and when, the best place you can still finish, "you move to ..." after each match; SEE THE
                              WHOLE CUP. After: "17TH OF 64 · FRIDAY 9 PM CUP" and the bracket to look back at.
   ...&back=1 / &cancel=1     back from the payment page
   Only the phone's function tw_ocup_phone with the public anon key and this phone's profile token (localStorage
   'tw.token', the player site's own); the cloud keeps only the token's hash. */
(() => {
  const CFG = window.TW_PLAYER_SITE || {};
  const app = document.getElementById('app');
  const qs = new URLSearchParams(location.search);
  const cid = String(qs.get('c') || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const up = (s) => String(s ?? '').toUpperCase();
  const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  const ORD = (n) => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[n % 10] || 'TH')}`;
  const when = (ts) => new Date(ts * 1000).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const hhmm = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const BUG = '<div class="bug"><b><i>TABLE WARS</i></b><span><i>ONLINE CUP</i></span></div>';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const PLACE = ['1ST', '2ND', '3RD'];
  const S = { v: null, busy: false, loc: null, whole: false, msg: '' };
  const token = () => ls.get('tw.token') || '';
  async function rpc(action, args) {
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    let r;
    try {
      r = await fetch(`${url}/rest/v1/rpc/tw_ocup_phone`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token() || 'no-token-on-this-phone-yet-000', p_action: action, p_args: { cup: cid, ...(args || {}) } }) });
    } catch { const e = new Error("Can't reach Table Wars. Check your phone's internet."); e.offline = true; throw e; }
    let j = null; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) throw new Error((j && j.message) || `Something went wrong (${r.status})`);
    return j;
  }
  const page = (html) => { app.innerHTML = BUG + html; };
  const errLine = (m) => `<div class="msg" role="alert">${esc(m)}</div>`;
  const gameOf = (c) => String(c.game || '').replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase());

  function head(c) {
    const fee = Number(c.fee_cents) || 0;
    const prizes = (c.prizes || []).map((p, i) => (p ? `<div class="row"><div><b>${PLACE[i]}</b><small>${esc(up(p))}</small></div></div>` : '')).join('');
    return `<h1 class="hl metal">${esc(c.name)}</h1><div class="line">${esc(gameOf(c))} &middot; ${c.kind === 'duos' ? 'duos' : 'solo'} &middot; ${c.size} spots &middot; ${c.in} in</div>` +
      `<div class="line">Starts <b>${esc(when(c.starts_at))}</b> at every venue in it</div>` +
      `<div class="gcard cfee"><div class="for">${fee ? `${money(fee)} TO ENTER` : 'FREE TO ENTER'}</div>` +
      `<div class="what">${fee ? 'It covers your table time for <b>every cup match</b>. ' : ''}Everyone plays ${Math.log2(c.size)} games and finishes with a real place. A cancelled cup gives the fee back.</div></div>` +
      (prizes ? `<div class="board"><div class="rbtitle">PRIZES FROM TABLE WARS</div>${prizes}</div>` : '');
  }

  // ---- sign up -------------------------------------------------------------------------------------------------
  function form() {
    const { cup: c } = S.v;
    const fee = Number(c.fee_cents) || 0;
    const keep = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const nm = keep('oName'), pn = keep('oPartner');
    if (!S.v.profile) {
      page(head(c) + '<div class="gcard"><div class="for">MAKE YOUR PLAYER PROFILE FIRST</div><div class="what">An online cup puts your place on your profile. It takes a minute.</div></div>' +
        `<a class="btn primary" href="index.html">MAKE MY PROFILE</a>`);
      return;
    }
    if (c.state !== 'open') { page(head(c) + '<div class="gcard"><div class="for">SIGN-UP IS CLOSED</div></div>' + wholeBtn()); return; }
    const venues = (c.venues || []).map((v) => {
      const left = Math.max(0, v.spots - v.in);
      const full = left === 0 || c.in >= c.size;
      return `<button type="button" data-loc="${esc(v.loc)}" class="${S.loc === v.loc ? 'on' : ''}"><b>${esc(v.venue)}</b><small>${full ? 'WAITLIST' : `${left} of ${v.spots} spots left`}</small></button>`;
    }).join('');
    const seat = S.v.free_seat && fee;
    page(head(c) + '<div class="rbtitle" style="border-radius:6px">PICK YOUR VENUE</div>' + `<div class="vpick">${venues}</div>` +
      '<div class="gfield"><label for="oName">Your name on the TV</label><input id="oName" maxlength="12" autocomplete="off" placeholder="YOUR PROFILE NAME"><small>Leave it empty to use your profile\'s name.</small></div>' +
      (c.kind === 'duos' ? '<div class="gfield"><label for="oPartner">Your partner</label><input id="oPartner" maxlength="12" autocomplete="off" placeholder="SAM"></div>' : '') +
      `${S.msg ? errLine(S.msg) : ''}<button class="btn primary" type="button" id="oGo"${S.busy || !S.loc ? ' disabled' : ''}>${seat ? 'ENTER WITH MY FREE SEAT' : fee ? `PAY ${money(fee)} AND ENTER` : 'ENTER'}</button>` +
      `<div class="line dim">You check in at your venue's TV from 30 minutes before the start.${fee && !seat ? " You pay on the payment company's own page." : ''}</div>`);
    if (document.getElementById('oName')) document.getElementById('oName').value = nm;
    if (document.getElementById('oPartner')) document.getElementById('oPartner').value = pn;
  }
  async function enter() {
    const name = (document.getElementById('oName') || {}).value || '';
    const pEl = document.getElementById('oPartner');
    if (!S.loc) { S.msg = 'Pick your venue.'; return form(); }
    if (pEl && !pEl.value.trim()) { S.msg = "Type your partner's name."; return form(); }
    S.busy = true; S.msg = '';
    try { await rpc('enter', { loc: S.loc, name: name.trim() || null, partner: pEl ? pEl.value.trim() : null }); } catch (e) { S.busy = false; S.msg = e.message; return form(); }
    S.busy = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      await sleep(1000);
      try { S.v = await rpc('view'); } catch { continue; }
      const me = S.v.me || {};
      if (me.pay === 'checkout' && me.checkout_url) { location.href = me.checkout_url; return; }
      if (me.pay || !(Number(S.v.cup.fee_cents) > 0)) { render(); return; }
    }
    render();
  }

  // ---- where you stand -----------------------------------------------------------------------------------------
  function entryCard() {
    const { cup: c, me } = S.v;
    const fee = Number(c.fee_cents) || 0;
    const who = esc(me.partner ? `${me.name} + ${me.partner}` : me.name);
    let big, line, extra = '';
    if (c.state === 'cancelled') {
      big = 'THE CUP WAS CANCELLED';
      line = me.refund === 'done' ? `Your ${money(me.amount_cents || fee)} is on its way back to your card.` : me.pay === 'paid' ? `Your ${money(me.amount_cents || fee)} is coming back.` : me.pay === 'seat' ? 'Your free seat is yours again.' : 'Nothing was charged.';
    } else if (me.spot === 'out') {
      big = 'NOT IN THIS CUP'; line = me.refund ? 'Your spot went to the waitlist. Your fee is coming back.' : 'You did not check in at the start, so your spot went to the waitlist.';
    } else if (me.pay === 'checkout') {
      if (qs.get('cancel')) { big = 'NOT PAID YET'; line = "The payment isn't finished. Nothing was charged."; extra = `<a class="btn primary" href="${esc(me.checkout_url)}">PAY ${money(me.amount_cents || fee)}</a>`; }
      else { big = 'WAITING FOR THE PAYMENT'; line = 'This takes a few seconds after you pay.'; extra = '<div class="gwait"><i></i>WAITING</div>'; }
    } else if (!me.pay && fee) {
      big = 'ONE MOMENT'; line = `${esc(me.venue)} is putting your name in.`; extra = '<div class="gwait"><i></i>WAITING</div>';
    } else if (me.pay === 'unpaid') {
      big = 'PAY AT THE COUNTER'; line = `<b>${who}</b> is in, UNPAID. Pay ${money(fee)} at ${esc(me.venue)}'s counter before the start.`;
    } else if (me.spot === 'waitlist') {
      big = "YOU'RE ON THE WAITLIST"; line = `<b>${who}</b> at <b>${esc(me.venue)}</b>. Check in at the TV anyway: a spot nobody checks in for goes to the waitlist at the start.`;
    } else {
      big = "YOU'RE IN"; line = `<b>${who}</b> &middot; <b>${esc(me.venue)}</b>${me.pay === 'paid' ? ` &middot; PAID ${money(me.amount_cents || fee)}` : me.pay === 'seat' ? ' &middot; FREE SEAT' : ''}`;
    }
    let ci = '';
    if (c.state === 'open' && me.spot !== 'out') {
      ci = me.checked_in ? `<div class="board"><div class="rbtitle">&#10003; CHECKED IN</div><div class="row"><div><b>${esc(me.venue)}</b><small>Round 1 is drawn at ${esc(hhmm(c.starts_at))}. Stay close to the TV.</small></div></div></div>`
        : `<div class="board"><div class="rbtitle">CHECK IN AT THE TV</div><div class="row"><div><b>${esc(me.venue)}</b><small>Check in from <em>${esc(hhmm(c.starts_at - 1800))}</em>: hold a puck at a cup table, point at your name, tap. Not checked in at ${esc(hhmm(c.starts_at))} = your spot goes to the waitlist.</small></div></div></div>`;
    }
    return `<div class="gcard"><div class="for">${big}</div><div class="what">${line}</div></div>${extra}${ci}`;
  }
  // YOUR PATH: the same walk as the box's runtime/online_cup.py path_view
  function groupWords(g) {
    if (!g) return '';
    const [a, b] = g;
    if (a === 1 && b === 2) return 'THE FINAL';
    if (b - a === 1) return `FOR ${ORD(a)}`;
    return `FOR ${ORD(a)}–${ORD(b)}`;
  }
  function nextGroup(doc, m, won) {
    if (m.places) return null;
    const tag = won ? 'W' : 'L';
    for (const x of Object.values(doc.matches)) for (const s of x.src) if (s[0] === tag && s[1] === m.key) return x.group;
    return null;
  }
  const sideOf = (doc, id) => (id === 'BYE' ? { name: 'BYE', bye: true } : doc.ents[id] || null);
  function path(doc, eid) {
    const ms = Object.values(doc.matches).sort((a, b) => a.round - b.round || a.order - b.order);
    const played = [];
    let next = null;
    for (const m of ms) {
      if (!(m.sides || []).includes(eid)) continue;
      const me = m.sides.indexOf(eid);
      const opp = sideOf(doc, m.sides[1 - me]);
      if (m.status === 'done') { const won = m.winner === me; played.push({ m, won, opp, to: nextGroup(doc, m, won) }); }
      else if (!next) next = { m, opp };
    }
    let group = next ? next.m.group : null;
    if (!group && played.length) group = played[played.length - 1].to;
    return { played, next, group };
  }
  function pathCard() {
    const { cup: c, me, doc } = S.v;
    const eid = me && me.eid;
    if (!doc || !doc.ents || !doc.ents[eid]) return '';
    const p = path(doc, eid);
    const place = (doc.places || {})[eid];
    let rows = p.played.map((x) => {
      const verb = x.m.how === 'bye' ? 'a bye' : x.won ? `beat ${esc(x.opp ? x.opp.name : '')}` : `lost to ${esc(x.opp ? x.opp.name : '')}`;
      const ff = x.m.how === 'noshow' || x.m.how === 'forfeit' || x.m.how === 'double_noshow' ? ' (forfeit)' : '';
      return `<div class="row"><div><b><span class="r">R${x.m.round}</span> &middot; ${verb}${ff}</b><small>${x.opp && !x.opp.bye ? esc(up(x.opp.venue)) + ' &middot; ' : ''}${x.to ? `you move to <em>${esc(groupWords(x.to))}</em>` : x.m.places ? `that's ${ORD(x.won ? x.m.places[0] : x.m.places[1])} place` : ''}</small></div></div>`;
    }).join('');
    if (doc.state === 'running' && p.group) {
      rows += `<div class="row now"><div><b>NOW: ${esc(groupWords(p.group))}</b><small>the bracket you're in</small></div></div>`;
    }
    if (doc.state === 'running' && p.next) {
      const m = p.next.m;
      const t = m.status === 'called' || m.status === 'playing' ? (m.calls || {})[me.loc] : null;
      const at = m.status === 'called' ? "YOU'RE UP" : m.status === 'playing' ? 'PLAYING NOW' : ((doc.rounds || {})[String(m.round)] ? 'WAITING FOR A TABLE' : `ROUND ${m.round}`);
      const opp = p.next.opp;
      rows += `<div class="row lit"><div><b><span class="r">R${m.round}</span> &middot; vs ${esc(opp ? opp.name : 'the winner of their match')}</b><small>${opp && !opp.bye ? esc(up(opp.venue)) + ' &middot; ' : ''}<em>${at}</em>${t ? ` &middot; TABLE ${t}` : ''}${m.local ? ' &middot; at your venue, one table' : ''}</small></div></div>`;
    }
    const best = place ? '' : `<div class="obest">Best you can still finish: <em>${p.group ? ORD(p.group[0]) : '1ST'}</em></div>`;
    const top = place ? `<div class="place">${ORD(place)}</div><div class="line">of ${doc.count} &middot; <b>${esc(c.name)}</b></div>` : '';
    return `${top}<div class="board pth"><div class="rbtitle">YOUR PATH<span class="c">${doc.count} PLAYERS</span></div>${rows || '<div class="row"><div><b>ROUND 1 IS ON</b><small>Your match is coming up.</small></div></div>'}</div>${best}`;
  }
  const wholeBtn = () => `<button class="btn" type="button" id="oWhole">${S.whole ? 'BACK TO YOUR PATH' : 'SEE THE WHOLE CUP'}</button>`;
  function wholeCup() {
    const { doc, me } = S.v;
    if (!doc || !doc.matches) return '<div class="line">The bracket is drawn at the start.</div>';
    const eid = me && me.eid;
    const byRound = {};
    for (const m of Object.values(doc.matches)) (byRound[m.round] = byRound[m.round] || []).push(m);
    let html = '';
    for (const r of Object.keys(byRound).map(Number).sort((a, b) => a - b)) {
      const groups = {};
      for (const m of byRound[r].sort((a, b) => a.order - b.order)) { const k = groupWords(m.group); (groups[k] = groups[k] || []).push(m); }
      html += `<h3>ROUND ${r}</h3><div class="board whole">`;
      for (const [g, list] of Object.entries(groups)) {
        html += `<div class="gt">${esc(g)}</div>`;
        html += list.map((m) => {
          const side = (i) => { const s = sideOf(doc, m.sides[i]); const k = m.status === 'done' ? (m.winner === i ? ' w' : ' l') : ''; return `<div class="s${k}"><span>${esc(s ? s.name : '—')}</span><small>${s && !s.bye ? esc(s.venue) : ''}</small></div>`; };
          return `<div class="mt${(m.sides || []).includes(eid) ? ' me' : ''}">${side(0)}${side(1)}</div>`;
        }).join('');
      }
      html += '</div>';
    }
    if (doc.places) {
      const rows = Object.entries(doc.places).sort((a, b) => a[1] - b[1]).map(([e, p]) => `<div class="row${e === eid ? ' lit' : ''}"><div><b>${ORD(p)} &middot; ${esc(doc.ents[e].name)}</b><small>${esc(doc.ents[e].venue)}</small></div></div>`).join('');
      html = `<h3>FINAL PLACES</h3><div class="board">${rows}</div>` + html;
    }
    return `<div class="whole">${html}</div>`;
  }
  function render() {
    const { cup: c, me, doc } = S.v;
    if (!me || me.spot === 'out' && c.state === 'open') { if (!me) return form(); }
    if (S.whole) { page(head(c) + wholeBtn() + wholeCup()); return; }
    const running = doc && (doc.state === 'running' || doc.state === 'done');
    page(`<h1 class="hl metal">${esc(c.name)}</h1>` + (running && me.eid && doc.ents && doc.ents[me.eid] ? pathCard() : (running ? '' : '') + entryCard()) + (running ? wholeBtn() : ''));
  }
  async function load() {
    try { S.v = await rpc('view'); } catch (e) { page(`<h1 class="hl metal">ONLINE CUP</h1>${errLine(e.message)}`); return false; }
    if (S.v.cup && S.v.cup.kind === 'team') { location.replace(`tcup.html${location.search}`); return false; }   // C5: a team cup's own page
    if (!S.loc && S.v.cup && (S.v.cup.venues || []).length === 1) S.loc = S.v.cup.venues[0].loc;
    render();
    return true;
  }
  async function list() {
    let cups = [], places = [];
    try { cups = (await rpc('list')).cups || []; places = (await rpc('mine')).places || []; } catch (e) { page(`<h1 class="hl metal">ONLINE CUPS</h1>${errLine(e.message)}`); return; }
    const up1 = cups.map((c) => (c.kind === 'team'
      ? `<a class="row" href="tcup.html?c=${encodeURIComponent(c.id)}"><div><b>${esc(c.name)}</b><small>TEAM CUP &middot; teams of ${c.team_size} &middot; ${c.size} venues &middot; ${c.in} in &middot; ${esc(when(c.starts_at))}</small></div></a>`
      : `<a class="row" href="ocup.html?c=${encodeURIComponent(c.id)}"><div><b>${esc(c.name)}</b><small>${esc(gameOf(c))} &middot; ${c.kind} &middot; ${c.size} spots &middot; ${c.in} in &middot; ${esc(when(c.starts_at))}</small></div></a>`)).join('');
    const mine = places.map((p) => `<a class="row" href="ocup.html?c=${encodeURIComponent(p.cup)}"><div><b>${esc(p.title)} &middot; ${esc(p.detail)}</b><small>${esc(p.venue)} &middot; see the bracket</small></div></a>`).join('');
    page('<h1 class="hl metal">ONLINE CUPS</h1>' + `<div class="board"><div class="rbtitle">COMING UP</div>${up1 || '<div class="row"><div><b>NONE RIGHT NOW</b><small>Watch the TV at your venue for the next one.</small></div></div>'}</div>` +
      (mine ? `<div class="board"><div class="rbtitle">MY CUP PLACES</div>${mine}</div>` : ''));
  }
  app.addEventListener('click', (e) => {
    const v = e.target.closest('.vpick button[data-loc]');
    if (v) { S.loc = v.dataset.loc; S.msg = ''; form(); return; }
    if (e.target.closest('#oGo') && !S.busy) { enter(); return; }
    if (e.target.closest('#oWhole')) { S.whole = !S.whole; render(); }
  });
  (async () => {
    if (!cid) { await list(); return; }
    if (!(await load())) return;
    for (;;) {
      await sleep(S.v && S.v.me && (S.v.me.pay === 'checkout' || !S.v.me.pay) ? 2000 : 5000);
      const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
      if (typing || !S.v || !S.v.me) continue;
      try { S.v = await rpc('view'); render(); } catch { /* next time */ }
    }
  })();
})();
