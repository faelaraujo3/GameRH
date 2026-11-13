export type GameStatus =
  | 'LOBBY'           // Aguardando início da 1ª rodada
  | 'ROUND_INTRO'     // Exibindo regras da rodada antes de valer o tempo (ou aguardando admin iniciar)
  | 'ROUND_ACTIVE'    // Rodada de 60s em andamento (canvas liberado)
  | 'ROUND_PAUSED'    // Rodada pausada pelo administrador
  | 'ROUND_FINISHED'  // Rodada encerrada, recompensas calculadas e exibidas
  | 'GAME_OVER';      // Todas as 5 rodadas finalizadas — tela final com vencedores

export interface Point2D {
  x: number;
  y: number;
}

export interface FittedCircle {
  centerX: number;
  centerY: number;
  radius: number;
}

export interface CircleEvaluation {
  isValid: boolean;
  accuracy: number; // 0 to 100, 1 casa decimal (ex: 87.4)
  reason?: string;
  fittedCircle?: FittedCircle;
  normalizedRadialError?: number;
  closureRatio?: number;
  coverageDegrees?: number;
}

export interface CircleAttempt {
  id: string;
  roundNumber: number;
  accuracy: number;
  isValid: boolean;
  timestamp: number;
}

export interface RoundPayoutRecord {
  roundNumber: number;
  roundName: string;
  validCirclesCount: number;
  qualifiedMetaCirclesCount: number; // Rodada 4: círculos >= 80%
  bestAccuracy: number;
  averageAccuracy: number;
  lastFiveAverageAccuracy: number | null; // Rodada 5: média dos últimos 5 válidos
  amountEarned: number;
  explanation: string;
  paidAt: number;
}

export interface Participant {
  id: string;
  nickname: string;
  joinedAt: number;
  connected: boolean;
  isBot?: boolean;
  balance: number; // Dinheiro acumulado total em R$
  totalValidCircles: number;
  bestOverallAccuracy: number;
  averageOverallAccuracy: number;
  accuracySumAllValid: number;
  currentRoundCircles: CircleAttempt[];
  roundHistory: Record<number, RoundPayoutRecord>; // indexado por roundNumber (1..5)
}

export interface SkillTier {
  minAccuracy: number;
  maxAccuracy: number;
  reward: number;
  label: string;
}

export interface RemunerationConfig {
  roundDurationSeconds: number; // padrão 60
  round1FixedSalary: number; // padrão 500
  round2PerCircleReward: number; // padrão 50
  round3SkillTiers: {
    tier70to79: number; // 100
    tier80to89: number; // 250
    tier90to94: number; // 400
    tier95to100: number; // 600
  };
  round4Goals: {
    minAccuracyThreshold: number; // 80
    target1MinCircles: number; // 5
    target1Reward: number; // 500
    target2MinCircles: number; // 8
    target2Reward: number; // 800
  };
  round5Competencies: {
    requiredValidCircles: number; // 5
    tier70to79: number; // 200
    tier80to89: number; // 400
    tier90plus: number; // 600
  };
}

export interface GameRoomState {
  roomCode: string;
  status: GameStatus;
  currentRound: number; // 1 a 5
  roundDurationMs: number; // 60000
  roundStartedAt: number | null; // timestamp do servidor
  roundEndsAt: number | null; // timestamp do servidor
  remainingMsWhenPaused: number | null;
  remainingMs: number; // calculado em tempo real pelo servidor no broadcast
  serverNow: number;
  paidRounds: Record<number, boolean>; // Garante que nenhuma rodada seja paga 2x
  config: RemunerationConfig;
  participants: Record<string, Participant>;
  publicTunnelUrl?: string | null;
  lanUrls?: string[];
}

export interface PublicGameSnapshot {
  roomCode: string;
  status: GameStatus;
  currentRound: number;
  roundDurationMs: number;
  roundStartedAt: number | null;
  roundEndsAt: number | null;
  remainingMs: number;
  serverNow: number;
  paidRounds: Record<number, boolean>;
  config: RemunerationConfig;
  participants: Participant[]; // Já ordenado pelo ranking oficial!
  publicTunnelUrl?: string | null;
  lanUrls?: string[];
}
