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

  const myItem = React.useMemo(() => {
    if (!currentParticipantId) return null;
    const idx = rankedItems.findIndex((item) => item.participant.id === currentParticipantId);
    if (idx < 0) return null;
    return { ...rankedItems[idx], position: idx + 1 };
  }, [rankedItems, currentParticipantId]);

  const getRoundMetricSubtitle = (): string => {
    switch (roundNumber) {
      case 1:
        return 'Salário funcional fixo para todos os participantes presentes';
      case 2:
        return 'Quantidade de círculos válidos feitos por cada participante';
      case 3:
        return 'Porcentagem do melhor círculo desenhado por cada participante';
      case 4:
        return `Desempenho nas metas (1ª Meta: ${snapshot.config.round4Goals.target1MinCircles} círc. • 2ª Meta: ${snapshot.config.round4Goals.target2MinCircles}+ círc. ≥${snapshot.config.round4Goals.minAccuracyThreshold}%)`;
      case 5:
        return 'Média de porcentagem dos últimos 5 círculos válidos de cada participante';
      default:
        return '';
    }
  };

  const renderRoundSpecificMetric = (rec: RoundPayoutRecord) => {
    if (roundNumber === 1) {
      return (
        <span className="inline-block bg-violet-500/25 border border-violet-300/35 text-violet-100 font-display font-black text-xs px-3 py-1 rounded-full">
          {rec.validCirclesCount} {rec.validCirclesCount === 1 ? 'círculo' : 'círculos'} • Fixo
        </span>
      );
    }

    if (roundNumber === 2) {
      return (
        <span className="inline-block bg-sky-500/25 border border-sky-300/40 text-sky-200 font-display font-black text-xs md:text-sm px-3.5 py-1 rounded-full">
          {rec.validCirclesCount}{' '}
          {rec.validCirclesCount === 1 ? 'círculo feito' : 'círculos feitos'}
        </span>
      );
    }

    if (roundNumber === 3) {
      return (
        <span className="inline-block bg-amber-400/25 border border-amber-300/45 text-amber-200 font-display font-black text-xs md:text-sm px-3.5 py-1 rounded-full">
          Melhor: {rec.validCirclesCount > 0 ? formatPercentageBR(rec.bestAccuracy) : '0,0%'}
        </span>
      );
    }

    if (roundNumber === 4) {
      const { target1MinCircles, target2MinCircles } = snapshot.config.round4Goals;
      if (rec.qualifiedMetaCirclesCount >= target2MinCircles) {
        return (
          <span className="inline-block bg-emerald-400 text-[#092E19] font-display font-black text-[11px] md:text-xs uppercase tracking-wider px-3 py-1 rounded-full shadow">
            Bateu as 2 metas! ({rec.qualifiedMetaCirclesCount} círc.)
          </span>
        );
      }
      if (rec.qualifiedMetaCirclesCount >= target1MinCircles) {
        return (
          <span className="inline-block bg-cyan-300 text-[#06283D] font-display font-black text-[11px] md:text-xs uppercase tracking-wider px-3 py-1 rounded-full shadow">
            Bateu a 1ª meta ({rec.qualifiedMetaCirclesCount} círc.)
          </span>
        );
      }
      return (
        <span className="inline-block bg-rose-500/25 border border-rose-400/40 text-rose-200 font-display font-black text-[11px] md:text-xs uppercase tracking-wider px-3 py-1 rounded-full">
          Nenhuma meta ({rec.qualifiedMetaCirclesCount}/{target1MinCircles})
        </span>
      );
    }

    // Rodada 5 — Média de porcentagem de cada um
    if (rec.lastFiveAverageAccuracy !== null) {
      return (
        <span className="inline-block bg-pink-500/25 border border-pink-300/45 text-pink-200 font-display font-black text-xs md:text-sm px-3.5 py-1 rounded-full">
          Média: {formatPercentageBR(rec.lastFiveAverageAccuracy)}
        </span>
      );
    }
    return (
      <span className="inline-block bg-white/10 border border-white/15 text-violet-300 font-display font-bold text-xs px-3 py-1 rounded-full">
        Sem média ({rec.validCirclesCount}/{snapshot.config.round5Competencies.requiredValidCircles} círc.)
      </span>
    );
  };

  return (
    <div className="relative animate-pop w-full">
      {/* Balão Principal Estilo Gartic Phone */}
      <div className="gartic-glass p-5 md:p-6 border-2 border-amber-300/40 shadow-[0_14px_0_#120629,0_24px_50px_rgba(0,0,0,0.65)] space-y-4">
        {/* Topo do Balão */}
        <div className="text-center space-y-1.5">
          <div className="inline-block bg-amber-300 text-[#23114B] font-display font-black text-[11px] uppercase tracking-widest px-4 py-1 rounded-full shadow">
            Ranking da Rodada {roundNumber}
          </div>
          <h2
            className={`font-display ${
              variant === 'desktop' ? 'text-3xl' : 'text-2xl'
            } font-black uppercase text-white tracking-tight`}
          >
            {currentRoundMeta.shortTitle}
          </h2>
          <p className="text-xs font-bold text-violet-200">{getRoundMetricSubtitle()}</p>
        </div>

        {/* Destaque do Próprio Jogador (No Celular) */}
        {myItem && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-400 text-[#23114B] p-3.5 px-4 shadow-[0_5px_0_#9E6B00] flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
                Seu Resultado na Rodada {roundNumber} ({myItem.position}º na fase)
              </div>
              <div className="font-display text-2xl font-black leading-tight">
                + {formatCurrencyBRL(myItem.record.amountEarned)}
              </div>
            </div>
            <div className="shrink-0">{renderRoundSpecificMetric(myItem.record)}</div>
          </div>
        )}

        {/* Lista de Classificação Exclusiva da Rodada */}
        <div
          className={`space-y-2 overflow-y-auto pr-1 ${
            variant === 'desktop' ? 'max-h-[420px]' : 'max-h-[270px]'
          }`}
        >
          {rankedItems.map(({ participant: p, record: rec }, idx) => {
            const isMe = p.id === currentParticipantId;
            return (
              <div
                key={p.id}
                className={`rounded-2xl p-3 px-3.5 border flex items-center justify-between gap-2 transition ${
                  isMe
                    ? 'bg-violet-600/50 border-amber-300 ring-2 ring-amber-300/50'
                    : idx === 0
                    ? 'bg-amber-400/15 border-amber-300/40'
                    : idx === 1
                    ? 'bg-slate-200/12 border-slate-300/30'
                    : idx === 2
                    ? 'bg-amber-600/15 border-amber-500/30'
                    : 'bg-[#160933]/85 border-white/10'
                }`}
              >
                {/* Posição + Avatar + Apelido */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl font-display font-black text-xs flex items-center justify-center shrink-0 ${
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

                  <div className="min-w-0">
                    <div className="font-display font-black text-sm md:text-base text-white truncate">
                      {p.nickname}
                    </div>
                    {isMe && (
                      <span className="text-[9px] font-black uppercase text-amber-300 block leading-none">
                        Você
                      </span>
                    )}
                  </div>
                </div>

                {/* Indicador Específico da Rodada (R2: Círculos, R3: Melhor %, R4: Metas, R5: Média %) */}
                <div className="shrink-0">{renderRoundSpecificMetric(rec)}</div>

                {/* Dinheiro Ganho na Rodada */}
                <div className="text-right shrink-0 min-w-[88px]">
                  <span className="font-display text-sm md:text-lg font-black text-emerald-300">
                    + {formatCurrencyBRL(rec.amountEarned)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé de Espera */}
        <div className="pt-1 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-violet-200 px-4 py-2 rounded-full text-xs font-extrabold">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
            <span>
              {roundNumber < 5
                ? `Este balão fechará assim que o administrador iniciar a Rodada ${roundNumber + 1}`
                : 'Aguardando o administrador abrir o Pódio Final'}
            </span>
          </div>
        </div>
      </div>

      {/* Ponta do Balão apontando para baixo estilo Gartic */}
      <div className="w-6 h-6 bg-[#2D165E] border-r-2 border-b-2 border-amber-300/40 rotate-45 mx-auto -mt-3 rounded-xs" />
    </div>
  );
};
