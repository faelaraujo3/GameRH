import React from 'react';
import { Participant, PublicGameSnapshot, RoundPayoutRecord } from '../shared/types';
import {
  calculateRoundPayoutForParticipant,
  formatCurrencyBRL,
  formatPercentageBR,
  getAvatarGradient,
  getInitials,
  getRoundsMetadata,
} from '../shared/roundRules';

interface RoundRankingBalloonProps {
  snapshot: PublicGameSnapshot;
  currentParticipantId?: string | null;
  variant?: 'mobile' | 'desktop';
}

interface RankedRoundItem {
  participant: Participant;
  record: RoundPayoutRecord;
}

export const RoundRankingBalloon: React.FC<RoundRankingBalloonProps> = ({
  snapshot,
  currentParticipantId,
  variant = 'mobile',
}) => {
  const roundNumber = snapshot.currentRound;
  const roundsMeta = getRoundsMetadata(snapshot.config);
  const currentRoundMeta = roundsMeta[roundNumber - 1] || roundsMeta[0];

  const rankedItems: RankedRoundItem[] = React.useMemo(() => {
    const items = snapshot.participants.map((p) => {
      const record =
        p.roundHistory[roundNumber] ||
        calculateRoundPayoutForParticipant(roundNumber, p.currentRoundCircles, snapshot.config);
      return { participant: p, record };
    });

    items.sort((a, b) => {
      if (b.record.amountEarned !== a.record.amountEarned) {
        return b.record.amountEarned - a.record.amountEarned;
      }
      if (roundNumber === 2) {
        if (b.record.validCirclesCount !== a.record.validCirclesCount) {
          return b.record.validCirclesCount - a.record.validCirclesCount;
        }
        return b.record.bestAccuracy - a.record.bestAccuracy;
      }
      if (roundNumber === 3) {
        return b.record.bestAccuracy - a.record.bestAccuracy;
      }
      if (roundNumber === 4) {
        if (b.record.qualifiedMetaCirclesCount !== a.record.qualifiedMetaCirclesCount) {
          return b.record.qualifiedMetaCirclesCount - a.record.qualifiedMetaCirclesCount;
        }
        return b.record.bestAccuracy - a.record.bestAccuracy;
      }
      if (roundNumber === 5) {
        const avgA = a.record.lastFiveAverageAccuracy ?? -1;
        const avgB = b.record.lastFiveAverageAccuracy ?? -1;
        if (avgB !== avgA) return avgB - avgA;
        return b.record.validCirclesCount - a.record.validCirclesCount;
      }
      if (b.record.validCirclesCount !== a.record.validCirclesCount) {
        return b.record.validCirclesCount - a.record.validCirclesCount;
      }
      return b.record.bestAccuracy - a.record.bestAccuracy;
    });

    return items;
  }, [snapshot.participants, snapshot.config, roundNumber]);

  const getRoundMetricSubtitle = (): string => {
    switch (roundNumber) {
      case 1:
        return 'Salário funcional fixo para todos os participantes';
      case 2:
        return 'Quantidade de círculos feitos por participante';
      case 3:
        return 'Porcentagem do melhor círculo de cada participante';
      case 4:
        return `Metas (1ª: ${snapshot.config.round4Goals.target1MinCircles} círc. • 2ª: ${snapshot.config.round4Goals.target2MinCircles}+ círc. ≥${snapshot.config.round4Goals.minAccuracyThreshold}%)`;
      case 5:
        return 'Média de precisão dos últimos 5 círculos válidos';
      default:
        return '';
    }
  };

  const renderRoundSpecificMetric = (rec: RoundPayoutRecord) => {
    if (roundNumber === 1) {
      return (
        <span className="inline-block bg-violet-500/25 border border-violet-300/35 text-violet-200 font-display font-bold text-[11px] px-2.5 py-0.5 rounded-full">
          {rec.validCirclesCount} {rec.validCirclesCount === 1 ? 'círculo feito' : 'círculos feitos'} • Salário Fixo
        </span>
      );
    }

    if (roundNumber === 2) {
      return (
        <span className="inline-block bg-sky-500/25 border border-sky-300/40 text-sky-200 font-display font-black text-[11px] px-2.5 py-0.5 rounded-full">
          {rec.validCirclesCount}{' '}
          {rec.validCirclesCount === 1 ? 'círculo feito' : 'círculos feitos'}
        </span>
      );
    }

    if (roundNumber === 3) {
      return (
        <span className="inline-block bg-amber-400/25 border border-amber-300/45 text-amber-200 font-display font-black text-[11px] px-2.5 py-0.5 rounded-full">
          Melhor círculo: {rec.validCirclesCount > 0 ? formatPercentageBR(rec.bestAccuracy) : '0,0%'}
        </span>
      );
    }

    if (roundNumber === 4) {
      const { target1MinCircles, target2MinCircles } = snapshot.config.round4Goals;
      if (rec.qualifiedMetaCirclesCount >= target2MinCircles) {
        return (
          <span className="inline-block bg-emerald-400 text-[#092E19] font-display font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            Bateu as 2 metas! ({rec.qualifiedMetaCirclesCount} círc.)
          </span>
        );
      }
      if (rec.qualifiedMetaCirclesCount >= target1MinCircles) {
        return (
          <span className="inline-block bg-cyan-300 text-[#06283D] font-display font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            Só a 1ª meta ({rec.qualifiedMetaCirclesCount} círc.)
          </span>
        );
      }
      return (
        <span className="inline-block bg-rose-500/25 border border-rose-400/40 text-rose-200 font-display font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
          Nenhuma meta ({rec.qualifiedMetaCirclesCount}/{target1MinCircles})
        </span>
      );
    }

    if (rec.lastFiveAverageAccuracy !== null) {
      return (
        <span className="inline-block bg-pink-500/25 border border-pink-300/45 text-pink-200 font-display font-black text-[11px] px-2.5 py-0.5 rounded-full">
          Média: {formatPercentageBR(rec.lastFiveAverageAccuracy)}
        </span>
      );
    }
    return (
      <span className="inline-block bg-white/10 border border-white/15 text-violet-300 font-display font-bold text-[11px] px-2.5 py-0.5 rounded-full">
        Sem média ({rec.validCirclesCount}/{snapshot.config.round5Competencies.requiredValidCircles} círc.)
      </span>
    );
  };

  return (
    <div className="relative animate-pop w-full flex-1 flex flex-col min-h-0">
      {/* Balão Principal Estilo Gartic Phone ocupando quase toda a tela */}
      <div className="gartic-glass p-4 sm:p-5 border-2 border-amber-300/40 shadow-[0_10px_0_#120629,0_20px_40px_rgba(0,0,0,0.6)] flex-1 flex flex-col min-h-0 space-y-3">
        {/* Cabeçalho Compacto do Balão */}
        <div className="text-center shrink-0 space-y-1">
          <div className="inline-block bg-amber-300 text-[#23114B] font-display font-black text-[10px] uppercase tracking-widest px-3.5 py-0.5 rounded-full shadow">
            Ranking da Rodada {roundNumber}
          </div>
          <h2
            className={`font-display ${
              variant === 'desktop' ? 'text-2xl' : 'text-xl'
            } font-black uppercase text-white tracking-tight leading-tight`}
          >
            {currentRoundMeta.shortTitle}
          </h2>
          <p className="text-[11px] font-bold text-violet-200 leading-snug">
            {getRoundMetricSubtitle()}
          </p>
        </div>

        {/* Lista de Classificação da Rodada (Expansível para ocupar a tela) */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
          {rankedItems.map(({ participant: p, record: rec }, idx) => {
            const isMe = p.id === currentParticipantId;
            return (
              <div
                key={p.id}
                className={`rounded-2xl p-2.5 px-3 border flex items-center justify-between gap-2.5 transition ${
                  isMe
                    ? 'bg-violet-600/55 border-amber-300 ring-2 ring-amber-300/60'
                    : idx === 0
                    ? 'bg-amber-400/15 border-amber-300/40'
                    : idx === 1
                    ? 'bg-slate-200/12 border-slate-300/30'
                    : idx === 2
                    ? 'bg-amber-600/15 border-amber-500/30'
                    : 'bg-[#160933]/85 border-white/10'
                }`}
              >
                {/* Esquerda: Posição + Avatar + (Nome em cima / Indicador da rodada embaixo) */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 rounded-lg font-display font-black text-xs flex items-center justify-center shrink-0 ${
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
                    className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(
                      p.nickname
                    )} flex items-center justify-center font-display font-black text-xs text-white shrink-0 shadow`}
                  >
                    {getInitials(p.nickname)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-black text-sm text-white truncate">
                        {p.nickname}
                      </span>
                      {isMe && (
                        <span className="shrink-0 text-[9px] font-black uppercase bg-amber-300 text-[#23114B] px-1.5 py-0.5 rounded-full leading-none">
                          Você
                        </span>
                      )}
                    </div>
                    <div className="mt-1">{renderRoundSpecificMetric(rec)}</div>
                  </div>
                </div>

                {/* Direita: Valor Recebido na Rodada */}
                <div className="text-right shrink-0 pl-1">
                  <span className="font-display text-sm sm:text-base font-black text-emerald-300 whitespace-nowrap">
                    + {formatCurrencyBRL(rec.amountEarned)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status de espera discreto no rodapé do balão */}
        <div className="pt-1 text-center shrink-0">
          <div className="inline-flex items-center gap-2 bg-white/10 text-violet-200 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping shrink-0" />
            <span>
              {roundNumber < 5
                ? `Aguardando início da Rodada ${roundNumber + 1}...`
                : 'Aguardando exibição do Pódio Final...'}
            </span>
          </div>
        </div>
      </div>

      {/* Ponta do Balão apontando para o Ranking Geral abaixo */}
      <div className="w-5 h-5 bg-[#2D165E] border-r-2 border-b-2 border-amber-300/40 rotate-45 mx-auto -mt-2.5 rounded-xs shrink-0" />
    </div>
  );
};
