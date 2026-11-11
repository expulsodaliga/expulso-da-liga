// Servidor do Expulso da Liga: entrega o jogo (pasta public/) e cuida das salas.
//
// Ele NÃO roda a partida: só cria salas com código, mostra as salas públicas
// e repassa as mensagens entre o host (quem criou a sala, peer 1) e os jogadores.
// Quem manda na partida continua sendo o host, no navegador dele.
//
// Protocolo (WebSocket):
//   texto (JSON) = controle
//     -> {"t":"host"}                     cria sala; resposta {"t":"hosted","code":"K7QM2P"}
//     -> {"t":"join","code":"K7QM2P"}     entra;     resposta {"t":"joined","id":N}
//     -> {"t":"meta", ...}                (host) nome, jogadores, fase, pública...
//     -> {"t":"kick","id":N}              (host) tira alguém da sala
//     <- {"t":"peer_in","id":N} / {"t":"peer_out","id":N}   (para o host)
//     <- {"t":"error","msg":"..."}        e a conexão fecha
//   binário = dados do jogo
//     enviado:  [destino int32 LE][dados]  (0 = todos, >0 = um, <0 = todos menos |n|)
//     recebido: [origem  int32 LE][dados]
//
// HTTP: GET /rooms  -> salas públicas esperando jogadores (JSON)
//       GET /health -> "ok"
//       qualquer outro caminho -> o jogo (arquivos da pasta public/), se ela existir

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PUBLIC = path.join(__dirname, "public");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".webp": "image/webp", ".mp3": "audio/mpeg", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".json": "application/json", ".ico": "image/x-icon", ".svg": "image/svg+xml",
};

function serveStatic(url, res) {
  let rel;
  try { rel = decodeURIComponent(url); } catch (e) { rel = "/"; }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.statusCode = 403; return res.end("no"); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end("não encontrado");
    }
    const ext = path.extname(file).toLowerCase();
    res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
    // index.html sempre fresco; o resto pode ficar em cache (os links levam ?v=).
    res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=86400");
    fs.createReadStream(file).pipe(res);
  });
}

const PORT = Number(process.env.PORT || 8080);
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOMS = 2000;
const MAX_PLAYERS = 8;
const MAX_MSG = 64 * 1024;

/** code -> {code, host: ws, peers: Map<id, ws>, nextId, meta, created} */
const rooms = new Map();

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let c = "";
    for (let i = 0; i < 6; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

function cleanCode(c) {
  return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function sendJson(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function frame(id, data) {
  const out = Buffer.allocUnsafe(4 + data.length);
  out.writeInt32LE(id, 0);
  data.copy(out, 4);
  return out;
}

function publicRooms() {
  const list = [];
  for (const r of rooms.values()) {
    const m = r.meta || {};
    if (!m.public) continue;
    list.push({
      code: r.code,
      name: String(m.name || "Sala da Liga").slice(0, 28),
      host: String(m.host || "").slice(0, 18),
      n: r.peers.size + 1,
      max: Math.min(Number(m.max) || MAX_PLAYERS, MAX_PLAYERS),
      phase: String(m.phase || "lobby"),
    });
  }
  list.sort((a, b) => b.n - a.n);
  return list.slice(0, 50);
}

function closeRoom(room, why) {
  if (!rooms.has(room.code)) return;
  rooms.delete(room.code);
  for (const ws of room.peers.values()) {
    sendJson(ws, { t: "error", msg: why });
    try { ws.close(4000, "room closed"); } catch (e) {}
  }
}

// ------------------------------------------------------------------ TURN (voz)
// Repasse de voz para quem está atrás de rede que bloqueia conexão direta (4G, empresa).
// Opcional. Configure no Render uma destas opções:
//   CF_TURN_KEY_ID + CF_TURN_TOKEN  → Cloudflare (gera credenciais temporárias)
//   TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL → qualquer servidor TURN (URLs separadas por vírgula)
let turnCache = null;
let turnAt = 0;

async function turnServers() {
  if (process.env.CF_TURN_KEY_ID && process.env.CF_TURN_TOKEN) {
    if (turnCache && Date.now() - turnAt < 6 * 3600 * 1000) return turnCache;
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.CF_TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CF_TURN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 86400 }),
      });
      const j = await r.json();
      const list = Array.isArray(j.iceServers) ? j.iceServers : j.iceServers ? [j.iceServers] : [];
      if (list.length) {
        turnCache = list;
        turnAt = Date.now();
      }
      return list;
    } catch (e) {
      console.error("TURN Cloudflare falhou:", e.message);
      return turnCache || [];
    }
  }
  if (process.env.TURN_URLS) {
    return [{ urls: process.env.TURN_URLS.split(",").map((u) => u.trim()).filter(Boolean), username: process.env.TURN_USERNAME || "", credential: process.env.TURN_CREDENTIAL || "" }];
  }
  return [];
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = req.url.split("?")[0];
  if (url === "/turn") {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    turnServers().then((list) => res.end(JSON.stringify({ iceServers: list })));
    return;
  }
  if (url === "/rooms") {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(publicRooms()));
  } else if (url === "/health" || (url === "/" && !fs.existsSync(path.join(PUBLIC, "index.html")))) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain");
    res.end("ok: " + rooms.size + " salas");
  } else if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(url, res);
  } else {
    res.statusCode = 405;
    res.end();
  }
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MSG });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.room = null;
  ws.peerId = 0;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch (e) { return; }
      handleControl(ws, msg);
      return;
    }
    const room = ws.room;
    if (!room || data.length < 4) return;
    const target = data.readInt32LE(0);
    const payload = data.subarray(4);
    if (ws.peerId === 1) {
      // host -> jogadores
      if (target > 0) {
        const to = room.peers.get(target);
        if (to && to.readyState === 1) to.send(frame(1, payload));
      } else {
        const skip = -target;
        for (const [id, to] of room.peers) {
          if (id !== skip && to.readyState === 1) to.send(frame(1, payload));
        }
      }
    } else if (room.host.readyState === 1) {
      // jogador -> só o host
      room.host.send(frame(ws.peerId, payload));
    }
  });

  ws.on("close", () => {
    const room = ws.room;
    if (!room) return;
    if (ws.peerId === 1) {
      closeRoom(room, "A sala foi encerrada: o host saiu.");
    } else if (room.peers.get(ws.peerId) === ws) {
      room.peers.delete(ws.peerId);
      sendJson(room.host, { t: "peer_out", id: ws.peerId });
    }
  });
});

function handleControl(ws, msg) {
  switch (msg.t) {
    case "host": {
      if (ws.room) return;
      if (rooms.size >= MAX_ROOMS) return sendJson(ws, { t: "error", msg: "Servidor lotado. Tente de novo em alguns minutos." });
      const code = newCode();
      if (!code) return sendJson(ws, { t: "error", msg: "Não deu para criar a sala agora." });
      const room = { code, host: ws, peers: new Map(), nextId: 2, meta: { public: false }, created: Date.now() };
      rooms.set(code, room);
      ws.room = room;
      ws.peerId = 1;
      sendJson(ws, { t: "hosted", code });
      break;
    }
    case "join": {
      if (ws.room) return;
      const room = rooms.get(cleanCode(msg.code));
      if (!room) {
        sendJson(ws, { t: "error", msg: "Sala não encontrada. Confira o código: talvez ela já tenha fechado." });
        return ws.close(4001, "no room");
      }
      if (room.peers.size + 1 >= MAX_PLAYERS) {
        sendJson(ws, { t: "error", msg: "A sala está cheia." });
        return ws.close(4002, "full");
      }
      const id = room.nextId++;
      ws.room = room;
      ws.peerId = id;
      room.peers.set(id, ws);
      sendJson(ws, { t: "joined", id });
      sendJson(room.host, { t: "peer_in", id });
      break;
    }
    case "meta": {
      if (ws.peerId !== 1 || !ws.room) return;
      const m = {};
      for (const k of ["name", "host", "max", "phase", "public"]) if (k in msg) m[k] = msg[k];
      ws.room.meta = m;
      break;
    }
    case "kick": {
      if (ws.peerId !== 1 || !ws.room) return;
      const to = ws.room.peers.get(Number(msg.id));
      if (to) {
        ws.room.peers.delete(Number(msg.id));
        sendJson(to, { t: "error", msg: "Você foi expulso da sala pelo host." });
        try { to.close(4003, "kicked"); } catch (e) {}
      }
      break;
    }
  }
}

// Derruba conexões mortas (celular que dormiu, aba fechada sem aviso).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  }
}, 25000);

server.listen(PORT, () => console.log("Expulso da Liga: servidor de salas na porta " + PORT));
