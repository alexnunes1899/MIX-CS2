import React, { Component, Suspense, lazy } from 'react';

const RoomsHubModal = lazy(() => import('./RoomsHubModal'));
const MatchHistoryModal = lazy(() => import('./MatchHistoryModal'));
const QuickVetoModal = lazy(() => import('./QuickVetoModal'));
const QuickMapRollModal = lazy(() => import('./QuickMapRollModal'));
const SteamLoginGateModal = lazy(() => import('./SteamLoginGateModal'));
const PlayerProfileModal = lazy(() => import('./PlayerProfileModal'));
const GsiSetupModal = lazy(() => import('./GsiSetupModal'));
const RoomPasswordModal = lazy(() => import('./RoomPasswordModal'));
const LeaderboardModal = lazy(() => import('./LeaderboardModal'));
const DiscordWebhookModal = lazy(() => import('./DiscordWebhookModal'));
const MatchCardModal = lazy(() => import('./MatchCardModal'));
const PlayerStoryCardModal = lazy(() => import('./PlayerStoryCardModal'));
const GrenadePlaybookModal = lazy(() => import('./GrenadePlaybookModal'));
const AimReflexModal = lazy(() => import('./AimReflexModal'));
const TournamentBracketModal = lazy(() => import('./TournamentBracketModal'));
const LocalHostModal = lazy(() => import('./LocalHostModal'));

class ModalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[GlobalModals] Erro ao carregar modal:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full text-center space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Falha ao abrir janela
            </h3>
            <p className="text-xs text-slate-400">
              Não foi possível carregar este módulo. Tente novamente.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                if (this.props.onReset) this.props.onReset();
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ModalLoadingFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs pointer-events-none">
    <div className="px-4 py-2 rounded-xl bg-slate-900/95 border border-slate-700 text-xs font-mono text-amber-300 shadow-xl animate-pulse">
      Carregando módulo...
    </div>
  </div>
);

export default function GlobalModals({
  view,
  roomId,
  room,
  myProfile,
  socket,
  soundEnabled,
  isSteamLogged,
  officialRotation,
  syncingRotation,
  // Modal open flags & setters
  roomsHubOpen,
  onCloseRoomsHub,
  onOpenRoomsHub,
  historyOpen,
  onCloseHistory,
  quickVetoOpen,
  onCloseQuickVeto,
  quickMapRollOpen,
  onCloseQuickMapRoll,
  steamGateModalOpen,
  steamGateActionText,
  onCloseSteamGate,
  onExitMixLobbyToLanding,
  profileModalOpen,
  onCloseProfile,
  gsiModalOpen,
  onCloseGsi,
  passwordModalOpen,
  pendingRoomAuth,
  passwordError,
  authErrorType,
  onClosePasswordModal,
  onSubmitRoomPassword,
  leaderboardOpen,
  onCloseLeaderboard,
  onOpenLeaderboard,
  discordModalOpen,
  onCloseDiscordModal,
  matchCardOpen,
  onCloseMatchCard,
  storyCardOpen,
  onCloseStoryCard,
  onOpenStoryCard,
  grenadeModalOpen,
  onCloseGrenadeModal,
  aimReflexModalOpen,
  onCloseAimReflexModal,
  tournamentModalOpen,
  onCloseTournamentModal,
  localHostModalOpen,
  onCloseLocalHostModal,
  // Handlers
  onSelectRoom,
  onDeleteRoom,
  onRequireSteamLogin,
  onSaveScore,
  onStartQuickVeto,
  onApplyQuickMap,
  onSyncOfficialRotation,
  onLogoutSteam,
  onSwitchSteamAccount,
  onSaveProfile,
  onSaveDiscordWebhook,
  onShareToChat,
  onLoadTournamentTeams,
  onUpdateServerIp,
}) {
  const effectiveSteamGateOpen =
    steamGateModalOpen || (view === 'mix' && room?.phase === 'lobby' && !isSteamLogged);
  const handleSteamGateClose =
    view === 'mix' && !isSteamLogged ? onExitMixLobbyToLanding : onCloseSteamGate;
  const tournamentRoomKey = room?.id || roomId || 'MIX';

  return (
    <ModalErrorBoundary
      onReset={() => {
        onCloseRoomsHub?.();
        onCloseHistory?.();
        onCloseQuickVeto?.();
        onCloseQuickMapRoll?.();
        onCloseProfile?.();
        onCloseGsi?.();
        onCloseLeaderboard?.();
        onCloseDiscordModal?.();
        onCloseMatchCard?.();
        onCloseStoryCard?.();
        onCloseGrenadeModal?.();
        onCloseAimReflexModal?.();
        onCloseTournamentModal?.();
        onCloseLocalHostModal?.();
      }}
    >
      <Suspense fallback={<ModalLoadingFallback />}>
        {roomsHubOpen && (
          <RoomsHubModal
            isOpen={roomsHubOpen}
            onClose={onCloseRoomsHub}
            currentRoomId={roomId}
            onSelectRoom={onSelectRoom}
            onDeleteRoom={onDeleteRoom}
            soundEnabled={soundEnabled}
            isSteamLogged={isSteamLogged}
            onRequireSteamLogin={onRequireSteamLogin}
            myProfile={myProfile}
          />
        )}

        {effectiveSteamGateOpen && (
          <SteamLoginGateModal
            isOpen={effectiveSteamGateOpen}
            onClose={handleSteamGateClose}
            roomId={roomId}
            actionText={steamGateActionText}
            soundEnabled={soundEnabled}
          />
        )}

        {historyOpen && (
          <MatchHistoryModal
            isOpen={historyOpen}
            onClose={onCloseHistory}
            history={room?.history || []}
            currentMap={room?.finalMap?.name || room?.finalMap || 'Mirage'}
            onSaveScore={onSaveScore}
            onOpenGlobalHistory={() => {
              onCloseHistory();
              onOpenLeaderboard();
            }}
            soundEnabled={soundEnabled}
          />
        )}

        {quickVetoOpen && (
          <QuickVetoModal
            isOpen={quickVetoOpen}
            onClose={onCloseQuickVeto}
            onStartQuickVeto={onStartQuickVeto}
            soundEnabled={soundEnabled}
          />
        )}

        {quickMapRollOpen && (
          <QuickMapRollModal
            isOpen={quickMapRollOpen}
            onClose={onCloseQuickMapRoll}
            onApplyMap={onApplyQuickMap}
            soundEnabled={soundEnabled}
            officialRotation={officialRotation}
            syncingRotation={syncingRotation}
            onSyncOfficialRotation={onSyncOfficialRotation}
          />
        )}

        {profileModalOpen && (
          <PlayerProfileModal
            isOpen={profileModalOpen}
            onClose={onCloseProfile}
            profile={myProfile}
            rankingSystem={room?.rankingSystem || 'gc'}
            onLogout={onLogoutSteam}
            onSwitchAccount={onSwitchSteamAccount}
            soundEnabled={soundEnabled}
            onSaveProfile={onSaveProfile}
            onOpenStoryCard={onOpenStoryCard}
          />
        )}

        {gsiModalOpen && (
          <GsiSetupModal
            isOpen={gsiModalOpen}
            onClose={onCloseGsi}
            roomId={roomId}
            liveMatch={room?.liveMatch}
            soundEnabled={soundEnabled}
          />
        )}

        {passwordModalOpen && (
          <RoomPasswordModal
            isOpen={passwordModalOpen}
            onClose={onClosePasswordModal}
            roomId={pendingRoomAuth?.roomId || roomId}
            roomName={pendingRoomAuth?.roomName || room?.name}
            onSubmitPassword={onSubmitRoomPassword}
            errorMessage={passwordError}
            errorType={authErrorType}
            onOpenRoomsHub={onOpenRoomsHub}
            soundEnabled={soundEnabled}
          />
        )}

        {leaderboardOpen && (
          <LeaderboardModal
            isOpen={leaderboardOpen}
            onClose={onCloseLeaderboard}
            socket={socket}
            soundEnabled={soundEnabled}
          />
        )}

        {discordModalOpen && (
          <DiscordWebhookModal
            isOpen={discordModalOpen}
            onClose={onCloseDiscordModal}
            roomId={roomId}
            currentWebhook={room?.discordWebhook || ''}
            autoLobby={room?.discordAutoLobby !== false}
            autoVeto={room?.discordAutoVeto !== false}
            autoGsiRounds={room?.discordGsiRounds !== false}
            autoGsiBomb={Boolean(room?.discordGsiBomb)}
            autoStats={room?.discordAutoStats !== false}
            onSaveWebhook={onSaveDiscordWebhook}
            soundEnabled={soundEnabled}
          />
        )}

        {matchCardOpen && (
          <MatchCardModal
            isOpen={matchCardOpen}
            onClose={onCloseMatchCard}
            room={room}
            soundEnabled={soundEnabled}
          />
        )}

        {storyCardOpen && (
          <PlayerStoryCardModal
            isOpen={storyCardOpen}
            onClose={onCloseStoryCard}
            room={room}
            soundEnabled={soundEnabled}
            initialPlayer={myProfile}
          />
        )}

        {grenadeModalOpen && (
          <GrenadePlaybookModal
            isOpen={grenadeModalOpen}
            onClose={onCloseGrenadeModal}
            initialMap={room?.finalMap?.id}
            soundEnabled={soundEnabled}
          />
        )}

        {aimReflexModalOpen && (
          <AimReflexModal
            isOpen={aimReflexModalOpen}
            onClose={onCloseAimReflexModal}
            soundEnabled={soundEnabled}
            onShareToChat={onShareToChat}
          />
        )}

        {tournamentModalOpen && (
          <TournamentBracketModal
            key={tournamentRoomKey}
            isOpen={tournamentModalOpen}
            onClose={onCloseTournamentModal}
            onLoadTeamsToMix={onLoadTournamentTeams}
            soundEnabled={soundEnabled}
            roomId={tournamentRoomKey}
          />
        )}

        {localHostModalOpen && (
          <LocalHostModal
            isOpen={localHostModalOpen}
            onClose={onCloseLocalHostModal}
            roomId={roomId}
            currentServerIp={room?.serverIp || ''}
            finalMap={room?.finalMap?.name || 'de_mirage'}
            onUpdateServerIp={onUpdateServerIp}
            soundEnabled={soundEnabled}
          />
        )}
      </Suspense>
    </ModalErrorBoundary>
  );
}
