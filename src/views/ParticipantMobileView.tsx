import React, { useState, useEffect, useMemo } from 'react';
import {
  CircleEvaluation,
  Participant,
  Point2D,
  PublicGameSnapshot,
} from '../shared/types';
import {
  calculateRoundPayoutForParticipant,
  formatCurrencyBRL,
  formatPercentageBR,
  getAvatarGradient,
  getInitials,
  getRoundsMetadata,
} from '../shared/roundRules';
import { CircleCanvas } from '../components/CircleCanvas';
import { FinalWinnersScreen } from '../components/FinalWinnersScreen';
import { RoundRankingBalloon } from '../components/RoundRankingBalloon';

interface ParticipantMobileViewProps {
  snapshot: PublicGameSnapshot | null;
  connected: boolean;
  displayRemainingSeconds: number;
  applySnapshot: (data: PublicGameSnapshot) => void;
}

const STORAGE_KEYS = {
  PARTICIPANT_ID: 'cp_participant_id',
  SESSION_TOKEN: 'cp_session_token',
  ROOM_CODE: 'cp_room_code',
};

export const ParticipantMobileView: React.FC<ParticipantMobileViewProps> = ({
  snapshot,
  connected,
  displayRemainingSeconds,
  applySnapshot,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [nicknameInput, setNicknameInput] = useState<string>('');
  const [participantId, setParticipantId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.PARTICIPANT_ID)
  );
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN)
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState<boolean>(false);
  const [recoverChecked, setRecoverChecked] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('sala') || params.get('code');
    if (codeParam) {
      setRoomCodeInput(codeParam.toUpperCase());
    } else if (snapshot?.roomCode && !roomCodeInput) {
      setRoomCodeInput(snapshot.roomCode);
    }
  }, [snapshot?.roomCode, roomCodeInput]);

  useEffect(() => {
    async function tryRecover() {
      const savedId = localStorage.getItem(STORAGE_KEYS.PARTICIPANT_ID);
      const savedToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (!savedId || !savedToken) {
        setRecoverChecked(true);
        return;
      }

      try {
        const res = await fetch('/api/participant/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: savedId, sessionToken: savedToken }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.snapshot) {
            setParticipantId(savedId);
            setSessionToken(savedToken);
            applySnapshot(data.snapshot);
            setRecoverChecked(true);
            return;
          }
        }
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
        localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
        setParticipantId(null);
        setSessionToken(null);
      } catch {
        // Manter credenciais para reconexão
      } finally {
        setRecoverChecked(true);
      }
    }
    tryRecover();
  }, [applySnapshot]);

  const me: Participant | null = useMemo(() => {
    if (!snapshot || !participantId) return null;
    return snapshot.participants.find((p) => p.id === participantId) || null;
  }, [snapshot, participantId]);

  const myRankPosition = useMemo(() => {
    if (!snapshot || !participantId) return null;
    const idx = snapshot.participants.findIndex((p) => p.id === participantId);
    return idx >= 0 ? idx + 1 : null;
  }, [snapshot, participantId]);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setIsSubmittingJoin(true);

    try {
      const res = await fetch('/api/participant/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: roomCodeInput.trim().toUpperCase(),
          nickname: nicknameInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Não foi possível entrar na sala.');
        return;
      }

      localStorage.setItem(STORAGE_KEYS.PARTICIPANT_ID, data.participant.id);
      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.sessionToken);
      localStorage.setItem(STORAGE_KEYS.ROOM_CODE, data.snapshot.roomCode);

      setParticipantId(data.participant.id);
      setSessionToken(data.sessionToken);
      applySnapshot(data.snapshot);
    } catch {
      setJoinError('Erro de conexão com o servidor. Verifique sua internet.');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const handleLeaveSession = () => {
    localStorage.removeItem(STORAGE_KEYS.PARTICIPANT_ID);
    localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    setParticipantId(null);
    setSessionToken(null);
  };

  const handleCircleCompleted = async (points: Point2D[], _localEval: CircleEvaluation) => {
    if (!participantId || !sessionToken) return;
    try {
      const res = await fetch('/api/participant/circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          sessionToken,
          points,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.snapshot) {
          applySnapshot(data.snapshot);
        }
      }
    } catch {
      // Silencioso durante oscilação de rede
    }
  };

  if (!snapshot || !recoverChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="gartic-glass p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 mx-auto rounded-full border-4 border-amber-400 border-t-transparent animate-spin mb-4" />
          <h1 className="font-display text-2xl font-black uppercase tracking-wide text-white">
            Círculo Premiado
          </h1>
          <p className="text-sm font-bold text-violet-300 mt-1">Sincronizando com a sala...</p>
        </div>
      </div>
    );
  }

  const roundsMeta = getRoundsMetadata(snapshot.config);
  const currentRoundMeta = roundsMeta[snapshot.currentRound - 1] || roundsMeta[0];

  // ==================== TELAS 1, 2 E 3: ENTRADA ESTILO GARTIC PHONE ====================
  if (!me) {
    const previewName = nicknameInput.trim() || 'Jogador';
    return (
      <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto">
        <div className="my-auto space-y-6">
          {/* Logo Estilo Gartic Phone */}
          <div className="text-center space-y-2">
            <div className="inline-block bg-amber-400 text-[#23114B] font-display font-black text-[11px] uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
              Jogo de Remuneração
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.45)]">
              Círculo <span className="text-amber-300">Premiado</span>
            </h1>
            <p className="text-sm font-bold text-violet-200 max-w-xs mx-auto">
              Desenhe círculos no celular e acumule dinheiro fictício em 5 rodadas!
            </p>
          </div>

          {/* Painel Central Gartic Phone */}
          <form onSubmit={handleJoinRoom} className="gartic-glass p-6 space-y-5">
            {/* Avatar Dinâmico Estilo Gartic */}
            <div className="flex flex-col items-center">
              <div
                className={`w-20 h-20 rounded-full bg-gradient-to-br ${getAvatarGradient(
                  previewName
                )} ring-4 ring-white/25 shadow-xl flex items-center justify-center font-display text-2xl font-black text-white transition-all`}
              >
                {getInitials(previewName)}
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest text-violet-300 mt-2">
                {nicknameInput.trim() ? nicknameInput.trim() : 'Escolha seu apelido'}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-violet-200 mb-1.5">
                  Código da Sala
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="EX: RH10"
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#160933]/90 border-2 border-white/20 font-display text-2xl font-black text-center tracking-widest text-amber-300 placeholder:text-violet-400/40 focus:outline-none focus:border-amber-300 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-violet-200 mb-1.5">
                  Seu Apelido
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="Digite seu apelido..."
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-white text-[#1E1136] font-display font-extrabold text-lg text-center placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-300"
                />
              </div>
            </div>

            {joinError && (
              <div className="p-3 rounded-xl bg-rose-500/25 border border-rose-400 text-rose-100 text-xs font-extrabold text-center">
                {joinError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingJoin}
              className="btn-game btn-yellow w-full py-4 rounded-2xl text-xl cursor-pointer"
            >
              {isSubmittingJoin ? 'Entrando...' : 'Jogar Agora!'}
            </button>
          </form>
        </div>

        <footer className="pt-6 pb-2 text-center">
          <div className="flex items-center justify-center gap-4 text-xs font-extrabold text-violet-300/70">
            <a href="/admin" className="hover:text-amber-300 transition">
              Painel Admin
            </a>
            <span>•</span>
            <a href="/placar" className="hover:text-amber-300 transition">
              Placar Projetor
            </a>
          </div>
        </footer>
      </div>
    );
  }

  const liveRoundSummary = calculateRoundPayoutForParticipant(
    snapshot.currentRound,
    me.currentRoundCircles,
    snapshot.config
  );

  // ==================== TELA 10: VENCEDORES FINAIS ====================
  if (snapshot.status === 'GAME_OVER') {
    return (
      <div className="min-h-screen p-3 sm:p-6">
        <div className="max-w-6xl mx-auto mb-5 gartic-glass-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(
                me.nickname
              )} flex items-center justify-center font-display font-black text-base text-white`}
            >
              {getInitials(me.nickname)}
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-violet-300">
                Seu Desempenho ({me.nickname})
              </div>
              <div className="font-display text-2xl font-black text-amber-300">
                {myRankPosition}º Lugar • {formatCurrencyBRL(me.balance)}
              </div>
            </div>
          </div>
          <button
            onClick={handleLeaveSession}
            className="btn-game btn-ghost text-xs px-4 py-2 rounded-xl cursor-pointer"
          >
            Sair
          </button>
        </div>

        <FinalWinnersScreen snapshot={snapshot} currentParticipantId={me.id} />
      </div>
    );
  }

  // ==================== TELA 4: SALA DE ESPERA / REGRAS DA RODADA ====================
  if (snapshot.status === 'LOBBY' || snapshot.status === 'ROUND_INTRO') {
    return (
      <div className="min-h-screen flex flex-col justify-between p-4 max-w-md mx-auto space-y-4">
        {/* Topo do Jogador */}
        <div className="gartic-glass-sm p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarGradient(
                me.nickname
              )} flex items-center justify-center font-display font-black text-sm text-white shadow`}
            >
              {getInitials(me.nickname)}
            </div>
            <div>
              <div className="font-display font-black text-white leading-tight">{me.nickname}</div>
              <div className="text-xs font-extrabold text-emerald-300">
                Saldo: {formatCurrencyBRL(me.balance)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-black bg-white/10 text-amber-300 px-3 py-1.5 rounded-xl border border-white/15">
              SALA {snapshot.roomCode}
            </span>
            <button
              type="button"
              onClick={handleLeaveSession}
              className="text-[11px] font-black uppercase text-violet-300 hover:text-rose-400 px-2 py-1"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Cartão da Rodada */}
        <div className="gartic-glass p-6 space-y-4 my-auto">
          <div className="flex items-center justify-between">
            <span
              className={`font-display text-xs font-black uppercase tracking-wider text-white px-3.5 py-1 rounded-full bg-gradient-to-r ${currentRoundMeta.badgeColor}`}
            >
              Rodada {snapshot.currentRound} de 5
            </span>
            <span className="font-display text-xs font-black uppercase bg-amber-400 text-[#23114B] px-3 py-1 rounded-full">
              {snapshot.config.roundDurationSeconds}s de tempo
            </span>
          </div>

          <div>
            <h2 className="font-display text-2xl font-black text-white leading-snug">
              {currentRoundMeta.shortTitle}
            </h2>
            <p className="text-xs font-bold text-violet-200 mt-1">{currentRoundMeta.concept}</p>
          </div>

          <div className="bg-[#180A38]/85 border border-white/12 rounded-2xl p-4 space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
              Regra de Pagamento
            </div>
            <p className="text-sm font-bold text-white leading-relaxed">
              {currentRoundMeta.ruleSummary}
            </p>
          </div>

          <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-3.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
              Objetivo da Fase
            </div>
            <p className="text-xs font-bold text-emerald-100 mt-0.5">{currentRoundMeta.objective}</p>
          </div>

          {currentRoundMeta.disclaimer && (
            <div className="bg-amber-500/15 border border-amber-400/30 rounded-xl p-3 text-xs font-bold text-amber-200">
              {currentRoundMeta.disclaimer}
            </div>
          )}

          <div className="pt-2 text-center">
            <div className="inline-flex items-center gap-2.5 bg-white/10 border border-white/15 text-white px-5 py-3 rounded-2xl font-display font-black text-xs uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              <span>Aguardando o administrador iniciar a rodada...</span>
            </div>
          </div>
        </div>

        {/* Jogadores Conectados na Sala */}
        <div className="gartic-glass-sm p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-violet-200">
            <span>{snapshot.participants.length} Jogadores na Sala</span>
            <span className={connected ? 'text-emerald-300' : 'text-amber-300'}>
              {connected ? '● Conectado' : '○ Reconectando'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {snapshot.participants.map((p) => (
              <span
                key={p.id}
                className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                  p.id === me.id
                    ? 'bg-amber-300 text-[#23114B]'
                    : 'bg-white/10 text-white'
                }`}
              >
                {p.nickname}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==================== TELA 6: RESULTADO E BALÃO DE RANKING DA RODADA ====================
  if (snapshot.status === 'ROUND_FINISHED') {
    return (
      <div className="min-h-screen flex flex-col justify-between p-4 max-w-md mx-auto space-y-4">
        {/* Topo com Saldo e Posição Geral */}
        <div className="gartic-glass-sm p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-violet-300">
              Saldo Acumulado
            </div>
            <div className="font-display text-2xl font-black text-emerald-300">
              {formatCurrencyBRL(me.balance)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-violet-300">
              Classificação Geral
            </div>
            <div className="font-display text-2xl font-black text-amber-300">
              {myRankPosition}º Lugar
            </div>
          </div>
        </div>

        {/* Balão de Ranking por Rodada inspirado no Gartic (fecha ao iniciar próxima rodada) */}
        <div className="my-auto">
          <RoundRankingBalloon
            snapshot={snapshot}
            currentParticipantId={me.id}
            variant="mobile"
          />
        </div>

        {/* Ranking Total Acumulado ao pé da página do jogador */}
        <div className="gartic-glass-sm p-3.5">
          <div className="text-[10px] font-black uppercase tracking-widest text-violet-300 mb-2">
            Ranking Total da Sala (Acumulado)
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {snapshot.participants.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-xs font-extrabold">
                <span className="text-white truncate">
                  <strong className="text-amber-300">{i + 1}º</strong> {p.nickname}
                  {p.id === me.id && (
                    <span className="ml-1.5 text-[9px] uppercase bg-amber-300 text-[#23114B] px-1.5 py-0.5 rounded-full">
                      Você
                    </span>
                  )}
                </span>
                <span className="text-emerald-300">{formatCurrencyBRL(p.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==================== TELA 5: TELA DE DESENHO MOBILE (RODADA ATIVA) ====================
  const isPaused = snapshot.status === 'ROUND_PAUSED';
  const isUrgentTime = displayRemainingSeconds <= 10;
  const totalSec = snapshot.config.roundDurationSeconds || 45;
  const timePercent = Math.max(0, Math.min(100, (displayRemainingSeconds / totalSec) * 100));

  return (
    <div className="h-[100dvh] flex flex-col justify-between p-2.5 sm:p-4 max-w-md mx-auto overflow-hidden select-none">
      {/* HUD Superior estilo Gartic Phone */}
      <div className="gartic-glass-sm p-3 mb-2.5 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`font-display text-[11px] font-black uppercase text-white px-2.5 py-0.5 rounded-full bg-gradient-to-r ${currentRoundMeta.badgeColor}`}
            >
              R{snapshot.currentRound}/5
            </span>
            <h2 className="font-display text-sm font-black uppercase tracking-wide text-white truncate">
              {currentRoundMeta.shortTitle}
            </h2>
          </div>

          <div
            className={`px-3.5 py-1 rounded-full font-display text-base font-black shrink-0 ${
              isPaused
                ? 'bg-amber-400 text-[#23114B]'
                : isUrgentTime
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-amber-300 text-[#23114B]'
            }`}
          >
            {displayRemainingSeconds}s
          </div>
        </div>

        {/* Barra de Tempo Progressiva */}
        <div className="w-full h-2 bg-[#14082E] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isUrgentTime ? 'bg-rose-500' : 'bg-gradient-to-r from-amber-300 to-emerald-400'
            }`}
            style={{ width: `${timePercent}%` }}
          />
        </div>

        {/* Pílulas de Indicadores em Tempo Real */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-[#160933]/85 border border-white/10 rounded-xl py-1.5 px-2">
            <div className="text-[9px] font-black text-violet-300 uppercase leading-none">
              Círculos Válidos
            </div>
            <div className="font-display text-base font-black text-white mt-0.5">
              {liveRoundSummary.validCirclesCount}
            </div>
          </div>

          <div className="bg-[#160933]/85 border border-white/10 rounded-xl py-1.5 px-2">
            <div className="text-[9px] font-black text-violet-300 uppercase leading-none">
              {snapshot.currentRound === 4
                ? `Meta (≥${snapshot.config.round4Goals.minAccuracyThreshold}%)`
                : snapshot.currentRound === 5
                ? 'Média Últ. 5'
                : 'Melhor Precisão'}
            </div>
            <div className="font-display text-base font-black text-amber-300 mt-0.5">
              {snapshot.currentRound === 4
                ? `${liveRoundSummary.qualifiedMetaCirclesCount}/${snapshot.config.round4Goals.target1MinCircles}`
                : snapshot.currentRound === 5
                ? liveRoundSummary.lastFiveAverageAccuracy !== null
                  ? formatPercentageBR(liveRoundSummary.lastFiveAverageAccuracy)
                  : `${liveRoundSummary.validCirclesCount}/5`
                : formatPercentageBR(liveRoundSummary.bestAccuracy)}
            </div>
          </div>

          <div className="bg-emerald-500/20 border border-emerald-400/35 rounded-xl py-1.5 px-2">
            <div className="text-[9px] font-black text-emerald-300 uppercase leading-none">
              Ganho na Fase
            </div>
            <div className="font-display text-base font-black text-emerald-300 mt-0.5">
              {formatCurrencyBRL(liveRoundSummary.amountEarned)}
            </div>
          </div>
        </div>

        {/* Progresso específico das Rodadas 4 e 5 */}
        {snapshot.currentRound === 4 && (
          <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-lg px-2.5 py-1 text-[11px] font-extrabold text-emerald-200 text-center">
            {liveRoundSummary.qualifiedMetaCirclesCount}/
            {snapshot.config.round4Goals.target1MinCircles} círculos necessários para atingir a meta
            {liveRoundSummary.qualifiedMetaCirclesCount >=
              snapshot.config.round4Goals.target1MinCircles &&
              ` • Rumo a ${snapshot.config.round4Goals.target2MinCircles} para ${formatCurrencyBRL(
                snapshot.config.round4Goals.target2Reward
              )}!`}
          </div>
        )}

        {snapshot.currentRound === 5 && (
          <div className="bg-pink-500/15 border border-pink-400/30 rounded-lg px-2.5 py-1 text-[11px] font-extrabold text-pink-200 text-center">
            {liveRoundSummary.validCirclesCount <
            snapshot.config.round5Competencies.requiredValidCircles
              ? `Complete ${snapshot.config.round5Competencies.requiredValidCircles} círculos válidos (${liveRoundSummary.validCirclesCount}/${snapshot.config.round5Competencies.requiredValidCircles})`
              : `Média dos últimos 5 círculos: ${formatPercentageBR(
                  liveRoundSummary.lastFiveAverageAccuracy || 0
                )}`}
          </div>
        )}
      </div>

      {/* Área Branca de Desenho */}
      <div className="relative flex-1 flex flex-col min-h-0">
        <CircleCanvas
          disabled={isPaused || displayRemainingSeconds <= 0}
          onCircleCompleted={handleCircleCompleted}
        />

        {isPaused && (
          <div className="absolute inset-0 rounded-[28px] bg-[#190A38]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white z-20">
            <div className="w-16 h-16 rounded-full bg-amber-400 text-[#23114B] font-display font-black text-2xl flex items-center justify-center mb-3 shadow-lg">
              II
            </div>
            <h3 className="font-display text-2xl font-black uppercase">Rodada Pausada</h3>
            <p className="text-sm font-bold text-violet-200 mt-1">
              Aguarde o administrador retomar o cronômetro.
            </p>
          </div>
        )}
      </div>

      {/* Rodapé Compacto */}
      <div className="pt-2.5 shrink-0 flex items-center justify-between text-xs font-extrabold text-violet-200 px-1">
        <span className="truncate max-w-[62%]">{currentRoundMeta.objective}</span>
        <span className="bg-white/10 px-3 py-1 rounded-full text-white">
          Saldo: <strong className="text-emerald-300">{formatCurrencyBRL(me.balance)}</strong>
        </span>
      </div>
    </div>
  );
};
