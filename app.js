/* THE PLAYER SITE (docs/specs/player-profiles.md 3.1): a seat card's QR opens <site>/s/<CODE>?seat=S on any internet
   (mobile data is fine; no venue Wi-Fi). The SAME screens and behaviour as the venue page /me (landing.js, one
   source): PLAY AS NICK? / MAKE A PROFILE or PLAY AS A GUEST / YOU'RE IN / E1 that seat isn't playing / E2 taken /
   E4 Not NICK? / E12 under 13 / E13 signed in elsewhere. It asks the cloud's phone function tw_pf_phone
   ('lobby', 'view', 'make', 'checkin', 'leave') with the public anon key (config.js).

   The phone keeps its token here (localStorage 'tw.token'); the cloud keeps only its hash. A phone with a token
   but no profile yet is a new phone. A link with no seat (an older TV) shows TAP YOUR COLOUR.
   /link#t=<token> (CARRY MY PROFILE on a venue page) keeps that profile on this phone. */
(() => {
  const $ = (id) => document.getElementById(id);
  const L = window.TWLanding;
  const CFG = window.TW_PLAYER_SITE || {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private window */ } },
  };
  const COLORS = ['BLUE', 'PINK', 'GOLD', 'GREEN', 'PURPLE', 'ORANGE', 'CYAN', 'RED'];
  const GEM = 'art/rubygold-gem-ruby-diamond.webp';
  const qs = new URLSearchParams(location.search);
  const path = location.pathname.match(/\/s\/([A-Za-z0-9]{4,12})\/?$/);
  const code = ((path && path[1]) || qs.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const isLink = /\/link\/?$/.test(location.pathname);
  let seatQ = (() => { const v = Number(qs.get('seat')); return v >= 1 && v <= 8 ? Math.floor(v) : null; })();

  const newToken = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
  let token = ls.get('tw.token');
  if (!token || token.length < 32) { token = newToken(); ls.set('tw.token', token); }

  // E4: the profiles this phone knows: [{t, n}], newest first
  function knownAll() { try { const k = JSON.parse(ls.get('tw.known') || '[]'); return Array.isArray(k) ? k.filter((x) => x && x.t) : []; } catch { return []; } }
  function remember(t, n) { if (!t || !n) return; ls.set('tw.known', JSON.stringify([{ t, n }, ...knownAll().filter((x) => x.t !== t)].slice(0, 4))); }
  const others = () => knownAll().filter((x) => x.t !== token);

  async function rpc(action, args, tok = token) {
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    let r;
    try {
      r = await fetch(`${url}/rest/v1/rpc/tw_pf_phone`, {
        method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: tok, p_action: action, p_args: args || {} }),
      });
    } catch { const e = new Error('offline'); e.offline = true; throw e; }
    let j = null; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) { const e = new Error((j && j.message) || `Something went wrong (${r.status})`); e.code = j && j.code; throw e; }
    return j;
  }

  let lob = null;           // 'lobby': {venue, table, slug, seats [{seat, color, nickname}], me}
  let mine = null;          // 'view': this phone's profile (with seat {code, seat, venue, table}) or null
  let gone = false;         // the code is over (E1)
  let lastMsg = null, landArmed = false, view = null;
  const nick = () => (mine && mine.profile && mine.profile.nickname) || (lob && lob.me && lob.me.nickname) || '';

  async function load() {
    gone = false;
    try { lob = await rpc('lobby', { code }); }
    catch (e) { if (e.offline) throw e; lob = null; gone = true; }
    mine = null;
    if (lob && lob.me) {
      try { mine = await rpc('view', {}); remember(token, nick()); } catch (e) { if (e.offline) throw e; mine = null; }
    }
  }
  const seatRow = () => (lob && lob.seats || []).find((s) => Number(s.seat) === seatQ) || null;
  const ctx = (extra) => ({ venue: (lob && lob.venue) || '', table: lob ? lob.table : null, seat: seatQ,
    color: (seatRow() && seatRow().color) || COLORS[(seatQ || 1) - 1], nick: nick(), gem: GEM, card: false, msg: null, ...extra });

  const S = {};
  S.seat = async () => {
    const m = lastMsg; lastMsg = null;
    // a seat a puck just joined reaches the cloud within a pass of the venue box: ask again before saying E1
    for (let i = 0; i < 3 && lob && !gone && !seatRow(); i++) { await new Promise((r) => setTimeout(r, 1500)); await load(); }
    const c = ctx({ msg: m });
    if (gone || !seatRow()) { view = 'stale'; return L.screens.stale(c); }
    const at = mine && mine.seat;
    if (at && at.code === code && Number(at.seat) === seatQ) { view = 'in'; return L.screens.in({ ...c, armed: landArmed }); }
    if (seatRow().nickname) { view = 'taken'; return L.screens.taken({ ...c, other: seatRow().nickname }); }
    if (mine) {
      view = 'known';
      return L.screens.known({ ...c, elsewhere: at ? { table: at.table, venue: at.venue, color: COLORS[(Number(at.seat) || 1) - 1] } : null });
    }
    view = 'fresh';
    return L.screens.fresh(c);
  };
  S.tap = () => {
    if (gone || !lob) { view = 'stale'; return L.screens.stale(ctx({})); }
    view = 'tap';
    return L.screens.tap(ctx({ seats: lob.seats, msg: lastMsg }));
  };
  S.notme = () => { view = 'notme'; return L.screens.notme(ctx({ backTo: 'seat', known: others().map((k) => ({ nick: k.n })) })); };
  S.guest = () => { view = 'guest'; return L.screens.guest(ctx({})); };
  S.make = () => { view = 'make'; return L.screens.make(ctx({ backTo: mine ? 'notme' : 'seat', guest: true })); };

  function go(screen) { if (location.hash !== `#${screen}`) location.hash = screen; else render(); }
  async function render() {
    let name = (location.hash || '').replace(/^#/, '');
    if (!S[name] || (name === 'notme' && !mine)) name = seatQ ? 'seat' : 'tap';
    if (!seatQ && name !== 'tap') name = 'tap';
    if (name !== 'seat') landArmed = false;
    view = null;
    const html = await S[name]();
    $('app').innerHTML = html;
    $('app').dataset.screen = name;
    $('app').dataset.view = view || name;
    if (name === 'make') L.wireMake(document);
    document.title = `${name === 'guest' ? 'GUEST' : (name === 'make' ? 'NEW PROFILE' : 'SIGN IN')} · Table Wars`;
    window.__site = { screen: name, view: view || name, lob, mine };
  }
  function off(title, text) {
    $('app').innerHTML = L.screens.off({ title, text });
    $('app').dataset.screen = 'off'; $('app').dataset.view = 'off';
    window.__site = { screen: 'off', view: 'off' };
  }
  const unreachable = () => off("CAN'T REACH TABLE WARS", "Check your phone's internet, then scan again. You can still play with your puck.");

  async function sitHere() {
    try { await rpc('checkin', { code, seat: seatQ }); }
    catch (e) { if (e.offline) { unreachable(); return; } }
    try { await load(); } catch { unreachable(); return; }
    if (location.hash === '#seat') render(); else location.hash = 'seat';
  }

  async function makeProfile() {
    const err = $('mk_err'); err.textContent = '';
    // Not NICK?: the new profile gets its own token; NICK stays on this phone (E4)
    const tok = mine ? newToken() : token;
    try {
      const v = await rpc('make', { code, nickname: $('mk_ini').value, age_ok: $('mk_age').checked }, tok);
      token = tok; ls.set('tw.token', token);
      remember(token, v && v.profile && v.profile.nickname);
    } catch (e) { err.textContent = e.offline ? "Can't reach Table Wars. Check your phone's internet." : e.message; return; }
    await sitHere();                       // MAKE sits the QR's seat directly (taken meanwhile: E2 shows)
  }

  document.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button, .tap');
    if (landArmed && !(t && t.id === 'lLeave')) { landArmed = false; render(); if (!t) return; }
    if (!t) return;
    const d = t.dataset;
    if (d.go) { ev.preventDefault(); go(d.go === 'card' ? 'seat' : d.go); return; }
    if (d.seat) {                         // TAP YOUR COLOUR (a link with no seat)
      seatQ = Number(d.seat);
      const u = new URL(location.href); u.searchParams.set('seat', String(seatQ)); u.hash = 'seat';
      history.replaceState(null, '', u.toString());
      render(); return;
    }
    if (t.id === 'lPlay') { t.disabled = true; sitHere(); return; }
    if (t.id === 'mk_go') { makeProfile(); return; }
    if (t.id === 'lGuest') { go('guest'); return; }
    if (t.id === 'lRetry') { try { await load(); } catch { unreachable(); return; } render(); return; }
    if (t.id === 'lLeave') {
      if (!landArmed) { landArmed = true; render(); return; }
      landArmed = false;
      try { await rpc('leave', {}); lastMsg = { text: 'You left the seat.', ok: true }; } catch (e) { lastMsg = { text: e.message, ok: false }; }
      try { await load(); } catch { unreachable(); return; }
      render(); return;
    }
    if (d.switch) {                       // E4: play as another profile this phone knows
      const k = others()[Number(d.switch)];
      if (k) { token = k.t; ls.set('tw.token', token); try { await load(); } catch { unreachable(); return; } go('seat'); }
    }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.id === 'mk_ini' && $('mk_age').checked) makeProfile(); });
  window.addEventListener('hashchange', () => { if (code) render(); });

  (async () => {
    if (!/^https?:\/\//.test(String(CFG.supabaseUrl || '')) || !CFG.anonKey || /YOUR-/.test(`${CFG.supabaseUrl}${CFG.anonKey}`)) {
      off('NOT SET UP YET', 'This page needs its cloud address. Play with your puck.'); return;
    }
    if (isLink) {                         // CARRY MY PROFILE: the token rides the part of the address never sent
      const t = new URLSearchParams((location.hash || '').replace(/^#/, '')).get('t') || '';
      history.replaceState(null, '', location.pathname);
      if (t.length >= 32) {
        try {
          const v = await rpc('view', {}, t);
          token = t; ls.set('tw.token', token); remember(t, v.profile && v.profile.nickname);
          off(`HI ${String((v.profile && v.profile.nickname) || '').toUpperCase()}`, 'Your profile is on this phone now. Scan your seat card on any Table Wars TV.');
        } catch (e) { if (e.offline) unreachable(); else off("THAT LINK DIDN'T WORK", 'Open MY CARD on the venue page and tap KEEP again.'); }
        return;
      }
      off('SCAN YOUR SEAT CARD', 'Hold your puck to join, then scan your seat card on the TV.'); return;
    }
    if (!code) { off('SCAN YOUR SEAT CARD', 'Hold your puck to join, then scan your seat card on the TV.'); return; }
    try { await load(); } catch { unreachable(); return; }
    await render();
  })();
})();
