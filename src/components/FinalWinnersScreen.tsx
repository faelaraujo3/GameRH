import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Participant, PublicGameSnapshot } from '../shared/types';
import {
  formatCurrencyBRL,
  formatPercentageBR,
  getAvatarGradient,
  getInitials,
  getRoundsMetadata,
} from '../shared/roundRules';

interface FinalWinnersScreenProps {
  snapshot: PublicGameSnapshot;
  currentParticipantId?: string | null;
}

export const FinalWinnersScreen: React.FC<FinalWinnersScreenProps> = ({
  snapshot,
  currentParticipantId,
}) => {
  const participants = snapshot.participants;
  const first = participants[0];
  const second = participants[1];
  const third = participants[2];
  const roundsMeta = getRoundsMetadata(snapshot.config);
  const maxBalance = Math.max(1, first?.balance || 1);

  useEffect(() => {
    const duration = 3800;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.65 },
        colors: ['#FFD000', '#9B51FF', '#26E880', '#33D6FF', '#FF4769'],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.65 },
        colors: ['#FFD000', '#9B51FF', '#26E880', '#33D6FF', '#FF4769'],
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const totalsByRound = [1, 2, 3, 4, 5].map((roundNum) => {
    let totalDistributed = 0;
    let totalCirclesInRound = 0;
    for (const p of participants) {
      const record = p.roundHistory[roundNum];
      if (record) {
        totalDistributed += record.amountEarned;
        totalCirclesInRound += record.validCirclesCount;
      }
    }
    return {
      roundNum,
      meta: roundsMeta[roundNum - 1],
      totalDistributed,
      totalCirclesInRound,
    };
  });

  const grandTotalDistributed = totalsByRound.reduce((acc, r) => acc + r.totalDistributed, 0);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-16">
      {/* Cabeçalho de Encerramento Estilo Gartic Phone */}
      <div className="text-center space-y-2 pt-2">
        <div className="inline-block bg-amber-400 text-[#23114B] font-display font-black text-xs uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg">
          Resultado Final • 5 Rodadas Concluídas
        </div>
        <h1 className="font-display text-4xl md:text-6xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.45)]">
          Pódio Oficial
        </h1>
        <p className="text-violet-200 font-bold text-sm md:text-base max-w-xl mx-auto">
          Classificação final pelo patrimônio acumulado ao longo dos 5 modelos de remuneração
        </p>
      </div>

      {/* PÓDIO 3D ESTILO KAHOOT / GARTIC PHONE */}
      {participants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end max-w-4xl mx-auto pt-6 px-2">
          {/* 2º COLOCADO */}
          {second ? (
            <div className="order-2 md:order-1 flex flex-col items-center">
              <div
                className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarGradient(
                  second.nickname
                )} ring-4 ring-slate-200 shadow-xl flex items-center justify-center font-display text-xl font-black text-white mb-2`}
              >
                {getInitials(second.nickname)}
              </div>
              <div className="font-display text-xl font-black text-white truncate max-w-[200px]">
                {second.nickname}
              </div>
              <div className="font-display text-2xl font-black text-emerald-300 mb-3">
                {formatCurrencyBRL(second.balance)}
              </div>
              <div className="w-full rounded-t-3xl bg-gradient-to-b from-slate-200 to-slate-400 text-[#1E1136] p-5 text-center shadow-[0_12px_30px_rgba(0,0,0,0.4)] md:h-40 flex flex-col justify-between">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#1E1136] text-white font-display font-black text-lg flex items-center justify-center">
                  2º
                </div>
                <div className="text-xs font-extrabold uppercase tracking-wider opacity-80">
                  {second.totalValidCircles} círculos • Média{' '}
                  {formatPercentageBR(second.averageOverallAccuracy)}
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden md:block order-1" />
          )}

          {/* 1º COLOCADO — CAMPEÃO */}
          {first && (
            <div className="order-1 md:order-2 flex flex-col items-center">
              <div className="bg-amber-300 text-[#23114B] font-display font-black text-[11px] uppercase tracking-widest px-3.5 py-1 rounded-full mb-2 shadow">
                Grande Campeão
              </div>
              <div
                className={`w-22 h-22 rounded-full bg-gradient-to-br ${getAvatarGradient(
                  first.nickname
                )} ring-4 ring-amber-300 shadow-[0_0_30px_rgba(255,208,0,0.5)] flex items-center justify-center font-display text-3xl font-black text-white mb-2`}
              >
                {getInitials(first.nickname)}
              </div>
              <div className="font-display text-2xl md:text-3xl font-black text-white truncate max-w-[240px]">
                {first.nickname}
              </div>
              <div className="font-display text-3xl md:text-4xl font-black text-amber-300 mb-3 drop-shadow">
                {formatCurrencyBRL(first.balance)}
              </div>
              <div className="w-full rounded-t-3xl bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 text-[#23114B] p-6 text-center shadow-[0_14px_35px_rgba(0,0,0,0.5)] md:h-52 flex flex-col justify-between">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#23114B] text-amber-300 font-display font-black text-2xl flex items-center justify-center shadow-md">
                  1º
                </div>
                <div className="text-xs font-black uppercase tracking-wider">
                  {first.totalValidCircles} círculos • Melhor{' '}
                  {formatPercentageBR(first.bestOverallAccuracy)} • Média{' '}
                  {formatPercentageBR(first.averageOverallAccuracy)}
                </div>
              </div>
            </div>
          )}

          {/* 3º COLOCADO */}
          {third ? (
            <div className="order-3 flex flex-col items-center">
              <div
                className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarGradient(
                  third.nickname
                )} ring-4 ring-amber-600 shadow-xl flex items-center justify-center font-display text-xl font-black text-white mb-2`}
              >
                {getInitials(third.nickname)}
              </div>
              <div className="font-display text-xl font-black text-white truncate max-w-[200px]">
                {third.nickname}
              </div>
              <div className="font-display text-2xl font-black text-emerald-300 mb-3">
                {formatCurrencyBRL(third.balance)}
              </div>
              <div className="w-full rounded-t-3xl bg-gradient-to-b from-amber-600 to-amber-800 text-white p-5 text-center shadow-[0_12px_30px_rgba(0,0,0,0.4)] md:h-32 flex flex-col justify-between">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#23114B] text-amber-300 font-display font-black text-lg flex items-center justify-center">
                  3º
                </div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-100">
                  {third.totalValidCircles} círculos • Média{' '}
                  {formatPercentageBR(third.averageOverallAccuracy)}
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden md:block order-3" />
          )}
        </div>
      )}

      {/* RANKING COMPLETO EM BARRAS MODERNAS (ESTILO PLACAR DE JOGO) */}
      <div className="gartic-glass p-5 md:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
          <h2 className="font-display text-xl md:text-2xl font-black uppercase tracking-wide text-white">
            Classificação Completa & Histórico das 5 Fases
          </h2>
          <span className="text-xs font-extrabold uppercase tracking-wider bg-white/10 text-violet-200 px-3.5 py-1.5 rounded-full">
            Critério: Dinheiro Acumulado • Desempate: Precisão Média
          </span>
        </div>

        <div className="space-y-3">
          {participants.map((p: Participant, idx: number) => {
            const isMe = p.id === currentParticipantId;
            const barPercent = Math.max(8, Math.round((p.balance / maxBalance) * 100));

            return (
              <div
                key={p.id}
                className={`relative overflow-hidden rounded-2xl p-4 transition ${
                  isMe
                    ? 'bg-violet-600/45 ring-2 ring-amber-300'
                    : idx === 0
                    ? 'bg-gradient-to-r from-amber-400/20 to-white/5 border border-amber-300/40'
                    : 'bg-white/6 hover:bg-white/10 border border-white/10'
                }`}
              >
                {/* Barra de proporção de patrimônio sutil no fundo */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.04] transition-all duration-500"
                  style={{ width: `${barPercent}%` }}
                />

                <div className="relative flex flex-wrap items-center justify-between gap-4">
                  {/* Posição + Avatar + Nome */}
                  <div className="flex items-center gap-3.5 min-w-[200px]">
                    <div
                      className={`w-10 h-10 rounded-xl font-display font-black text-base flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-[#23114B]'
                          : idx === 1
                          ? 'bg-slate-200 text-[#23114B]'
                          : idx === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-white/10 text-violet-200'
                      }`}
                    >
                      {idx + 1}º
                    </div>

                    <div
                      className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarGradient(
                        p.nickname
                      )} flex items-center justify-center font-display font-black text-sm text-white shrink-0 shadow`}
                    >
                      {getInitials(p.nickname)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-black text-white">
                          {p.nickname}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-black uppercase bg-amber-300 text-[#23114B] px-2 py-0.5 rounded-full">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-violet-200">
                        {p.totalValidCircles} círculos válidos • Média:{' '}
                        <strong className="text-white">
                          {formatPercentageBR(p.averageOverallAccuracy)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Pílulas de Ganhos nas Rodadas 1 a 5 */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((rNum) => {
                      const rec = p.roundHistory[rNum];
                      return (
                        <div
                          key={rNum}
                          className="bg-[#180A38]/80 border border-white/10 rounded-xl px-2.5 py-1 text-center min-w-[74px]"
                        >
                          <div className="text-[9px] font-black uppercase text-violet-300">
                            Rodada {rNum}
                          </div>
                          <div className="font-display text-xs font-extrabold text-white">
                            {rec ? formatCurrencyBRL(rec.amountEarned) : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Acumulado */}
                  <div className="text-right min-w-[140px]">
                    <div className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                      Saldo Final
                    </div>
                    <div className="font-display text-2xl font-black text-emerald-300">
                      {formatCurrencyBRL(p.balance)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SÍNTESE PEDAGÓGICA DAS 5 MODALIDADES */}
      <div className="gartic-glass p-5 md:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-black uppercase tracking-wide text-white">
              Análise Comparativa das 5 Abordagens de Remuneração
            </h2>
            <p className="text-sm font-bold text-violet-200 mt-0.5">
              Como cada regra de recompensa alterou o comportamento dos participantes durante a dinâmica
            </p>
          </div>
          <div className="bg-emerald-400/20 border border-emerald-400/40 text-emerald-300 font-display font-black text-xs uppercase px-4 py-2 rounded-full">
            Total Distribuído na Sala: {formatCurrencyBRL(grandTotalDistributed)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {totalsByRound.map(({ roundNum, meta, totalDistributed, totalCirclesInRound }) => (
            <div
              key={roundNum}
              className="rounded-2xl bg-[#1A0B3B]/90 border border-white/12 p-4 flex flex-col justify-between space-y-4"
            >
              <div>
                <div
                  className={`inline-block text-white font-display text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r ${meta.badgeColor} mb-2.5`}
                >
                  Fase {roundNum}
                </div>
                <h3 className="font-display text-base font-black text-white leading-snug">
                  {meta.shortTitle}
                </h3>
                <p className="text-xs font-semibold text-violet-200 mt-2 leading-relaxed">
                  {meta.pedagogicalTakeaway}
                </p>
                {meta.disclaimer && (
                  <p className="text-[11px] text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-xl p-2.5 mt-2.5 font-bold">
                    {meta.disclaimer}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-white/10">
                <div className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                  Distribuído na Fase
                </div>
                <div className="font-display text-xl font-black text-emerald-300 mt-0.5">
                  {formatCurrencyBRL(totalDistributed)}
                </div>
                <div className="text-[11px] font-bold text-violet-300">
                  {totalCirclesInRound} círculos válidos na turma
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
