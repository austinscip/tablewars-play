/* THE PLAYER SITE (docs/specs/player-profiles.md 3.1): a seat card's QR opens <site>/s/<CODE>?seat=S on any internet
   (mobile data is fine; no venue Wi-Fi). The SAME screens and behaviour as the venue page /me (landing.js, one
   source): PLAY AS NICK? / MAKE A PROFILE or PLAY AS A GUEST / YOU'RE IN / E1 that seat isn't playing / E2 taken /
   E4 Not NICK? / E12 under 13 / E13 signed in elsewhere. It asks the cloud's phone function tw_pf_phone
   ('lobby', 'view', 'make', 'checkin', 'leave') with the public anon key (config.js).

   The phone keeps its token here (localStorage 'tw.token'); the cloud keeps only its hash. A phone with a token
   but no profile yet is a new phone. A link with no seat (an older TV) shows TAP YOUR COLOUR.
   /link#t=<token> (CARRY MY PROFILE on a venue page) keeps that profile on this phone.

   W46 "I ALREADY HAVE A PROFILE": Supabase Auth's email code, straight from the phone (the REST calls supabase-js
   makes: /auth/v1/otp then /auth/v1/verify, type email; the publishable key; works on mobile data), then
   tw_pf_auth with the player's own session: check, signin (this phone's new token), make (with the email).

   W46 MY CARD on the player site (mobile data is the main path): MY CARD, FRIENDS, ADD A FRIEND (the friend QR,
   drawn here by qrcode.js), INVITES, INVITE, SETTINGS (rename, the email by code, home venue, sign out, FORGET ME):
   card.js, the same screens as /me, over tw_pf_phone's own actions. /f/<CODE> (a friend QR) asks that friend. */
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
  const fpath = location.pathname.match(/\/f\/([A-Za-z0-9]{6,12})\/?$/);
  let friendCode = ((fpath && fpath[1]) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
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

  // W46 Supabase Auth (the email code) and tw_pf_auth with the player's own session
  async function authPost(path, body) {
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    let r;
    try {
      r = await fetch(`${url}/auth/v1/${path}`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch { const e = new Error("Can't reach Table Wars. Check your phone's internet."); e.why = 'offline'; throw e; }
    let j = {}; try { j = await r.json(); } catch { /* */ }
    if (r.ok) return j;
    const e = new Error(r.status === 429 ? 'Too many codes for now. Wait a little, then RESEND.'
      : (path === 'verify' && r.status < 500 ? "That code isn't right." : (r.status < 500 ? "That email doesn't look right." : "Can't send email codes right now.")));
    e.why = r.status === 429 ? 'rate' : (path === 'verify' && r.status < 500 ? 'bad_code' : (r.status < 500 ? 'bad_email' : 'offline'));
    throw e;
  }
  async function rpcAuth(session, action, args, tok = token) {
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    let r;
    try {
      r = await fetch(`${url}/rest/v1/rpc/tw_pf_auth`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: tok, p_action: action, p_args: args || {} }) });
    } catch { const e = new Error("Can't reach Table Wars. Check your phone's internet."); e.offline = true; throw e; }
    let j = null; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) { const e = new Error((j && j.message) || `Something went wrong (${r.status})`); e.code = j && j.code; throw e; }
    return j;
  }
  const EF = L.EmailFlow({
    send: (email) => authPost('otp', { email, create_user: true }),
    verify: async (email, code) => {
      const v = await authPost('verify', { type: 'email', email, token: code });
      const chk = await rpcAuth(v.access_token, 'check', {}, null);
      return { session: v.access_token, profile: chk && chk.profile, email: chk && chk.email };
    },
  }, Number(CFG.otpSeconds) || 3600);
  L.tickResend(document, EF);
  let mailDraft = '';

  let lob = null;           // 'lobby': {venue, table, slug, seats [{seat, color, nickname}], me}
  let mine = null;          // 'view': this phone's profile (with seat {code, seat, venue, table}) or null
  let gone = false;         // the code is over (E1)
  let lastMsg = null, landArmed = false, view = null;
  const nick = () => (mine && mine.profile && mine.profile.nickname) || (lob && lob.me && lob.me.nickname) || '';

  // C3: this profile's ONLINE CUP places ("17TH OF 64 · FRIDAY 9 PM CUP"), each one opens its bracket (ocup.html);
  // a cloud without the online cup's SQL simply has none
  async function cupPlaces() {
    if (!mine) return;
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    try {
      const r = await fetch(`${url}/rest/v1/rpc/tw_ocup_phone`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token, p_action: 'mine', p_args: {} }) });
      mine.cups = r.ok ? ((await r.json()).places || []) : [];
    } catch { mine.cups = []; }
    // C4: this profile's past league seasons ("2ND · TUESDAY LEAGUE · FALL"); a cloud without the league SQL has none
    try {
      const r2 = await fetch(`${url}/rest/v1/rpc/tw_lg_phone`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token, p_action: 'mine', p_args: {} }) });
      mine.seasons = r2.ok ? ((await r2.json()).seasons || []) : [];
    } catch { mine.seasons = []; }
  }

  async function load() {
    gone = false;
    if (!code) {                          // MY CARD with no seat QR (a friend QR, a saved page): the profile alone
      lob = null; mine = null;
      try { mine = await rpc('view', {}); remember(token, nick()); } catch (e) { if (e.offline) throw e; mine = null; }
      await cupPlaces();
      return;
    }
    try { lob = await rpc('lobby', { code }); }
    catch (e) { if (e.offline) throw e; lob = null; gone = true; }
    mine = null;
    if (lob && lob.me) {
      try { mine = await rpc('view', {}); remember(token, nick()); } catch (e) { if (e.offline) throw e; mine = null; }
      await cupPlaces();
    }
  }
  const seatRow = () => (lob && lob.seats || []).find((s) => Number(s.seat) === seatQ) || null;
  const ctx = (extra) => ({ venue: (lob && lob.venue) || '', table: lob ? lob.table : null, seat: seatQ,
    color: (seatRow() && seatRow().color) || COLORS[(seatQ || 1) - 1], nick: nick(), gem: GEM, card: !!mine, msg: null,
    tag: (mine && mine.profile && mine.profile.tag) || (lob && lob.me && lob.me.tag) || null, email: true, ...extra });

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
  S.make = () => {
    view = 'make';
    const locked = !!(EF.session && !EF.found);
    return L.screens.make(ctx({ backTo: mine ? 'notme' : 'seat', guest: true, mail: locked ? EF.email : mailDraft, mailLocked: locked }));
  };
  // W46 the email screens
  const ef = (extra) => ctx({ msg: EF.msg, purpose: EF.purpose, hint: EF.hint, wait: EF.wait(), locked: EF.locked, found: EF.found, ...extra });
  S.email = () => {
    view = 'email';
    const c = ef({ backTo: ({ make: 'make', attach: 'settings' })[EF.purpose] || 'seat', mail: mailDraft || EF.email, had: !!(mine && mine.profile && mine.profile.email) });
    EF.msg = null; return L.screens.email(c);
  };
  S.code = () => {
    if (!EF.sentAt) return S.email();
    view = 'code';
    const c = ef({ backTo: 'email', goWord: ({ make: 'MAKE MY PROFILE', attach: 'SAVE MY EMAIL' })[EF.purpose] || 'SIGN IN' });
    EF.msg = null; return L.screens.code(c);
  };
  S.nomail = () => { view = 'nomail'; return L.screens.nomail(ef({ backTo: 'email' })); };
  S.hasmail = () => { view = 'hasmail'; return L.screens.hasmail(ef({ backTo: 'make' })); };

  // W46 MY CARD (card.js: the same screens as /me)
  const C = window.TWCard;
  const COLORS_OF = (n) => COLORS[((Number(n) || 1) - 1) % 8];
  const cs = { armed: null, undo: null, editing: null, showAll: false, moreGames: false, picked: null, pickedFmt: null, screenFrom: {} };
  const TABBED = { card: 'MY CARD', friends: 'FRIENDS', settings: 'SETTINGS' };
  const CARD = ['card', 'friends', 'add', 'invites', 'invite', 'settings', 'rivals', 'bests'];
  const say = (text, ok) => { lastMsg = { text, ok: !!ok }; const m = document.querySelector('.msg'); if (m) { m.textContent = text; m.classList.toggle('ok', !!ok); } };
  const msgLine = () => { const m = lastMsg; lastMsg = null; return `<p class="msg${m && m.ok ? ' ok' : ''}" role="status">${m ? L.esc(m.text) : ''}</p>`; };
  function friendQR(fc) {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(new URL(`f/${fc}`, document.baseURI).href);
      q.make();
      return q.createDataURL(6, 2);
    } catch { return null; }
  }
  const kc = () => {
    const p = (mine && mine.profile) || {};
    const at = mine && mine.seat;
    return { nick: p.nickname || '', tag: p.tag, venue: p.venue || '', seat: at ? { table: at.table, color: COLORS_OF(at.seat) } : null,
      cv: mine, mine: { ...C.fromView(mine), cups: (mine && mine.cups) || [] }, online: true, error: null, friendCode, email: p.email || null, emailOn: true,
      qr: p.friend_code ? friendQR(p.friend_code) : null, tile: (t) => `tiles/${t}.jpg`, gem: GEM, formats: window.TW_FORMATS || {},
      s: cs, msgLine, signIn: code && seatQ ? 'seat' : null, more: null, stamp: `Version ${L.STAMP}` };
  };
  for (const n of CARD) S[n] = (arg) => C.screens[n](kc(), arg);
  S.none = () => L.screens.off({ title: 'SCAN YOUR SEAT CARD', text: friendCode
    ? 'Make a profile first: hold your puck to join, then scan your seat card on the TV. Then scan the friend QR again.'
    : 'Hold your puck to join, then scan your seat card on the TV.' });
  async function reloadMine() {
    try { mine = await rpc('view', {}); } catch (e) { if (e.offline) throw e; mine = null; }
    await cupPlaces();
  }
  const cio = {
    act: async (action, args, okMsg) => {
      try { mine = await rpc(action, args); say(okMsg || 'Sent.', true); await render(); return true; }
      catch (e) { say(e.offline ? "Can't reach Table Wars. Check your phone's internet." : e.message); return false; }
    },
    go: (x) => go(x), render: () => render(), say: (t, ok) => say(t, ok),
    reload: async () => { try { await reloadMine(); } catch { /* the next tap says it */ } await render(); },
    saveNick: async (v) => { mine = await rpc('nickname', { nickname: v }); remember(token, nick()); },
    standUp: async () => { mine = await rpc('leave', {}); },
    forgetNow: async () => {
      await rpc('forget', {});
      ls.set('tw.known', JSON.stringify(knownAll().filter((x) => x.t !== token)));
      token = newToken(); ls.set('tw.token', token); mine = null;
      try { await load(); } catch { /* */ }
      lastMsg = { text: 'Your profile is gone. Nothing of it is kept.', ok: true };
      go(code && seatQ ? 'seat' : 'none');
    },
    emailEdit: () => { EF.start('attach'); mailDraft = ''; go('email'); },
    codeUsed: () => { friendCode = ''; },
  };

  function go(screen) { if (location.hash !== `#${screen}`) location.hash = screen; else render(); }
  const SEATISH = ['seat', 'notme', 'guest', 'make', 'email', 'code', 'nomail', 'hasmail', 'tap'];
  let screenNow = null;
  async function render() {
    let [name, arg] = (location.hash || '').replace(/^#/, '').split('/');
    const attach = ['email', 'code'].includes(name) && EF.purpose === 'attach';
    if ((CARD.includes(name) || attach) && !mine) name = '';
    if (!S[name] || (name === 'notme' && !mine)) name = code ? (seatQ ? 'seat' : 'tap') : (mine ? (friendCode ? 'friends' : 'card') : 'none');
    if (SEATISH.includes(name) && !attach) {
      if (!code) name = mine ? 'card' : 'none';
      else if (!seatQ && name !== 'tap') name = 'tap';
    }
    if (name !== 'seat') landArmed = false;
    if (screenNow !== name) {
      cs.armed = null; cs.editing = null; cs.showAll = false; cs.moreGames = false;
      // a MY CARD page opens with fresh friends and invites (mobile data: one small call)
      if (['card', 'friends', 'invites', 'add', 'rivals', 'bests'].includes(name) && mine) { try { await reloadMine(); } catch { /* the cached view */ } }
    }
    if (name === 'add' && screenNow && screenNow !== 'add') cs.screenFrom.add = ['card', 'friends'].includes(screenNow) ? screenNow : 'friends';
    screenNow = name;
    view = null;
    const html = await S[name](arg);
    if (screenNow !== name) return;
    $('app').className = `pg${TABBED[name] ? ' tabbed' : ''}`;
    $('tabs').hidden = !TABBED[name];
    if (TABBED[name]) for (const a of $('tabs').querySelectorAll('a')) a.classList.toggle('on', a.dataset.tab === name);
    $('app').innerHTML = html;
    $('app').dataset.screen = name;
    $('app').dataset.view = view || name;
    if (name === 'make') L.wireMake(document);
    document.title = `${TABBED[name] || (name === 'guest' ? 'GUEST' : (name === 'make' ? 'NEW PROFILE' : ({ add: 'ADD A FRIEND', invites: 'INVITES', invite: 'INVITE', rivals: 'RIVALS', bests: 'BESTS' })[name] || 'SIGN IN'))} · Table Wars`;
    const ci = $('cd_in'); if (ci && !ci.disabled) ci.focus();
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

  // W46 MAKE with an email: the code first (an email that has a profile: sign in instead), then make + the email
  async function makeProfile() {
    const err = $('mk_err'); err.textContent = '';
    const mail = (($('mk_email') && $('mk_email').value) || '').trim();
    const pending = { nickname: $('mk_ini').value, age_ok: $('mk_age').checked };
    if (mail && !(EF.session && EF.email === mail.toLowerCase())) {
      mailDraft = mail;
      EF.start('make', pending);
      try { await EF.send(mail); } catch (e) { err.textContent = e.message; return; }
      go('code'); return;
    }
    await doMake(pending, mail ? EF.session : null);
  }
  async function doMake(pending, session) {
    const err = $('mk_err');
    const fail = (t) => { if (err) err.textContent = t; else { lastMsg = { text: t, ok: false }; go('make'); } };
    // Not NICK?: the new profile gets its own token; NICK stays on this phone (E4)
    const tok = mine ? newToken() : token;
    try {
      const a = { code, nickname: pending.nickname, age_ok: pending.age_ok };
      const v = session ? await rpcAuth(session, 'make', a, tok) : await rpc('make', a, tok);
      if (session) { EF.start('signin'); mailDraft = ''; }
      token = tok; ls.set('tw.token', token);
      remember(token, v && v.profile && v.profile.nickname);
    } catch (e) {
      if (session && e.code === '23505') { go('hasmail'); return; }
      fail(e.offline ? "Can't reach Table Wars. Check your phone's internet." : e.message); return;
    }
    await sitHere();                       // MAKE sits the QR's seat directly (taken meanwhile: E2 shows)
  }

  // W46 this phone signs in to the email's profile: a new token, linked in the cloud by the checked session
  async function emailSignin() {
    const tok = newToken();
    try {
      const v = await rpcAuth(EF.session, 'signin', {}, tok);
      token = tok; ls.set('tw.token', token);
      remember(token, v && v.profile && v.profile.nickname);
    } catch (e) {
      if (e.code === 'P0002') { go('nomail'); return; }
      EF.say(e.offline ? "Can't reach Table Wars. Check your phone's internet." : e.message); render(); return;
    }
    EF.start('signin'); mailDraft = '';
    await sitHere();                       // sign-in sits the QR's seat, like PLAY
  }
  async function afterCode() {
    if (EF.purpose === 'attach') {       // MY CARD's email: an email on another profile says so; a free one is saved
      try { mine = await rpcAuth(EF.session, 'attach', {}); EF.start('signin'); say('Email saved.', true); go('settings'); }
      catch (e) { EF.say(e.code === '23505' ? 'That email already has a profile. Use another one.' : e.message); EF.sentAt = 0; go('email'); }
      return;
    }
    if (EF.purpose === 'make') { if (EF.found) go('hasmail'); else await doMake(EF.pending, EF.session); return; }
    if (EF.found) await emailSignin(); else go('nomail');
  }

  document.addEventListener('click', async (ev) => {
    // the tabs: the page has a <base> (the site's folder), so a plain #hash link would leave /s/<CODE>
    const tab = ev.target.closest('a[data-tab]');
    if (tab) { ev.preventDefault(); go(tab.dataset.tab); return; }
    const t = ev.target.closest('button, .tap');
    if (landArmed && !(t && t.id === 'lLeave')) { landArmed = false; render(); if (!t) return; }
    if (C.disarm(t, cs)) { cs.armed = null; render(); if (!t) return; }
    if (!t) return;
    const d = t.dataset;
    if (d.go) { ev.preventDefault(); go(d.go); return; }
    if (CARD.includes(screenNow) && await C.click(t, kc(), cio)) return;
    if (d.seat) {                         // TAP YOUR COLOUR (a link with no seat)
      seatQ = Number(d.seat);
      const u = new URL(location.href); u.searchParams.set('seat', String(seatQ)); u.hash = 'seat';
      history.replaceState(null, '', u.toString());
      render(); return;
    }
    if (t.id === 'lPlay') { t.disabled = true; sitHere(); return; }
    if (t.id === 'mk_go') { makeProfile(); return; }
    if (t.id === 'lHave') { EF.start('signin'); mailDraft = ''; go('email'); return; }
    if (t.id === 'emSend') {
      mailDraft = $('em_in').value.trim();
      try { await EF.send(mailDraft); go('code'); } catch (e) { EF.say(e.message); render(); }
      return;
    }
    if (t.id === 'cdGo') {
      t.disabled = true;
      try { await EF.verify($('cd_in').value); } catch { render(); return; }
      await afterCode(); return;
    }
    if (t.id === 'cdResend') {
      try { await EF.send(EF.email); EF.say('A new code is on its way.', true); } catch (e) { EF.say(e.message); }
      render(); return;
    }
    if (t.id === 'cdOther') { mailDraft = ''; Object.assign(EF, { email: '', sentAt: 0, session: null, found: null, msg: null }); go('email'); return; }
    if (t.id === 'nmMake') { mailDraft = EF.email; go('make'); return; }
    if (t.id === 'hmSignin') { emailSignin(); return; }
    if (t.id === 'hmNoMail') { const p = EF.pending; EF.start('signin'); mailDraft = ''; if (p) await doMake(p, null); else go('make'); return; }
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
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    if (ev.target.id === 'mk_ini' && $('mk_age').checked) makeProfile();
    if (ev.target.id === 'em_in') { const b = $('emSend'); if (b) b.click(); }
    if (ev.target.id === 'cd_in') { const b = $('cdGo'); if (b && !b.disabled) b.click(); }
  });
  window.addEventListener('hashchange', () => render());
  // countdowns on the thing that will happen (NO THANKS, waiting), and invites and friends arrive by themselves (as /me)
  setInterval(() => { for (const el of document.querySelectorAll('[data-left]')) el.textContent = C.left(el.dataset.left); }, 1000);
  setInterval(async () => {
    if (!['card', 'friends', 'invites'].includes(screenNow) || document.hidden || cs.armed || cs.undo) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    try { await reloadMine(); } catch { return; }
    render();
  }, 8000);

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
    if (!code) history.replaceState(null, '', location.pathname.replace(/f\/[A-Za-z0-9]+\/?$/, '') + location.hash);
    try { await load(); } catch { unreachable(); return; }
    await render();
  })();
})();
