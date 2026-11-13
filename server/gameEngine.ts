import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {
  CircleAttempt,
  CircleEvaluation,
  GameRoomState,
  Participant,
  Point2D,
  PublicGameSnapshot,
  RemunerationConfig,
} from '../src/shared/types';
import { evaluateCircleDrawing } from '../src/shared/circleMath';
import {
  calculateRoundPayoutForParticipant,
  DEFAULT_REMUNERATION_CONFIG,
  sortParticipantsForRanking,
} from '../src/shared/roundRules';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'game-state.json');

interface PersistedData {
  room: GameRoomState;
  participantTokens: Record<string, string>; // participantId -> secret sessionToken
}

function generateRoomCode(): string {
  const chars = 'ABDEFGHJKLMNQRSTUVXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getLocalLanUrls(port: number): string[] {
  const interfaces = os.networkInterfaces();
  const urls: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

export class GameEngine {
  private room: GameRoomState;
  private participantTokens: Record<string, string> = {};
  private adminTokens: Set<string> = new Set();
  private onStateChange: () => void;
  private port: number;

  constructor(port: number, onStateChange: () => void) {
    this.port = port;
    this.onStateChange = onStateChange;
    const loaded = this.loadFromDisk();
    if (loaded) {
      this.room = loaded.room;
      this.participantTokens = loaded.participantTokens || {};
      if (this.room.roomCode === 'CP26') {
        this.room.roomCode = 'RH10';
        this.saveToDisk();
      }
      // Garantir que a duração padrão de 30s seja aplicada
      if (this.room.config.roundDurationSeconds === 60) {
        this.room.config.roundDurationSeconds = DEFAULT_REMUNERATION_CONFIG.roundDurationSeconds;
        this.room.roundDurationMs = this.room.config.roundDurationSeconds * 1000;
        if (this.room.status === 'LOBBY' || this.room.status === 'ROUND_INTRO') {
          this.room.remainingMs = this.room.roundDurationMs;
        }
        this.saveToDisk();
      }
      // Se o servidor reiniciou no meio de uma rodada ativa, pausamos com o tempo restante
      if (this.room.status === 'ROUND_ACTIVE') {
        const now = Date.now();
        const rem = this.room.roundEndsAt ? Math.max(0, this.room.roundEndsAt - now) : 0;
        if (rem > 0) {
          this.room.status = 'ROUND_PAUSED';
          this.room.remainingMsWhenPaused = rem;
          this.room.remainingMs = rem;
        } else {
          this.finishCurrentRound();
        }
      }
    } else {
      this.room = this.createFreshRoomState();
      this.saveToDisk();
    }
  }

  private createFreshRoomState(customCode?: string): GameRoomState {
    const config = structuredClone(DEFAULT_REMUNERATION_CONFIG);
    return {
      roomCode: customCode || generateRoomCode(),
      status: 'LOBBY',
      currentRound: 1,
      roundDurationMs: config.roundDurationSeconds * 1000,
      roundStartedAt: null,
      roundEndsAt: null,
      remainingMsWhenPaused: null,
      remainingMs: config.roundDurationSeconds * 1000,
      serverNow: Date.now(),
      paidRounds: {},
      config,
      participants: {},
      publicTunnelUrl: null,
      lanUrls: getLocalLanUrls(this.port),
    };
  }

  private loadFromDisk(): PersistedData | null {
    try {
      if (!fs.existsSync(STATE_FILE)) return null;
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedData;
      if (parsed && parsed.room && parsed.room.roomCode) {
        return parsed;
      }
    } catch (err) {
      console.error('Erro ao carregar estado salvo:', err);
    }
    return null;
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const payload: PersistedData = {
        room: this.room,
        participantTokens: this.participantTokens,
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erro ao salvar estado em disco:', err);
    }
  }

  public setPublicTunnelUrl(url: string | null): void {
    this.room.publicTunnelUrl = url;
    this.saveToDisk();
    this.onStateChange();
  }

  // ==================== AUTENTICAÇÃO DO ADMINISTRADOR ====================

  public verifyAdminPin(pin: string): string | null {
    const expectedPin = process.env.ADMIN_PIN || '1234';
    if (pin.trim() === expectedPin.trim()) {
      const token = crypto.randomBytes(24).toString('hex');
      this.adminTokens.add(token);
      return token;
    }
    return null;
  }

  public isValidAdminToken(token?: string | null): boolean {
    if (!token) return false;
    return this.adminTokens.has(token);
  }

  // ==================== SNAPSHOT E LOOP DE TEMPO ====================

  public tick(): boolean {
    const now = Date.now();
    this.room.serverNow = now;

    if (this.room.status === 'ROUND_ACTIVE' && this.room.roundEndsAt) {
      const remaining = Math.max(0, this.room.roundEndsAt - now);
      this.room.remainingMs = remaining;

      // Simular jogadas dos bots se houver bots na sala
      this.tickBots(now);

      if (remaining <= 0) {
        this.finishCurrentRound();
        return true;
      }
      return true;
    }
    return false;
  }

  public getPublicSnapshot(): PublicGameSnapshot {
    const now = Date.now();
    let remainingMs = this.room.remainingMs;
    if (this.room.status === 'ROUND_ACTIVE' && this.room.roundEndsAt) {
      remainingMs = Math.max(0, this.room.roundEndsAt - now);
    } else if (this.room.status === 'ROUND_PAUSED' && this.room.remainingMsWhenPaused !== null) {
      remainingMs = this.room.remainingMsWhenPaused;
    } else if (this.room.status === 'LOBBY' || this.room.status === 'ROUND_INTRO') {
      remainingMs = this.room.config.roundDurationSeconds * 1000;
    } else if (this.room.status === 'ROUND_FINISHED' || this.room.status === 'GAME_OVER') {
      remainingMs = 0;
    }

    const sortedParticipants = sortParticipantsForRanking(Object.values(this.room.participants));

    return {
      roomCode: this.room.roomCode,
      status: this.room.status,
      currentRound: this.room.currentRound,
      roundDurationMs: this.room.config.roundDurationSeconds * 1000,
      roundStartedAt: this.room.roundStartedAt,
      roundEndsAt: this.room.roundEndsAt,
      remainingMs,
      serverNow: now,
      paidRounds: this.room.paidRounds,
      config: this.room.config,
      participants: sortedParticipants,
      publicTunnelUrl: this.room.publicTunnelUrl,
      lanUrls: getLocalLanUrls(this.port),
    };
  }

  // ==================== GESTÃO DE PARTICIPANTES ====================

  public joinParticipant(
    roomCodeInput: string,
    nicknameInput: string,
    existingParticipantId?: string,
    existingSessionToken?: string
  ): {
    success: boolean;
    error?: string;
    participant?: Participant;
    sessionToken?: string;
  } {
    const normalizedCode = roomCodeInput.trim().toUpperCase();
    if (normalizedCode !== this.room.roomCode.toUpperCase()) {
      return {
        success: false,
        error: `Código da sala inválido! O código atual é ${this.room.roomCode}.`,
      };
    }

    // Caso 1: Reconexão de sessão já existente
    if (
      existingParticipantId &&
      existingSessionToken &&
      this.room.participants[existingParticipantId] &&
      this.participantTokens[existingParticipantId] === existingSessionToken
    ) {
      const existing = this.room.participants[existingParticipantId];
      existing.connected = true;
      this.saveToDisk();
      this.onStateChange();
      return {
        success: true,
        participant: existing,
        sessionToken: existingSessionToken,
      };
    }

    const cleanNickname = nicknameInput.trim().replace(/\s+/g, ' ');
    if (cleanNickname.length < 2 || cleanNickname.length > 22) {
      return {
        success: false,
        error: 'O apelido deve ter entre 2 e 22 caracteres.',
      };
    }

    // Impedir apelidos duplicados na mesma sala (case-insensitive)
    const duplicate = Object.values(this.room.participants).find(
      (p) => p.nickname.toLowerCase() === cleanNickname.toLowerCase()
    );

    if (duplicate) {
      return {
        success: false,
        error: `O apelido "${cleanNickname}" já está em uso nesta sala! Escolha outro apelido.`,
      };
    }

    const participantId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(20).toString('hex');

    const newParticipant: Participant = {
      id: participantId,
      nickname: cleanNickname,
      joinedAt: Date.now(),
      connected: true,
      balance: 0,
      totalValidCircles: 0,
      bestOverallAccuracy: 0,
      averageOverallAccuracy: 0,
      accuracySumAllValid: 0,
      currentRoundCircles: [],
      roundHistory: {},
    };

    this.room.participants[participantId] = newParticipant;
    this.participantTokens[participantId] = sessionToken;
    this.saveToDisk();
    this.onStateChange();

    return {
      success: true,
      participant: newParticipant,
      sessionToken,
    };
  }

  public recoverSession(
    participantId: string,
    sessionToken: string
  ): { valid: boolean; participant?: Participant } {
    const p = this.room.participants[participantId];
    if (!p || this.participantTokens[participantId] !== sessionToken) {
      return { valid: false };
    }
    p.connected = true;
    return { valid: true, participant: p };
  }

  public removeParticipant(participantId: string): boolean {
    if (!this.room.participants[participantId]) return false;
    delete this.room.participants[participantId];
    delete this.participantTokens[participantId];
    this.saveToDisk();
    this.onStateChange();
    return true;
  }

  // ==================== SUBMISSÃO E VALIDAÇÃO DE CÍRCULOS ====================

  public submitCircleAttempt(
    participantId: string,
    sessionToken: string,
    points: Point2D[]
  ): {
    accepted: boolean;
    error?: string;
    evaluation?: CircleEvaluation;
    attempt?: CircleAttempt;
    participant?: Participant;
  } {
    const participant = this.room.participants[participantId];
    if (!participant || this.participantTokens[participantId] !== sessionToken) {
      return { accepted: false, error: 'Sessão inválida ou expirada.' };
    }

    if (this.room.status !== 'ROUND_ACTIVE') {
      return { accepted: false, error: 'A rodada não está ativa no momento!' };
    }

    if (this.room.roundEndsAt && Date.now() > this.room.roundEndsAt + 400) {
      return { accepted: false, error: 'Tempo da rodada esgotado!' };
    }

    const evaluation = evaluateCircleDrawing(points);
    const attempt: CircleAttempt = {
      id: crypto.randomUUID(),
      roundNumber: this.room.currentRound,
      accuracy: evaluation.accuracy,
      isValid: evaluation.isValid,
      timestamp: Date.now(),
    };

    if (evaluation.isValid) {
      participant.currentRoundCircles.push(attempt);
      participant.totalValidCircles += 1;
      participant.accuracySumAllValid += evaluation.accuracy;
      if (evaluation.accuracy > participant.bestOverallAccuracy) {
        participant.bestOverallAccuracy = evaluation.accuracy;
      }
      participant.averageOverallAccuracy =
        Math.round((participant.accuracySumAllValid / participant.totalValidCircles) * 10) / 10;

      this.saveToDisk();
      this.onStateChange();
    }

    return {
      accepted: true,
      evaluation,
      attempt,
      participant,
    };
  }

  // ==================== CONTROLES DO ADMINISTRADOR ====================

  public createNewRoom(customCode?: string): GameRoomState {
    const tunnelUrl = this.room.publicTunnelUrl;
    this.room = this.createFreshRoomState(customCode);
    this.room.publicTunnelUrl = tunnelUrl;
    this.participantTokens = {};
    this.saveToDisk();
    this.onStateChange();
    return this.room;
  }

  public resetGameKeepParticipants(): GameRoomState {
    const config = this.room.config;
    this.room.status = 'LOBBY';
    this.room.currentRound = 1;
    this.room.roundStartedAt = null;
    this.room.roundEndsAt = null;
    this.room.remainingMsWhenPaused = null;
    this.room.remainingMs = config.roundDurationSeconds * 1000;
    this.room.paidRounds = {};

    for (const p of Object.values(this.room.participants)) {
      p.balance = 0;
      p.totalValidCircles = 0;
      p.bestOverallAccuracy = 0;
      p.averageOverallAccuracy = 0;
      p.accuracySumAllValid = 0;
      p.currentRoundCircles = [];
      p.roundHistory = {};
    }

    this.saveToDisk();
    this.onStateChange();
    return this.room;
  }

  public updateRemunerationConfig(newConfig: Partial<RemunerationConfig>): RemunerationConfig {
    this.room.config = {
      ...this.room.config,
      ...newConfig,
      round3SkillTiers: {
        ...this.room.config.round3SkillTiers,
        ...(newConfig.round3SkillTiers || {}),
      },
      round4Goals: {
        ...this.room.config.round4Goals,
        ...(newConfig.round4Goals || {}),
      },
      round5Competencies: {
        ...this.room.config.round5Competencies,
        ...(newConfig.round5Competencies || {}),
      },
    };
    this.room.roundDurationMs = this.room.config.roundDurationSeconds * 1000;
    if (this.room.status === 'LOBBY' || this.room.status === 'ROUND_INTRO') {
      this.room.remainingMs = this.room.roundDurationMs;
    }
    this.saveToDisk();
    this.onStateChange();
    return this.room.config;
  }

  public startRound(roundNumber?: number): { ok: boolean; error?: string } {
    const targetRound = roundNumber ?? this.room.currentRound;
    if (targetRound < 1 || targetRound > 5) {
      return { ok: false, error: 'Número de rodada inválido (deve ser de 1 a 5).' };
    }

    // Se a rodada solicitada já foi paga antes, limpamos o pagamento anterior caso o admin queira repetir a rodada,
    // subtraindo o valor previamente pago daquela rodada para nunca duplicar saldo!
    if (this.room.paidRounds[targetRound]) {
      for (const p of Object.values(this.room.participants)) {
        const previousRecord = p.roundHistory[targetRound];
        if (previousRecord) {
          p.balance = Math.max(0, p.balance - previousRecord.amountEarned);
          delete p.roundHistory[targetRound];
        }
      }
      delete this.room.paidRounds[targetRound];
    }

    this.room.currentRound = targetRound;
    this.room.status = 'ROUND_ACTIVE';
    const durationMs = this.room.config.roundDurationSeconds * 1000;
    const now = Date.now();
    this.room.roundDurationMs = durationMs;
    this.room.roundStartedAt = now;
    this.room.roundEndsAt = now + durationMs;
    this.room.remainingMsWhenPaused = null;
    this.room.remainingMs = durationMs;

    // Limpar tentativas da rodada atual para todos os participantes
    for (const p of Object.values(this.room.participants)) {
      p.currentRoundCircles = [];
    }

    this.saveToDisk();
    this.onStateChange();
    return { ok: true };
  }

  public pauseRound(): { ok: boolean; error?: string } {
    if (this.room.status !== 'ROUND_ACTIVE' || !this.room.roundEndsAt) {
      return { ok: false, error: 'A rodada não está em andamento para ser pausada.' };
    }
    const now = Date.now();
    const remaining = Math.max(0, this.room.roundEndsAt - now);
    this.room.status = 'ROUND_PAUSED';
    this.room.remainingMsWhenPaused = remaining;
    this.room.remainingMs = remaining;
    this.room.roundEndsAt = null;
    this.saveToDisk();
    this.onStateChange();
    return { ok: true };
  }

  public resumeRound(): { ok: boolean; error?: string } {
    if (this.room.status !== 'ROUND_PAUSED' || this.room.remainingMsWhenPaused === null) {
      return { ok: false, error: 'A rodada não está pausada.' };
    }
    const now = Date.now();
    this.room.status = 'ROUND_ACTIVE';
    this.room.roundEndsAt = now + this.room.remainingMsWhenPaused;
    this.room.remainingMs = this.room.remainingMsWhenPaused;
    this.room.remainingMsWhenPaused = null;
    this.saveToDisk();
    this.onStateChange();
    return { ok: true };
  }

  public finishCurrentRound(): { ok: boolean; error?: string } {
    if (this.room.status !== 'ROUND_ACTIVE' && this.room.status !== 'ROUND_PAUSED') {
      return { ok: false, error: 'Nenhuma rodada ativa para finalizar.' };
    }

    const round = this.room.currentRound;
    this.room.status = 'ROUND_FINISHED';
    this.room.roundEndsAt = null;
    this.room.remainingMsWhenPaused = null;
    this.room.remainingMs = 0;

    // Proteção transacional contra duplicidade de pagamento
    if (!this.room.paidRounds[round]) {
      this.room.paidRounds[round] = true;
      for (const p of Object.values(this.room.participants)) {
        const payout = calculateRoundPayoutForParticipant(
          round,
          p.currentRoundCircles,
          this.room.config
        );
        p.balance += payout.amountEarned;
        p.roundHistory[round] = payout;
      }
    }

    this.saveToDisk();
    this.onStateChange();
    return { ok: true };
  }

  public advanceToNextPhase(): { ok: boolean; error?: string } {
    // Se a rodada atual ainda estava ativa/pausada, finaliza e calcula os pagamentos primeiro
    if (this.room.status === 'ROUND_ACTIVE' || this.room.status === 'ROUND_PAUSED') {
      this.finishCurrentRound();
    }

    if (this.room.currentRound < 5) {
      this.room.currentRound += 1;
      this.room.status = 'ROUND_INTRO';
      this.room.roundStartedAt = null;
      this.room.roundEndsAt = null;
      this.room.remainingMsWhenPaused = null;
      this.room.remainingMs = this.room.config.roundDurationSeconds * 1000;
      for (const p of Object.values(this.room.participants)) {
        p.currentRoundCircles = [];
      }
    } else {
      this.room.status = 'GAME_OVER';
      this.room.remainingMs = 0;
    }

    this.saveToDisk();
    this.onStateChange();
    return { ok: true };
  }

  public showFinalPodium(): { ok: boolean } {
    if (this.room.status === 'ROUND_ACTIVE' || this.room.status === 'ROUND_PAUSED') {
      this.finishCurrentRound();
    }
    this.room.status = 'GAME_OVER';
    this.room.remainingMs = 0;
    this.saveToDisk();
    this.onStateChange();
    return { ok: true };
  }

  // ==================== SIMULAÇÃO DE PARTICIPANTES (PARA TESTES) ====================

  public addSimulatedBots(count = 6): Participant[] {
    const botProfiles = [
      'Ana Clara (Bot)',
      'Bruno Mendes (Bot)',
      'Camila Rocha (Bot)',
      'Diego Ferreira (Bot)',
      'Eduarda Lima (Bot)',
      'Felipe Santos (Bot)',
      'Gabriela Alves (Bot)',
      'Henrique Costa (Bot)',
      'Isabela Martins (Bot)',
      'João Pedro (Bot)',
      'Larissa Gomes (Bot)',
      'Matheus Ribeiro (Bot)',
      'Natália Dias (Bot)',
      'Otávio Cardoso (Bot)',
      'Paula Teixeira (Bot)',
    ];

    const created: Participant[] = [];
    for (const name of botProfiles) {
      if (created.length >= count) break;
      const exists = Object.values(this.room.participants).some(
        (p) => p.nickname.toLowerCase() === name.toLowerCase()
      );
      if (exists) continue;

      const id = crypto.randomUUID();
      const token = crypto.randomBytes(16).toString('hex');
      const bot: Participant = {
        id,
        nickname: name,
        joinedAt: Date.now(),
        connected: true,
        isBot: true,
        balance: 0,
        totalValidCircles: 0,
        bestOverallAccuracy: 0,
        averageOverallAccuracy: 0,
        accuracySumAllValid: 0,
        currentRoundCircles: [],
        roundHistory: {},
      };
      this.room.participants[id] = bot;
      this.participantTokens[id] = token;
      created.push(bot);
    }

    this.saveToDisk();
    this.onStateChange();
    return created;
  }

  public removeAllBots(): number {
    let removed = 0;
    for (const [id, p] of Object.entries(this.room.participants)) {
      if (p.isBot) {
        delete this.room.participants[id];
        delete this.participantTokens[id];
        removed++;
      }
    }
    if (removed > 0) {
      this.saveToDisk();
      this.onStateChange();
    }
    return removed;
  }

  private lastBotTick = 0;

  private tickBots(now: number): void {
    if (now - this.lastBotTick < 1300) return;
    this.lastBotTick = now;

    const bots = Object.values(this.room.participants).filter((p) => p.isBot);
    if (bots.length === 0) return;

    let anyUpdated = false;
    for (let idx = 0; idx < bots.length; idx++) {
      const bot = bots[idx];
      // Cada bot tem uma chance de concluir um círculo a cada ~2.2s
      if (Math.random() > 0.42) continue;

      // Perfil diferente por índice do bot (uns mais precisos, outros mais rápidos)
      const skillBase = 72 + ((idx * 7) % 24); // entre 72% e 95%
      const variance = (Math.random() - 0.45) * 10;
      const accuracy = Math.round(Math.max(58, Math.min(98.8, skillBase + variance)) * 10) / 10;

      const attempt: CircleAttempt = {
        id: crypto.randomUUID(),
        roundNumber: this.room.currentRound,
        accuracy,
        isValid: true,
        timestamp: now,
      };

      bot.currentRoundCircles.push(attempt);
      bot.totalValidCircles += 1;
      bot.accuracySumAllValid += accuracy;
      if (accuracy > bot.bestOverallAccuracy) {
        bot.bestOverallAccuracy = accuracy;
      }
      bot.averageOverallAccuracy =
        Math.round((bot.accuracySumAllValid / bot.totalValidCircles) * 10) / 10;
      anyUpdated = true;
    }

    if (anyUpdated) {
      this.saveToDisk();
    }
  }
}
