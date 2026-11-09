/* C5 THE TEAM CUP on the player site (Austin 2026-11-08: "yes" to the plan's TEAM CUP picks; the plan: the cups
   page's "TEAM CUP: one venue's team of 2 or 4 ..." step A, YOUR PATH).

   tcup.html?c=<CUP>[&v=<VENUE>]   no team yet: PICK YOUR VENUE (each venue's team, or none yet), the team's name, I PAY
                                   IT ALL or SPLIT IT, MAKE THE TEAM -> the venue box's own payment page
   tcup.html?c=<CUP>&j=<LINK>      a teammate's link: JOIN <TEAM> as a player (your share's payment page on a split
                                   team) or as a sub
   on a team                       THE TEAM (players, subs, each share, the link to send), PAY MY SHARE / PAY THE FEE,
                                   the captain's TONIGHT'S LINE-UP (a sub steps in up to the start of each round),
                                   CHECK IN AT THE TV; once it runs YOUR PATH; after: the team's place
   Phones never write a team: each change is an ASK (tw_tcup_phone 'act') the team's venue box answers; the page waits
   for the answer. Only the phone's function with the public anon key and this phone's profile token ('tw.token'). */
(() => {
  const CFG = window.TW_PLAYER_SITE || {};
  const app = document.getElementById('app');
  const qs = new URLSearchParams(location.search);
  const cid = String(qs.get('c') || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  const join = String(qs.get('j') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const up = (s) => String(s ?? '').toUpperCase();
  const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  const ORD = (n) => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[n % 10] || 'TH')}`;
  const when = (ts) => new Date(ts * 1000).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const hhmm = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const BUG = '<div class="bug"><b><i>TABLE WARS</i></b><span><i>TEAM CUP</i></span></div>';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const PLACE = ['1ST', '2ND', '3RD'];
  const S = { v: null, busy: false, loc: qs.get('v') || null, split: false, msg: '', good: '' };
  const token = () => ls.get('tw.token') || '';
  async function rpc(action, args) {
    const url = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
    let r;
    try {
      r = await fetch(`${url}/rest/v1/rpc/tw_tcup_phone`, { method: 'POST', cache: 'no-store',
        headers: { apikey: CFG.anonKey, Authorization: `Bearer ${CFG.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token() || 'no-token-on-this-phone-yet-000', p_action: action, p_args: { cup: cid, ...(args || {}) } }) });
    } catch { const e = new Error("Can't reach Table Wars. Check your phone's internet."); e.offline = true; throw e; }
    let j = null; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) throw new Error((j && j.message) || `Something went wrong (${r.status})`);
    return j;
  }
  // an ask: the team's venue box answers it within a few seconds
  async function ask(kind, body) {
    const { id } = await rpc('act', { kind, ...(body || {}) });
    for (let i = 0; i < 40; i++) {
      await sleep(750);
      const a = await rpc('answer', { id });
      if (a.state === 'done') return a.answer || {};
      if (a.state === 'refused') throw new Error((a.answer && a.answer.error) || 'The venue said no');
    }
    throw new Error("The venue's box has not answered yet. Try again in a minute.");
  }
  const page = (html) => { app.innerHTML = BUG + html; };
  const errLine = (m) => `<div class="msg" role="alert">${esc(m)}</div>`;
  const goodLine = (m) => `<div class="msg good" role="status">${esc(m)}</div>`;
  const gameOf = (g) => String(g || '').replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase());

  function head(c) {
    const fee = Number(c.fee_cents) || 0;
    const n = c.team_size || 4;
    const games = c.mixed ? (c.games || []).map((g) => `${gameOf(g.game)} ${up(g.fmt || '')}`.trim()).join(', ') : gameOf(c.game);
    const prizes = (c.prizes || []).map((p, i) => (p ? `<div class="row"><div><b>${PLACE[i]}</b><small>${esc(up(p))}</small></div></div>` : '')).join('');
    return `<h1 class="hl metal">${esc(c.name)}</h1><div class="line">Teams of ${n} &middot; ${c.size} venues &middot; ${c.in} in &middot; ${esc(games)}</div>` +
      `<div class="line">Starts <b>${esc(when(c.starts_at))}</b> at every venue in it</div>` +
      `<div class="gcard cfee"><div class="for">${fee ? `${money(fee)} A TEAM` : 'FREE TO ENTER'}</div>` +
      `<div class="what">One team per venue: ${n} players and up to 2 subs. Each round your ${n} play the other venue's ${n}, board 1 against board 1. ${fee ? `The captain pays it, or each player pays ${money(Math.floor(fee / n))}. ` : ''}A cancelled cup gives every fee back.</div></div>` +
      (prizes ? `<div class="board"><div class="rbtitle">PRIZES FROM TABLE WARS</div>${prizes}</div>` : '');
  }

  // ---- no team yet: make one, or join by the link --------------------------------------------------------------
  function makeForm() {
    const { cup: c } = S.v;
    const fee = Number(c.fee_cents) || 0;
    const n = c.team_size || 4;
    const keep = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const nm = keep('tName');
    if (!S.v.profile) {
      page(head(c) + '<div class="gcard"><div class="for">MAKE YOUR PLAYER PROFILE FIRST</div><div class="what">A team cup puts your place on your profile. It takes a minute.</div></div><a class="btn primary" href="index.html">MAKE MY PROFILE</a>');
      return;
    }
    if (c.state !== 'open') { page(head(c) + '<div class="gcard"><div class="for">SIGN-UP IS CLOSED</div></div>'); return; }
    if (join) {
      const v = (c.venues || []).find((x) => x.team) || {};
      page(head(c) + `<div class="gcard"><div class="for">JOIN YOUR TEAM</div><div class="what">A teammate sent you their team's link. Join as a player, or as a sub (a sub steps in when a player can't come).</div></div>` +
        `${S.msg ? errLine(S.msg) : ''}<button class="btn primary" type="button" id="tJoin"${S.busy ? ' disabled' : ''}>JOIN AS A PLAYER</button>` +
        `<button class="btn" type="button" id="tJoinSub"${S.busy ? ' disabled' : ''}>JOIN AS A SUB</button>`);
      void v;
      return;
    }
    const venues = (c.venues || []).map((v) => `<button type="button" data-loc="${esc(v.loc)}" class="${S.loc === v.loc ? 'on' : ''}"${v.team ? ' disabled' : ''}><b>${esc(v.venue)}</b><small>${v.team ? `${esc(up(v.team.name))} plays for it` : 'No team yet'}</small></button>`).join('');
    page(head(c) + '<div class="rbtitle" style="border-radius:6px">WHO PLAYS FOR YOUR VENUE?</div>' + `<div class="vpick">${venues}</div>` +
      `<div class="gfield"><label for="tName">Your team's name</label><input id="tName" maxlength="12" autocomplete="off" placeholder="SHARKS" value="${esc(nm)}"><small>You are the captain. You add ${n - 1} more ${n - 1 === 1 ? 'player' : 'players'} with the team's link.</small></div>` +
      (fee ? `<div class="tpay"><button type="button" data-split="0" class="${S.split ? '' : 'on'}"><b>I PAY IT ALL</b><small>${money(fee)} now</small></button><button type="button" data-split="1" class="${S.split ? 'on' : ''}"><b>SPLIT IT</b><small>${money(Math.floor(fee / n))} each, on each phone</small></button></div>` : '') +
      `${S.msg ? errLine(S.msg) : ''}<button class="btn primary" type="button" id="tMake"${S.busy || !S.loc ? ' disabled' : ''}>${fee ? (S.split ? `MAKE THE TEAM AND PAY MY ${money(fee - Math.floor(fee / n) * (n - 1))}` : `MAKE THE TEAM AND PAY ${money(fee)}`) : 'MAKE THE TEAM'}</button>` +
      `<div class="line dim">The team is in when ${fee ? 'the fee is paid' : 'you make it'}. Everyone checks in at your venue's TV from 30 minutes before the start.</div>`);
  }
  async function make() {
    const name = (document.getElementById('tName') || {}).value || '';
    if (!name.trim()) { S.msg = "Type your team's name."; makeForm(); return; }
    S.busy = true; S.msg = ''; makeForm();
    try {
      const a = await ask('make', { loc: S.loc, name: name.trim(), split: S.split });
      if (a.url) { location.href = a.url; return; }
      await load();
    } catch (e) { S.msg = e.message; } finally { S.busy = false; }
    if (!S.v.me) makeForm();
  }
  async function doJoin(sub) {
    S.busy = true; S.msg = ''; makeForm();
    try {
      const a = await ask('join', { code: join, sub });
      if (a.url) { location.href = a.url; return; }
      history.replaceState(null, '', `tcup.html?c=${cid}`);
      await load();
    } catch (e) { S.msg = e.message; } finally { S.busy = false; }
    if (!S.v.me) makeForm();
  }

  // ---- on a team ------------------------------------------------------------------------------------------------
  const SH = { paid: 'PAID', checkout: 'PAYING', unpaid: 'NOT PAID' };
  function teamCard() {
    const { cup: c, me } = S.v;
    const t = me.team;
    const fee = Number(c.fee_cents) || 0;
    const n = c.team_size || 4;
    const players = t.members.filter((m) => !m.sub);
    const paid = me.pay === 'paid' || me.pay === 'free';
    const rows = t.members.map((m) => {
      const tags = [m.captain ? 'CAPTAIN' : '', m.sub ? 'SUB' : '', (t.in || []).includes(m.name) ? '&#10003; IN' : ''].filter(Boolean).join(' &middot; ');
      const sh = t.mode === 'split' && !m.sub && fee ? `<span class="tg${(m.share || {}).pay === 'paid' ? '' : ' dim'}">${SH[(m.share || {}).pay] || 'NOT PAID'}</span>` : '';
      return `<div class="row trow"><div><b>${esc(m.name)}</b><small>${tags || '&nbsp;'}</small></div>${sh}</div>`;
    }).join('') + Array.from({ length: Math.max(0, n - players.length) }, () => '<div class="row trow"><div><b>&mdash;</b><small>A player still to join</small></div></div>').join('');
    const link = `${location.origin}${location.pathname}?c=${cid}&j=${t.code}`;
    let pay = '';
    if (fee && !paid && c.state === 'open') {
      if (t.mode === 'split' && !me.sub) {
        const sh = me.share || {};
        pay = sh.pay === 'paid' ? `<div class="line">Your ${money(sh.cents)} is paid. The team is in when every player's share is.</div>`
          : `<button class="btn primary" type="button" id="tPay"${S.busy ? ' disabled' : ''}>PAY MY ${money(sh.cents || Math.floor(fee / n))}</button>`;
      } else if (t.mode !== 'split' && me.captain) {
        pay = `<button class="btn primary" type="button" id="tPay"${S.busy ? ' disabled' : ''}>PAY ${money(fee)} FOR THE TEAM</button>`;
      } else pay = `<div class="line">${t.mode === 'split' ? 'Subs do not pay a share.' : 'Your captain pays the fee.'}</div>`;
    }
    const state = me.refund === 'done' ? 'REFUNDED' : paid ? 'THE TEAM IS IN' : players.length < n ? `${players.length} OF ${n} PLAYERS` : 'NOT PAID YET';
    let lineup = '';
    if (me.captain && c.state !== 'done' && c.state !== 'cancelled') {
      const ln = (t.lineup && t.lineup.length ? t.lineup : players.map((m) => m.name)).slice(0, n);
      const bench = t.members.map((m) => m.name).filter((x) => !ln.includes(x));
      lineup = `<div class="board"><div class="rbtitle">TONIGHT'S LINE-UP</div>${ln.map((x, i) => `<div class="row"><div><b>BOARD ${i + 1}: ${esc(x)}</b><small>Plays board ${i + 1} against the other venue's board ${i + 1}</small></div></div>`).join('')}` +
        bench.map((x) => `<div class="row"><div><b>${esc(x)}</b><small>On the bench. Put them on a board:</small></div><div class="tbench">${ln.map((_y, i) => `<button class="btn sm" type="button" data-lu="${esc(x)}|${i}"${S.busy ? ' disabled' : ''}>${i + 1}</button>`).join('')}</div></div>`).join('') +
        '<div class="row"><div><small>Change it any time before a round starts. A player not checked in at the start of a round: a checked-in sub plays that board, or it is lost.</small></div></div></div>';
    }
    return `<div class="gcard"><div class="for">${esc(t.name)} &middot; ${esc(up(me.venue))}</div><div class="what"><b>${state}</b>${c.state === 'open' ? ` &middot; check in at the TV from ${esc(hhmm(c.starts_at - 1800))}` : ''}</div></div>` +
      `${S.msg ? errLine(S.msg) : ''}${S.good ? goodLine(S.good) : ''}${pay}` +
      `<div class="board"><div class="rbtitle">THE TEAM</div>${rows}</div>` +
      (c.state === 'open' ? `<div class="board"><div class="rbtitle">SEND THE TEAM'S LINK</div><div class="tlink" id="tLink">${esc(link)}</div><button class="btn" type="button" id="tShare">SHARE THE LINK</button></div>` : '') +
      lineup;
  }

  // ---- YOUR PATH (once it runs) ----------------------------------------------------------------------------------
  function path() {
    const { cup: c, me, doc } = S.v;
    const eid = me.eid;
    const ties = Object.values(doc.ties || {}).filter((t) => (t.sides || []).includes(eid)).sort((a, b) => a.round - b.round);
    const n = c.team_size || 4;
    const vname = (x) => (x === 'BYE' ? 'A BYE' : ((doc.ents || {})[x] || {}).name || 'TO BE DECIDED');
    const score = (t, s) => {
      if (t.how === 'bye') return t.winner === s ? [n, 0] : [0, n];
      const w = [0, 0];
      for (const k of t.boards || []) { const m = doc.matches[k]; if (m && m.status === 'done' && [0, 1].includes(m.winner) && !['void', 'unneeded'].includes(m.how) && !m.double_noshow) w[m.winner] += 1; }
      return s === 0 ? w : [w[1], w[0]];
    };
    const myBoard = (t, s) => {
      for (const k of [...(t.boards || []), ...(t.decider ? [t.decider] : [])]) {
        const m = doc.matches[k];
        const ent = m && m.sides && doc.ents[m.sides[s]];
        if (ent && (ent.members || [])[0] === me.name) return m;
      }
      return null;
    };
    const rows = ties.map((t) => {
      const s = t.sides.indexOf(eid);
      const sc = score(t, s);
      const opp = vname(t.sides[1 - s]);
      const m = myBoard(t, s);
      const mine = m ? `${m.decider ? 'The decider' : m.label}: ${m.status === 'done' ? (m.how === 'unneeded' ? 'not needed' : m.winner === s ? (m.missing ? 'you won: they had nobody for it' : 'you won') : (m.missing ? 'lost: nobody to play it' : 'you lost')) : m.status === 'playing' ? 'playing now' : m.status === 'called' ? `called at table ${(m.calls || {})[me.loc] || ''}` : 'next'}` : t.how === 'bye' ? 'A bye counts as a win' : 'You sat this one out';
      const now = t.status !== 'done';
      return `<div class="row${now ? ' now' : ''}"><div><b>ROUND ${t.round}: ${now ? 'VS' : t.winner === s ? 'BEAT' : 'LOST TO'} ${esc(opp)}</b><small>${esc(mine)}${t.decider ? ' &middot; went to the decider' : ''}</small></div><span class="tscore">${sc[0]}-${sc[1]}</span></div>`;
    }).join('');
    const place = (doc.places || {})[eid];
    const grp = (() => { const live = ties.find((t) => t.status !== 'done') || ties[ties.length - 1]; return live && live.group; })();
    const best = place ? `<div class="place">${ORD(place)}</div><div class="obest">OF ${doc.count} VENUES &middot; ${esc(c.name)}</div>`
      : grp ? `<div class="obest">Best your team can still finish: <em>${ORD(grp[0])}</em></div>` : '';
    return `<div class="gcard"><div class="for">${esc(me.team.name)} &middot; ${esc(up(me.venue))}</div><div class="what">${doc.state === 'done' ? 'The cup is over. The place is on every player\'s profile.' : `Round ${doc.round} of ${doc.rounds_n}`}</div></div>` +
      best + `<div class="board pth"><div class="rbtitle">YOUR PATH</div>${rows || '<div class="row"><div><b>THE DRAW IS DONE</b><small>Your first round is coming up</small></div></div>'}</div>`;
  }

  function render() {
    if (!S.v) return;
    const { cup: c, me, doc } = S.v;
    if (!me) { makeForm(); return; }
    if (c.state === 'cancelled') { page(head(c) + `<div class="gcard"><div class="for">THE CUP WAS CANCELLED</div><div class="what">${me.refund === 'done' ? 'Every fee went back.' : 'Every fee goes back.'}</div></div>`); return; }
    const running = doc && ['running', 'done'].includes(doc.state) && doc.ents && doc.ents[me.eid];
    page(`<h1 class="hl metal">${esc(c.name)}</h1>${running ? path() : ''}${teamCard()}`);
  }
  async function load() {
    try { S.v = await rpc('view'); } catch (e) { page(`<h1 class="hl metal">TEAM CUP</h1>${errLine(e.message)}`); return false; }
    if (!S.loc && S.v.cup && (S.v.cup.venues || []).length === 1) S.loc = S.v.cup.venues[0].loc;
    render();
    return true;
  }
  app.addEventListener('click', async (e) => {
    const v = e.target.closest('.vpick button[data-loc]');
    if (v) { S.loc = v.dataset.loc; S.msg = ''; makeForm(); return; }
    const sp = e.target.closest('[data-split]');
    if (sp) { S.split = sp.dataset.split === '1'; makeForm(); return; }
    if (S.busy) return;
    if (e.target.closest('#tMake')) { make(); return; }
    if (e.target.closest('#tJoin')) { doJoin(false); return; }
    if (e.target.closest('#tJoinSub')) { doJoin(true); return; }
    if (e.target.closest('#tShare')) {
      const link = document.getElementById('tLink').textContent;
      try { if (navigator.share) await navigator.share({ title: S.v.me.team.name, url: link }); else await navigator.clipboard.writeText(link); S.good = 'Link ready to send.'; } catch { /* */ }
      render();
      return;
    }
    if (e.target.closest('#tPay')) {
      if (S.v.me.share && S.v.me.share.url && S.v.me.share.pay === 'checkout') { location.href = S.v.me.share.url; return; }
      if (S.v.me.checkout_url && S.v.me.pay === 'checkout') { location.href = S.v.me.checkout_url; return; }
      S.busy = true; S.msg = ''; render();
      try { const a = await ask('pay', {}); if (a.url) { location.href = a.url; return; } } catch (er) { S.msg = er.message; } finally { S.busy = false; }
      render();
      return;
    }
    const lu = e.target.closest('[data-lu]');
    if (lu) {
      const [who, i] = lu.dataset.lu.split('|');
      const t = S.v.me.team;
      const n = S.v.cup.team_size || 4;
      const ln = (t.lineup && t.lineup.length ? t.lineup : t.members.filter((m) => !m.sub).map((m) => m.name)).slice(0, n);
      ln[Number(i)] = who;
      S.busy = true; S.msg = ''; render();
      try { await ask('lineup', { names: ln }); S.good = `${who} plays board ${Number(i) + 1}.`; await load(); } catch (er) { S.msg = er.message; } finally { S.busy = false; }
      render();
    }
  });
  (async () => {
    if (!cid) { page(`<h1 class="hl metal">TEAM CUP</h1>${errLine('Scan the QR on your venue\'s TV to open the cup.')}`); return; }
    if (!(await load())) return;
    for (;;) {
      await sleep(S.v && S.v.me && S.v.me.pay !== 'paid' ? 2000 : 5000);
      const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
      if (typing || S.busy || !S.v || !S.v.me) continue;
      try { S.v = await rpc('view'); render(); } catch { /* next time */ }
    }
  })();
})();
