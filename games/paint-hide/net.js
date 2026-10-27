/* =========================================================================
   PAINT & HIDE ― みんなで あそぶ (オンライン)
   へやを 作った人 (ホスト) の ブラウザが ゲームを 動かし、入った人には 見えている ものだけを 送る。
   自分の 位置は 自分の ブラウザが 決めて ホストへ 送る。撃つ・かくれるは ホストが 判定する。
   通信は PeerJS (WebRTC)。?loop を つけると 同じ ブラウザの タブどうしで つなぐ (試験用)。
   ========================================================================= */
'use strict';

const NET_PREFIX = 'painthide-';
const SNAP_GAP = 1 / 15;

/* ---------- 試験用: BroadcastChannel で PeerJS と 同じ 形の つなぎかたを まねる ---------- */
class LoopConn {
  constructor(p, peer) { this.p = p; this.peer = peer; this.h = {}; this.open = false; }
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); }
  emit(ev, ...a) { if (ev === 'open') this.open = true; (this.h[ev] || []).forEach((f) => f(...a)); }
  send(d) { this.p.bc.postMessage({ from: this.p.id, to: this.peer, type: 'data', data: d }); }
  close() { this.p.bc.postMessage({ from: this.p.id, to: this.peer, type: 'close' }); delete this.p.conns[this.peer]; }
}
class LoopPeer {
  constructor(id) {
    this.id = id || 'p' + Math.random().toString(36).slice(2, 9);
    this.h = {}; this.conns = {};
    this.bc = new BroadcastChannel('painthide-loop');
    this.bc.onmessage = (e) => this.recv(e.data);
    setTimeout(() => this.emit('open', this.id), 20);
  }
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); }
  emit(ev, ...a) { (this.h[ev] || []).forEach((f) => f(...a)); }
  connect(to) { const c = new LoopConn(this, to); this.conns[to] = c; this.bc.postMessage({ from: this.id, to, type: 'hi' }); return c; }
  recv(m) {
    if (m.to !== this.id) return;
    let c = this.conns[m.from];
    if (m.type === 'hi') {
      if (!c) { c = new LoopConn(this, m.from); this.conns[m.from] = c; this.emit('connection', c); }
      this.bc.postMessage({ from: this.id, to: m.from, type: 'ok' });
      setTimeout(() => c.emit('open'), 0);
    } else if (m.type === 'ok') { if (c) c.emit('open'); }
    else if (m.type === 'data') { if (c) c.emit('data', m.data); }
    else if (m.type === 'close') { if (c) { delete this.conns[m.from]; c.emit('close'); } }
  }
  destroy() { for (const k in this.conns) this.conns[k].close(); this.bc.close(); }
}

const Net = {
  role: null,               // null / host / client
  code: '', peer: null,
  members: [],              // ホスト: 入った人 { conn, peer, skin(データ), agent }
  hostConn: null,
  sendT: 0,
  attempt: 0,              // へや作り・つなぎの ためし番号 (古い 返事を 無視する)
  loop: /[?&]loop/.test(location.search),

  get on() { return !!this.role; },
  get host() { return this.role === 'host'; },
  get client() { return this.role === 'client'; },

  async loadPeer() {
    if (this.loop || window.Peer) return;
    for (const src of ['vendor/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js']) {
      try {
        await new Promise((ok, ng) => { const s = document.createElement('script'); s.src = src; s.onload = () => (window.Peer ? ok() : ng()); s.onerror = ng; document.head.appendChild(s); });
        return;
      } catch (e) { /* つぎを ためす */ }
    }
    throw new Error('peerjs');
  },
  newPeer(id) { return this.loop ? new LoopPeer(id) : new window.Peer(id, { debug: 0 }); },
  genCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let r = ''; for (let i = 0; i < 4; i++) r += c[Math.floor(Math.random() * c.length)];
    return r;
  },
  maxPlayers() { const n = UI.settings.oni; return HIDERS[n] + n; },

  leave() {
    this.attempt++;
    const p = this.peer;
    this.role = null; this.peer = null; this.hostConn = null;
    for (const m of this.members) { try { m.conn.close(); } catch (e) { /* もう 切れている */ } }
    this.members = [];
    if (p) { try { p.destroy(); } catch (e) { /* もう 切れている */ } }
  },

  /* ------------------------------ ホスト ------------------------------ */
  async hostRoom() {
    this.leave();
    const token = this.attempt;
    UI.netMsg('じゅんびちゅう…');
    try { await this.loadPeer(); } catch (e) { UI.netMsg('通信の じゅんびが できませんでした。ネットに つながっているか たしかめてね', true); return; }
    for (let tries = 0; tries < 3; tries++) {
      if (token !== this.attempt) return;
      const code = this.genCode();
      const peer = this.newPeer(NET_PREFIX + code);
      const ok = await new Promise((done) => {
        let opened = false;
        peer.on('open', () => { opened = true; done(true); });
        peer.on('error', (e) => { if (!opened) done(false); else if (token === this.attempt) UI.netMsg('通信エラー (' + (e.type || '') + ')', true); });
        peer.on('connection', (conn) => { if (token === this.attempt) this.onConn(conn); else conn.close(); });
      });
      /* とちゅうで やめた / べつの へやに かわった ときは すてる */
      if (!ok || token !== this.attempt) { try { peer.destroy(); } catch (x) { /* */ } if (token !== this.attempt) return; continue; }
      this.peer = peer; this.role = 'host'; this.code = code; UI.onlineRoom(); return;
    }
    UI.netMsg('へやを 作れませんでした。すこし まって もう一度 ためしてね', true);
  },

  onConn(conn) {
    conn.on('data', (d) => this.onClientData(conn, d));
    conn.on('close', () => this.onGone(conn));
    conn.on('error', () => this.onGone(conn));
  },

  onClientData(conn, d) {
    if (!d || typeof d !== 'object') return;
    const m = this.members.find((x) => x.conn === conn);
    if (d.t === 'hello') {
      if (m) return;
      let why = '';
      if (G.mode !== 'title') why = 'いまは ゲームちゅうです。おわるまで まってね';
      else if (this.members.length + 1 >= this.maxPlayers()) why = 'へやが いっぱいです';
      if (why) { try { conn.send({ t: 'reject', why }); } catch (e) { /* */ } setTimeout(() => conn.close(), 300); return; }
      this.members.push({ conn, peer: conn.peer, skin: d.skin || null, agent: null });
      this.sendLobby();
      return;
    }
    if (!m || !m.agent || G.mode !== 'play') return;
    const a = m.agent;
    if (d.t === 'st') {
      if (a.inSpot || (a.role === 'oni' && Game.phase === 'hide')) return;
      /* ホストが 動かした (かくれ場所から 出た など) あとの 古い 位置は 使わない */
      if (d.tp !== (a.tp || 0) || typeof d.x !== 'number' || typeof d.y !== 'number' || !isFinite(d.x) || !isFinite(d.y)) return;
      a.x = clamp(d.x, TILE, (MW - 1) * TILE); a.y = clamp(d.y, TILE, (MH - 1) * TILE);
      a.dir = d.d > 0 ? 1 : -1; a.moving = !!d.m; if (typeof d.a === 'number' && isFinite(d.a)) a.aim = d.a;
      if (a.moving) a.walk += SNAP_GAP * 14;
    } else if (d.t === 'act') Game.remoteAct(a, d);
    else if (d.t === 'skin' && d.data) {
      a.skin = Skin.fromData(d.data);
      a.painting = 0.6;
      this.emit({ t: 'skin', id: a.id, data: d.data }, m);
    }
  },

  onGone(conn) {
    const m = this.members.find((x) => x.conn === conn);
    if (!m) return;
    this.members = this.members.filter((x) => x !== m);
    /* ゲーム中に ぬけた人は コンピューターが 引きつぐ */
    if (m.agent) {
      const a = m.agent;
      a.remote = null; a.painting = 0;
      a.brain = a.role === 'oni' ? new OniBrain(a) : new HiderBrain(a);
      if (a.role === 'hider' && (a.inSpot || Game.phase === 'hunt')) { a.brain.ready = true; a.brain.plan = { kind: 'camo', x: a.x, y: a.y }; }
    }
    if (G.mode === 'title') this.sendLobby();
  },

  sendLobby() {
    const skins = [Game.mySkin.toData(), ...this.members.map((m) => m.skin)];
    UI.onlineRoom(skins);
    this.members.forEach((m) => { try { m.conn.send({ t: 'lobby', code: this.code, skins, max: this.maxPlayers() }); } catch (e) { /* */ } });
  },

  emit(msg, except) {
    for (const m of this.members) if (m !== except) { try { m.conn.send(msg); } catch (e) { /* */ } }
  },

  /* ホストが スタートを おした */
  startGame() {
    Game.start({ oni: UI.settings.oni, humans: this.members });
    /* 入った人の 見た目は 読みこみ中かもしれないので、もらった データを そのまま まわす */
    const data = Game.agents.map((o) => { const m = this.members.find((x) => x.agent === o); return (m && m.skin) || o.skin.toData(); });
    for (const m of this.members) {
      const a = m.agent;
      try {
        m.conn.send({
          t: 'start', you: a.id, oni: UI.settings.oni,
          agents: Game.agents.map((o, i) => ({ id: o.id, role: o.role, name: o === a ? 'あなた' : o === Game.player ? 'ホスト' : o.name, x: Math.round(o.x), y: Math.round(o.y), skin: o === a ? null : data[i] })),
        });
      } catch (e) { /* */ }
    }
  },

  /* 入った人 1人ぶんの 見えている もの */
  snapshot(R) {
    const blind = R.role === 'oni' && Game.phase === 'hide';
    const ox = R.inSpot ? R.inSpot.cx : R.x, oy = R.inSpot ? R.inSpot.cy : R.y - 20;
    const see = (x, y) => !blind && (!R.alive || canSee(ox, oy, x, y, Game.visionOf(R) + 40));
    return {
      t: 's', ph: Game.phase, tt: Math.round(Game.t * 10) / 10, left: Game.left(),
      a: Game.agents.filter((o) => o !== R && !o.inSpot && (o.alive ? see(o.x, o.y - 20) : !R.alive))
        .map((o) => [o.id, Math.round(o.x), Math.round(o.y), o.dir, o.moving ? 1 : 0, o.alive ? 1 : 0, Math.round(o.aim * 100), o.painting > 0 ? 1 : 0]),
      b: Game.bullets.filter((b) => see(b.x, b.y)).map((b) => [b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy)]),
      f: Game.prints.filter((f) => see(f.x, f.y)).map((f) => [Math.round(f.x), Math.round(f.y), Math.round((Game.clock - f.t) * 10)]),
      you: [R.alive ? 1 : 0, R.inSpot ? R.inSpot.i : -1, R.ammo, R.tp || 0, Math.round(R.x), Math.round(R.y)],
    };
  },

  tick(dt) {
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = SNAP_GAP;
    if (this.host) {
      for (const m of this.members) if (m.agent && m.agent.remote) { try { m.conn.send(this.snapshot(m.agent)); } catch (e) { /* */ } }
    } else if (this.client && this.hostConn) {
      const p = Game.player;
      try { this.hostConn.send({ t: 'st', x: Math.round(p.x), y: Math.round(p.y), d: p.dir, m: p.moving ? 1 : 0, a: Math.round(p.aim * 100) / 100, tp: p.tp || 0 }); } catch (e) { /* */ }
    }
  },

  /* ------------------------------ 入る人 ------------------------------ */
  async joinRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 4) { UI.netMsg('あいことばは 4もじ だよ', true); return; }
    this.leave();
    const token = this.attempt;
    UI.netMsg('つないでいます…');
    try { await this.loadPeer(); } catch (e) { UI.netMsg('通信の じゅんびが できませんでした。ネットに つながっているか たしかめてね', true); return; }
    if (token !== this.attempt) return;
    const peer = this.newPeer();
    this.peer = peer; this.role = 'client'; this.code = code;
    let opened = false;
    peer.on('open', () => {
      const conn = peer.connect(NET_PREFIX + code, { reliable: true });
      this.hostConn = conn;
      conn.on('open', () => { opened = true; conn.send({ t: 'hello', skin: Game.mySkin.toData() }); UI.netMsg('つながった！'); });
      conn.on('data', (d) => this.onHostData(d));
      conn.on('close', () => { if (this.client) { this.leave(); UI.netLost(); } });
    });
    peer.on('error', () => { if (!opened && token === this.attempt) { this.leave(); UI.netMsg('へやが 見つかりません。あいことばを たしかめてね', true); } });
    setTimeout(() => { if (token === this.attempt && this.client && !opened) { this.leave(); UI.netMsg('へやが 見つかりません。あいことばを たしかめてね', true); } }, 9000);
  },

  send(d) { if (this.hostConn) { try { this.hostConn.send(d); } catch (e) { /* */ } } },

  onHostData(d) {
    if (!d || typeof d !== 'object') return;
    switch (d.t) {
      case 'lobby': UI.onlineRoom(d.skins, d.code); break;
      case 'reject': this.leave(); UI.netMsg(d.why, true); break;
      case 'start': Game.startClient(d); UI.reveal(); break;
      case 's': Game.applySnap(d); break;
      case 'skin': { const a = Game.agents[d.id]; if (a && a !== Game.player) { a.skin = Skin.fromData(d.data); a.painting = 0.6; } break; }
      case 'ev': Game.clientEvent(d); break;
      case 'over': Game.clientOver(d); break;
    }
  },
};
