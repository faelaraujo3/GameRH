import assert from 'node:assert';
import { evaluateCircleDrawing } from '../src/shared/circleMath';
import { Point2D } from '../src/shared/types';
import { GameEngine } from './gameEngine';

function generateSyntheticCircle(
  centerX: number,
  centerY: number,
  radius: number,
  numPoints: number,
  radialNoiseFraction: number,
  arcCoverageFraction = 1.0
): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * (2 * Math.PI * arcCoverageFraction);
    // Ruído determinístico suave (senoidal) para testes reprodutíveis
    const noise = radius * radialNoiseFraction * Math.sin(theta * 5);
    const r = radius + noise;
    pts.push({
      x: centerX + r * Math.cos(theta),
      y: centerY + r * Math.sin(theta),
    });
  }
  return pts;
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO TESTES AUTOMATIZADOS — CÍRCULO PREMIADO');
  console.log('====================================================\n');

  // 1. Testar algoritmo geométrico de precisão dos círculos
  console.log('1️⃣  Testando algoritmo geométrico de precisão de círculos...');

  const perfectPts = generateSyntheticCircle(150, 150, 90, 80, 0.0, 1.0);
  const perfectEval = evaluateCircleDrawing(perfectPts);
  assert.strictEqual(perfectEval.isValid, true, 'Círculo perfeito deve ser válido');
  assert(perfectEval.accuracy >= 98, `Precisão esperada >= 98%, obtida: ${perfectEval.accuracy}%`);
  console.log(`   ✔ Círculo ideal: válido=${perfectEval.isValid}, precisão=${perfectEval.accuracy}%`);

  const goodPts = generateSyntheticCircle(150, 150, 90, 80, 0.06, 1.0);
  const goodEval = evaluateCircleDrawing(goodPts);
  assert.strictEqual(goodEval.isValid, true, 'Círculo bom deve ser válido');
  assert(
    goodEval.accuracy >= 85 && goodEval.accuracy <= 95,
    `Precisão boa esperada entre 85% e 95%, obtida: ${goodEval.accuracy}%`
  );
  console.log(`   ✔ Círculo bom (ruído 6%): válido=${goodEval.isValid}, precisão=${goodEval.accuracy}%`);

  const mediumPts = generateSyntheticCircle(150, 150, 90, 80, 0.14, 1.0);
  const mediumEval = evaluateCircleDrawing(mediumPts);
  assert.strictEqual(mediumEval.isValid, true, 'Círculo mediano deve ser válido');
  assert(
    mediumEval.accuracy >= 70 && mediumEval.accuracy < 86,
    `Precisão mediana esperada entre 70% e 86%, obtida: ${mediumEval.accuracy}%`
  );
  console.log(`   ✔ Círculo mediano (ruído 14%): válido=${mediumEval.isValid}, precisão=${mediumEval.accuracy}%`);

  const halfCirclePts = generateSyntheticCircle(150, 150, 90, 50, 0.01, 0.55);
  const halfEval = evaluateCircleDrawing(halfCirclePts);
  assert.strictEqual(halfEval.isValid, false, 'Semicírculo aberto deve ser rejeitado');
  console.log(`   ✔ Semicírculo incompleto rejeitado corretamente: "${halfEval.reason}"`);

  const straightLine: Point2D[] = Array.from({ length: 30 }, (_, i) => ({
    x: 20 + i * 8,
    y: 100 + i * 2,
  }));
  const lineEval = evaluateCircleDrawing(straightLine);
  assert.strictEqual(lineEval.isValid, false, 'Linha reta deve ser rejeitada');
  console.log(`   ✔ Linha reta rejeitada corretamente: "${lineEval.reason}"`);

  // 2. Testar motor do jogo com 15 participantes simultâneos e as 5 rodadas
  console.log('\n2️⃣  Testando dinâmica completa com 15 participantes e 5 rodadas...');
  const engine = new GameEngine(3000, () => {});
  const room = engine.createNewRoom('RH26');

  const studentNames = [
    'Alice', 'Beatriz', 'Carlos', 'Daniel', 'Eduarda',
    'Fernando', 'Gabriela', 'Henrique', 'Isabela', 'João',
    'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Olívia',
  ];

  const joinedStudents: { id: string; token: string; name: string }[] = [];

  for (const name of studentNames) {
    const res = engine.joinParticipant('RH26', name);
    assert.strictEqual(res.success, true, `Falha ao entrar com ${name}`);
    joinedStudents.push({
      id: res.participant!.id,
      token: res.sessionToken!,
      name,
    });
  }

  // Verificar bloqueio de apelido duplicado
  const dupRes = engine.joinParticipant('RH26', 'alice');
  assert.strictEqual(dupRes.success, false, 'Apelido duplicado (case-insensitive) deveria ser bloqueado');
  console.log('   ✔ 15 participantes conectados e bloqueio de apelido duplicado verificado!');

  // Testar reconexão de sessão
  const recRes = engine.recoverSession(joinedStudents[0].id, joinedStudents[0].token);
  assert.strictEqual(recRes.valid, true, 'Recuperação de sessão deve funcionar');
  console.log('   ✔ Recuperação de sessão após atualização de página verificada!');

  // RODADA 1 — Remuneração Funcional (R$ 500 para todos)
  engine.startRound(1);
  // Alice desenha 3 círculos, Beatriz não desenha nenhum — ambas devem ganhar R$ 500
  engine.submitCircleAttempt(joinedStudents[0].id, joinedStudents[0].token, perfectPts);
  engine.submitCircleAttempt(joinedStudents[0].id, joinedStudents[0].token, goodPts);
  engine.finishCurrentRound();

  // Tentar finalizar novamente para garantir proteção contra pagamento duplicado
  engine.finishCurrentRound();

  let snap = engine.getPublicSnapshot();
  for (const p of snap.participants) {
    assert.strictEqual(p.balance, 500, `Na Rodada 1 todos devem ter R$ 500, mas ${p.nickname} tem ${p.balance}`);
  }
  console.log('   ✔ Rodada 1 (Remuneração Funcional): R$ 500,00 creditados para todos (sem duplicidade)!');

  // RODADA 2 — Produtividade (R$ 50 por círculo válido)
  engine.advanceToNextPhase();
  engine.startRound(2);
  // Alice desenha 4 círculos válidos (+R$ 200) e 1 inválido (+R$ 0)
  for (let i = 0; i < 4; i++) {
    engine.submitCircleAttempt(joinedStudents[0].id, joinedStudents[0].token, mediumPts);
  }
  engine.submitCircleAttempt(joinedStudents[0].id, joinedStudents[0].token, halfCirclePts);
  engine.finishCurrentRound();

  snap = engine.getPublicSnapshot();
  const aliceR2 = snap.participants.find((p) => p.id === joinedStudents[0].id)!;
  assert.strictEqual(aliceR2.roundHistory[2].amountEarned, 200, 'Alice deveria ganhar R$ 200 na Rodada 2');
  assert.strictEqual(aliceR2.balance, 700, 'Saldo acumulado de Alice deveria ser R$ 700');
  console.log('   ✔ Rodada 2 (Produtividade): 4 círculos válidos × R$ 50 = R$ 200,00!');

  // RODADA 3 — Habilidades (Melhor precisão: 95-100% -> R$ 600)
  engine.advanceToNextPhase();
  engine.startRound(3);
  engine.submitCircleAttempt(joinedStudents[0].id, joinedStudents[0].token, mediumPts);
  engine.submitCircleAttempt(joinedStudents[0].id, joinedStudents[0].token, perfectPts); // >= 95%
  engine.finishCurrentRound();

  snap = engine.getPublicSnapshot();
  const aliceR3 = snap.participants.find((p) => p.id === joinedStudents[0].id)!;
  assert.strictEqual(aliceR3.roundHistory[3].amountEarned, 600, 'Alice deveria ganhar R$ 600 na Rodada 3');
  console.log('   ✔ Rodada 3 (Habilidades): Melhor precisão >= 95% premiada com R$ 600,00 (não cumulativo)!');

  // RODADA 4 — Metas (5 a 7 círculos >= 80% -> R$ 500; 8+ -> R$ 800 substitutivo)
  engine.advanceToNextPhase();
  engine.startRound(4);
  for (let i = 0; i < 8; i++) {
    engine.submitCircleAttempt(joinedStudents[0].id, joinedStudents[0].token, goodPts); // >= 85%
  }
  for (let i = 0; i < 5; i++) {
    engine.submitCircleAttempt(joinedStudents[1].id, joinedStudents[1].token, goodPts); // 5 círculos -> R$ 500
  }
  engine.finishCurrentRound();

  snap = engine.getPublicSnapshot();
  const aliceR4 = snap.participants.find((p) => p.id === joinedStudents[0].id)!;
  const beatrizR4 = snap.participants.find((p) => p.id === joinedStudents[1].id)!;
  assert.strictEqual(aliceR4.roundHistory[4].amountEarned, 800, 'Alice (8 círculos >=80%) deveria ganhar R$ 800');
  assert.strictEqual(beatrizR4.roundHistory[4].amountEarned, 500, 'Beatriz (5 círculos >=80%) deveria ganhar R$ 500');
  console.log('   ✔ Rodada 4 (Metas): Meta (R$ 500,00) e Supermeta substitutiva (R$ 800,00) verificadas!');

  // RODADA 5 — Competências (Mínimo 5 círculos; média dos últimos 5 válidos)
  engine.advanceToNextPhase();
  engine.startRound(5);
  for (let i = 0; i < 5; i++) {
    engine.submitCircleAttempt(joinedStudents[0].id, joinedStudents[0].token, perfectPts); // média >= 90% -> R$ 600
  }
  // Carlos faz apenas 4 círculos perfeitos -> não atinge mínimo de 5 -> R$ 0
  for (let i = 0; i < 4; i++) {
    engine.submitCircleAttempt(joinedStudents[2].id, joinedStudents[2].token, perfectPts);
  }
  engine.finishCurrentRound();
  engine.advanceToNextPhase(); // GAME_OVER

  snap = engine.getPublicSnapshot();
  const aliceR5 = snap.participants.find((p) => p.id === joinedStudents[0].id)!;
  const carlosR5 = snap.participants.find((p) => p.id === joinedStudents[2].id)!;
  assert.strictEqual(aliceR5.roundHistory[5].amountEarned, 600, 'Alice deveria ganhar R$ 600 na Rodada 5');
  assert.strictEqual(carlosR5.roundHistory[5].amountEarned, 0, 'Carlos com 4 círculos deveria ganhar R$ 0 na Rodada 5');
  assert.strictEqual(snap.status, 'GAME_OVER', 'Status final deve ser GAME_OVER');
  assert.strictEqual(snap.participants[0].id, joinedStudents[0].id, 'Alice deve ser a 1ª colocada no ranking');
  console.log('   ✔ Rodada 5 (Competências) e Ranking Final verificados com sucesso!');

  // Deixar a sala limpa e pronta para uso imediato pelo usuário
  engine.createNewRoom('RH10');
  console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! Sala pronta com código RH10.');
}

runTests().catch((err) => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
