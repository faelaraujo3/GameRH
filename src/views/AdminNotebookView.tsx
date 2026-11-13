import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Participant,
  PublicGameSnapshot,
  RemunerationConfig,
} from '../shared/types';
import {
  calculateRoundPayoutForParticipant,
  formatCurrencyBRL,
  formatPercentageBR,
  getAvatarGradient,
  getInitials,
  getRoundsMetadata,
} from '../shared/roundRules';

interface AdminNotebookViewProps {
  snapshot: PublicGameSnapshot | null;
  connected: boolean;
  displayRemainingSeconds: number;
  applySnapshot: (data: PublicGameSnapshot) => void;
}

const ADMIN_TOKEN_KEY = 'cp_admin_token';

export const AdminNotebookView: React.FC<AdminNotebookViewProps> = ({
  snapshot,
  connected,
  displayRemainingSeconds,
  applySnapshot,
}) => {
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    sessionStorage.getItem(ADMIN_TOKEN_KEY)
  );
  const [pinInput, setPinInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoadingAction, setIsLoadingAction] = useState<boolean>(false);

  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [showNewRoomModal, setShowNewRoomModal] = useState<boolean>(false);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [configDraft, setConfigDraft] = useState<RemunerationConfig | null>(null);

  useEffect(() => {
    if (snapshot?.config && !configDraft) {
      setConfigDraft(structuredClone(snapshot.config));
    }
  }, [snapshot?.config, configDraft]);

  const activeBaseUrl = useMemo(() => {
    if (customUrlInput.trim()) return customUrlInput.trim().replace(/\/+$/, '');
    if (snapshot?.publicTunnelUrl) return snapshot.publicTunnelUrl.replace(/\/+$/, '');
    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost && snapshot?.lanUrls && snapshot.lanUrls.length > 0) {
      return snapshot.lanUrls[0];
    }
    return window.location.origin;
  }, [customUrlInput, snapshot]);

  const participantJoinUrl = snapshot ? `${activeBaseUrl}/?sala=${snapshot.roomCode}` : '';

  useEffect(() => {
    if (!participantJoinUrl) return;
    QRCode.toDataURL(participantJoinUrl, {
      width: 420,
      margin: 1,
      color: { dark: '#1e1136', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [participantJoinUrl]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'PIN inválido.');
        return;
      }
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.adminToken);
      setAdminToken(data.adminToken);
      if (data.snapshot) applySnapshot(data.snapshot);
    } catch {
      setAuthError('Falha ao conectar ao servidor.');
    }
  };

  const callAdminAction = async (endpoint: string, body: Record<string, unknown> = {}) => {
    if (!adminToken) return;
    setActionError(null);
    setIsLoadingAction(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 401) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setAdminToken(null);
        return;
      }
      if (!res.ok) {
        setActionError(data.error || 'Erro ao executar comando.');
        return;
      }
      if (data.snapshot) {
        applySnapshot(data.snapshot);
      }
    } catch {
      setActionError('Erro de comunicação com o servidor.');
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(participantJoinUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configDraft) return;
    await callAdminAction('/api/admin/config', configDraft as unknown as Record<string, unknown>);
    setShowConfigModal(false);
  };

  // ==================== TELA DE LOGIN DO ADMINISTRADOR (PIN) ====================
  if (!adminToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="gartic-glass p-8 max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-block bg-amber-400 text-[#23114B] font-display font-black text-[11px] uppercase tracking-widest px-4 py-1 rounded-full">
              Acesso Restrito
            </div>
            <h1 className="font-display text-3xl font-black uppercase tracking-tight text-white">
              Painel do Administrador
            </h1>
            <p className="text-sm text-violet-200 font-bold">
              Controle exclusivo das rodadas pelo notebook. Informe o PIN:
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-violet-200 mb-1.5">
                PIN Administrativo
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="PIN (Padrão: 1234)"
                required
                autoFocus
                className="w-full px-4 py-3.5 rounded-2xl bg-[#160933]/90 border-2 border-white/20 font-display text-2xl font-black text-center tracking-widest text-amber-300 placeholder:text-violet-400/40 focus:outline-none focus:border-amber-300"
              />
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/25 border border-rose-400 text-rose-100 text-xs font-extrabold text-center">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="btn-game btn-yellow w-full py-4 rounded-2xl text-lg cursor-pointer"
            >
              Entrar no Painel
            </button>
          </form>

          <div className="text-center pt-2">
            <a
              href="/"
              className="text-xs font-extrabold text-violet-300 hover:text-amber-300 transition"
            >
              ← Voltar para a tela do participante
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="gartic-glass p-10 text-center font-display text-2xl font-black uppercase">
          Carregando Painel...
        </div>
      </div>
    );
  }

  const roundsMeta = getRoundsMetadata(snapshot.config);
  const currentRoundMeta = roundsMeta[snapshot.currentRound - 1] || roundsMeta[0];
  const participants = snapshot.participants;
  const botsCount = participants.filter((p) => p.isBot).length;

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-16">
      {/* BARRA SUPERIOR ADMINISTRATIVA */}
      <header className="gartic-glass p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-[#23114B] font-display font-black text-xl flex items-center justify-center shadow-[0_5px_0_#9E6B00]">
            ADM
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-black uppercase tracking-tight text-white">
                Controle da Dinâmica — Círculo Premiado
              </h1>
              <span
                className={`font-display text-[11px] font-black uppercase px-3 py-0.5 rounded-full ${
                  connected
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    : 'bg-rose-500/30 text-rose-200'
                }`}
              >
                {connected ? '● Sincronizado' : '○ Reconectando'}
              </span>
            </div>
            <p className="text-xs font-bold text-violet-300 mt-0.5">
              Gerencie as 5 rodadas de remuneração e acompanhe a turma em tempo real
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/placar"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-game btn-yellow px-4 py-2.5 rounded-xl text-xs"
          >
            Abrir Placar Projetor ↗
          </a>

          <button
            type="button"
            onClick={() => {
              setConfigDraft(structuredClone(snapshot.config));
              setShowConfigModal(true);
            }}
            className="btn-game btn-ghost px-4 py-2.5 rounded-xl text-xs cursor-pointer"
          >
            Valores (R$)
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirmModal(true)}
            className="btn-game btn-coral px-4 py-2.5 rounded-xl text-xs cursor-pointer"
          >
            Reiniciar Partida
          </button>
        </div>
      </header>

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/25 border border-rose-400 text-rose-100 font-bold text-sm flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-xs underline">
            Fechar
          </button>
        </div>
      )}

      {/* SELETOR DAS 5 FASES */}
      <div className="gartic-glass p-5 space-y-3">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-violet-300">
          <span>As 5 Fases da Dinâmica</span>
          <span>Estado do Servidor: {snapshot.status}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {roundsMeta.map((rm) => {
            const isCurrent = snapshot.currentRound === rm.number && snapshot.status !== 'GAME_OVER';
            const isPaid = Boolean(snapshot.paidRounds[rm.number]);
            return (
              <div
                key={rm.number}
                className={`p-3.5 rounded-2xl border transition flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-violet-600/45 border-amber-300 ring-2 ring-amber-300/50'
                    : isPaid
                    ? 'bg-emerald-500/15 border-emerald-400/35'
                    : 'bg-[#160933]/70 border-white/10 opacity-85'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-display text-[11px] font-black uppercase text-amber-300">
                      Rodada {rm.number}
                    </span>
                    {isPaid && (
                      <span className="text-[10px] font-black uppercase bg-emerald-400 text-[#092E19] px-2 py-0.5 rounded-full">
                        Paga
                      </span>
                    )}
                  </div>
                  <div className="font-display font-black text-sm text-white mt-1 leading-snug">
                    {rm.shortTitle}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={snapshot.status === 'ROUND_ACTIVE' || isLoadingAction}
                  onClick={() => callAdminAction('/api/admin/start-round', { roundNumber: rm.number })}
                  className="mt-3 text-[11px] font-display font-black uppercase tracking-wider py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-amber-300 hover:text-[#23114B] text-white transition cursor-pointer disabled:opacity-40"
                >
                  {isPaid ? `Repetir Fase ${rm.number}` : `Iniciar Fase ${rm.number}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* GRID CENTRAL: COMANDOS DA RODADA + ACESSO E QR CODE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Comandos da Rodada (7 colunas) */}
        <div className="lg:col-span-7 gartic-glass p-6 flex flex-col justify-between space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-lg">
              <div className="flex items-center gap-2">
                <span
                  className={`font-display text-xs font-black uppercase tracking-wider text-white px-3.5 py-1 rounded-full bg-gradient-to-r ${currentRoundMeta.badgeColor}`}
                >
                  Fase Atual: {snapshot.currentRound} de 5
                </span>
                <span className="font-display text-xs font-black uppercase bg-white/10 text-violet-200 px-3 py-1 rounded-full">
                  {snapshot.status === 'LOBBY'
                    ? 'Sala de Espera'
                    : snapshot.status === 'ROUND_INTRO'
                    ? 'Pronto para Iniciar'
                    : snapshot.status === 'ROUND_ACTIVE'
                    ? 'Em Andamento'
                    : snapshot.status === 'ROUND_PAUSED'
                    ? 'Pausada'
                    : snapshot.status === 'ROUND_FINISHED'
                    ? 'Concluída e Paga'
                    : 'Jogo Finalizado'}
                </span>
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-black text-white pt-1">
                {currentRoundMeta.title}
              </h2>
              <p className="text-xs font-bold text-violet-200 leading-relaxed">
                {currentRoundMeta.ruleSummary}
              </p>
            </div>

            {/* Mostrador do Cronômetro */}
            <div className="bg-gradient-to-b from-amber-300 to-amber-500 text-[#23114B] px-6 py-3.5 rounded-2xl text-center shadow-[0_6px_0_#9E6B00] shrink-0">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-85">
                Cronômetro
              </div>
              <div className="font-display text-4xl font-black leading-none mt-0.5">
                {displayRemainingSeconds}s
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="p-4 rounded-2xl bg-[#160933]/85 border border-white/12 space-y-3">
            <div className="text-[11px] font-black uppercase tracking-widest text-violet-300">
              Ações de Controle da Partida
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(snapshot.status === 'LOBBY' ||
                snapshot.status === 'ROUND_INTRO' ||
                snapshot.status === 'ROUND_FINISHED') && (
                <button
                  type="button"
                  disabled={isLoadingAction}
                  onClick={() =>
                    callAdminAction('/api/admin/start-round', {
                      roundNumber: snapshot.currentRound,
                    })
                  }
                  className="btn-game btn-green py-4 px-5 rounded-2xl text-base cursor-pointer"
                >
                  {snapshot.paidRounds[snapshot.currentRound]
                    ? `Reiniciar Rodada ${snapshot.currentRound} (${snapshot.config.roundDurationSeconds}s)`
                    : `Iniciar Rodada ${snapshot.currentRound} (${snapshot.config.roundDurationSeconds}s)`}
                </button>
              )}

              {snapshot.status === 'ROUND_ACTIVE' && (
                <button
                  type="button"
                  disabled={isLoadingAction}
                  onClick={() => callAdminAction('/api/admin/pause-round')}
                  className="btn-game btn-yellow py-4 px-5 rounded-2xl text-base cursor-pointer"
                >
                  Pausar Cronômetro
                </button>
              )}

              {snapshot.status === 'ROUND_PAUSED' && (
                <button
                  type="button"
                  disabled={isLoadingAction}
                  onClick={() => callAdminAction('/api/admin/resume-round')}
                  className="btn-game btn-green py-4 px-5 rounded-2xl text-base cursor-pointer"
                >
                  Retomar Cronômetro
                </button>
              )}

              {(snapshot.status === 'ROUND_ACTIVE' || snapshot.status === 'ROUND_PAUSED') && (
                <button
                  type="button"
                  disabled={isLoadingAction}
                  onClick={() => callAdminAction('/api/admin/finish-round')}
                  className="btn-game btn-coral py-4 px-5 rounded-2xl text-base cursor-pointer"
                >
                  Finalizar e Pagar Agora
                </button>
              )}

              {snapshot.status === 'ROUND_FINISHED' && snapshot.currentRound < 5 && (
                <button
                  type="button"
                  disabled={isLoadingAction}
                  onClick={() => callAdminAction('/api/admin/next-phase')}
                  className="btn-game btn-purple py-4 px-5 rounded-2xl text-base cursor-pointer"
                >
                  Avançar para Rodada {snapshot.currentRound + 1} →
                </button>
              )}

              {(snapshot.currentRound === 5 && snapshot.status === 'ROUND_FINISHED') ||
              snapshot.status === 'GAME_OVER' ? (
                <button
                  type="button"
                  disabled={isLoadingAction}
                  onClick={() => callAdminAction('/api/admin/show-podium')}
                  className="btn-game btn-yellow py-4 px-5 rounded-2xl text-base cursor-pointer"
                >
                  Exibir Pódio Final e Vencedores
                </button>
              ) : null}
            </div>
          </div>

          {/* Simulador de Alunos para Testes */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-violet-300">
              Modo Simulação (Adicione jogadores virtuais para testar antes da aula):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => callAdminAction('/api/admin/add-bots', { count: 5 })}
                className="btn-game btn-ghost px-3.5 py-1.5 rounded-xl text-[11px] cursor-pointer"
              >
                +5 Jogadores Simulados
              </button>
              {botsCount > 0 && (
                <button
                  type="button"
                  onClick={() => callAdminAction('/api/admin/remove-bots')}
                  className="btn-game btn-coral px-3.5 py-1.5 rounded-xl text-[11px] cursor-pointer"
                >
                  Remover Bots ({botsCount})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Código da Sala e QR Code (5 colunas) */}
        <div className="lg:col-span-5 gartic-glass p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-black uppercase tracking-wide text-white">
              QR Code & Código da Sala
            </h3>
            <button
              type="button"
              onClick={() => setShowNewRoomModal(true)}
              className="text-xs font-extrabold text-amber-300 hover:underline cursor-pointer"
            >
              Gerar Novo Código
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#160933]/85 p-4 rounded-2xl border border-white/12">
            {qrDataUrl && (
              <div className="shrink-0 text-center">
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  onClick={() => setShowQrModal(true)}
                  className="w-32 h-32 rounded-2xl bg-white p-1.5 cursor-pointer hover:scale-105 transition shadow-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="mt-2 w-full font-display font-black uppercase text-[10px] tracking-wider bg-amber-300 text-[#23114B] px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Ampliar QR Code
                </button>
              </div>
            )}

            <div className="space-y-2.5 text-center sm:text-left min-w-0 flex-1">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-violet-300">
                  Código da Sala
                </div>
                <div className="font-display text-4xl font-black text-amber-300 tracking-widest">
                  {snapshot.roomCode}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-violet-300">
                  Link Direto de Entrada
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={participantJoinUrl}
                    className="w-full text-xs font-mono bg-white/10 px-3 py-2 rounded-xl border border-white/15 text-white truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="btn-game btn-purple px-3 py-2 rounded-xl text-[11px] shrink-0 cursor-pointer"
                  >
                    {copiedUrl ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-violet-300">
                Para os alunos escanearem pelo 4G/5G ou qualquer Wi-Fi:
              </span>
              {snapshot.publicTunnelUrl && (
                <span className="text-[10px] font-black uppercase bg-emerald-400/20 text-emerald-300 px-2.5 py-0.5 rounded-full">
                  Link Público Ativo!
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={isLoadingAction}
              onClick={() => callAdminAction('/api/admin/start-tunnel')}
              className="btn-game btn-cyan w-full py-2.5 px-4 rounded-xl text-xs cursor-pointer"
            >
              {isLoadingAction
                ? 'Gerando Link Público na Internet (aguarde ~5s)...'
                : snapshot.publicTunnelUrl
                ? 'Link Público da Internet Ativo no QR Code!'
                : 'Gerar Link Público da Internet (1 Clique)'}
            </button>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder={activeBaseUrl}
                className="flex-1 text-xs px-3 py-1.5 rounded-xl bg-[#160933]/90 border border-white/15 text-white placeholder:text-violet-400/50"
              />
              <button
                type="button"
                onClick={() => callAdminAction('/api/admin/public-url', { url: customUrlInput })}
                className="btn-game btn-ghost px-3.5 py-1.5 rounded-xl text-xs cursor-pointer"
              >
                Fixar URL
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MONITORAMENTO DE JOGADORES EM TEMPO REAL */}
      <div className="gartic-glass p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h2 className="font-display text-xl md:text-2xl font-black uppercase tracking-wide text-white">
            Participantes Conectados ({participants.length})
          </h2>
          <span className="text-xs font-extrabold text-violet-300">
            Ordenado por Dinheiro Acumulado • Desempate: Maior Precisão Média
          </span>
        </div>

        {participants.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="font-display text-lg font-black text-white">
              Nenhum participante conectado ainda.
            </p>
            <p className="text-xs font-bold text-violet-300">
              Compartilhe o QR Code ou clique em <strong>"+5 Jogadores Simulados"</strong> acima
              para testar a partida.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {participants.map((p: Participant, idx: number) => {
              const liveRound = calculateRoundPayoutForParticipant(
                snapshot.currentRound,
                p.currentRoundCircles,
                snapshot.config
              );
              return (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[#160933]/80 border border-white/10 p-3.5 px-4 flex flex-wrap items-center justify-between gap-4 hover:border-white/25 transition"
                >
                  <div className="flex items-center gap-3 min-w-[200px]">
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
                      )} flex items-center justify-center font-display font-black text-xs text-white shrink-0`}
                    >
                      {getInitials(p.nickname)}
                    </div>
                    <div>
                      <div className="font-display font-black text-base text-white">
                        {p.nickname}
                        {p.isBot && (
                          <span className="ml-2 text-[10px] font-black uppercase bg-violet-500/30 text-violet-200 px-2 py-0.5 rounded-full">
                            Simulado
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-violet-300">
                        Total: {p.totalValidCircles} círculos • Média Geral:{' '}
                        {formatPercentageBR(p.averageOverallAccuracy)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="bg-white/6 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                      <span className="text-[10px] font-black uppercase text-violet-300 block">
                        Círculos R{snapshot.currentRound}
                      </span>
                      <span className="font-display font-black text-white">
                        {liveRound.validCirclesCount}
                      </span>
                    </div>

                    <div className="bg-white/6 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                      <span className="text-[10px] font-black uppercase text-violet-300 block">
                        Melhor R{snapshot.currentRound}
                      </span>
                      <span className="font-display font-black text-amber-300">
                        {formatPercentageBR(liveRound.bestAccuracy)}
                      </span>
                    </div>

                    <div className="bg-white/6 border border-white/10 rounded-xl px-3 py-1.5 text-center">
                      <span className="text-[10px] font-black uppercase text-violet-300 block">
                        Média Últ. 5
                      </span>
                      <span className="font-display font-black text-cyan-300">
                        {liveRound.lastFiveAverageAccuracy !== null
                          ? formatPercentageBR(liveRound.lastFiveAverageAccuracy)
                          : '—'}
                      </span>
                    </div>

                    <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-3 py-1.5 text-right min-w-[100px]">
                      <span className="text-[10px] font-black uppercase text-emerald-300 block">
                        Ganho R{snapshot.currentRound}
                      </span>
                      <span className="font-display font-black text-emerald-300">
                        + {formatCurrencyBRL(liveRound.amountEarned)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right min-w-[120px]">
                      <span className="text-[10px] font-black uppercase text-violet-300 block">
                        Acumulado
                      </span>
                      <span className="font-display text-xl font-black text-white">
                        {formatCurrencyBRL(p.balance)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        callAdminAction('/api/admin/remove-participant', {
                          participantId: p.id,
                        })
                      }
                      className="text-xs font-black uppercase text-rose-300 hover:text-rose-400 bg-rose-500/15 px-3 py-1.5 rounded-xl cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL QR CODE EM TELA CHEIA */}
      {showQrModal && (
        <div className="fixed inset-0 bg-[#120629]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="gartic-glass p-8 max-w-lg w-full text-center space-y-5 relative animate-pop">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 font-display font-black text-xs uppercase bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full cursor-pointer"
            >
              Fechar
            </button>
            <h3 className="font-display text-3xl font-black uppercase text-white">
              Entre no Círculo Premiado!
            </h3>
            {qrDataUrl && (
              <div className="p-4 bg-white rounded-3xl inline-block shadow-2xl">
                <img src={qrDataUrl} alt="QR Code Grande" className="w-72 h-72 rounded-2xl" />
              </div>
            )}
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-violet-300">
                Código da Sala
              </div>
              <div className="font-display text-6xl font-black text-amber-300 tracking-widest mt-1">
                {snapshot.roomCode}
              </div>
            </div>
            <p className="text-xs font-mono text-violet-300 break-all">{participantJoinUrl}</p>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR REINÍCIO */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-[#120629]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="gartic-glass p-6 max-w-md w-full space-y-4 animate-pop">
            <h3 className="font-display text-2xl font-black uppercase text-white">
              Reiniciar a Partida?
            </h3>
            <p className="text-sm font-bold text-violet-200">
              Os saldos e estatísticas de todos os participantes serão zerados e o jogo voltará para
              a Rodada 1.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="btn-game btn-ghost flex-1 py-3 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await callAdminAction('/api/admin/reset-game');
                  setShowResetConfirmModal(false);
                }}
                className="btn-game btn-coral flex-1 py-3 rounded-xl text-xs cursor-pointer"
              >
                Sim, Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA SALA */}
      {showNewRoomModal && (
        <div className="fixed inset-0 bg-[#120629]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="gartic-glass p-6 max-w-md w-full space-y-4 animate-pop">
            <h3 className="font-display text-2xl font-black uppercase text-white">
              Gerar Nova Sala?
            </h3>
            <p className="text-sm font-bold text-violet-200">
              Um novo código será criado e a lista de participantes será limpa para uma nova turma.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewRoomModal(false)}
                className="btn-game btn-ghost flex-1 py-3 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await callAdminAction('/api/admin/new-room');
                  setShowNewRoomModal(false);
                }}
                className="btn-game btn-yellow flex-1 py-3 rounded-xl text-xs cursor-pointer"
              >
                Criar Nova Sala
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR VALORES */}
      {showConfigModal && configDraft && (
        <div className="fixed inset-0 bg-[#120629]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveConfig}
            className="gartic-glass p-6 max-w-xl w-full space-y-4 my-8 animate-pop"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-black uppercase text-white">
                Valores e Regras (R$)
              </h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-xs font-black uppercase bg-white/10 px-3 py-1.5 rounded-full"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
              <div className="p-3.5 rounded-xl bg-[#160933]/90 border border-white/10">
                <label className="block text-violet-300 mb-1">Duração da Rodada (segundos)</label>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={configDraft.roundDurationSeconds}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      roundDurationSeconds: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-base font-display font-black"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#160933]/90 border border-white/10">
                <label className="block text-violet-300 mb-1">
                  Rodada 1 — Salário Funcional (R$)
                </label>
                <input
                  type="number"
                  value={configDraft.round1FixedSalary}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      round1FixedSalary: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-base font-display font-black"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#160933]/90 border border-white/10 sm:col-span-2">
                <label className="block text-violet-300 mb-1">
                  Rodada 2 — Valor por Círculo Válido (R$)
                </label>
                <input
                  type="number"
                  value={configDraft.round2PerCircleReward}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      round2PerCircleReward: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-base font-display font-black"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#160933]/90 border border-white/10 sm:col-span-2 space-y-2">
                <div className="text-amber-300">Rodada 3 — Faixas por Habilidade (R$)</div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] text-violet-300 block">70–79,9%</span>
                    <input
                      type="number"
                      value={configDraft.round3SkillTiers.tier70to79}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round3SkillTiers: {
                            ...configDraft.round3SkillTiers,
                            tier70to79: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-violet-300 block">80–89,9%</span>
                    <input
                      type="number"
                      value={configDraft.round3SkillTiers.tier80to89}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round3SkillTiers: {
                            ...configDraft.round3SkillTiers,
                            tier80to89: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-violet-300 block">90–94,9%</span>
                    <input
                      type="number"
                      value={configDraft.round3SkillTiers.tier90to94}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round3SkillTiers: {
                            ...configDraft.round3SkillTiers,
                            tier90to94: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-violet-300 block">95–100%</span>
                    <input
                      type="number"
                      value={configDraft.round3SkillTiers.tier95to100}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round3SkillTiers: {
                            ...configDraft.round3SkillTiers,
                            tier95to100: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#160933]/90 border border-white/10 sm:col-span-2 space-y-2">
                <div className="text-emerald-300">
                  Rodada 4 — Metas (Círculos com precisão ≥ {configDraft.round4Goals.minAccuracyThreshold}% • R$)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-violet-300 block">
                      5 a 7 círculos (≥{configDraft.round4Goals.minAccuracyThreshold}%)
                    </span>
                    <input
                      type="number"
                      value={configDraft.round4Goals.target1Reward}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round4Goals: {
                            ...configDraft.round4Goals,
                            target1Reward: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-violet-300 block">
                      8+ círculos (≥{configDraft.round4Goals.minAccuracyThreshold}%)
                    </span>
                    <input
                      type="number"
                      value={configDraft.round4Goals.target2Reward}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round4Goals: {
                            ...configDraft.round4Goals,
                            target2Reward: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#160933]/90 border border-white/10 sm:col-span-2 space-y-2">
                <div className="text-pink-300">
                  Rodada 5 — Competências (Média dos últimos 5 círculos R$)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-violet-300 block">70–79,9%</span>
                    <input
                      type="number"
                      value={configDraft.round5Competencies.tier70to79}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round5Competencies: {
                            ...configDraft.round5Competencies,
                            tier70to79: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-violet-300 block">80–89,9%</span>
                    <input
                      type="number"
                      value={configDraft.round5Competencies.tier80to89}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round5Competencies: {
                            ...configDraft.round5Competencies,
                            tier80to89: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-violet-300 block">≥ 90%</span>
                    <input
                      type="number"
                      value={configDraft.round5Competencies.tier90plus}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          round5Competencies: {
                            ...configDraft.round5Competencies,
                            tier90plus: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/15 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="btn-game btn-ghost px-4 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-game btn-yellow px-6 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
