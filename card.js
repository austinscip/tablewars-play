/* MY CARD, the phone's own pages (W24 PH-3 .. PH-6, moved here by W46 so the PLAYER SITE draws the SAME screens):
   MY CARD, FRIENDS, ADD A FRIEND, INVITES, INVITE (pick a game), SETTINGS (+ FORGET ME). The venue page /me (me.js)
   and the player site (app.js) both use this file; the player site keeps a byte-for-byte copy (sync_player_site.py).
   Pure screens: data in, HTML out (k below), plus one click handler both pages call with their own doors (io).

   k = { nick, tag, venue (the home venue's name), seat ({table, color} | null), cv (the cloud's view: profile,
         friends, played_with, invites, venues), mine ({best, games}: records words), online, error, friendCode,
         email (n•••@gmail.com | null), emailOn, qr (the friend QR picture's address | null), tile(slug) -> address,
         gem (address), formats ({slug: [{id, label}]}), s (the page's state: armed, undo, editing, showAll, moreGames,
         picked, pickedFmt, screenFrom), msgLine(), signIn (SIGN IN's screen | null), more (MORE's screen | null),
         stamp (a line under SETTINGS | null) }
   io = { act(action, args, okMsg) -> Promise<bool>, go(screen), render(), say(text, ok), saveNick(v) -> Promise,
          standUp() -> Promise, forgetNow() -> Promise, emailEdit() }

   myGames(card, bests): MY CARD's records words for a page with no box (runtime/records.py my_games, the same
   rule; pinned equal by tests/test_w46_player_card.py). */
(() => {
  const L = window.TWLanding;
  const { esc, tc, word, tagged: T } = L;
  const SEAT_N = L.SEAT_N;
  const GAME = { puck_racer_relay: 'PUCK RACER', puck_golf_relay: 'PUCK GOLF', puck_darts_relay: 'BULL RUSH', puck_pong_toss_relay: 'RACK ATTACK',
    puck_trivia_relay: 'BRAIN FREEZE', puck_cornhole_relay: 'HOLE HOG', puck_rack_relay: 'BREAK ROOM', puck_airhockey_relay: 'GOAL TENDER',
    puck_starswarm_relay: 'SHOTS FIRED', puck_roller_relay: 'TIPSY' };
  const TILE = { puck_racer_relay: 'racer', puck_golf_relay: 'golf', puck_darts_relay: 'darts', puck_pong_toss_relay: 'pong', puck_trivia_relay: 'trivia',
    puck_cornhole_relay: 'cornhole', puck_rack_relay: 'rack', puck_airhockey_relay: 'airhockey', puck_starswarm_relay: 'shotsfired', puck_roller_relay: 'tipsy' };
  // games a friend can be invited to (Goal Tender stays offline)
  const ONLINE = ['puck_rack_relay', 'puck_darts_relay', 'puck_trivia_relay', 'puck_racer_relay', 'puck_golf_relay', 'puck_cornhole_relay',
    'puck_pong_toss_relay', 'puck_roller_relay', 'puck_starswarm_relay'];
  const BUG = (page) => `<div class="bug"><b><i>TABLE WARS</i></b><span><i>${esc(page)}</i></span></div>`;
  const BACK = (to) => `<div class="backrow"><button class="btn sm" data-go="${esc(to)}">&#9664; BACK</button></div>`;
  const GEMI = (k) => `<img src="${esc(k.gem)}" alt="">`;
  function ago(iso) {
    const t = Date.parse(iso || ''); if (!t) return '';
    const d = Math.floor((Date.now() - t) / 86400000);
    if (d < 1) return 'Tonight'; if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`;
    const w = Math.floor(d / 7); return `${w} weeks ago`;
  }
  function left(iso) {
    const s = Math.max(0, Math.round((Date.parse(iso || '') - Date.now()) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  const typesOf = (k, slug) => (k.formats || {})[slug] || [];
  const typeWord = (k, i) => { const f = typesOf(k, i.slug).find((x) => x.id === i.fmt); return f ? ` ${f.label}` : ''; };
  const invitesToMe = (k) => ((k.cv && k.cv.invites) || []).filter((i) => !i.mine && i.state === 'open' && Date.parse(i.expires_at || 0) > Date.now() - 1000);
  const friendsList = (k) => (k.cv && k.cv.friends) || [];
  const gameWords = (k, i) => word(GAME[i.slug] || 'a game').replace(/\b\w/g, (x) => x.toUpperCase()) + typeWord(k, i);
  const offlineLine = '<p class="empty" id="frLead">Friends and invites work when this venue is online.</p>';

  const C = {};

  // PH-3 MY CARD
  C.card = (k) => {
    const seat = k.seat;
    const mine = k.mine || { best: null, games: [] };
    const c = seat ? `var(--p${SEAT_N[seat.color] <= 4 ? SEAT_N[seat.color] : 1})` : 'var(--brass)';
    const status = seat ? `<div class="status" id="seatNow"><em>Signed in</em> at table ${esc(seat.table)}, ${esc(String(seat.color).toLowerCase())}</div>`
      : (k.signIn ? `<div class="status" id="seatNow">Not signed in &middot; <button class="tap" style="display:inline-flex" data-go="${esc(k.signIn)}">SIGN IN</button></div>`
        : '<div class="status" id="seatNow">Not signed in &middot; scan your seat card on the TV</div>');
    const b = mine.best;
    const best = b ? `<div class="board best" id="bestRank"><span class="lbl">${esc(b.label)}</span>${b.tier ? `<span class="tierp">${esc(b.tier)}</span>` : `<span class="words rec dim">${esc(b.words || '')}</span>`}${b.record ? `<span class="rec">${esc(b.record)}</span>` : ''}</div>`
      : '<div class="board best" id="bestRank"><span class="lbl">RANK</span><span class="rec dim">Play a game to get a rank</span></div>';
    const inv = invitesToMe(k).length;
    // C3: every online cup this profile finished, its place first; a tap opens that cup's bracket to look back at
    const cups = (mine.cups || []).slice(0, 5).map((p) => `<a class="row" href="ocup.html?c=${encodeURIComponent(p.cup)}"><span><b>${esc(p.title)}</b><small>${esc(p.detail)} &middot; ${esc(p.venue)} &middot; <em>SEE THE BRACKET</em></small></span></a>`).join('');
    // C4: every league season this profile finished: "2ND · TUESDAY LEAGUE · FALL", a tap opens that league
    const ordw = (n) => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[n % 10] || 'TH')}`;
    const seasons = (mine.seasons || []).slice(0, 5).map((p) => `<a class="row" href="league.html?l=${encodeURIComponent(p.league)}"><span><b>${ordw(p.place)} &middot; ${esc(p.title)} &middot; ${esc(String(p.detail || '').split(' ')[0])}</b><small>${esc(p.detail)} &middot; ${esc(p.venue)} &middot; ${p.place} of ${p.of}</small></span></a>`).join('');
    const games = (mine.games || []).map((r) => `<div class="game"><img src="${esc(k.tile(r.tile))}" alt=""><div><b>${esc(r.name)}</b>` +
      (r.tier ? `<div class="rk"><span class="lbl">RANK</span><span class="tierp">${esc(r.tier)}</span></div>` : (r.words ? `<span class="words">${esc(r.words)}</span>` : '')) +
      (r.record ? `<span class="rec">${esc(r.record)}</span>` : (r.best ? `<span class="rec">${esc(r.best)}</span>` : '')) + '</div></div>').join('');
    return `<div data-first style="display:flex;flex-direction:column;gap:16px">
        ${BUG('MY CARD')}
        <div class="vcard" style="--c:${c}"><i></i><div><small>${esc(tc(k.venue))}</small><b id="ini">${T(k.nick, k.tag)}</b></div></div>
        ${status}
        ${best}
        <div class="btns"><button class="btn primary" data-go="invites" id="invBtn">INVITES <span class="n">${inv || ''}</span></button><button class="btn" data-go="add">ADD A FRIEND</button></div>
      </div>
      ${k.error ? `<p class="msg">${esc(k.error)}</p>` : ''}
      ${games ? `<div class="board" id="myGames"><div class="rbtitle">MY GAMES<span class="tlinks"><button class="tlink" data-go="rivals" id="rivBtn">RIVALS</button><button class="tlink" data-go="bests" id="bestBtn">BESTS</button></span></div>${games}</div>` : ''}
      ${cups ? `<div class="board" id="myCups"><div class="rbtitle">MY CUP PLACES</div>${cups}</div>` : ''}
      ${seasons ? `<div class="board" id="mySeasons"><div class="rbtitle">MY LEAGUE SEASONS</div>${seasons}</div>` : ''}`;
  };

  // PH-4 FRIENDS
  C.friends = (k) => {
    if (!k.online) return `${BUG('FRIENDS')}${offlineLine}`;
    const s = k.s;
    const fr = friendsList(k);
    const playing = fr.filter((f) => f.state === 'friends' && f.playing_now);
    const asks = fr.filter((f) => f.state === 'asks_me');
    const mine = fr.filter((f) => f.state === 'friends');
    const lastPlayed = {}; for (const p of (k.cv && k.cv.played_with) || []) lastPlayed[p.id] = p.last_at;
    const code = k.friendCode ? `<div class="board"><div class="rbtitle">FRIEND CODE</div><div class="row lit"><span><b>${esc(k.friendCode)}</b><small>From a friend QR</small></span><button class="btn sm" data-code="${esc(k.friendCode)}">ASK</button></div></div>` : '';
    const rowsPlaying = playing.map((f) => `<div class="row"><span><b>${T(f.nickname, f.tag)}</b><small>${f.at ? `At ${esc(tc(f.at))}` : 'Playing now'}</small></span><button class="btn sm" data-go="invite/${esc(f.id)}" data-invite="${esc(f.id)}">INVITE</button></div>`).join('');
    const rowsAsks = asks.map((f) => `<div class="row lit"><span><b>${T(f.nickname, f.tag)}</b><small>${esc(lastPlayed[f.id] ? `Played ${ago(lastPlayed[f.id]).toLowerCase()}` : tc(f.venue))}</small></span><div class="acts"><button class="btn sm" data-accept="${esc(f.id)}">ACCEPT</button><button class="btn sm" data-no="${esc(f.id)}">NO</button></div></div>`).join('');
    const shown = s.showAll ? mine : mine.slice(0, 2);
    const rowsMine = shown.map((f) => `<div class="row"><span><b>${T(f.nickname, f.tag)}</b><small>${esc(lastPlayed[f.id] ? `Played ${ago(lastPlayed[f.id]).toLowerCase()}` : tc(f.venue))}</small></span></div>`).join('');
    return `${BUG('FRIENDS')}${code}
      ${playing.length ? `<div class="board"><div class="rbtitle">PLAYING NOW<span class="c">${playing.length}</span></div>${rowsPlaying}</div>` : ''}
      ${asks.length ? `<div class="board"><div class="rbtitle">WANTS TO BE FRIENDS<span class="c">${asks.length}</span></div>${rowsAsks}</div>` : ''}
      ${mine.length ? `<div class="board" id="friends"><div class="rbtitle">MY FRIENDS<span class="c">${mine.length}</span></div>${rowsMine}${mine.length > 2 && !s.showAll ? `<button class="more" data-act="showall">SHOW ALL ${mine.length}</button>` : ''}</div>`
        : (asks.length || playing.length ? '' : '<p class="empty" id="friends">No friends yet. Add someone you played.</p>')}
      ${k.msgLine()}
      <button class="btn primary" data-go="add">ADD A FRIEND</button>`;
  };

  // PH-4B ADD A FRIEND
  C.add = (k) => {
    if (!k.online) return `${BUG('ADD A FRIEND')}${offlineLine}${BACK('friends')}`;
    const fc = k.cv && k.cv.profile.friend_code;
    const friendIds = new Map(friendsList(k).map((f) => [f.id, f.state]));
    const pw = ((k.cv && k.cv.played_with) || []).filter((p) => friendIds.get(p.id) !== 'friends');
    const rows = pw.map((p) => `<div class="row"><span><b>${T(p.nickname, p.tag)}</b><small>${esc(ago(p.last_at))}</small></span>` +
      (friendIds.get(p.id) === 'asked' ? '<span class="tierp wait">ASKED</span>' : `<button class="btn sm" data-ask="${esc(p.id)}">ASK</button>`) + '</div>').join('');
    return `${BUG('ADD A FRIEND')}
      ${fc && k.qr ? `<div class="board"><div class="rbtitle">SHOW THEM THIS</div><div class="qrwrap"><div class="plate"><img id="friendQR" src="${esc(k.qr)}" alt="My friend QR"></div><p class="line">They scan it with their phone camera.</p></div></div>`
        : '<p class="empty">Your friend QR shows here once this venue sends your profile.</p>'}
      <div class="board" id="played"><div class="rbtitle">PEOPLE YOU PLAYED</div>${rows || '<p class="empty">Play a game signed in: they show up here.</p>'}</div>
      ${k.msgLine()}
      ${BACK(k.s.screenFrom.add || 'friends')}`;
  };

  // PH-5 INVITES
  C.invites = (k) => {
    if (!k.online) return `${BUG('INVITES')}${offlineLine}${BACK('card')}`;
    const all = (k.cv && k.cv.invites) || [];
    const toMe = invitesToMe(k);
    const sent = all.filter((i) => i.mine);
    const openSent = sent.filter((i) => i.state === 'open').length;
    const bands = toMe.map((i) => `<div class="inv" id="invitesIn"><div class="who metal">${T(i.from, i.from_tag)}</div><div class="what">wants to play <b>${esc(gameWords(k, i))}</b></div>` +
      `<div class="btns"><button class="btn primary" data-yes="${esc(i.id)}">${GEMI(k)} PLAY</button><button class="btn" data-noinv="${esc(i.id)}">NO THANKS <span class="t" data-left="${esc(i.expires_at)}">${left(i.expires_at)}</span></button></div></div>`).join('');
    const rows = sent.map((i) => {
      const gname = gameWords(k, i);
      if (i.state === 'open') {
        const isArmed = k.s.armed === `cancel:${i.id}`;
        return `<div class="row"><span><b>${T(i.to, i.to_tag)}</b><small>${esc(gname)} &middot; waiting <span class="t" data-left="${esc(i.expires_at)}">${left(i.expires_at)}</span></small></span><button class="btn sm hot${isArmed ? ' armed' : ''}" data-cancel="${esc(i.id)}">${isArmed ? 'TAP AGAIN' : 'CANCEL'}</button></div>`;
      }
      return `<div class="row"><span><b>${T(i.to, i.to_tag)}</b><small>${esc(gname)} &middot; ${i.state === 'yes' ? 'said yes: watch the TV' : 'said no thanks'}</small></span></div>`;
    }).join('');
    return `${BUG('INVITES')}${bands}
      ${sent.length ? `<div class="board"><div class="rbtitle">I SENT<span class="c">${openSent}/3</span></div>${rows}</div>` : ''}
      ${!toMe.length && !sent.length ? '<p class="empty">No invites right now. Invite a friend who is playing.</p><button class="btn primary" data-go="friends">FRIENDS</button>' : ''}
      ${k.msgLine()}
      ${BACK('card')}`;
  };

  // PH-5B INVITE (pick a game: 4 cards at most, the most played first and picked)
  C.invite = (k, fid) => {
    const s = k.s;
    const f = friendsList(k).find((x) => x.id === fid);
    if (!f) return `${BUG('INVITE')}<p class="empty">That friend is not playing now.</p>${BACK('friends')}`;
    const played = ((k.mine && k.mine.games) || []).map((r) => r.slug).filter((x) => ONLINE.includes(x));
    const order = [...played, ...ONLINE.filter((x) => !played.includes(x))];
    if (!s.picked || !order.includes(s.picked)) s.picked = order[0];
    const shown = s.moreGames ? order : order.slice(0, 4);
    const tiles = shown.map((x) => `<button class="tile${x === s.picked ? ' sel' : ''}" data-game="${x}" aria-pressed="${x === s.picked}"><div class="art" style="background-image:url('${esc(k.tile(TILE[x]))}')"></div><div class="nm">${esc(GAME[x])}</div></button>`).join('');
    // GAME TYPE (Austin 2026-10-29): the inviter picks it (8-BALL or 9-BALL...); the invite carries it, both TVs play it.
    const types = typesOf(k, s.picked);
    if (!types.some((t) => t.id === s.pickedFmt)) s.pickedFmt = types.length ? types[0].id : null;
    const typeRow = types.length > 1 ? `<div class="line">Game type</div><div class="types">${types.map((t) =>
      `<button class="btn sm${t.id === s.pickedFmt ? ' sel' : ''}" data-fmt="${esc(t.id)}" aria-pressed="${t.id === s.pickedFmt}">${esc(t.label)}</button>`).join('')}</div>` : '';
    return `${BUG('INVITE')}
      <div class="line">Pick a game for <b>${T(f.nickname, f.tag)}</b></div>
      <div class="board"><div class="tiles">${tiles}</div>${s.moreGames ? '' : '<button class="more" data-act="moregames">MORE GAMES</button>'}</div>
      ${typeRow}
      <p class="line dim">The invite lasts 5 minutes.</p>
      ${k.msgLine()}
      <div class="foot"><button class="btn sm" data-go="friends">&#9664; BACK</button><button class="btn primary" data-send="${esc(f.id)}">${GEMI(k)} SEND INVITE</button></div>`;
  };

  // F3 RIVALS (Austin 2026-11-07, the five-features page section 1): the top 5 people by games together, every venue
  // and online too (profiles only), from the cloud's view (`rivals`, docs/specs/f3-rivals-bests.sql)
  const dash = '\u2013';
  C.rivals = (k) => {
    if (!k.online || !k.cv) return `${BUG('RIVALS')}<p class="empty" id="rivals">Your rivals show here when this venue is online.</p>${BACK('card')}`;
    const rows = (k.cv.rivals || []).slice(0, 5).map((r) => {
      const w = int(r.wins), l = int(r.losses), d = int(r.draws);
      const lead = w > l ? 'You lead' : w < l ? 'They lead' : 'All square';
      const game = GAME[r.last_slug] ? ` &middot; last game ${esc(word(GAME[r.last_slug]).replace(/\b\w/g, (x) => x.toUpperCase()))}` : '';
      const when = r.last_at ? `, ${esc(ago(r.last_at).toLowerCase())}` : '';
      return `<div class="row"><span><b>${T(r.nickname, r.tag)}</b><small>${lead}${game}${when}</small></span><span class="rec">${w}${dash}${l}${d ? `${dash}${d}` : ''}</span></div>`;
    }).join('');
    return `${BUG('RIVALS')}
      <div class="board" id="rivals"><div class="rbtitle">MOST GAMES TOGETHER</div>${rows || '<p class="empty">Play someone who has a profile: they show up here.</p>'}</div>
      <p class="line dim">Every venue counts, online too. The score is wins, then losses${(k.cv.rivals || []).some((r) => int(r.draws)) ? ', then ties' : ''}.</p>
      ${BACK('card')}`;
  };

  // F3 BESTS (the five-features page section 5): the best per game (and per variant: a track, a course, a game type)
  // and when, by the number each leaderboard ranks (docs/LEADERBOARDS.md), from the cloud's view (`bests`)
  C.bests = (k) => {
    if (!k.online || !k.cv) return `${BUG('BESTS')}<p class="empty" id="bests">Your bests show here when this venue is online.</p>${BACK('card')}`;
    const order = Object.keys(GAME);
    const rows = ((k.cv.bests) || []).filter((b) => R.META[b.slug] && int(b.score) > 0)
      .sort((a, b) => (order.indexOf(a.slug) - order.indexOf(b.slug)) || String(a.detail || '').localeCompare(String(b.detail || '')))
      .map((b) => {
        const v = variantName(b.detail);
        const where = b.venue ? ` &middot; ${esc(tc(b.venue))}` : '';
        return `<div class="game"><img src="${esc(k.tile(TILE[b.slug]))}" alt=""><div><b>${esc(GAME[b.slug])}${v ? ` <small class="var">${esc(v)}</small>` : ''}</b>` +
          `<span class="rec">${esc(bestNumber(R.META[b.slug].unit, int(b.score)))}</span><span class="words">${esc(ago(b.at))}${where}</span></div></div>`;
      }).join('');
    return `${BUG('BESTS')}
      <div class="board" id="bests"><div class="rbtitle">MY BESTS</div>${rows || '<p class="empty">Win a game signed in: your best shows up here.</p>'}</div>
      ${BACK('card')}`;
  };

  // PH-6 SETTINGS (+ PH-6B FORGET ME armed)
  C.settings = (k) => {
    const s = k.s;
    const seat = k.seat;
    const show = !!(k.cv && k.cv.profile.show_venue);
    const venues = (k.cv && k.cv.venues) || [];
    const home = k.venue || '';
    const nickRow = s.editing === 'nick'
      ? `<div class="edit"><input id="ed_nick" maxlength="10" value="${esc(k.nick)}" autocapitalize="characters" autocomplete="off" aria-label="Nickname"><button class="btn sm" id="ed_nick_save">SAVE</button></div>`
      : `<div class="row"><span><b>NICKNAME</b><small>${esc(k.nick)}</small></span><button class="btn sm" data-edit="nick">CHANGE</button></div>`;
    const homeRow = s.editing === 'home'
      ? `<div class="row"><span><b>HOME VENUE</b><small>Pick one you played at</small></span></div>${venues.map((v) => `<button class="row pick${v.name === home ? ' lit' : ''}" data-home="${esc(v.loc)}"><span><b>${esc(v.name)}</b></span></button>`).join('')}`
      : `<div class="row"><span><b>HOME VENUE</b><small>${esc(tc(home))}</small></span>${k.online && venues.length > 1 ? '<button class="btn sm" data-edit="home">CHANGE</button>' : ''}</div>`;
    const showRow = k.online ? `<div class="row"><span><b>SHOW MY VENUE</b><small>Friends see where you play</small></span><div class="toggle" role="group" aria-label="Show my venue"><button class="${show ? '' : 'on'}" data-show="0" aria-pressed="${!show}"><i>OFF</i></button><button class="${show ? 'on' : ''}" data-show="1" aria-pressed="${show}"><i>ON</i></button></div></div>` : '';
    const emailRow = k.emailOn ? `<div class="row"><span><b>EMAIL</b><small id="emNow">${k.email ? esc(k.email) : 'Sign in on another phone'}</small></span><button class="btn sm" id="emEdit">${k.email ? 'CHANGE' : 'ADD'}</button></div>` : '';
    const outArmed = s.armed === 'signout';
    const seatRow = seat
      ? `<div class="row"><span><b>THIS SEAT</b><small>Table ${esc(seat.table)}, ${esc(String(seat.color).toLowerCase())}</small></span><button class="btn sm hot${outArmed ? ' armed' : ''}" id="standUp">${outArmed ? 'TAP AGAIN' : 'SIGN OUT'}</button></div>`
      : `<div class="row"><span><b>THIS SEAT</b><small>Not signed in</small></span>${k.signIn ? `<button class="btn sm" data-go="${esc(k.signIn)}">SIGN IN</button>` : ''}</div>`;
    const fg = s.armed === 'forget';
    const forget = s.undo
      ? `<div class="danger"><p>Forgetting you in <span class="t" id="undoT">${s.undo.left}</span> s.</p><button class="btn" id="undoBtn">UNDO</button></div>`
      : (fg ? '<div class="danger"><p>Deletes your profile, ranks, records and friends at every venue. Your email unlinks. Scores already on a board stay as GUEST.</p><button class="btn hot armed" id="forget">TAP AGAIN</button></div>'
        : '<button class="btn hot" id="forget">FORGET ME</button>');
    return `${BUG('SETTINGS')}
      <div class="board">${nickRow}${emailRow}${homeRow}${showRow}${seatRow}${k.more ? `<button class="more" data-go="${esc(k.more)}">MORE</button>` : ''}</div>
      ${k.msgLine()}
      ${forget}
      ${k.stamp ? `<p class="line dim" id="meStamp">${esc(k.stamp)}</p>` : ''}`;
  };

  // FORGET ME's 5 s UNDO, then io.forgetNow()
  function startUndo(k, io) {
    const s = k.s;
    s.undo = { left: 5, timer: null };
    s.undo.timer = setInterval(async () => {
      s.undo.left -= 1;
      const t = document.getElementById('undoT'); if (t) t.textContent = String(s.undo.left);
      if (s.undo.left <= 0) {
        clearInterval(s.undo.timer); s.undo = null;
        try { await io.forgetNow(); } catch (e) { io.say(e.message); io.render(); }
      }
    }, 1000);
    io.render();
  }

  // the MY CARD pages' buttons (both pages): true = handled
  async function click(t, k, io) {
    const d = t.dataset;
    const s = k.s;
    if (d.act === 'showall') { s.showAll = true; io.render(); return true; }
    if (d.act === 'moregames') { s.moreGames = true; io.render(); return true; }
    if (d.accept) { io.act('friend_accept', { other: d.accept }, 'Friends now.'); return true; }
    if (d.no) { io.act('friend_remove', { other: d.no }, 'Said no.'); return true; }
    if (d.ask) { if (await io.act('friend_ask', { other: d.ask }, 'Asked.')) { t.outerHTML = '<span class="tierp wait">ASKED</span>'; } return true; }
    if (d.code) { if (await io.act('friend_code', { code: d.code }, 'Asked.')) io.codeUsed(); return true; }
    if (d.game) { s.picked = d.game; io.render(); return true; }
    if (d.fmt) { s.pickedFmt = d.fmt; io.render(); return true; }
    if (d.send) {
      const okMsg = 'Invite sent. It shows on their TV for 5 minutes.';
      if (await io.act('invite', { friend: d.send, slug: s.picked, fmt: s.pickedFmt || undefined }, okMsg)) { io.say(okMsg, true); io.go('invites'); }
      return true;
    }
    if (d.yes) { io.act('invite_answer', { id: d.yes, yes: true }, 'On it. Watch the TV.'); return true; }
    if (d.noinv) { io.act('invite_answer', { id: d.noinv, yes: false }, 'Said no thanks.'); return true; }
    if (d.cancel) {
      if (s.armed !== `cancel:${d.cancel}`) { s.armed = `cancel:${d.cancel}`; io.render(); return true; }
      s.armed = null; io.act('invite_cancel', { id: d.cancel }, 'Cancelled.'); return true;
    }
    if (d.edit) { s.editing = d.edit; await io.render(); const i = document.querySelector('.edit input'); if (i) i.focus(); return true; }
    if (t.id === 'ed_nick_save') {
      try { await io.saveNick(document.getElementById('ed_nick').value); s.editing = null; io.say('Saved.', true); await io.reload(); }
      catch (e) { io.say(e.message); }
      return true;
    }
    if (d.home) { s.editing = null; io.act('settings', { home_loc: d.home }, 'Saved.'); io.render(); return true; }
    if (d.show) { io.act('settings', { show_venue: d.show === '1' }, 'Saved.'); return true; }
    if (t.id === 'emEdit') { io.emailEdit(); return true; }
    if (t.id === 'standUp') {
      if (s.armed !== 'signout') { s.armed = 'signout'; io.render(); return true; }
      s.armed = null;
      try { await io.standUp(); io.say('Signed out.', true); await io.reload(); } catch (e) { io.say(e.message); }
      return true;
    }
    if (t.id === 'forget') {
      if (s.armed !== 'forget') { s.armed = 'forget'; io.render(); return true; }
      s.armed = null; startUndo(k, io); return true;
    }
    if (t.id === 'undoBtn') { if (s.undo) clearInterval(s.undo.timer); s.undo = null; io.say('Kept. Nothing was deleted.', true); io.render(); return true; }
    return false;
  }
  // a tap anywhere else puts an armed red button back (PH-6B): true = the page should redraw
  const disarm = (t, s) => !!(s.armed && !(t && (t.id === 'forget' || t.id === 'standUp' || (t.dataset && t.dataset.cancel))));

  // ------------------------------------------------------------------ the records words (runtime/records.py)
  const R = {
    RANK_AFTER: 5,
    TIER_ORDER: { DIAMOND: 5, PLATINUM: 4, GOLD: 3, SILVER: 2, BRONZE: 1 },
    TIERS: [['DIAMOND', 2900], ['PLATINUM', 2200], ['GOLD', 1500], ['SILVER', 800], ['BRONZE', 0]],
    TEAM: ['puck_airhockey_relay', 'puck_cornhole_relay', 'puck_pong_toss_relay', 'puck_rack_relay'],
    META: { puck_racer_relay: { unit: 'TIME', best: 'low' }, puck_golf_relay: { unit: 'STROKES', best: 'low' },
      puck_darts_relay: { unit: 'DARTS', best: 'low' }, puck_pong_toss_relay: { unit: 'THROWS', best: 'low' },
      puck_trivia_relay: { unit: 'PTS', best: 'high' }, puck_cornhole_relay: { unit: 'BAG PTS', best: 'high' },
      puck_rack_relay: { unit: 'SHOTS', best: 'low' }, puck_airhockey_relay: { unit: 'WON BY', best: 'high' },
      puck_starswarm_relay: { unit: 'PTS', best: 'high' }, puck_roller_relay: { unit: 'TIME', best: 'low' } },
    UNITS: { STROKES: ['stroke', 'strokes'], DARTS: ['dart', 'darts'], THROWS: ['throw', 'throws'], SHOTS: ['shot', 'shots'],
      PTS: ['point', 'points'], 'BAG PTS': ['bag point', 'bag points'] },
    VARIANTS: { NEON: 'Neon City', 'NEON CITY': 'Neon City', VELOCITY: 'Velocity Ring', 'VELOCITY RING': 'Velocity Ring',
      SKYFALL: 'Skyfall', CASTAWAY: 'Castaway', 'CASTAWAY COVE': 'Castaway', BLACKREEF: 'Blackreef',
      '501PRO': '501 Pro', '501 PRO': '501 Pro', CLOCK: 'The Clock', 'THE CLOCK': 'The Clock',
      '8BALL': '8-ball', '8 BALL': '8-ball', '8-BALL': '8-ball', '9BALL': '9-ball', '9 BALL': '9-ball', '9-BALL': '9-ball',
      DOUBLES8: 'Doubles 8-ball', DOUBLES: 'Doubles', 'HAPPY HOUR': 'Happy Hour', HAPPYHOUR: 'Happy Hour',
      HAPPY_HOUR: 'Happy Hour', 'HOUSE SPECIAL': 'House Special', HOUSE_SPECIAL: 'House Special',
      QUICK: 'Quick', FULL: 'Full', 'HOST NIGHT': 'Host Night', CLASSIC: 'Classic', 'CLASSIC 21': 'Classic 21' },
  };
  const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
  const personGames = (st) => int((st || {}).played) + int((st || {}).ffa_games);
  const winsText = (w, g) => `${w} win${w === 1 ? '' : 's'} · ${g} game${g === 1 ? '' : 's'}`;
  function recordText(slug, st) {
    st = st || {};
    const games = int(st.played), wins = int(st.wins), fg = int(st.ffa_games), fw = int(st.ffa_wins);
    if (!R.TEAM.includes(slug)) return games ? winsText(wins, games) : null;
    const parts = [];
    if (games) parts.push(`${wins}-${games - wins}`);
    if (fg) parts.push(!games ? winsText(fw, fg) : `9-ball ${winsText(fw, fg)}`);
    return parts.join(' · ') || null;
  }
  function rankWords(games) { const l = R.RANK_AFTER - int(games); return l <= 0 ? null : `${l} more game${l === 1 ? '' : 's'} to get a rank`; }
  function tierFor(r, games) {
    if (games < R.RANK_AFTER) return null;
    if (!r) return R.TIERS[R.TIERS.length - 1][0];
    const pts = Math.max(0, Math.round(100 * (Number(r.mu) - 3 * Number(r.sigma))));
    return (R.TIERS.find(([, floor]) => pts >= floor) || R.TIERS[R.TIERS.length - 1])[0];
  }
  function bestNumber(unit, score) {
    const v = int(score);
    if (unit === 'TIME') {
      const s = v / 1000;
      if (s < 60) return `${s.toFixed(1)} s`;
      const m = Math.floor(s / 60); return `${m}:${(s - 60 * m).toFixed(1).padStart(4, '0')}`;
    }
    if (unit === 'WON BY') return `won by ${v}`;
    const [one, many] = R.UNITS[unit] || [unit.toLowerCase(), unit.toLowerCase()];
    return `${v.toLocaleString('en-US')} ${v === 1 ? one : many}`;
  }
  function variantName(detail) {
    if (!detail) return null;
    const d = String(detail).trim().toUpperCase();
    if (R.VARIANTS[d]) return R.VARIANTS[d];
    return d.replace(/_/g, ' ').split(/\s+/).filter(Boolean).map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  }
  function bestText(unit, score, detail) { const v = variantName(detail); return `Best ${bestNumber(unit, score)}${v ? ` · ${v}` : ''}`; }
  function pickBest(slug, rows) {
    const meta = R.META[slug];
    const good = (rows || []).filter((r) => int(r.score) > 0);
    if (!meta || !good.length) return null;
    const low = meta.best === 'low';
    return good.slice().sort((a, b) => (int(a.score) - int(b.score)) * (low ? 1 : -1))[0];
  }
  function myGames(card, bests) {
    bests = bests || {};
    const stats = (card && card.stats) || {};
    const ranks = (card && card.ranks) || {};
    const order = Object.keys(GAME);
    const slugs = order.filter((x) => (stats[x] && (personGames(stats[x]) || int(stats[x].solo))) || (bests[x] && bests[x].length));
    const rows = slugs.map((slug) => {
      const st = stats[slug] || {};
      const n = personGames(st);
      const row = { slug, name: GAME[slug], tile: TILE[slug], games: n, tier: null, words: null, record: null, best: null };
      if (n) { row.tier = tierFor(ranks[slug], n); row.words = rankWords(n); row.record = recordText(slug, st); }
      else { const b = pickBest(slug, bests[slug]); if (b) row.best = bestText(R.META[slug].unit, int(b.score), b.detail); }
      return row;
    });
    rows.sort((a, b) => ((R.TIER_ORDER[b.tier] || 0) - (R.TIER_ORDER[a.tier] || 0)) || (b.games - a.games) || (order.indexOf(a.slug) - order.indexOf(b.slug)));
    const ranked = rows.filter((r) => r.tier);
    let top = null;
    const maxBy = (xs, f) => xs.reduce((m, x) => (m === null || f(x) > f(m) ? x : m), null);
    if (ranked.length) {
      const r = maxBy(ranked, (x) => (R.TIER_ORDER[x.tier] || 0) * 1e6 + x.games);
      top = { slug: r.slug, label: `${r.name} RANK`, tier: r.tier, words: null, record: r.record };
    } else if (rows.some((r) => r.games)) {
      const r = maxBy(rows, (x) => x.games);
      top = { slug: r.slug, label: `${r.name} RANK`, tier: null, words: r.words, record: r.record };
    }
    return { best: top, games: rows };
  }
  // the cloud's phone view (pf_view) as the card + bests myGames reads
  function fromView(v) {
    const card = { ranks: {}, stats: {} }, bests = {};
    for (const r of (v && v.ranks) || []) card.ranks[r.slug] = { mu: r.mu, sigma: r.sigma, games: r.games };
    for (const st of (v && v.stats) || []) card.stats[st.slug] = st;
    for (const b of (v && v.bests) || []) (bests[b.slug] = bests[b.slug] || []).push({ detail: b.detail, score: b.score });
    return myGames(card, bests);
  }

  window.TWCard = { screens: C, click, disarm, myGames, fromView, R, GAME, TILE, ONLINE, left };
})();
