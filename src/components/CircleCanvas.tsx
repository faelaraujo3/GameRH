import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CircleEvaluation, Point2D } from '../shared/types';
import {
  evaluateCircleDrawing,
  estimateRealtimeCircleAccuracy,
} from '../shared/circleMath';
import { formatPercentageBR } from '../shared/roundRules';

interface CircleCanvasProps {
  disabled: boolean;
  onCircleCompleted: (points: Point2D[], localEvaluation: CircleEvaluation) => Promise<void> | void;
}

export const CircleCanvas: React.FC<CircleCanvasProps> = ({ disabled, onCircleCompleted }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isDrawingRef = useRef<boolean>(false);
  const pointsRef = useRef<Point2D[]>([]);
  const activePointerIdRef = useRef<number | null>(null);

  const [realtimeAccuracy, setRealtimeAccuracy] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<CircleEvaluation | null>(null);
  const [strokeCount, setStrokeCount] = useState<number>(0);

  const renderCanvas = useCallback(
    (points: Point2D[], evaluationToRender: CircleEvaluation | null, isCurrentlyDrawing: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Área de desenho 100% branca
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Guia geométrico central sutil (estilo Draw the Perfect Circle)
      const centerX = width / 2;
      const centerY = height / 2;
      ctx.strokeStyle = '#EFEAFC';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(width, height) * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Mira central minimalista
      ctx.fillStyle = '#D7C9F8';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Círculo ideal ajustado (gabarito tracejado exibido ao soltar o dedo)
      if (!isCurrentlyDrawing && evaluationToRender?.fittedCircle && evaluationToRender.fittedCircle.radius > 15) {
        const { centerX: cx, centerY: cy, radius: r } = evaluationToRender.fittedCircle;
        ctx.save();
        ctx.strokeStyle = evaluationToRender.isValid
          ? 'rgba(124, 58, 237, 0.32)'
          : 'rgba(244, 63, 94, 0.32)';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Traçado do jogador
      if (points.length > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 7.5;

        if (!isCurrentlyDrawing && evaluationToRender) {
          if (!evaluationToRender.isValid) {
            ctx.strokeStyle = '#FF3B6B';
          } else if (evaluationToRender.accuracy >= 90) {
            ctx.strokeStyle = '#12C969';
          } else if (evaluationToRender.accuracy >= 80) {
            ctx.strokeStyle = '#7C3AED';
          } else {
            ctx.strokeStyle = '#FFB000';
          }
        } else {
          ctx.strokeStyle = '#7C3AED';
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const midX = (prev.x + curr.x) / 2;
          const midY = (prev.y + curr.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();

        // Indicador do ponto de partida para fechar o círculo
        ctx.fillStyle = '#7C3AED';
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, 6.5, 0, Math.PI * 2);
        ctx.fill();

        if (isCurrentlyDrawing) {
          ctx.strokeStyle = 'rgba(124, 58, 237, 0.35)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(points[0].x, points[0].y, 14, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    },
    []
  );

  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${Math.floor(rect.width)}px`;
      canvas.style.height = `${Math.floor(rect.height)}px`;

      renderCanvas(pointsRef.current, lastResult, isDrawingRef.current);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [renderCanvas, lastResult]);

  useEffect(() => {
    if (disabled && isDrawingRef.current) {
      isDrawingRef.current = false;
      activePointerIdRef.current = null;
      setRealtimeAccuracy(null);
    }
  }, [disabled]);

  const getPointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignorar se não suportado
      }
    }

    activePointerIdRef.current = e.pointerId;
    isDrawingRef.current = true;
    const startPt = getPointFromEvent(e);
    pointsRef.current = [startPt];
    setLastResult(null);
    setRealtimeAccuracy(null);
    renderCanvas(pointsRef.current, null, true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !isDrawingRef.current || activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    const pt = getPointFromEvent(e);
    const pts = pointsRef.current;
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 2) {
      pts.push(pt);
      renderCanvas(pts, null, true);

      if (pts.length >= 12 && pts.length % 4 === 0) {
        const { estimatedAccuracy } = estimateRealtimeCircleAccuracy(pts);
        setRealtimeAccuracy(estimatedAccuracy);
      }
    }
  };

  const finalizeGesture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    setRealtimeAccuracy(null);

    const capturedPoints = [...pointsRef.current];
    const evaluation = evaluateCircleDrawing(capturedPoints);
    setLastResult(evaluation);
    setStrokeCount((c) => c + 1);
    renderCanvas(capturedPoints, evaluation, false);

    onCircleCompleted(capturedPoints, evaluation);
  };

  const handleClearCanvas = () => {
    pointsRef.current = [];
    setLastResult(null);
    setRealtimeAccuracy(null);
    renderCanvas([], null, false);
  };

  return (
    <div className="flex flex-col flex-1 w-full min-h-[340px] relative select-none">
      <div
        ref={containerRef}
        className="relative flex-1 w-full bg-white rounded-[28px] shadow-[0_10px_0_#13072E,0_20px_40px_rgba(0,0,0,0.45)] ring-4 ring-white/20 overflow-hidden drawing-surface"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finalizeGesture}
          onPointerCancel={finalizeGesture}
          className="block w-full h-full cursor-crosshair drawing-surface"
        />

        {/* Guia inicial minimalista */}
        {strokeCount === 0 && !realtimeAccuracy && !lastResult && !disabled && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 rounded-full border-[3.5px] border-dashed border-violet-300 flex items-center justify-center mb-3">
              <div className="w-3.5 h-3.5 rounded-full bg-violet-500 animate-ping" />
            </div>
            <p className="font-display text-lg font-black uppercase tracking-wide text-violet-950">
              Desenhe um círculo
            </p>
            <p className="text-xs font-bold text-slate-400 max-w-[220px] mt-1">
              Use o dedo na área branca e feche o traçado até o ponto inicial
            </p>
          </div>
        )}

        {/* Estimativa ao vivo enquanto desenha */}
        {realtimeAccuracy !== null && (
          <div className="pointer-events-none absolute top-3.5 left-1/2 -translate-x-1/2 bg-[#23114B]/95 text-white px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg">
            Precisão estimada: <span className="text-amber-300">{formatPercentageBR(realtimeAccuracy)}</span>
          </div>
        )}

        {/* Resultado imediato ao levantar o dedo */}
        {lastResult && (
          <div
            key={strokeCount}
            className="pointer-events-none absolute top-3.5 left-3 right-3 flex justify-center animate-pop"
          >
            {lastResult.isValid ? (
              <div
                className={`px-6 py-2.5 rounded-2xl shadow-xl text-center ${
                  lastResult.accuracy >= 90
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                    : lastResult.accuracy >= 80
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
                    : 'bg-gradient-to-r from-amber-400 to-yellow-400 text-indigo-950'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-widest opacity-90">
                  Círculo Concluído!
                </div>
                <div className="font-display text-2xl font-black tracking-tight">
                  {formatPercentageBR(lastResult.accuracy)}
                </div>
              </div>
            ) : (
              <div className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-xl text-center max-w-xs">
                <div className="text-[10px] font-black uppercase tracking-widest text-rose-100">
                  Tentativa Inválida
                </div>
                <div className="text-xs font-extrabold mt-0.5">{lastResult.reason}</div>
              </div>
            )}
          </div>
        )}

        {/* Botão Limpar estilo pílula Gartic */}
        <button
          type="button"
          onClick={handleClearCanvas}
          disabled={disabled}
          className="absolute bottom-3.5 right-3.5 bg-slate-100 hover:bg-slate-200 active:translate-y-0.5 text-slate-600 font-display font-black uppercase tracking-wider text-[11px] px-4 py-2 rounded-full shadow-sm transition cursor-pointer"
        >
          Limpar Tela
        </button>
      </div>
    </div>
  );
};
