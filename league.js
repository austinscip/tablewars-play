/* C4 LEAGUES on the player site (Austin 2026-11-07 "proceed how u deem necessary"; the plan: the cups page's "Leagues:
   real fixtures over weeks").

   league.html?l=<LEAGUE>          the league: MAKE A TEAM (you are its captain; an online league: pick your venue), its
                                   fee paid on the venue box's own payment page; then MY LEAGUE: the standings, MY TEAM
                                   (the captain: REMOVE, MAKE CAPTAIN, the team link to share), the NEXT FIXTURE (who,
                                   which night, where; a captain: MOVE FIXTURE to another night that week; the other
                                   captain: YES / NO), RESULTS so far.
   league.html?l=<L>&t=<CODE>      the team link: JOIN <the team>
   league.html                     my leagues now and my past seasons ("2ND · TUESDAY LEAGUE · FALL")
   Only the phone's function tw_lg_phone with the public anon key and this phone's profile token (localStorage 'tw.token');
   every request is answered by a venue box (the phone waits for its answer). */
(() => {
  const CFG = window.TW_PLAYER_SITE || {};
  const app = document.getElementById('app');
  const qs = new URLSearchParams(location.search);
  const lid = String(qs.get('l') || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  const code = String(qs.get('t') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const up = (s) => String(s ?? '').toUpperCase();
  const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  const ORD = (n) => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[n % 10] || 'TH')}`;
  const DAY = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const BUG = '<div class="bug"><b><i>TABLE WARS</i></b><span><i>LEAGUE</i></span></div>';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const PLACE = ['1ST', '2ND', '3RD'];
  const S = { v: null, busy: false, loc: null, msg: '', moveFor: null, day: null };
  const token = () => ls.get('tw.token') || '';
  async function rpc(action, args) {
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    let r;
    try {
      r = await fetch(`${url}/rest/v1/rpc/tw_lg_phone`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token() || 'no-token-on-this-phone-yet-000', p_action: action, p_args: { league: lid, ...(args || {}) } }) });
    } catch { const e = new Error("Can't reach Table Wars. Check your phone's internet."); e.offline = true; throw e; }
    let j = null; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) throw new Error((j && j.message) || `Something went wrong (${r.status})`);
    return j;
  }
  const page = (html) => { app.innerHTML = BUG + html; };
  const errLine = (m) => `<div class="msg" role="alert">${esc(m)}</div>`;
  const L = () => (S.v && S.v.view) || {};
  const me = () => (S.v && S.v.me) || null;
  const gameWords = (lg) => (lg.rule === 'one' ? String((lg.game_names || [])[0] || '') : lg.rule === 'mix' ? `MIX: ${(lg.game_names || []).join(', ')}` : 'GAUNTLET: every game');

  // a request answered by a venue box: send it, then wait for the answer (a few seconds)
  async function ask(kind, body) {
    S.busy = true; S.msg = ''; render();
    let id;
    try { id = (await rpc('act', { kind, ...(body || {}) })).id; } catch (e) { S.busy = false; S.msg = e.message; render(); return null; }
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      await sleep(1000);
      let a;
      try { a = await rpc('answer', { id }); } catch { continue; }
      if (a.state === 'new') continue;
      S.busy = false;
      if (a.state === 'refused') { S.msg = (a.answer && a.answer.error) || 'The venue said no.'; await load(); return null; }
      await load();
      return a.answer || {};
    }
    S.busy = false; S.msg = 'The venue has not answered yet. Try again in a minute.'; render();
    return null;
  }

  function head(lg) {
    const fee = Number(lg.fee_cents) || 0;
    const prizes = (lg.prizes || []).map((p, i) => (p ? `<div class="row"><div><b>${PLACE[i]}</b><small>${esc(up(p))}</small></div></div>` : '')).join('');
    const where = lg.scope === 'online' ? `${(S.v.league.venues || []).length} venues, played online` : esc(lg.venue || '');
    return `<h1 class="hl metal">${esc(lg.name || '')}</h1><div class="line">${esc(lg.night_words || '')} &middot; ${lg.weeks} weeks &middot; ${where}</div>` +
      `<div class="line">${esc(gameWords(lg))} &middot; best of 3 &middot; ${lg.per_side === 2 ? '2 vs 2' : '1 vs 1'} &middot; teams of up to ${lg.team_max}</div>` +
      (lg.state === 'signup' ? `<div class="gcard cfee"><div class="for">${fee ? `${money(fee)} A TEAM` : 'FREE TO ENTER'}</div><div class="what">3 points a win. The top ${lg.playoff} play a cup for the title. It covers your fixtures' table time. A league the venue cancels gives the fee back.</div></div>` : '') +
      (prizes ? `<div class="board"><div class="rbtitle">PRIZES</div>${prizes}</div>` : '');
  }

  function table(lg, mine) {
    const rows = lg.standings || [];
    return `<div class="board"><div class="rbtitle">THE STANDINGS${lg.state === 'season' ? ` &middot; WEEK ${lg.week} OF ${lg.weeks}` : ''}</div><div class="lst h"><span>#</span><span>TEAM</span><span>W</span><span>L</span><span>GMS</span><span>PTS</span></div>` +
      rows.map((r) => `<div class="lst${r.id === mine ? ' me' : ''}"><span>${r.place}</span><span>${esc(r.name)}</span><span>${r.w}</span><span>${r.l}</span><span>${r.gw}</span><span class="p">${r.pts}</span></div>`).join('') + '</div>';
  }

  function signUp(lg) {
    if (!S.v.profile) {
      return page(head(lg) + '<div class="gcard"><div class="for">MAKE YOUR PLAYER PROFILE FIRST</div><div class="what">Your team and your seasons live on your profile. It takes a minute.</div></div><a class="btn primary" href="index.html">MAKE MY PROFILE</a>');
    }
    if (lg.state !== 'signup') return page(head(lg) + '<div class="gcard"><div class="for">SIGN-UP IS CLOSED</div><div class="what">The season has started.</div></div>' + table(lg, null));
    if (code) {
      return page(head(lg) + `<div class="gcard"><div class="for">JOIN THE TEAM</div><div class="what">A teammate sent you this link. You play as <b>${esc(S.v.nickname || '')}</b>.</div></div>${S.msg ? errLine(S.msg) : ''}<button class="btn primary" type="button" id="lJoin"${S.busy ? ' disabled' : ''}>${S.busy ? 'JOINING...' : 'JOIN'}</button>`);
    }
    const venues = lg.scope === 'online' ? `<div class="rbtitle" style="border-radius:6px">PICK YOUR VENUE</div><div class="vpick">${(S.v.league.venues || []).map((v) => `<button type="button" data-loc="${esc(v.loc)}" class="${S.loc === v.loc ? 'on' : ''}"><b>${esc(v.venue)}</b><small>Your team plays here</small></button>`).join('')}</div>` : '';
    const teams = (lg.teams || []).map((t) => `<div class="row"><div><b>${esc(t.name)}</b><small>${t.members.length} ${t.members.length === 1 ? 'player' : 'players'}${t.venue && lg.scope === 'online' ? ` &middot; ${esc(t.venue)}` : ''}</small></div></div>`).join('');
    page(head(lg) + venues +
      `<div class="gfield"><label for="lTeam">Your team's name</label><input id="lTeam" maxlength="12" autocomplete="off" placeholder="SHARKS"><small>You are the captain. Your players join with the team's link.</small></div>` +
      `${S.msg ? errLine(S.msg) : ''}<button class="btn primary" type="button" id="lMake"${S.busy || (lg.scope === 'online' && !S.loc) ? ' disabled' : ''}>${S.busy ? 'ONE MOMENT...' : Number(lg.fee_cents) ? `MAKE THE TEAM AND PAY ${money(lg.fee_cents)}` : 'MAKE THE TEAM'}</button>` +
      (teams ? `<div class="board"><div class="rbtitle">TEAMS IN</div>${teams}</div>` : ''));
  }

  function myTeam(lg, m) {
    const t = (lg.teams || []).find((x) => x.id === m.team_id);
    if (!t) return '';
    const cap = m.captain && ['signup', 'season'].includes(lg.state);
    const rows = t.members.map((p) => `<div class="row"><div><b>${esc(p.name)}</b><small>${p.captain ? 'CAPTAIN' : 'PLAYER'}</small></div>${cap && !p.captain ? `<div class="acts"><button class="btn sm" type="button" data-cap="${esc(p.name)}">MAKE CAPTAIN</button><button class="btn sm" type="button" data-rm="${esc(p.name)}">REMOVE</button></div>` : ''}</div>`).join('');
    const link = m.code ? `${location.origin}${location.pathname}?l=${encodeURIComponent(lid)}&t=${encodeURIComponent(m.code)}` : '';
    const fee = Number(lg.fee_cents) || 0;
    let pay = '';
    if (fee && t.refund) pay = `<div class="row"><div><b>${t.refund === 'done' ? 'REFUNDED' : 'REFUND ON ITS WAY'}</b><small>${money(fee)} back</small></div></div>`;
    else if (fee && t.pay === 'paid') pay = `<div class="row"><div><b>PAID ${money(fee)}</b><small>${t.pay_how === 'counter' ? 'At the counter' : 'By phone'}</small></div></div>`;
    else if (fee && t.pay === 'paying') pay = '<div class="row"><div><b>WAITING FOR THE PAYMENT</b><small>This takes a few seconds after you pay.</small></div></div>';
    else if (fee) pay = `<div class="row"><div><b>UNPAID</b><small>${m.captain ? 'Pay on your phone, or at the counter.' : 'The captain pays, on the phone or at the counter.'} An unpaid team can't start a fixture; not paid by the week's end = that fixture is lost.</small></div>${m.captain ? `<div class="acts"><button class="btn sm primary" type="button" id="lPay">PAY ${money(fee)}</button></div>` : ''}</div>`;
    return `<div class="board ros"><div class="rbtitle">MY TEAM &middot; ${esc(t.name)}</div>${rows}${pay}${link && lg.state === 'signup' ? `<div class="row"><div><b>THE TEAM LINK</b><small>Send it to your players: they join with it.</small></div><div class="acts"><button class="btn sm" type="button" id="lShare">SHARE</button></div></div><div class="link" id="lLink">${esc(link)}</div>` : ''}</div>`;
  }

  function nextFixture(lg, m) {
    const fx = (lg.fixtures || []).filter((f) => f.status !== 'done' && f.sides.some((s) => s.id === m.team_id)).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (!fx) return '';
    const s = fx.sides.findIndex((x) => x.id === m.team_id);
    const opp = fx.sides[1 - s];
    const where = lg.scope === 'online' ? `Online, from ${esc(fx.sides[s].venue || '')} against ${esc(opp.venue || '')}` : esc(lg.venue || '');
    let move = '';
    const mv = fx.move;
    if (m.captain && fx.status === 'wait' && lg.state === 'season') {
      if (mv && mv.by !== m.team_id) {
        move = `<div class="row"><div><b>${esc(opp.name)} ASK TO MOVE IT</b><small>To ${esc(DAY(mv.date))}</small></div><div class="acts"><button class="btn sm primary" type="button" data-ans="yes" data-key="${fx.key}">YES</button><button class="btn sm" type="button" data-ans="no" data-key="${fx.key}">NO</button></div></div>`;
      } else if (mv) {
        move = `<div class="row"><div><b>YOU ASKED TO MOVE IT</b><small>To ${esc(DAY(mv.date))}. Waiting for ${esc(opp.name)}'s captain.</small></div></div>`;
      } else if (S.moveFor === fx.key) {
        const days = (L().move_dates || {})[fx.key] || [];
        move = `<div class="rbtitle">MOVE TO WHICH NIGHT?</div><div class="days">${days.map((d) => `<button type="button" data-day="${d}" class="${S.day === d ? 'on' : ''}">${esc(DAY(d))}</button>`).join('') || '<small>No night left this week.</small>'}</div>` +
          `<div class="row"><div><small>The ${esc(opp.name)} captain has to say yes.</small></div><div class="acts"><button class="btn sm primary" type="button" id="lMoveGo" data-key="${fx.key}"${S.day && !S.busy ? '' : ' disabled'}>ASK THEM</button></div></div>`;
      } else {
        move = `<div class="row"><div><small>Can't make it? Move it to another night that week.</small></div><div class="acts"><button class="btn sm" type="button" data-move="${fx.key}">MOVE FIXTURE</button></div></div>`;
      }
    }
    return `<div class="board"><div class="rbtitle">NEXT FIXTURE &middot; WEEK ${fx.week}</div><div class="row"><div><b>${esc(fx.sides[s].name)} VS ${esc(opp.name)}</b><small>${esc(DAY(fx.date))} &middot; ${esc(lg.night_words ? lg.night_words.split(' ').slice(1).join(' ') : '')} &middot; ${where}${fx.date !== fx.orig ? ' &middot; MOVED' : ''}</small></div></div>${move}</div>`;
  }

  function results(lg, m) {
    const done = (lg.fixtures || []).filter((f) => f.status === 'done' && f.sides.some((s) => s.id === m.team_id));
    if (!done.length) return '';
    return `<div class="board"><div class="rbtitle">RESULTS SO FAR</div>${done.map((f) => {
      const s = f.sides.findIndex((x) => x.id === m.team_id);
      const w = f.wins || [0, 0];
      const res = f.how === 'double' ? 'NOT PLAYED 0-0' : f.winner === s ? `WON ${f.how === 'forfeit' ? 'BY FORFEIT' : `${w[s]}-${w[1 - s]}`}` : `LOST ${f.how === 'forfeit' ? 'BY FORFEIT' : `${w[s]}-${w[1 - s]}`}`;
      return `<div class="row"><div><b>WEEK ${f.week} &middot; ${esc(res)}</b><small>vs ${esc(f.sides[1 - s].name)}</small></div></div>`;
    }).join('')}</div>`;
  }

  function myLeague(lg, m) {
    let top = '';
    if (lg.state === 'done') {
      const p = (lg.places || {})[m.team];
      top = `<div class="gcard"><div class="for">${p ? `${ORD(p)} OF ${(lg.teams || []).length}` : 'THE SEASON IS OVER'}</div><div class="what">${esc(m.team)} &middot; ${esc(lg.name)} &middot; ${esc(lg.season || '')}. Champions: <b>${esc(lg.champion_name || '')}</b>.</div></div>`;
    } else if (lg.state === 'cancelled') {
      top = '<div class="gcard"><div class="for">THE LEAGUE WAS CANCELLED</div></div>';
    } else if (lg.state === 'signup') {
      top = `<div class="gcard"><div class="for">YOU'RE IN</div><div class="what"><b>${esc(m.team)}</b> plays from ${esc(DAY(lg.starts))}.</div></div>`;
    }
    page(`<h1 class="hl metal">${esc(lg.name)}</h1><div class="line">${esc(lg.night_words || '')} &middot; ${esc(lg.season || '')}</div>${top}${S.msg ? errLine(S.msg) : ''}` +
      nextFixture(lg, m) + myTeam(lg, m) + (lg.state !== 'signup' ? table(lg, m.team_id) : '') + results(lg, m));
  }

  function render() {
    if (!S.v) return;
    const lg = L();
    if (!lg.name) { page(`<h1 class="hl metal">LEAGUE</h1>${errLine('This league is not on yet. Try again in a minute.')}`); return; }
    const m = me();
    if (m) myLeague(lg, m); else signUp(lg);
    const k = document.getElementById('lTeam');
    if (k && S.keepTeam) k.value = S.keepTeam;
  }
  async function load() {
    try { S.v = await rpc('view'); } catch (e) { page(`<h1 class="hl metal">LEAGUE</h1>${errLine(e.message)}`); return false; }
    render();
    return true;
  }
  async function list() {
    let got;
    try { got = await rpc('mine'); } catch (e) { page(`<h1 class="hl metal">MY LEAGUES</h1>${errLine(e.message)}`); return; }
    const now = (got.leagues || []).map((x) => `<a class="row" href="league.html?l=${encodeURIComponent(x.id)}"><div><b>${esc(x.name)}</b><small>${esc(x.team)}${x.captain ? ' (CAPTAIN)' : ''} &middot; ${esc(x.venue || 'ONLINE')}</small></div></a>`).join('');
    const past = (got.seasons || []).map((p) => `<a class="row" href="league.html?l=${encodeURIComponent(p.league)}"><div><b>${ORD(p.place)} &middot; ${esc(p.title)} &middot; ${esc(String(p.detail || '').split(' ')[0])}</b><small>${esc(p.detail)} &middot; ${esc(p.venue)} &middot; ${p.place} of ${p.of}</small></div></a>`).join('');
    page('<h1 class="hl metal">MY LEAGUES</h1>' + `<div class="board"><div class="rbtitle">THIS SEASON</div>${now || '<div class="row"><div><b>NO LEAGUE RIGHT NOW</b><small>Scan a league poster on a venue TV to make a team.</small></div></div>'}</div>` +
      (past ? `<div class="board"><div class="rbtitle">PAST SEASONS</div>${past}</div>` : ''));
  }

  app.addEventListener('click', async (e) => {
    const t = e.target;
    const v = t.closest('.vpick button[data-loc]');
    if (v) { S.loc = v.dataset.loc; S.keepTeam = (document.getElementById('lTeam') || {}).value || ''; render(); return; }
    if (S.busy) return;
    if (t.closest('#lMake')) {
      const name = (document.getElementById('lTeam') || {}).value || '';
      if (!name.trim()) { S.msg = "Type your team's name."; render(); return; }
      S.keepTeam = name;
      const a = await ask('make_team', { name: name.trim(), loc: S.loc });
      if (a && a.url) { location.href = a.url; return; }
      return;
    }
    if (t.closest('#lJoin')) { const a = await ask('join', { code }); if (a) history.replaceState(null, '', `league.html?l=${encodeURIComponent(lid)}`); return; }
    if (t.closest('#lPay')) { const a = await ask('pay', {}); if (a && a.url) location.href = a.url; return; }
    const rm = t.closest('[data-rm]');
    if (rm) { await ask('remove', { who: rm.dataset.rm }); return; }
    const cp = t.closest('[data-cap]');
    if (cp) { await ask('captain', { who: cp.dataset.cap }); return; }
    const mv = t.closest('[data-move]');
    if (mv) { S.moveFor = mv.dataset.move; S.day = null; render(); return; }
    const dy = t.closest('.days button[data-day]');
    if (dy) { S.day = dy.dataset.day; render(); return; }
    const go = t.closest('#lMoveGo');
    if (go && S.day) { await ask('move', { key: go.dataset.key, date: S.day }); S.moveFor = null; S.day = null; render(); return; }
    const an = t.closest('[data-ans]');
    if (an) { await ask('move_answer', { key: an.dataset.key, yes: an.dataset.ans === 'yes' }); return; }
    if (t.closest('#lShare')) {
      const link = (document.getElementById('lLink') || {}).textContent || '';
      try { if (navigator.share) await navigator.share({ title: 'Join my team', url: link }); else await navigator.clipboard.writeText(link); S.msg = ''; } catch { /* the link is on the page */ }
    }
  });
  (async () => {
    if (!lid) { await list(); return; }
    if (!(await load())) return;
    for (;;) {
      await sleep(5000);
      const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
      if (typing || S.busy || S.moveFor) continue;
      try { S.v = await rpc('view'); render(); } catch { /* next time */ }
    }
  })();
})();
