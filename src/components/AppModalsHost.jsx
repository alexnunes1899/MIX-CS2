import React, { lazy, Suspense } from 'react';

const RoomsHubModal = lazy(() => import('./RoomsHubModal'));
const MatchHistoryModal = lazy(() => import('./MatchHistoryModal'));
const QuickVetoModal = lazy(() => import('./QuickVetoModal'));
const QuickMapRollModal = lazy(() => import('./QuickMapRollModal'));
const ChatDrawer = lazy(() => import('./ChatDrawer'));
const CoinFlipModal = lazy(() => import('./CoinFlipModal'));
const DraftRoulette = lazy(() => import('./DraftRoulette'));
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
const LiveSpectatorModal = lazy(() => import('./LiveSpectatorModal'));

/**
 * Shared Suspense tree hosting all secondary modals and drawers.
 */
export default function AppModalsHost({
  view,
  setView,
  roomId,
  room,
  myProfile,
  isSteamLogged,
  isSessionExpired = false,
  isAdmin = false,
  isSiteAdmin = false,
  soundEnabled,
  socket,
  officialRotation,
  syncingRotation,
  onSyncOfficialRotation,
  // Open/Close states
  roomsHubOpen,
  setRoomsHubOpen,
  steamGateModalOpen,
  setSteamGateModalOpen,
  steamGateActionText,
  historyOpen,
  setHistoryOpen,
  quickVetoOpen,
  setQuickVetoOpen,
  quickMapRollOpen,
  setQuickMapRollOpen,
  rouletteActive,
  profileModalOpen,
  setProfileModalOpen,
  publicProfile = null,
  setPublicProfile,
  spectateRoom = null,
  setSpectateRoom,
  gsiModalOpen,
  setGsiModalOpen,
  passwordModalOpen,
  setPasswordModalOpen,
  pendingRoomAuth,
  setPendingRoomAuth,
  passwordError,
  setPasswordError,
  authErrorType,
  leaderboardOpen,
  setLeaderboardOpen,
  discordModalOpen,
  setDiscordModalOpen,
  matchCardOpen,
  setMatchCardOpen,
  storyCardOpen,
  setStoryCardOpen,
  grenadeModalOpen,
  setGrenadeModalOpen,
  grenadeInitialTab,
  setGrenadeInitialTab,
  aimReflexModalOpen,
  setAimReflexModalOpen,
  tournamentModalOpen,
  setTournamentModalOpen,
  // Callbacks
  onSelectRoom,
  onDeleteRoom,
  onRequireSteamLogin,
  onSaveScore,
  onStartQuickVeto,
  onApplyQuickMap,
  onCoinChoice,
  onRouletteComplete,
  onSendMessage,
  onLogoutSteam,
  onSwitchSteamAccount,
  onSaveProfile,
  onSubmitRoomPassword,
  onSaveDiscordWebhook,
  onOpenServersPage,
  onOpenLeaderboardPage,
  onLoadTournamentTeams,
  onUpdateServerIp,
}) {
  return (
    <Suspense fallback={null}>
      {roomsHubOpen && (
        <RoomsHubModal
          isOpen={roomsHubOpen}
          onClose={() => setRoomsHubOpen(false)}
          currentRoomId={roomId}
          onSelectRoom={onSelectRoom}
          onDeleteRoom={onDeleteRoom}
          soundEnabled={soundEnabled}
          isSteamLogged={isSteamLogged}
          isSiteAdmin={isSiteAdmin}
          onRequireSteamLogin={onRequireSteamLogin}
          myProfile={myProfile}
        />
      )}

      {steamGateModalOpen && (
        <SteamLoginGateModal
          isOpen={steamGateModalOpen}
          roomId={roomId}
          actionText={steamGateActionText}
          soundEnabled={soundEnabled}
          onClose={() => setSteamGateModalOpen(false)}
        />
      )}

      {historyOpen && (
        <MatchHistoryModal
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          history={room.history}
          currentMap={room.finalMap?.name || room.finalMap || 'Mirage'}
          onSaveScore={onSaveScore}
          onOpenGlobalHistory={() => {
            setHistoryOpen(false);
            if (onOpenLeaderboardPage) {
              onOpenLeaderboardPage();
            } else {
              setLeaderboardOpen(true);
            }
          }}
          soundEnabled={soundEnabled}
        />
      )}

      {quickVetoOpen && (
        <QuickVetoModal
          isOpen={quickVetoOpen}
          onClose={() => setQuickVetoOpen(false)}
          onStartQuickVeto={onStartQuickVeto}
          soundEnabled={soundEnabled}
        />
      )}

      {quickMapRollOpen && (
        <QuickMapRollModal
          isOpen={quickMapRollOpen}
          onClose={() => setQuickMapRollOpen(false)}
          onApplyMap={onApplyQuickMap}
          soundEnabled={soundEnabled}
          officialRotation={officialRotation}
          syncingRotation={syncingRotation}
          onSyncOfficialRotation={onSyncOfficialRotation}
        />
      )}

      {room.phase === 'coin_flip' && (
        <CoinFlipModal
          isOpen={room.phase === 'coin_flip'}
          room={room}
          coin={room.coin}
          onChooseAction={onCoinChoice}
          soundEnabled={soundEnabled}
        />
      )}

      {rouletteActive && (
        <DraftRoulette
          players={room.players}
          rankingSystem={room.rankingSystem || 'gc'}
          onComplete={onRouletteComplete}
          soundEnabled={soundEnabled}
        />
      )}

      {view === 'mix' && (
        <ChatDrawer
          chat={room.chat}
          onSendMessage={onSendMessage}
          myProfile={myProfile}
          rankingSystem={room.rankingSystem || 'gc'}
          soundEnabled={soundEnabled}
        />
      )}

      {profileModalOpen && (
        <PlayerProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          profile={myProfile}
          rankingSystem={room.rankingSystem || 'gc'}
          onLogout={onLogoutSteam}
          onSwitchAccount={onSwitchSteamAccount}
          soundEnabled={soundEnabled}
          onSaveProfile={onSaveProfile}
          onOpenStoryCard={() => setStoryCardOpen(true)}
          isSessionExpired={isSessionExpired}
        />
      )}

      {publicProfile && (
        <PlayerProfileModal
          isOpen={Boolean(publicProfile)}
          onClose={() => {
            if (setPublicProfile) setPublicProfile(null);
            try {
              const u = new URL(window.location);
              if (u.searchParams.has('perfil')) {
                u.searchParams.delete('perfil');
                window.history.replaceState({}, '', u);
              }
            } catch {}
          }}
          profile={publicProfile}
          rankingSystem={room.rankingSystem || 'gc'}
          soundEnabled={soundEnabled}
          readOnly={true}
          initialTab="stats"
        />
      )}

      {spectateRoom && (
        <LiveSpectatorModal
          isOpen={Boolean(spectateRoom)}
          onClose={() => setSpectateRoom && setSpectateRoom(null)}
          roomId={spectateRoom.id}
          roomName={spectateRoom.name || spectateRoom.id}
          socket={socket}
          soundEnabled={soundEnabled}
        />
      )}

      {gsiModalOpen && (
        <GsiSetupModal
          isOpen={gsiModalOpen}
          onClose={() => setGsiModalOpen(false)}
          roomId={roomId}
          liveMatch={room.liveMatch}
          soundEnabled={soundEnabled}
        />
      )}

      {passwordModalOpen && (
        <RoomPasswordModal
          isOpen={passwordModalOpen}
          onClose={() => {
            setPasswordModalOpen(false);
            setPasswordError(null);
            setPendingRoomAuth(null);
          }}
          roomId={pendingRoomAuth?.roomId || roomId}
          roomName={pendingRoomAuth?.roomName || room.name}
          onSubmitPassword={onSubmitRoomPassword}
          errorMessage={passwordError}
          errorType={authErrorType}
          onOpenRoomsHub={() => setRoomsHubOpen(true)}
          soundEnabled={soundEnabled}
        />
      )}

      {leaderboardOpen && (
        <LeaderboardModal
          isOpen={leaderboardOpen}
          onClose={() => setLeaderboardOpen(false)}
          socket={socket}
          soundEnabled={soundEnabled}
          onInspectPlayer={
            setPublicProfile
              ? (p) => {
                  setLeaderboardOpen(false);
                  setPublicProfile({
                    id: p.id,
                    steamId: p.steamId || '',
                    discordId: p.discordId || '',
                    nick: p.nick || 'Jogador',
                    avatar: p.avatar || '',
                    level: p.level || 12,
                    faceitLevel: p.faceitLevel || 5,
                  });
                }
              : undefined
          }
        />
      )}

      {discordModalOpen && (
        <DiscordWebhookModal
          isOpen={discordModalOpen}
          onClose={() => setDiscordModalOpen(false)}
          roomId={roomId}
          currentWebhook={room.discordWebhook || ''}
          autoLobby={room.discordAutoLobby !== false}
          autoVeto={room.discordAutoVeto !== false}
          autoGsiRounds={room.discordGsiRounds !== false}
          autoGsiBomb={Boolean(room.discordGsiBomb)}
          autoStats={room.discordAutoStats !== false}
          onSaveWebhook={onSaveDiscordWebhook}
          onOpenServersPage={onOpenServersPage}
          isAdmin={view === 'mix' ? isAdmin : false}
          soundEnabled={soundEnabled}
        />
      )}

      {matchCardOpen && (
        <MatchCardModal
          isOpen={matchCardOpen}
          onClose={() => setMatchCardOpen(false)}
          room={room}
          soundEnabled={soundEnabled}
        />
      )}

      {storyCardOpen && (
        <PlayerStoryCardModal
          isOpen={storyCardOpen}
          onClose={() => setStoryCardOpen(false)}
          room={room}
          soundEnabled={soundEnabled}
          initialPlayer={myProfile}
        />
      )}

      {grenadeModalOpen && (
        <GrenadePlaybookModal
          isOpen={grenadeModalOpen}
          onClose={() => {
            setGrenadeModalOpen(false);
            setGrenadeInitialTab('lineups');
          }}
          initialMap={room.finalMap?.id}
          initialTab={grenadeInitialTab}
          soundEnabled={soundEnabled}
          serverIp={room.serverIp || ''}
          rconPassword={room.rconPassword || ''}
          isSteamLogged={isSteamLogged}
        />
      )}

      {aimReflexModalOpen && (
        <AimReflexModal
          isOpen={aimReflexModalOpen}
          onClose={() => setAimReflexModalOpen(false)}
          soundEnabled={soundEnabled}
          onShareToChat={(text) => onSendMessage(text)}
        />
      )}

      {tournamentModalOpen && (
        <TournamentBracketModal
          isOpen={tournamentModalOpen}
          onClose={() => setTournamentModalOpen(false)}
          onLoadTeamsToMix={onLoadTournamentTeams}
          soundEnabled={soundEnabled}
          roomId={roomId || 'MIX'}
          socket={socket}
          myProfile={myProfile}
          isSteamLogged={isSteamLogged}
          isSiteAdmin={isSiteAdmin}
          onRequireSteamLogin={onRequireSteamLogin}
        />
      )}
    </Suspense>
  );
}
