import { CircleEvaluation, FittedCircle, Point2D } from './types';

/**
 * Reamostra uma polilinha em M pontos equidistantes ao longo do comprimento do arco.
 * Isso evita que variações na velocidade do dedo distorçam o cálculo do centro e do raio médio.
 */
function resampleByArcLength(points: Point2D[], targetCount: number): { resampled: Point2D[]; totalLength: number } {
  if (points.length < 2) {
    return { resampled: points, totalLength: 0 };
  }

  const cumulativeLengths: number[] = [0];
  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segLen = Math.hypot(dx, dy);
    totalLength += segLen;
    cumulativeLengths.push(totalLength);
  }

  if (totalLength === 0) {
    return { resampled: [points[0]], totalLength: 0 };
  }

  const resampled: Point2D[] = [];
  const step = totalLength / (targetCount - 1);
  let currentSeg = 0;

  for (let i = 0; i < targetCount; i++) {
    const targetDist = Math.min(i * step, totalLength);
    while (currentSeg < cumulativeLengths.length - 2 && cumulativeLengths[currentSeg + 1] < targetDist) {
      currentSeg++;
    }
    const segStartDist = cumulativeLengths[currentSeg];
    const segEndDist = cumulativeLengths[currentSeg + 1];
    const segSpan = segEndDist - segStartDist;
    const t = segSpan > 1e-6 ? (targetDist - segStartDist) / segSpan : 0;

    const p0 = points[currentSeg];
    const p1 = points[currentSeg + 1];
    resampled.push({
      x: p0.x + t * (p1.x - p0.x),
      y: p0.y + t * (p1.y - p0.y),
    });
  }

  return { resampled, totalLength };
}

/**
 * Ajusta matematicamente um círculo ideal (centerX, centerY, radius) aos pontos usando
 * Mínimos Quadrados Algébricos (Método de Kåsa / Coope) seguido de refinamento geométrico.
 */
export function fitIdealCircle(points: Point2D[]): FittedCircle {
  const n = points.length;
  if (n === 0) {
    return { centerX: 0, centerY: 0, radius: 0 };
  }

  let meanX = 0;
  let meanY = 0;
  for (const p of points) {
    meanX += p.x;
    meanY += p.y;
  }
  meanX /= n;
  meanY /= n;

  // Coordenadas centralizadas para estabilidade numérica (u = x - meanX, v = y - meanY)
  let suu = 0;
  let suv = 0;
  let svv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;

  for (const p of points) {
    const u = p.x - meanX;
    const v = p.y - meanY;
    const uu = u * u;
    const vv = v * v;
    suu += uu;
    suv += u * v;
    svv += vv;
    suuu += uu * u;
    svvv += vv * v;
    suvv += u * vv;
    svuu += v * uu;
  }

  // Resolver sistema linear 2x2:
  // suu * uc + suv * vc = 0.5 * (suuu + suvv)
  // suv * uc + svv * vc = 0.5 * (svvv + svuu)
  const det = suu * svv - suv * suv;
  let centerX = meanX;
  let centerY = meanY;

  if (Math.abs(det) > 1e-5) {
    const rhs1 = 0.5 * (suuu + suvv);
    const rhs2 = 0.5 * (svvv + svuu);
    const uc = (rhs1 * svv - rhs2 * suv) / det;
    const vc = (suu * rhs2 - suv * rhs1) / det;
    centerX = meanX + uc;
    centerY = meanY + vc;
  }

  // Duas iterações de Gauss-Newton para minimizar o erro radial geométrico exato: sum((r_i - R)^2)
  for (let iter = 0; iter < 3; iter++) {
    const radii: number[] = [];
    let sumR = 0;
    for (const p of points) {
      const r = Math.hypot(p.x - centerX, p.y - centerY);
      radii.push(r);
      sumR += r;
    }
    const meanR = sumR / n;
    let stepX = 0;
    let stepY = 0;
    for (let i = 0; i < n; i++) {
      const r = radii[i];
      if (r > 1e-4) {
        const residual = r - meanR;
        stepX += residual * ((points[i].x - centerX) / r);
        stepY += residual * ((points[i].y - centerY) / r);
      }
    }
    centerX += (2 * stepX) / n;
    centerY += (2 * stepY) / n;
  }

  let radiusSum = 0;
  for (const p of points) {
    radiusSum += Math.hypot(p.x - centerX, p.y - centerY);
  }
  const radius = radiusSum / n;

  return { centerX, centerY, radius };
}

/**
 * Avalia de forma completa e rigorosa se os pontos desenhados formam um círculo válido
 * e calcula a pontuação de precisão de 0% a 100%.
 */
export function evaluateCircleDrawing(rawPoints: Point2D[]): CircleEvaluation {
  if (!rawPoints || rawPoints.length < 14) {
    return {
      isValid: false,
      accuracy: 0,
      reason: 'Traço muito curto! Desenhe um círculo completo.',
    };
  }

  // Filtrar pontos idênticos consecutivos
  const filtered: Point2D[] = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = filtered[filtered.length - 1];
    if (Math.hypot(rawPoints[i].x - prev.x, rawPoints[i].y - prev.y) >= 1.5) {
      filtered.push(rawPoints[i]);
    }
  }

  if (filtered.length < 12) {
    return {
      isValid: false,
      accuracy: 0,
      reason: 'Desenho muito pequeno! Faça um círculo maior.',
    };
  }

  const { resampled, totalLength } = resampleByArcLength(filtered, 72);
  const fitted = fitIdealCircle(resampled);

  // 1. Verificar raio mínimo para evitar pontinhos
  if (fitted.radius < 22 || totalLength < 110) {
    return {
      isValid: false,
      accuracy: 0,
      reason: 'Círculo muito pequeno! Use mais espaço da tela.',
      fittedCircle: fitted,
    };
  }

  // 2. Verificar proporção da caixa delimitadora (evitar linhas retas ou elipses muito achatadas)
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of resampled) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const aspect = Math.min(width, height) / Math.max(width, height, 1);

  if (aspect < 0.42) {
    return {
      isValid: false,
      accuracy: 0,
      reason: 'Formato muito achatado! Tente desenhar um círculo.',
      fittedCircle: fitted,
    };
  }

  // 3. Analisar cobertura angular ao redor do centro e fechamento do traçado
  const sectorCount = 12;
  const visitedSectors = new Array<boolean>(sectorCount).fill(false);
  let totalSweptRadians = 0;

  for (let i = 0; i < resampled.length; i++) {
    const dx = resampled[i].x - fitted.centerX;
    const dy = resampled[i].y - fitted.centerY;
    const angle = Math.atan2(dy, dx); // -PI a PI
    const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
    const sectorIdx = Math.min(
      sectorCount - 1,
      Math.floor((normalizedAngle / (2 * Math.PI)) * sectorCount)
    );
    visitedSectors[sectorIdx] = true;

    if (i > 0) {
      const prevDx = resampled[i - 1].x - fitted.centerX;
      const prevDy = resampled[i - 1].y - fitted.centerY;
      const prevAngle = Math.atan2(prevDy, prevDx);
      let dTheta = angle - prevAngle;
      while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
      while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
      totalSweptRadians += dTheta;
    }
  }

  const sectorsVisitedCount = visitedSectors.filter(Boolean).length;
  const sweptDegrees = (Math.abs(totalSweptRadians) * 180) / Math.PI;

  const startPoint = resampled[0];
  const endPoint = resampled[resampled.length - 1];
  const closureDistance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
  const closureRatio = closureDistance / fitted.radius;

  // Verificar se deu pelo menos ~80% da volta e visitou pelo menos 10 dos 12 setores
  if (sectorsVisitedCount < 10 || sweptDegrees < 285) {
    return {
      isValid: false,
      accuracy: 0,
      reason: 'Círculo incompleto! Feche a volta até o início.',
      fittedCircle: fitted,
      closureRatio,
      coverageDegrees: sweptDegrees,
    };
  }

  // Verificar se as pontas ficaram muito abertas
  if (closureRatio > 0.95) {
    return {
      isValid: false,
      accuracy: 0,
      reason: 'Pontas abertas! Una o final do traço ao ponto inicial.',
      fittedCircle: fitted,
      closureRatio,
      coverageDegrees: sweptDegrees,
    };
  }

  // Verificar se o usuário deu várias voltas seguidas (espiral)
  if (sweptDegrees > 460) {
    return {
      isValid: false,
      accuracy: 0,
      reason: 'Apenas uma volta por círculo! Não dê voltas extras.',
      fittedCircle: fitted,
      closureRatio,
      coverageDegrees: sweptDegrees,
    };
  }

  // 4. Calcular erro radial normalizado pelo raio médio (RMSE e MAE)
  let sumSquaredRadialError = 0;
  let sumAbsRadialError = 0;
  let maxRadialDeviation = 0;

  for (const p of resampled) {
    const r = Math.hypot(p.x - fitted.centerX, p.y - fitted.centerY);
    const diff = Math.abs(r - fitted.radius);
    sumAbsRadialError += diff;
    sumSquaredRadialError += diff * diff;
    if (diff > maxRadialDeviation) {
      maxRadialDeviation = diff;
    }
  }

  const rmseRadial = Math.sqrt(sumSquaredRadialError / resampled.length);
  const maeRadial = sumAbsRadialError / resampled.length;

  const normalizedRmse = rmseRadial / fitted.radius;
  const normalizedMae = maeRadial / fitted.radius;
  const normalizedMaxDev = maxRadialDeviation / fitted.radius;

  // Se o erro radial for absurdo (ex: desenhou um quadrado pontudo ou estrela), invalidar
  if (normalizedRmse > 0.34 || normalizedMaxDev > 0.68) {
    return {
      isValid: false,
      accuracy: 0,
      reason: 'Formato muito irregular para ser considerado um círculo!',
      fittedCircle: fitted,
      normalizedRadialError: normalizedRmse,
    };
  }

  // 5. Cálculo da Pontuação de Precisão (0% a 100%)
  // Penalidade principal: erro radial normalizado (combinando RMSE e MAE)
  const combinedRadialError = 0.68 * normalizedRmse + 0.32 * normalizedMae;

  // Penalidade por falha de fechamento (se a distância entre início e fim > 9% do raio)
  const gapPenalty = Math.max(0, closureRatio - 0.09) * 16.5;

  // Penalidade por falta ou excesso de ângulo em relação a 360 graus
  const angleDeviationDeg = Math.abs(360 - sweptDegrees);
  const anglePenalty = Math.max(0, angleDeviationDeg - 9) * 0.17;

  // Curva calibrada levemente mais rigorosa para dificultar um pouco as porcentagens mais altas:
  // combinedRadialError = 0.00 -> 100%
  // combinedRadialError = 0.03 -> ~93.2%
  // combinedRadialError = 0.06 -> ~86.8%
  // combinedRadialError = 0.10 -> ~79.0%
  // combinedRadialError = 0.15 -> ~70.2%
  const baseScore = 100 * Math.exp(-2.35 * combinedRadialError);
  const rawAccuracy = baseScore - gapPenalty - anglePenalty;

  const clampedAccuracy = Math.max(10, Math.min(100, rawAccuracy));
  const finalAccuracy = Math.round(clampedAccuracy * 10) / 10;

  return {
    isValid: true,
    accuracy: finalAccuracy,
    fittedCircle: fitted,
    normalizedRadialError: normalizedRmse,
    closureRatio,
    coverageDegrees: sweptDegrees,
  };
}

/**
 * Calcula uma estimativa rápida de precisão em tempo real enquanto o dedo ainda está desenhando,
 * sem penalizar o fechamento incompleto.
 */
export function estimateRealtimeCircleAccuracy(points: Point2D[]): {
  estimatedAccuracy: number | null;
  fittedCircle: FittedCircle | null;
} {
  if (points.length < 10) {
    return { estimatedAccuracy: null, fittedCircle: null };
  }

  // Amostragem leve de até 36 pontos para manter 60fps suaves
  const step = Math.max(1, Math.floor(points.length / 36));
  const sample: Point2D[] = [];
  for (let i = 0; i < points.length; i += step) {
    sample.push(points[i]);
  }

  const fitted = fitIdealCircle(sample);
  if (fitted.radius < 20) {
    return { estimatedAccuracy: null, fittedCircle: null };
  }

  let sumSq = 0;
  for (const p of sample) {
    const r = Math.hypot(p.x - fitted.centerX, p.y - fitted.centerY);
    const d = r - fitted.radius;
    sumSq += d * d;
  }
  const normRmse = Math.sqrt(sumSq / sample.length) / fitted.radius;
  const est = Math.max(0, Math.min(100, 100 * Math.exp(-2.35 * normRmse)));

  return {
    estimatedAccuracy: Math.round(est * 10) / 10,
    fittedCircle: fitted,
  };
}
