import {
  CircleAttempt,
  Participant,
  RemunerationConfig,
  RoundPayoutRecord,
} from './types';

export interface RoundMetadata {
  number: number;
  title: string;
  shortTitle: string;
  badgeColor: string;
  concept: string;
  ruleSummary: string;
  objective: string;
  pedagogicalTakeaway: string;
  disclaimer?: string;
}

export const DEFAULT_REMUNERATION_CONFIG: RemunerationConfig = {
  roundDurationSeconds: 30,
  round1FixedSalary: 500,
  round2PerCircleReward: 50,
  round3SkillTiers: {
    tier70to79: 100,
    tier80to89: 250,
    tier90to94: 400,
    tier95to100: 600,
  },
  round4Goals: {
    minAccuracyThreshold: 80,
    target1MinCircles: 5,
    target1Reward: 500,
    target2MinCircles: 8,
    target2Reward: 800,
  },
  round5Competencies: {
    requiredValidCircles: 5,
    tier70to79: 200,
    tier80to89: 400,
    tier90plus: 600,
  },
};

export function getRoundsMetadata(config: RemunerationConfig = DEFAULT_REMUNERATION_CONFIG): RoundMetadata[] {
  return [
    {
      number: 1,
      title: 'Rodada 1 — Remuneração Funcional',
      shortTitle: 'Remuneração Funcional',
      badgeColor: 'from-violet-600 to-indigo-600',
      concept:
        'Remuneração associada ao cargo ou função exercida, sem depender diretamente da produtividade ou precisão individual.',
      ruleSummary: `Todos os participantes presentes até o final da rodada recebem ${formatCurrencyBRL(config.round1FixedSalary)} fixos, independentemente da quantidade ou precisão dos círculos.`,
      objective: 'Experimente a área de desenho livremente e permaneça conectado até o fim da rodada!',
      pedagogicalTakeaway:
        'Garante previsibilidade e segurança financeira (salário-base), mas sozinha não diferencia quem produz mais ou com maior qualidade.',
    },
    {
      number: 2,
      title: 'Rodada 2 — Remuneração Variável por Produtividade',
      shortTitle: 'Produtividade (Comissão / Peça)',
      badgeColor: 'from-sky-500 to-blue-600',
      concept: 'Quanto maior o volume de produção entregue, maior a recompensa financeira.',
      ruleSummary: `Cada círculo válido concluído vale ${formatCurrencyBRL(config.round2PerCircleReward)}. A precisão não altera o valor (basta ser um círculo válido).`,
      objective: `Desenhe o maior número possível de círculos válidos em ${config.roundDurationSeconds} segundos!`,
      pedagogicalTakeaway:
        'Estimula fortemente a velocidade e o volume de entregas, porém pode provocar queda na qualidade se não houver controle.',
    },
    {
      number: 3,
      title: 'Rodada 3 — Remuneração por Habilidades',
      shortTitle: 'Remuneração por Habilidades',
      badgeColor: 'from-amber-500 to-orange-500',
      concept: 'Reconhece o domínio técnico de uma habilidade superior, e não a quantidade produzida.',
      ruleSummary:
        `Vale apenas a sua MELHOR precisão na rodada (pagamento único, não cumulativo): ` +
        `<70%: R$ 0 | 70–79,9%: ${formatCurrencyBRL(config.round3SkillTiers.tier70to79)} | ` +
        `80–89,9%: ${formatCurrencyBRL(config.round3SkillTiers.tier80to89)} | ` +
        `90–94,9%: ${formatCurrencyBRL(config.round3SkillTiers.tier90to94)} | ` +
        `95–100%: ${formatCurrencyBRL(config.round3SkillTiers.tier95to100)}.`,
      objective: 'Concentre-se em desenhar pelo menos UM círculo de altíssima precisão!',
      pedagogicalTakeaway:
        'Incentiva o aperfeiçoamento técnico e a busca pela excelência, mudando o foco da pressa para o domínio da execução.',
    },
    {
      number: 4,
      title: 'Rodada 4 — Remuneração por Metas',
      shortTitle: 'Remuneração por Metas',
      badgeColor: 'from-emerald-500 to-teal-600',
      concept: 'Recompensa vinculada ao cumprimento de objetivos claros de quantidade e qualidade mínima.',
      ruleSummary:
        `Produza círculos válidos com precisão igual ou superior a ${config.round4Goals.minAccuracyThreshold}%: ` +
        `Menos de ${config.round4Goals.target1MinCircles}: R$ 0 | ` +
        `De ${config.round4Goals.target1MinCircles} a ${config.round4Goals.target2MinCircles - 1} círculos (≥${config.round4Goals.minAccuracyThreshold}%): ${formatCurrencyBRL(config.round4Goals.target1Reward)} | ` +
        `${config.round4Goals.target2MinCircles} ou mais círculos (≥${config.round4Goals.minAccuracyThreshold}%): ${formatCurrencyBRL(config.round4Goals.target2Reward)} (substitutivo).`,
      objective: `Atinja a meta de ${config.round4Goals.target1MinCircles} círculos com precisão ≥ ${config.round4Goals.minAccuracyThreshold}% (ou ${config.round4Goals.target2MinCircles}+ para a supermeta)!`,
      pedagogicalTakeaway:
        'Direciona o esforço para resultados específicos combinando volume e padrão mínimo de qualidade, mas gera efeito "tudo ou nada" perto do corte.',
    },
    {
      number: 5,
      title: 'Rodada 5 — Remuneração por Competências',
      shortTitle: 'Remuneração por Competências',
      badgeColor: 'from-rose-500 to-pink-600',
      concept:
        'Reconhecimento de um conjunto de capacidades, avaliando a qualidade e a consistência sustentada das entregas.',
      ruleSummary:
        `Complete pelo menos ${config.round5Competencies.requiredValidCircles} círculos válidos. A recompensa é definida pela MÉDIA dos seus ÚLTIMOS ${config.round5Competencies.requiredValidCircles} círculos válidos: ` +
        `<70%: R$ 0 | 70–79,9%: ${formatCurrencyBRL(config.round5Competencies.tier70to79)} | ` +
        `80–89,9%: ${formatCurrencyBRL(config.round5Competencies.tier80to89)} | ` +
        `≥90%: ${formatCurrencyBRL(config.round5Competencies.tier90plus)}.`,
      objective: `Complete pelo menos ${config.round5Competencies.requiredValidCircles} círculos válidos mantendo alta consistência nos últimos ${config.round5Competencies.requiredValidCircles}!`,
      pedagogicalTakeaway:
        'Valoriza a regularidade, maturidade e sustentação da qualidade ao longo do tempo, evitando que um único golpe de sorte defina a remuneração.',
      disclaimer:
        'Nota pedagógica: Esta fase é uma simulação simplificada. Nas organizações reais, competências envolvem CHA (Conhecimentos, Habilidades e Atitudes), e não apenas precisão em uma tarefa motora.',
    },
  ];
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercentageBR(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

const AVATAR_GRADIENTS = [
  'from-pink-500 to-rose-600',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-green-600',
  'from-cyan-400 to-blue-600',
  'from-violet-500 to-purple-700',
  'from-fuchsia-500 to-pink-600',
  'from-lime-400 to-emerald-600',
  'from-sky-400 to-indigo-600',
];

export function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || 'JG';
}

/**
 * Calcula em tempo real ou no encerramento da rodada os indicadores e o pagamento de um participante.
 */
export function calculateRoundPayoutForParticipant(
  roundNumber: number,
  attempts: CircleAttempt[],
  config: RemunerationConfig = DEFAULT_REMUNERATION_CONFIG
): RoundPayoutRecord {
  const validAttempts = attempts.filter((a) => a.isValid);
  const validCirclesCount = validAttempts.length;

  let bestAccuracy = 0;
  let sumAccuracy = 0;
  for (const a of validAttempts) {
    if (a.accuracy > bestAccuracy) bestAccuracy = a.accuracy;
    sumAccuracy += a.accuracy;
  }
  const averageAccuracy =
    validCirclesCount > 0 ? Math.round((sumAccuracy / validCirclesCount) * 100) / 100 : 0;

  const qualifiedMetaCirclesCount = validAttempts.filter(
    (a) => a.accuracy >= config.round4Goals.minAccuracyThreshold
  ).length;

  let lastFiveAverageAccuracy: number | null = null;
  const reqCount = config.round5Competencies.requiredValidCircles;
  if (validCirclesCount >= reqCount) {
    const lastFive = validAttempts.slice(-reqCount);
    const sumLastFive = lastFive.reduce((acc, item) => acc + item.accuracy, 0);
    lastFiveAverageAccuracy = Math.round((sumLastFive / reqCount) * 100) / 100;
  }

  let amountEarned = 0;
  let explanation = '';
  const roundsMeta = getRoundsMetadata(config);
  const roundMeta = roundsMeta[roundNumber - 1] || roundsMeta[0];

  switch (roundNumber) {
    case 1: {
      amountEarned = config.round1FixedSalary;
      explanation = `Salário funcional fixo garantido pela participação na rodada (${formatCurrencyBRL(amountEarned)}).`;
      break;
    }
    case 2: {
      amountEarned = validCirclesCount * config.round2PerCircleReward;
      explanation = `${validCirclesCount} ${validCirclesCount === 1 ? 'círculo válido' : 'círculos válidos'} × ${formatCurrencyBRL(config.round2PerCircleReward)} = ${formatCurrencyBRL(amountEarned)}.`;
      break;
    }
    case 3: {
      if (validCirclesCount === 0 || bestAccuracy < 70) {
        amountEarned = 0;
        explanation =
          validCirclesCount === 0
            ? 'Nenhum círculo válido concluído na rodada (R$ 0,00).'
            : `Melhor precisão (${formatPercentageBR(bestAccuracy)}) ficou abaixo de 70% (R$ 0,00).`;
      } else if (bestAccuracy < 80) {
        amountEarned = config.round3SkillTiers.tier70to79;
        explanation = `Melhor precisão de ${formatPercentageBR(bestAccuracy)} (Faixa 70% a 79,99% → ${formatCurrencyBRL(amountEarned)}).`;
      } else if (bestAccuracy < 90) {
        amountEarned = config.round3SkillTiers.tier80to89;
        explanation = `Melhor precisão de ${formatPercentageBR(bestAccuracy)} (Faixa 80% a 89,99% → ${formatCurrencyBRL(amountEarned)}).`;
      } else if (bestAccuracy < 95) {
        amountEarned = config.round3SkillTiers.tier90to94;
        explanation = `Melhor precisão de ${formatPercentageBR(bestAccuracy)} (Faixa 90% a 94,99% → ${formatCurrencyBRL(amountEarned)}).`;
      } else {
        amountEarned = config.round3SkillTiers.tier95to100;
        explanation = `Excelência! Melhor precisão de ${formatPercentageBR(bestAccuracy)} (Faixa 95% a 100% → ${formatCurrencyBRL(amountEarned)}).`;
      }
      break;
    }
    case 4: {
      const { minAccuracyThreshold, target1MinCircles, target1Reward, target2MinCircles, target2Reward } =
        config.round4Goals;
      if (qualifiedMetaCirclesCount >= target2MinCircles) {
        amountEarned = target2Reward;
        explanation = `Supermeta atingida! ${qualifiedMetaCirclesCount} círculos com precisão ≥ ${minAccuracyThreshold}% (${formatCurrencyBRL(amountEarned)}).`;
      } else if (qualifiedMetaCirclesCount >= target1MinCircles) {
        amountEarned = target1Reward;
        explanation = `Meta atingida! ${qualifiedMetaCirclesCount} círculos com precisão ≥ ${minAccuracyThreshold}% (${formatCurrencyBRL(amountEarned)}).`;
      } else {
        amountEarned = 0;
        explanation = `Meta não atingida: ${qualifiedMetaCirclesCount}/${target1MinCircles} círculos com precisão ≥ ${minAccuracyThreshold}% (R$ 0,00).`;
      }
      break;
    }
    case 5: {
      if (lastFiveAverageAccuracy === null) {
        amountEarned = 0;
        explanation = `Requisito mínimo não atingido: completou ${validCirclesCount}/${reqCount} círculos válidos (R$ 0,00).`;
      } else if (lastFiveAverageAccuracy < 70) {
        amountEarned = 0;
        explanation = `Média dos últimos ${reqCount} círculos (${formatPercentageBR(lastFiveAverageAccuracy)}) ficou abaixo de 70% (R$ 0,00).`;
      } else if (lastFiveAverageAccuracy < 80) {
        amountEarned = config.round5Competencies.tier70to79;
        explanation = `Média dos últimos ${reqCount} círculos: ${formatPercentageBR(lastFiveAverageAccuracy)} (Faixa 70% a 79,99% → ${formatCurrencyBRL(amountEarned)}).`;
      } else if (lastFiveAverageAccuracy < 90) {
        amountEarned = config.round5Competencies.tier80to89;
        explanation = `Média dos últimos ${reqCount} círculos: ${formatPercentageBR(lastFiveAverageAccuracy)} (Faixa 80% a 89,99% → ${formatCurrencyBRL(amountEarned)}).`;
      } else {
        amountEarned = config.round5Competencies.tier90plus;
        explanation = `Alta consistência! Média dos últimos ${reqCount} círculos: ${formatPercentageBR(lastFiveAverageAccuracy)} (Faixa ≥ 90% → ${formatCurrencyBRL(amountEarned)}).`;
      }
      break;
    }
  }

  return {
    roundNumber,
    roundName: roundMeta.shortTitle,
    validCirclesCount,
    qualifiedMetaCirclesCount,
    bestAccuracy: Math.round(bestAccuracy * 10) / 10,
    averageAccuracy: Math.round(averageAccuracy * 10) / 10,
    lastFiveAverageAccuracy:
      lastFiveAverageAccuracy !== null ? Math.round(lastFiveAverageAccuracy * 10) / 10 : null,
    amountEarned,
    explanation,
    paidAt: Date.now(),
  };
}

/**
 * Ordena os participantes segundo a regra oficial do jogo:
 * 1º Critério Principal: Dinheiro acumulado (do maior para o menor)
 * 2º Critério de Desempate: Maior precisão média geral
 * 3º Critério adicional: Melhor precisão individual
 */
export function sortParticipantsForRanking(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) => {
    if (b.balance !== a.balance) {
      return b.balance - a.balance;
    }
    if (b.averageOverallAccuracy !== a.averageOverallAccuracy) {
      return b.averageOverallAccuracy - a.averageOverallAccuracy;
    }
    if (b.bestOverallAccuracy !== a.bestOverallAccuracy) {
      return b.bestOverallAccuracy - a.bestOverallAccuracy;
    }
    return a.joinedAt - b.joinedAt;
  });
}
