import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { GameEngine } from './gameEngine';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
let activeTunnelProcess: ChildProcess | null = null;

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  let broadcastPending = false;
  const scheduleBroadcast = () => {
    if (broadcastPending) return;
    broadcastPending = true;
    setImmediate(() => {
      broadcastPending = false;
      broadcastSnapshot();
    });
  };

  const engine = new GameEngine(PORT, scheduleBroadcast);

  function broadcastSnapshot() {
    const payload = JSON.stringify({
      type: 'SNAPSHOT',
      data: engine.getPublicSnapshot(),
    });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  wss.on('connection', (ws) => {
    // Envia estado imediato ao conectar
    ws.send(
      JSON.stringify({
        type: 'SNAPSHOT',
        data: engine.getPublicSnapshot(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', serverNow: Date.now() }));
        }
      } catch {
        // Ignorar mensagens malformadas
      }
    });
  });

  // Loop oficial do servidor a cada 250ms para sincronizar o cronômetro e encerrar rodadas no tempo exato
  setInterval(() => {
    const changed = engine.tick();
    if (changed) {
      broadcastSnapshot();
    }
  }, 250);

  // ==================== ROTAS PÚBLICAS / PARTICIPANTE ====================

  app.get('/api/state', (_req, res) => {
    res.json(engine.getPublicSnapshot());
  });

  app.post('/api/participant/join', (req, res) => {
    const { roomCode, nickname, participantId, sessionToken } = req.body || {};
    const result = engine.joinParticipant(
      String(roomCode || ''),
      String(nickname || ''),
      participantId ? String(participantId) : undefined,
      sessionToken ? String(sessionToken) : undefined
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      participant: result.participant,
      sessionToken: result.sessionToken,
      snapshot: engine.getPublicSnapshot(),
    });
  });

  app.post('/api/participant/recover', (req, res) => {
    const { participantId, sessionToken } = req.body || {};
    const result = engine.recoverSession(String(participantId || ''), String(sessionToken || ''));
    if (!result.valid) {
      res.status(404).json({ valid: false });
      return;
    }
    res.json({
      valid: true,
      participant: result.participant,
      snapshot: engine.getPublicSnapshot(),
    });
  });

  app.post('/api/participant/circle', (req, res) => {
    const { participantId, sessionToken, points } = req.body || {};
    if (!Array.isArray(points)) {
      res.status(400).json({ error: 'Pontos do desenho inválidos.' });
      return;
    }
    const result = engine.submitCircleAttempt(
      String(participantId || ''),
      String(sessionToken || ''),
      points
    );
    if (!result.accepted) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      evaluation: result.evaluation,
      attempt: result.attempt,
      participant: result.participant,
      snapshot: engine.getPublicSnapshot(),
    });
  });

  // ==================== ROTAS ADMINISTRATIVAS ====================

  app.post('/api/admin/login', (req, res) => {
    const { pin } = req.body || {};
    const token = engine.verifyAdminPin(String(pin || ''));
    if (!token) {
      res.status(401).json({ error: 'PIN administrativo incorreto!' });
      return;
    }
    res.json({ adminToken: token, snapshot: engine.getPublicSnapshot() });
  });

  function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers['x-admin-token'];
    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!engine.isValidAdminToken(token)) {
      res.status(401).json({ error: 'Acesso não autorizado. Informe o PIN de administrador.' });
      return;
    }
    next();
  }

  app.post('/api/admin/new-room', requireAdmin, (req, res) => {
    const { customCode } = req.body || {};
    engine.createNewRoom(customCode ? String(customCode).toUpperCase() : undefined);
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/reset-game', requireAdmin, (_req, res) => {
    engine.resetGameKeepParticipants();
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/start-round', requireAdmin, (req, res) => {
    const { roundNumber } = req.body || {};
    const result = engine.startRound(roundNumber ? Number(roundNumber) : undefined);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/pause-round', requireAdmin, (_req, res) => {
    const result = engine.pauseRound();
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/resume-round', requireAdmin, (_req, res) => {
    const result = engine.resumeRound();
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/finish-round', requireAdmin, (_req, res) => {
    const result = engine.finishCurrentRound();
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/next-phase', requireAdmin, (_req, res) => {
    const result = engine.advanceToNextPhase();
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/show-podium', requireAdmin, (_req, res) => {
    engine.showFinalPodium();
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/config', requireAdmin, (req, res) => {
    engine.updateRemunerationConfig(req.body || {});
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/remove-participant', requireAdmin, (req, res) => {
    const { participantId } = req.body || {};
    engine.removeParticipant(String(participantId || ''));
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/add-bots', requireAdmin, (req, res) => {
    const { count } = req.body || {};
    engine.addSimulatedBots(Number(count || 6));
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/remove-bots', requireAdmin, (_req, res) => {
    engine.removeAllBots();
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  app.post('/api/admin/public-url', requireAdmin, (req, res) => {
    const { url } = req.body || {};
    engine.setPublicTunnelUrl(url ? String(url).trim() : null);
    res.json({ snapshot: engine.getPublicSnapshot() });
  });

  async function ensurePublicTunnel(): Promise<string> {
    const currentSnap = engine.getPublicSnapshot();
    if (currentSnap.publicTunnelUrl && activeTunnelProcess) {
      return currentSnap.publicTunnelUrl;
    }

    if (activeTunnelProcess) {
      activeTunnelProcess.kill();
      activeTunnelProcess = null;
    }

    const tunnelUrl = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tempo limite ao gerar túnel público. Verifique sua internet.'));
      }, 35000);

      const proc = spawn(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`],
        { shell: true }
      );
      activeTunnelProcess = proc;

      const checkOutput = (chunk: Buffer) => {
        const text = chunk.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      };

      proc.stdout.on('data', checkOutput);
      proc.stderr.on('data', checkOutput);

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      proc.on('exit', (code) => {
        activeTunnelProcess = null;
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error('Processo de túnel encerrado.'));
        }
      });
    });

    engine.setPublicTunnelUrl(tunnelUrl);
    console.log(`🌍 LINK PÚBLICO (4G/5G/Wi-Fi): ${tunnelUrl}/?sala=${engine.getPublicSnapshot().roomCode}`);
    return tunnelUrl;
  }

  app.post('/api/admin/start-tunnel', requireAdmin, async (_req, res) => {
    try {
      const tunnelUrl = await ensurePublicTunnel();
      res.json({
        tunnelUrl,
        snapshot: engine.getPublicSnapshot(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar túnel público.';
      res.status(500).json({ error: msg });
    }
  });

  // ==================== INTEGRAÇÃO FRONTEND (VITE / STATIC) ====================

  const distPath = path.resolve(process.cwd(), 'dist');
  if (isProduction && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    const snapshot = engine.getPublicSnapshot();
    console.log('\n============================================================');
    console.log('🎯 CÍRCULO PREMIADO — SERVIDOR ONLINE!');
    console.log(`📌 Código da Sala Atual: ${snapshot.roomCode}`);
    console.log(`🔑 PIN do Administrador: ${process.env.ADMIN_PIN || '1234'}`);
    console.log(`💻 Painel Admin (Notebook): http://localhost:${PORT}/admin`);
    console.log(`🏆 Placar Projetor (Telão): http://localhost:${PORT}/placar`);
    console.log(`📱 Visão Participante:      http://localhost:${PORT}/`);
    if (snapshot.lanUrls && snapshot.lanUrls.length > 0) {
      console.log(`🏠 Acesso apenas Mesmo Wi-Fi: ${snapshot.lanUrls[0]}`);
    }
    console.log('============================================================\n');
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
