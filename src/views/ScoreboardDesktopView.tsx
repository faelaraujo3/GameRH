import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Participant, PublicGameSnapshot } from '../shared/types';
import {
  calculateRoundPayoutForParticipant,
  formatCurrencyBRL,
  formatPercentageBR,
  getAvatarGradient,
  getInitials,
  getRoundsMetadata,
} from '../shared/roundRules';
import { FinalWinnersScreen } from '../components/FinalWinnersScreen';
import { RoundRankingBalloon } from '../components/RoundRankingBalloon';

interface ScoreboardDesktopViewProps {
  snapshot: PublicGameSnapshot | null;
  connected: boolean;
  displayRemainingSeconds: number;
}

export const ScoreboardDesktopView: React.FC<ScoreboardDesktopViewProps> = ({
  snapshot,
  connected,
  displayRemainingSeconds,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const joinBaseUrl = React.useMemo(() => {
    if (!snapshot) return window.location.origin;
    if (snapshot.publicTunnelUrl) return snapshot.publicTunnelUrl;
    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost && snapshot.lanUrls && snapshot.lanUrls.length > 0) {
      return snapshot.lanUrls[0];
    }
    return window.location.origin;
  }, [snapshot]);

  const fullJoinUrl = snapshot ? `${joinBaseUrl}/?sala=${snapshot.roomCode}` : '';

  useEffect(() => {
    if (!fullJoinUrl) return;
    QRCode.toDataURL(fullJoinUrl, {
      width: 280,
      margin: 1,
      color: { dark: '#1e1136', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [fullJoinUrl]);

  if (!snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10">
        <div className="gartic-glass p-12 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-white">
            Carregando Placar...
          </h1>
        </div>
      </div>
    );
  }

  if (snapshot.status === 'GAME_OVER') {
    return (
      <div className="min-h-screen p-6 md:p-10">
        <FinalWinnersScreen snapshot={snapshot} />
      </div>
    );
  }

  const roundsMeta = getRoundsMetadata(snapshot.config);
  const currentRoundMeta = roundsMeta[snapshot.currentRound - 1] || roundsMeta[0];
  const participants = snapshot.participants;
  const topThree = participants.slice(0, 3);
  const maxBalance = Math.max(500, participants[0]?.balance || 500);

  const isUrgent = snapshot.status === 'ROUND_ACTIVE' && displayRemainingSeconds <= 10;
  const totalSec = snapshot.config.roundDurationSeconds || 45;
  const timePercent =
    snapshot.status === 'ROUND_ACTIVE' || snapshot.status === 'ROUND_PAUSED'
      ? Math.max(0, Math.min(100, (displayRemainingSeconds / totalSec) * 100))
      : snapshot.status === 'ROUND_FINISHED'
      ? 0
      : 100;

  return (
    <div className="min-h-screen p-5 md:p-8 max-w-[1680px] mx-auto flex flex-col gap-6">
      {/* TOPO DE TRANSMISSÃO ESTILO GARTIC PHONE / KAHOOT */}
      <header className="gartic-glass p-5 md:p-6 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-6">
          {/* Logo e Fase Atual */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-[#23114B] font-display font-black text-3xl flex items-center justify-center shadow-[0_6px_0_#9E6B00] shrink-0">
              R$
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-white drop-shadow">
                  Círculo <span className="text-amber-300">Premiado</span>
                </h1>
                <span
                  className={`font-display text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                    connected
                      ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-rose-500/30 text-rose-200'
                  }`}
                >
                  {connected ? '● Tempo Real' : '○ Reconectando'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                <span
                  className={`font-display text-xs font-black uppercase tracking-wider text-white px-3.5 py-1 rounded-full bg-gradient-to-r ${currentRoundMeta.badgeColor}`}
                >
                  Rodada {snapshot.currentRound} de 5
                </span>
                <span className="font-display text-xl md:text-2xl font-black text-violet-100">
                  {currentRoundMeta.shortTitle}
                </span>
              </div>
            </div>
          </div>

          {/* Cronômetro Gigante + Contador de Participantes */}
          <div className="flex items-center gap-4">
            <div className="bg-[#160933]/85 border border-white/12 px-5 py-3 rounded-2xl text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-violet-300">
                Participantes
              </div>
              <div className="font-display text-3xl font-black text-white mt-0.5">
                {participants.length}
              </div>
            </div>

            <div
              className={`px-8 py-3 rounded-2xl text-center min-w-[170px] transition-all ${
                snapshot.status === 'ROUND_PAUSED'
                  ? 'bg-amber-400 text-[#23114B] shadow-[0_6px_0_#9E6B00]'
                  : snapshot.status === 'ROUND_ACTIVE'
                  ? isUrgent
                    ? 'bg-rose-500 text-white shadow-[0_6px_0_#9E1532] animate-pulse'
                    : 'bg-gradient-to-b from-amber-300 to-amber-400 text-[#23114B] shadow-[0_6px_0_#9E6B00]'
                  : snapshot.status === 'ROUND_FINISHED'
                  ? 'bg-emerald-400 text-[#092E19] shadow-[0_6px_0_#0A7A3C]'
                  : 'bg-white/10 text-white border border-white/15'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest opacity-85">
                {snapshot.status === 'ROUND_ACTIVE'
                  ? 'Tempo Restante'
                  : snapshot.status === 'ROUND_PAUSED'
                  ? 'Cronômetro Pausado'
                  : snapshot.status === 'ROUND_FINISHED'
                  ? 'Rodada Encerrada'
                  : 'Aguardando Início'}
              </div>
              <div className="font-display text-4xl md:text-5xl font-black leading-none mt-0.5">
                {displayRemainingSeconds}s
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Progresso do Tempo no Rodapé do Header */}
        <div className="w-full h-2.5 bg-[#14082E] rounded-full overflow-hidden mt-5">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isUrgent
                ? 'bg-rose-500'
                : snapshot.status === 'ROUND_FINISHED'
                ? 'bg-emerald-400'
                : 'bg-gradient-to-r from-amber-300 via-emerald-400 to-cyan-400'
            }`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </header>

      {/* ARENA PRINCIPAL: COLUNA ESQUERDA (QR + REGRAS) E COLUNA DIREITA (RANKING) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* COLUNA ESQUERDA: QR CODE DE ENTRADA + REGRA DA MODALIDADE */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Card QR Code e Código da Sala */}
          <div className="gartic-glass p-6 flex flex-col items-center text-center space-y-4">
            <div className="inline-block bg-white/10 text-violet-200 font-display font-black text-[11px] uppercase tracking-widest px-4 py-1 rounded-full">
              Entre pelo Celular
            </div>

            {qrDataUrl && (
              <div className="p-3 bg-white rounded-3xl shadow-[0_10px_0_#13072E,0_16px_30px_rgba(0,0,0,0.4)]">
                <img
                  src={qrDataUrl}
                  alt="QR Code da Sala"
                  className="w-44 h-44 rounded-2xl block"
                />
              </div>
            )}

            <div>
              <div className="text-xs font-black uppercase tracking-widest text-violet-300">
                Código da Sala
              </div>
              <div className="font-display text-5xl font-black tracking-widest text-amber-300 mt-1 drop-shadow">
                {snapshot.roomCode}
              </div>
            </div>
          </div>

          {/* Card Explicativo da Regra Vigente */}
          <div className="gartic-glass p-6 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div
                className={`inline-block font-display text-xs font-black uppercase tracking-widest text-white px-4 py-1.5 rounded-full bg-gradient-to-r ${currentRoundMeta.badgeColor}`}
              >
                Regra da Rodada {snapshot.currentRound}
              </div>
              <h2 className="font-display text-2xl font-black text-white leading-tight">
                {currentRoundMeta.shortTitle}
              </h2>
              <p className="text-sm font-bold text-violet-200 leading-relaxed">
                {currentRoundMeta.concept}
              </p>

              <div className="bg-[#160933]/90 border border-white/12 rounded-2xl p-4 space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  Como ganhar dinheiro agora:
                </div>
                <p className="text-sm font-extrabold text-white leading-relaxed">
                  {currentRoundMeta.ruleSummary}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-xs font-bold text-violet-300 flex items-center justify-between">
              <span>1º Critério: Saldo Acumulado</span>
              <span>Desempate: Média Geral</span>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: PLACAR E RANKING EM TEMPO REAL */}
        <div className="lg:col-span-8 gartic-glass p-6 md:p-7 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                Ranking em Tempo Real
              </h2>
              <p className="text-xs font-bold text-violet-300 mt-0.5">
                Atualizado automaticamente a cada círculo desenhado e ao final de cada rodada
              </p>
            </div>
            <div className="bg-amber-400/15 border border-amber-300/35 text-amber-300 font-display font-black text-xs uppercase tracking-wider px-4 py-2 rounded-full">
              Top {participants.length} Jogadores
            </div>
          </div>

          {participants.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-16 space-y-3">
              <div className="w-20 h-20 rounded-full bg-white/8 border-2 border-dashed border-violet-300/40 flex items-center justify-center font-display text-2xl font-black text-amber-300">
                {snapshot.roomCode}
              </div>
              <h3 className="font-display text-2xl font-black text-white">
                Aguardando os participantes entrarem...
              </h3>
              <p className="text-sm font-bold text-violet-300 max-w-md">
                Aponte a câmera do celular para o QR Code ao lado e escolha um apelido para aparecer
                no placar!
              </p>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col">
              {/* BALÃO DE RANKING DA RODADA AO FINALIZAR A FASE (SOME AO INICIAR PRÓXIMA RODADA) */}
              {snapshot.status === 'ROUND_FINISHED' && (
                <RoundRankingBalloon snapshot={snapshot} variant="desktop" />
              )}

              {/* DESTAQUE ESPECIAL PARA OS 3 PRIMEIROS COLOCADOS DO RANKING TOTAL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topThree.map((p, idx) => {
                  const liveStats = calculateRoundPayoutForParticipant(
                    snapshot.currentRound,
                    p.currentRoundCircles,
                    snapshot.config
                  );
                  const cardThemes = [
                    {
                      wrapper:
                        'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-[#23114B] shadow-[0_8px_0_#9E6B00]',
                      rankPill: 'bg-[#23114B] text-amber-300',
                      subText: 'text-[#23114B]/80',
                      statBox: 'bg-[#23114B]/12 text-[#23114B]',
                      label: '1º LUGAR',
                    },
                    {
                      wrapper:
                        'bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-[#1E1136] shadow-[0_8px_0_#64748B]',
                      rankPill: 'bg-[#1E1136] text-white',
                      subText: 'text-slate-700',
                      statBox: 'bg-[#1E1136]/10 text-[#1E1136]',
                      label: '2º LUGAR',
                    },
                    {
                      wrapper:
                        'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white shadow-[0_8px_0_#78350F]',
                      rankPill: 'bg-[#23114B] text-amber-300',
                      subText: 'text-amber-100',
                      statBox: 'bg-black/20 text-white',
                      label: '3º LUGAR',
                    },
                  ][idx];

                  return (
                    <div
                      key={p.id}
                      className={`rounded-3xl p-4 flex flex-col justify-between transition-all ${cardThemes.wrapper}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-display text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${cardThemes.rankPill}`}
                        >
                          {cardThemes.label}
                        </span>
                        <span className={`text-xs font-extrabold ${cardThemes.subText}`}>
                          Média {formatPercentageBR(p.averageOverallAccuracy)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 my-3">
                        <div
                          className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(
                            p.nickname
                          )} ring-2 ring-white/60 flex items-center justify-center font-display font-black text-base text-white shrink-0 shadow`}
                        >
                          {getInitials(p.nickname)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display text-xl font-black truncate leading-tight">
                            {p.nickname}
                          </h3>
                          <div className="font-display text-2xl font-black leading-tight">
                            {formatCurrencyBRL(p.balance)}
                          </div>
                        </div>
                      </div>

                      <div className={`rounded-2xl p-2.5 flex items-center justify-between text-xs font-extrabold ${cardThemes.statBox}`}>
                        <span>{liveStats.validCirclesCount} círc. na fase</span>
                        <span>+ {formatCurrencyBRL(liveStats.amountEarned)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BARRAS HORIZONTAIS ESTILO GARTIC PHONE PARA TODOS OS PARTICIPANTES */}
              <div className="space-y-2.5 overflow-y-auto max-h-[480px] pr-1">
                {participants.map((p: Participant, idx: number) => {
                  const liveStats = calculateRoundPayoutForParticipant(
                    snapshot.currentRound,
                    p.currentRoundCircles,
                    snapshot.config
                  );
                  const fillPercent = Math.max(6, Math.round((p.balance / maxBalance) * 100));

                  return (
                    <div
                      key={p.id}
                      className={`relative overflow-hidden rounded-2xl p-3.5 px-4 border transition-all ${
                        idx === 0
                          ? 'bg-amber-400/15 border-amber-300/40'
                          : idx === 1
                          ? 'bg-slate-200/12 border-slate-300/30'
                          : idx === 2
                          ? 'bg-amber-600/15 border-amber-500/35'
                          : 'bg-[#160933]/75 border-white/10'
                      }`}
                    >
                      {/* Barra proporcional de dinheiro no fundo */}
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500/20 to-emerald-400/15 transition-all duration-500"
                        style={{ width: `${fillPercent}%` }}
                      />

                      <div className="relative flex flex-wrap items-center justify-between gap-4">
                        {/* Posição + Avatar + Apelido */}
                        <div className="flex items-center gap-3.5 min-w-[200px]">
                          <div
                            className={`w-9 h-9 rounded-xl font-display font-black text-sm flex items-center justify-center shrink-0 ${
                              idx === 0
                                ? 'bg-amber-400 text-[#23114B]'
                                : idx === 1
                                ? 'bg-slate-200 text-[#1E1136]'
                                : idx === 2
                                ? 'bg-amber-600 text-white'
                                : 'bg-white/10 text-violet-200'
                            }`}
                          >
                            {idx + 1}º
                          </div>

                          <div
                            className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(
                              p.nickname
                            )} flex items-center justify-center font-display font-black text-xs text-white shrink-0 shadow`}
                          >
                            {getInitials(p.nickname)}
                          </div>

                          <span className="font-display text-lg font-black text-white truncate">
                            {p.nickname}
                          </span>
                        </div>

                        {/* Indicadores da Rodada e Precisão */}
                        <div className="flex items-center gap-2 text-xs">
                          <div className="bg-white/8 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                            <span className="text-[10px] font-black uppercase text-violet-300 block">
                              Círculos (Fase / Total)
                            </span>
                            <span className="font-display font-black text-white">
                              {liveStats.validCirclesCount}{' '}
                              <span className="text-violet-300 font-bold">/ {p.totalValidCircles}</span>
                            </span>
                          </div>

                          <div className="bg-white/8 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                            <span className="text-[10px] font-black uppercase text-violet-300 block">
                              Melhor / Média
                            </span>
                            <span className="font-display font-black text-amber-300">
                              {formatPercentageBR(
                                Math.max(p.bestOverallAccuracy, liveStats.bestAccuracy)
                              )}{' '}
                              <span className="text-violet-200 font-bold">
                                ({formatPercentageBR(p.averageOverallAccuracy)})
                              </span>
                            </span>
                          </div>

                          <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-3 py-1.5 text-right min-w-[105px]">
                            <span className="text-[10px] font-black uppercase text-emerald-300 block">
                              Rodada {snapshot.currentRound}
                            </span>
                            <span className="font-display font-black text-emerald-300">
                              + {formatCurrencyBRL(liveStats.amountEarned)}
                            </span>
                          </div>
                        </div>

                        {/* Saldo Total Acumulado */}
                        <div className="text-right min-w-[140px]">
                          <span className="text-[10px] font-black uppercase tracking-wider text-violet-300 block">
                            Acumulado
                          </span>
                          <span className="font-display text-2xl font-black text-white">
                            {formatCurrencyBRL(p.balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
