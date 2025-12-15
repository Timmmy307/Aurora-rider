/* global localStorage */
import COLORS from '../constants/colors';
const utils = require('../utils');
const convertBeatmap = require('../lib/convert-beatmap');

// Stub gtag if not defined (analytics removed)
if (typeof window !== 'undefined' && typeof window.gtag === 'undefined') {
  window.gtag = function() {};
}
var gtag = typeof window !== 'undefined' ? window.gtag : function() {};

const challengeDataStore = {};
let HAS_LOGGED_VR = false;
const NUM_LEADERBOARD_DISPLAY = 10;
const SEARCH_PER_PAGE = 6;
const SONG_NAME_TRUNCATE = 22;
const SONG_SUB_NAME_RESULT_TRUNCATE = 32;
const SONG_SUB_NAME_DETAIL_TRUNCATE = 55;

const DAMAGE_DECAY = 0.25;
const DAMAGE_MAX = 10;

const difficultyMap = {
  "Easy": 'Easy',
  "Expert": 'Expert',
  "ExpertPlus": 'Expert+',
  "Hard": 'Hard',
  "Normal": 'Normal',
};

const badSongs = {};

const DEBUG_CHALLENGE = {
  author: 'Juancho Pancho',
  difficulty: 'Expert',
  id: '31',
  image: 'assets/img/molerat.jpg',
  songDuration: 100,
  songName: 'Friday',
  songLength: 100,
  songSubName: 'Rebecca Black'
};

const SKIP_INTRO = AFRAME.utils.getUrlParameter('skipintro') === 'true';

const colorScheme = localStorage.getItem('colorScheme') || 'default';

let favorites = localStorage.getItem('favorites-v2');
if (favorites) {
  try {
    favorites = JSON.parse(favorites);
  } catch (e) {
    favorites = [];
  }
} else {
  favorites = [];
}

/**
 * State handler.
 *
 * 1. `handlers` is an object of events that when emitted to the scene will run the handler.
 *
 * 2. The handler function modifies the state.
 *
 * 3. Entities and components that are `bind`ed automatically update:
 *    `bind__<componentName>="<propertyName>: some.item.in.state"`
 */
AFRAME.registerState({
  nonBindedStateKeys: ['genres'],

  initialState: {
    activeHand: localStorage.getItem('hand') || 'right',
    challenge: {  // Actively playing challenge.
      audio: '',  // URL.
      author: '',
      difficulty: '',
      beatmapCharacteristic: '',
      id: AFRAME.utils.getUrlParameter('challenge'),  // Will be empty string if not playing.
      image: '',
      isBeatsPreloaded: false,  // Whether we have passed the negative time.
      numBeats: undefined,
      songDuration: 0,
      songName: '',
      songNameShort: '',
      songSubName: '',
      metadata: {},
    },
    colorPrimary: COLORS.schemes[colorScheme].primary,
    colorScheme: colorScheme,
    colorSecondary: COLORS.schemes[colorScheme].secondary,
    colorSecondaryBright: COLORS.schemes[colorScheme].secondarybright,
    colorTertiary: COLORS.schemes[colorScheme].tertiary,
    controllerType: '',
    damage: 0,
    difficultyFilter: 'All',
    difficultyFilterMenuOpen: false,
    favorites: favorites,
    gameMode: 'ride',
    genre: '',
    genres: require('../constants/genres'),
    genreMenuOpen: false,
    has3DOFVR: false,
    has6DOFVR: false,
    hasSongLoadError: false,
    hasVR: AFRAME.utils.device.checkHeadsetConnected() ||
      AFRAME.utils.getUrlParameter('debugvr') === 'true',
    introActive: !SKIP_INTRO,  // Just started game, main menu not opened yet.
    inVR: AFRAME.utils.getUrlParameter('debugvr') === 'true',
    isIOS: AFRAME.utils.device.isIOS(),
    isGameOver: false,  // Game over screen.
    isLoading: false,  // Entire song loading process after selected (ZIP + process).
    isMenuOpening: !SKIP_INTRO,
    isPaused: false,  // Playing, but paused. Not active during menu.
    isPlaying: false,  // Actively playing (slicing beats).
    isSearching: false,  // Whether search is open.
    isSongProcessing: false,
    isVictory: false,  // Victory screen.
    isZipFetching: false,
    leaderboard: [],
    leaderboardFetched: false,
    leaderboardQualified: false,
    leaderboardNames: '',
    leaderboardScores: '',
    mainMenuActive: false,
    menuActive: SKIP_INTRO, // Main menu active.
    menuDifficulties: [],
    menuDifficultiesIds: [],
    menuSelectedChallenge: {  // Currently selected challenge in the main menu.
      author: '',
      difficulty: '',
      beatmapCharacteristic: '',
      downloads: '',
      downloadsText: '',
      genre: '',
      id: '',
      index: -1,
      image: '',
      isFavorited: false,
      numBeats: undefined,
      songDuration: 0,
      songInfoText: '',
      songLength: undefined,
      numBeats: undefined,
      songName: '',
      songSubName: '',
      version: '',
      metadata: {},
    },
    optionsMenuOpen: false,
    playlist: '',
    playlists: require('../constants/playlists'),
    playlistMenuOpen: false,
    playlistTitle: '',
    score: {
      accuracy: 100,  // Out of 100.
      accuracyScore: 0,  // Raw number.
      accuracyInt: 100,  // Out of 100.
      activePanel: false,
      beatsHit: 0,
      beatsMissed: 0,
      beatsText: '',
      combo: 0,
      finalAccuracy: 100,  // Out of 100.
      maxCombo: 0,
      rank: '',  // Grade (S to F).
      score: 0
    },
    search: {
      activePanel: true,
      page: 0,
      hasError: false,
      hasNext: false,
      hasPrev: false,
      query: '',
      queryText: '',
      results: [],
      songNameTexts: '',  // All names in search results merged together.
      songSubNameTexts: '',  // All sub names in search results merged together.
      // url and urlPage are used to load more results from the API when scrolling down
      url: '',
      urlPage: 0,
    },
    searchResultsPage: [],
    speed: 10,

    // Online Multiplayer State
    onlineMenuActive: false,
    onlineCreatePanelActive: false,
    onlineModeSelectPanelActive: false,
    onlineJoinPanelActive: false,
    onlineRoomCode: '',
    onlineRoomCodeDisplay: '',  // 'Room: XXXXXX'
    onlineRoomState: '',  // 'lobby', 'selecting', 'countdown', 'playing', 'results'
    onlineGameMode: '',   // 'classic' or 'punch'
    onlineGameModeDisplay: '',  // 'CLASSIC MODE' or 'PUNCH MODE'
    onlineCreateModeDisplay: '',  // 'MODE: CLASSIC' or 'MODE: PUNCH'
    onlineIsHost: false,
    onlineIsReady: false,
    onlinePlayers: [],
    onlinePlayersText: '',
    onlineJoinCode: '',
    onlineCountdown: 0,
    onlineLeaderboard: [],
    onlineLeaderboardText: '',
    onlineConnected: false,
    onlineError: '',
    onlineHasError: false,
    onlineUsername: '',
    onlineJoinCodePanelActive: false,
    onlineSelectedChallenge: {},  // Challenge selected by host for online play
    // Computed booleans for UI binding
    onlineNotInRoom: true,
    onlineInLobby: false,
    onlineInCountdown: false,
    onlineInPlaying: false,
    onlineInResults: false,
    onlineWaitingForPlayers: false,  // Waiting for other players to finish
    onlineWaitingText: '',  // Text showing who we're waiting for
    onlinePlayersFinished: 0,  // Count of players who finished
    onlinePlayersTotalInGame: 0,  // Total players in game
    onlineShowMainPanel: true
  },

  // Helper to update computed online state booleans
  computeOnlineState: function (state, roomState) {
    state.onlineRoomState = roomState;
    state.onlineNotInRoom = roomState === '';
    state.onlineInLobby = roomState === 'lobby';
    state.onlineInCountdown = roomState === 'countdown';
    state.onlineInPlaying = roomState === 'playing';
    state.onlineInResults = roomState === 'results';
    state.onlineWaitingForPlayers = roomState === 'waiting';
    state.onlineShowMainPanel = roomState === '' && !state.onlineCreatePanelActive && !state.onlineJoinPanelActive && !state.onlineModeSelectPanelActive;
  },

  handlers: {
    /**
     * Swap left-handed or right-handed mode.
     */
    activehandswap: state => {
      state.activeHand = state.activeHand === 'right' ? 'left' : 'right';
      localStorage.setItem('activeHand', state.activeHand);
    },

    beathit: (state, payload) => {
      if (state.damage > DAMAGE_DECAY) {
        state.damage -= DAMAGE_DECAY;
      }

      state.score.beatsHit++;
      state.score.combo++;
      if (state.score.combo > state.score.maxCombo) {
        state.score.maxCombo = state.score.combo;
      }

      payload.score = isNaN(payload.score) ? 100 : payload.score;
      state.score.accuracyScore += payload.percent;
      state.score.score += Math.floor(payload.score);
      updateScoreAccuracy(state);
    },

    beatmiss: state => {
      state.score.beatsMissed++;
      takeDamage(state);
      updateScoreAccuracy(state);
    },

    beatwrong: state => {
      state.score.beatsMissed++;
      takeDamage(state);
      updateScoreAccuracy(state);
    },

    beatloaderpreloadfinish: state => {
      if (state.menuActive) { return; }  // Cancelled.
      state.challenge.isBeatsPreloaded = true;
    },

    colorschemechange: (state, payload) => {
      state.colorScheme = payload;
      state.colorPrimary = COLORS.schemes[payload].primary;
      state.colorSecondary = COLORS.schemes[payload].secondary;
      state.colorSecondaryBright = COLORS.schemes[payload].secondarybright;
      state.colorTertiary = COLORS.schemes[payload].tertiary;
      localStorage.setItem('colorScheme', payload);
    },

    controllerconnected: (state, payload) => {
      state.controllerType = payload.name;
      state.has6DOFVR = [
        'oculus-quest-controls',
        'oculus-touch-controls',
        'vive-controls',
        'windows-motion-controls',
        'generic-tracked-controller-controls'
      ].indexOf(state.controllerType) !== -1;

      state.has3DOFVR = [
        'oculus-go-controls',
        'daydream-controls'
      ].indexOf(state.controllerType) !== -1;
    },

    debugbeatpositioning: state => {
      state.gameMode = 'classic';
      state.introActive = false;
      state.menuActive = false;
    },

    /**
     * To work on game over page.
     *
     * ?debugstate=gameplay
     */
    debuggameplay: state => {
      resetScore(state);

      // Set challenge. `beat-generator` is listening.
      Object.assign(state.challenge, state.menuSelectedChallenge);

      // Reset menu.
      state.menuActive = false;
      state.menuSelectedChallenge.id = '';

      state.isSearching = false;
      state.isLoading = false;
    },

    /**
     * To work on game over page.
     *
     * ?debugstate=gameover
     */
    debuggameover: state => {
      state.isGameOver = true;
      state.menuActive = false;
    },

    /**
     * To work on victory page.
     *
     * ?debugstate=loading
     */
    debugloading: state => {
      DEBUG_CHALLENGE.id = '-1';
      Object.assign(state.menuSelectedChallenge, DEBUG_CHALLENGE);
      Object.assign(state.challenge, DEBUG_CHALLENGE);
      state.menuActive = false;
      state.isSongProcessing = true;
    },

    /**
     * To work on victory page.
     *
     * ?debugstate=victory
     */
    debugvictory: state => {
      Object.assign(state.menuSelectedChallenge, DEBUG_CHALLENGE);
      Object.assign(state.challenge, DEBUG_CHALLENGE);
      state.isVictory = true;
      state.leaderboardQualified = true;
      state.menuActive = false;
      state.score.accuracy = 74.99;
      state.score.beatsHit = 125;
      state.score.beatsMissed = 125;
      state.score.maxCombo = 123;
      state.score.rank = 'A';
      state.score.score = 9001;
      state.introActive = false;
      computeBeatsText(state);
    },

    difficultyfilter: (state, difficulty) => {
      state.difficultyFilter = difficulty;
      state.difficultyFilterMenuOpen = false;
      state.menuSelectedChallenge.id = '';
    },

    difficultyfiltermenuclose: state => {
      state.difficultyFilterMenuOpen = false;
    },

    difficultyfiltermenuopen: state => {
      state.difficultyFilterMenuOpen = true;
    },

    displayconnected: state => {
      state.hasVR = true;
      if (HAS_LOGGED_VR) { return; }
      try {
        if ('getVRDisplays' in navigator) {
          navigator.getVRDisplays().then(displays => {
            if (!displays.length) { return; }
            HAS_LOGGED_VR = true;
          });
        }
      } catch (e) { }
    },

    favoritetoggle: state => {
      const id = state.menuSelectedChallenge.id;
      const challenge = challengeDataStore[id];

      if (!challenge) { return; }

      if (state.menuSelectedChallenge.isFavorited) {
        // Unfavorite.
        state.menuSelectedChallenge.isFavorited = false;
        for (let i = 0; i < state.favorites.length; i++) {
          if (state.favorites[i].id === id) {
            state.favorites.splice(i, 1);
            localStorage.setItem('favorites-v2', JSON.stringify(state.favorites));
            return;
          }
        }
      } else {
        // Favorite.
        state.menuSelectedChallenge.isFavorited = true;
        if (state.favorites.filter(favorite => favorite.id === id).length) { return; }
        state.favorites.push(challenge)
        localStorage.setItem('favorites-v2', JSON.stringify(state.favorites));
      }
    },

    gamemenuresume: state => {
      state.isPaused = false;
    },

    gamemenurestart: state => {
      resetScore(state);
      state.challenge.isBeatsPreloaded = false;
      state.isGameOver = false;
      state.isPaused = false;
      state.isLoading = true;
      state.isVictory = false;
      state.leaderboardQualified = false;
    },

    gamemenuexit: state => {
      resetScore(state);
      state.challenge.isBeatsPreloaded = false;
      state.isGameOver = false;
      state.isPaused = false;
      state.isVictory = false;
      state.menuActive = true;
      state.menuSelectedChallenge.id = state.challenge.id;
      state.menuSelectedChallenge.difficulty = state.challenge.difficulty;
      state.menuSelectedChallenge.beatmapCharacteristic = state.challenge.beatmapCharacteristic;
      state.menuSelectedChallenge.difficultyId = state.challenge.difficultyId;
      state.challenge.id = '';
      state.leaderboardQualified = false;
    },

    gamemode: (state, mode) => {
      state.gameMode = mode;
      // Close online menu when selecting a different game mode
      state.onlineMenuActive = false;
      state.onlineCreatePanelActive = false;
      state.onlineJoinPanelActive = false;
      state.onlineJoinCodePanelActive = false;
      state.onlineShowMainPanel = true;
    },

    // ==========================================
    // ONLINE MULTIPLAYER EVENT HANDLERS
    // ==========================================

    onlinemenuopen: state => {
      state.onlineMenuActive = true;
      state.onlineCreatePanelActive = false;
      state.onlineJoinPanelActive = false;
    },

    onlinemenuclose: state => {
      state.onlineMenuActive = false;
      state.onlineCreatePanelActive = false;
      state.onlineJoinPanelActive = false;
    },

    onlineshowcreate: state => {
      state.onlineModeSelectPanelActive = true;
      state.onlineCreatePanelActive = false;
      state.onlineJoinPanelActive = false;
    },

    onlinehidecreate: state => {
      state.onlineCreatePanelActive = false;
      state.onlineModeSelectPanelActive = false;
    },

    onlineshowjoin: state => {
      state.onlineJoinPanelActive = true;
      state.onlineCreatePanelActive = false;
      state.onlineJoinCode = '';
    },

    onlinehidejoin: state => {
      state.onlineJoinPanelActive = false;
    },

    onlinecreateclassic: state => {
      state.onlineGameMode = 'classic';
      state.onlineModeSelectPanelActive = false;
      state.onlineCreatePanelActive = true;
      updateOnlineDisplayTexts(state);
    },

    onlinecreatepunch: state => {
      state.onlineGameMode = 'punch';
      state.onlineModeSelectPanelActive = false;
      state.onlineCreatePanelActive = true;
      updateOnlineDisplayTexts(state);
    },

    onlinejoinconfirm: state => {
      // Handled by component, just update UI state
    },

    onlinestatuschange: (state, payload) => {
      state.onlineConnected = payload.connected;
    },

    onlineroomcreated: (state, payload) => {
      state.onlineRoomCode = payload.code || payload.roomCode;
      state.onlineRoomState = 'lobby';
      state.onlineGameMode = payload.gameMode || state.onlineGameMode || 'classic';
      state.onlineIsHost = true;
      state.onlineCreatePanelActive = false;
      state.onlineModeSelectPanelActive = false;
      state.onlinePlayers = payload.players || [];
      state.onlineNotInRoom = false;
      state.onlineInLobby = true;
      state.onlineShowMainPanel = false;
      updateOnlinePlayersText(state);
      updateOnlineDisplayTexts(state);
    },

    onlineroomjoined: (state, payload) => {
      state.onlineRoomCode = payload.code || payload.roomCode;
      state.onlineRoomState = 'lobby';
      state.onlineGameMode = payload.gameMode || 'classic';
      state.onlineIsHost = payload.isHost || false;
      state.onlineJoinPanelActive = false;
      state.onlineJoinCodePanelActive = false;
      state.onlinePlayers = payload.players || [];
      state.onlineNotInRoom = false;
      state.onlineInLobby = true;
      state.onlineShowMainPanel = false;
      updateOnlinePlayersText(state);
      updateOnlineDisplayTexts(state);
    },

    onlineplayersupdate: (state, payload) => {
      state.onlinePlayers = payload.players || [];
      updateOnlinePlayersText(state);
    },

    onlineroomupdate: (state, payload) => {
      state.onlinePlayers = payload.room.players;
      state.onlineRoomState = payload.room.state;
      state.onlineIsHost = payload.room.hostId === (window.AuroraRiderMultiplayer && window.AuroraRiderMultiplayer.socket && window.AuroraRiderMultiplayer.socket.id);
      updateOnlinePlayersText(state);
    },

    onlineplayerjoined: (state, payload) => {
      state.onlinePlayers = payload.room.players;
      updateOnlinePlayersText(state);
    },

    onlineplayerleft: (state, payload) => {
      state.onlinePlayers = payload.room.players;
      updateOnlinePlayersText(state);
    },

    onlineplayerready: (state, payload) => {
      state.onlinePlayers = payload.room.players;
      // Update our own ready state
      const myId = window.AuroraRiderMultiplayer && window.AuroraRiderMultiplayer.socket ? window.AuroraRiderMultiplayer.socket.id : null;
      const myPlayer = payload.room.players.find(p => p.id === myId);
      if (myPlayer) {
        state.onlineIsReady = myPlayer.ready;
      }
      updateOnlinePlayersText(state);
    },

    onlinetoggleready: state => {
      state.onlineIsReady = !state.onlineIsReady;
    },

    onlineleaveroom: state => {
      state.onlineRoomCode = '';
      state.onlineRoomState = '';
      state.onlineGameMode = '';
      state.onlineIsHost = false;
      state.onlineIsReady = false;
      state.onlinePlayers = [];
      state.onlinePlayersText = '';
      state.onlineCountdown = 0;
      updateOnlineDisplayTexts(state);
    },

    onlinegamestarting: (state, payload) => {
      state.onlineCountdown = payload.countdown;
      state.onlineRoomState = 'countdown';
      state.gameMode = payload.gameMode;
      Object.assign(state.menuSelectedChallenge, payload.challenge);
    },

    onlinecountdown: (state, payload) => {
      state.onlineCountdown = payload.count;
    },

    onlinegamestarted: state => {
      state.onlineCountdown = 0;
      state.onlineRoomState = 'playing';
      state.onlineMenuActive = false;
      state.menuActive = false;
      
      // Actually start the game - copy challenge from menuSelectedChallenge (set by onlinegamestarting)
      if (state.menuSelectedChallenge && state.menuSelectedChallenge.id) {
        resetScore(state);
        Object.assign(state.challenge, state.menuSelectedChallenge);
        state.isLoading = true;
        state.loadingText = 'Loading...';
        state.menuSelectedChallenge.id = '';
      }
    },

    onlinescoreupdate: (state, payload) => {
      state.onlineLeaderboard = payload.leaderboard || [];
    },

    // When THIS player finishes the song - show waiting screen
    onlineplayerfinished: (state, payload) => {
      state.onlineRoomState = 'waiting';
      state.onlineWaitingForPlayers = true;
      state.isVictory = false;  // Hide normal victory screen
      state.onlinePlayersFinished = payload.playersFinished || 1;
      state.onlinePlayersTotalInGame = payload.totalPlayers || state.onlinePlayers.length;
      state.onlineWaitingText = 'Waiting for other players... (' + state.onlinePlayersFinished + '/' + state.onlinePlayersTotalInGame + ')';
    },

    // When another player finishes - update waiting count (also for self from server confirmation)
    onlineotherplayerfinished: (state, payload) => {
      state.onlinePlayersFinished = payload.playersFinished || state.onlinePlayersFinished + 1;
      state.onlinePlayersTotalInGame = payload.totalPlayers || state.onlinePlayersTotalInGame;
      state.onlineWaitingText = 'Waiting for other players... (' + state.onlinePlayersFinished + '/' + state.onlinePlayersTotalInGame + ')';
      // Also ensure waiting screen is visible
      if (state.onlineWaitingForPlayers) {
        state.onlineRoomState = 'waiting';
      }
    },

    onlinegameresults: (state, payload) => {
      state.onlineLeaderboard = payload.leaderboard || [];
      state.onlineRoomState = 'results';
      state.onlineWaitingForPlayers = false;
      state.onlineMenuActive = true;  // Show the online menu with results
      state.isVictory = false;
      state.isPlaying = false;
      
      // Format leaderboard text
      if (state.onlineLeaderboard.length > 0) {
        state.onlineLeaderboardText = state.onlineLeaderboard
          .sort((a, b) => b.score - a.score)
          .map((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1) + '.';
            return medal + ' ' + player.name + ': ' + player.score.toLocaleString() + ' pts';
          })
          .join('\\n');
      } else {
        state.onlineLeaderboardText = 'No scores recorded';
      }
    },

    onlineerror: (state, payload) => {
      var message = typeof payload === 'string' ? payload : (payload.message || 'Unknown error');
      state.onlineError = message;
      state.onlineHasError = message !== '';
      console.error('[Aurora Rider] Online error:', message);
      // Clear error after 3 seconds
      setTimeout(function () {
        state.onlineError = '';
        state.onlineHasError = false;
      }, 3000);
    },

    onlinejoincodepanelshow: (state) => {
      state.onlineJoinPanelActive = false;
      state.onlineJoinCodePanelActive = true;
      state.onlineShowMainPanel = false;
    },

    onlinesetusername: (state, payload) => {
      state.onlineUsername = typeof payload === 'string' ? payload : (payload.value || '');
    },

    // ==========================================
    // END ONLINE MULTIPLAYER HANDLERS
    // ==========================================

    genreclear: state => {
      state.genre = '';
      state.menuSelectedChallenge.id = '';
    },

    genreselect: (state, genre) => {
      state.genre = genre;
      state.genreMenuOpen = false;
      state.menuSelectedChallenge.id = '';
      state.playlist = '';
      state.search.query = '';
    },

    genremenuclose: state => {
      state.genreMenuOpen = false;
    },

    genremenuopen: state => {
      state.genreMenuOpen = true;
    },

    keyboardclose: state => {
      state.isSearching = false;
    },

    keyboardopen: state => {
      state.isSearching = true;
      state.menuSelectedChallenge.id = '';
    },

    /**
     * High scores.
     */
    leaderboard: (state, payload) => {
      state.leaderboard.length = 0;
      state.leaderboardFetched = true;
      state.leaderboardNames = '';
      state.leaderboardScores = '';
      for (let i = 0; i < payload.scores.length; i++) {
        let score = payload.scores[i];
        state.leaderboard.push(score);
        state.leaderboardNames += `#${i + 1} ${truncate(score.username, 18)} (${Math.round(score.accuracy || 0)}%)\n`;
        state.leaderboardScores += `${score.score}\n`;
      }
      state.leaderboardLoading = false;
    },

    leaderboardqualify: state => {
      if (!state.has6DOFVR) { return; }
      state.leaderboardQualified = true;
    },

    /**
     * Insert new score into leaderboard locally.
     */
    leaderboardscoreadded: (state, payload) => {
      // Insert.
      for (let i = 0; i < state.leaderboard.length; i++) {
        if (payload.scoreData.score >= state.leaderboard[i].score ||
          i >= state.leaderboard.length - 1) {
          state.leaderboard.splice(i, 0, payload.scoreData);
          break;
        }
      }

      state.leaderboardNames = '';
      state.leaderboardScores = '';
      for (let i = 0; i < state.leaderboard.length; i++) {
        let score = state.leaderboard[i];
        state.leaderboardNames += `${score.username} (${score.accuracy || 0}%)\n`;
        state.leaderboardScores += `${score.score}\n`;
      }
    },

    leaderboardsubmit: state => {
      state.leaderboardQualified = false;
    },

    menuback: state => {
      state.difficultyFilterMenuOpen = false;
      state.genreMenuOpen = false;
      state.isSearching = false;
      state.optionsMenuOpen = false;
      state.playlistMenuOpen = false;
    },

    /**
     * Song clicked from menu.
     */
    menuchallengeselect: (state, id) => {
      // Copy from challenge store populated from search results.
      let challenge = challengeDataStore[id];
      if (!challenge) { return; }
      Object.assign(state.menuSelectedChallenge, challenge);
      state.menuSelectedChallenge.songName = truncate(challenge.metadata.songName, 24);

      // Populate difficulty options.
      state.menuDifficulties.length = 0;
      state.menuDifficultiesIds.length = 0;

      const characteristics = JSON.parse(challenge.metadata.characteristics);
      for (const characteristic of Object.keys(characteristics)) {

        if (['90Degree', '360Degree'].includes(characteristic)) continue;

        for (const difficulty of Object.keys(characteristics[characteristic])) {

          if (characteristics[characteristic][difficulty] === null) continue;

          let difficultyName = difficultyMap[difficulty];
          let renderName = difficultyName;

          if (characteristic !== 'Standard') {
            renderName = characteristic + '\n' + renderName;
          }
          state.menuDifficulties.unshift({
            'id': characteristic + '-' + difficulty,
            'filename': /* fileDifficultyMap[ */difficulty/* ] */ + characteristic,
            'difficultyName': difficultyName,
            'renderName': renderName,
            'beatmapCharacteristic': characteristic,
            'difficulty': difficulty,
          })

        }
      }
      
      state.menuDifficulties.sort(difficultyComparator);

      for (const d of state.menuDifficulties) {
        state.menuDifficultiesIds.push(d.id);
      }

      const selectedDifficulty = state.menuDifficulties[0];

      state.menuSelectedChallenge.difficulty = selectedDifficulty.difficulty;
      state.menuSelectedChallenge.beatmapCharacteristic = selectedDifficulty.beatmapCharacteristic;
      state.menuSelectedChallenge.difficultyId = selectedDifficulty.id;

      state.menuSelectedChallenge.image = state.menuSelectedChallenge.coverURL;
      updateMenuSongInfo(state, challenge);

      // Reset audio if it was able to prefetched by zip-loader before.
      state.challenge.audio = '';

      computeMenuSelectedChallengeIndex(state);
      state.isSearching = false;

      // Favorited.
      const isFavorited = !!state.favorites.filter(favorite => favorite.id === id).length;
      state.menuSelectedChallenge.isFavorited = isFavorited;

      // Clear leaderboard.
      clearLeaderboard(state);
      state.leaderboardLoading = true;

      state.hasSongLoadError = false;
      if (badSongs[id]) {
        state.hasSongLoadError = true;
      }
    },

    menuchallengeunselect: state => {
      state.menuSelectedChallenge.id = '';
      state.menuSelectedChallenge.difficultyId = '';
      state.menuSelectedChallenge.difficulty = '';
      state.menuSelectedChallenge.beatmapCharacteristic = '';
      clearLeaderboard(state);
    },

    menudifficultyselect: (state, difficultyId) => {
      let difficulty;
      for (const d of state.menuDifficulties) {
        if (d.id === difficultyId) {
          difficulty = d;
          break;
        }
      }
      state.menuSelectedChallenge.difficultyId = difficultyId;
      state.menuSelectedChallenge.difficulty = difficulty.difficulty;
      state.menuSelectedChallenge.beatmapCharacteristic = difficulty.beatmapCharacteristic;
      updateMenuSongInfo(state, state.menuSelectedChallenge);

      clearLeaderboard(state);
      state.leaderboardLoading = true;
    },

    menuopeningend: state => {
      state.isMenuOpening = false;
    },

    minehit: state => {
      takeDamage(state);
    },

    optionsmenuopen: state => {
      state.optionsMenuOpen = true;
    },

    pausegame: state => {
      if (!state.isPlaying) { return; }
      state.isPaused = true;
    },

    /**
     * Start challenge.
     * Transfer staged challenge to the active challenge.
     */
    playbuttonclick: state => {
      if (state.menuSelectedChallenge.id === '') { return; }
      if (badSongs[state.menuSelectedChallenge.id]) { return; }

      // If in online lobby as host, don't start single player - let component handle it
      if (state.onlineInLobby && state.onlineIsHost) {
        // Store the challenge for online mode to use
        state.onlineSelectedChallenge = Object.assign({}, state.menuSelectedChallenge);
        return;
      }

      let source = 'frontpage';
      if (state.playlist) { source = 'playlist'; }
      if (state.search.query) { source = 'search'; }
      if (state.genre) { source = 'genre'; }
      gtag('event', 'songsource', { event_label: source });

      resetScore(state);

      // Set challenge.
      Object.assign(state.challenge, state.menuSelectedChallenge);

      gtag('event', 'difficulty', { event_label: state.challenge.difficulty });

      // Reset menu.
      state.menuActive = false;
      state.menuSelectedChallenge.id = '';
      state.menuSelectedChallenge.difficulty = '';
      state.menuSelectedChallenge.beatmapCharacteristic = '';

      state.isSearching = false;
      state.isLoading = true;
      state.loadingText = 'Loading...'

      gtag('event', 'colorscheme', { event_label: state.colorScheme });
    },

    playlistclear: (state, playlist) => {
      state.menuSelectedChallenge.id = '';
      state.playlist = '';
    },

    playlistselect: (state, playlist) => {
      state.genre = '';
      state.menuSelectedChallenge.id = '';
      state.playlist = playlist.id;
      state.playlistTitle = playlist.title;
      state.playlistMenuOpen = false;
      state.search.query = '';
    },

    playlistmenuclose: state => {
      state.playlistMenuOpen = false;
    },

    playlistmenuopen: state => {
      state.playlistMenuOpen = true;
    },

    searcherror: (state, payload) => {
      state.search.hasError = true;
    },

    searchprevpage: state => {
      if (state.search.page === 0) { return; }
      state.search.page--;
      computeSearchPagination(state);
    },

    searchnextpage: state => {
      if (state.search.page > Math.floor(state.search.results.length / SEARCH_PER_PAGE)) {
        return;
      }
      state.search.page++;
      computeSearchPagination(state);

      if (state.search.url === undefined) {
        return;
      }

      if ((state.search.page + 3) > Math.floor(state.search.results.length / SEARCH_PER_PAGE)) {

        state.search.urlPage = state.search.urlPage + 1;

        fetch(state.search.url.replaceAll('CURRENT_PAGE_INDEX', state.search.urlPage))
          .then(r => { return r.json() })
          .then(res => {
            var hits = (res['docs'] || res['maps']).map(convertBeatmap)

            state.search.results.push(...hits);

            for (i = 0; i < hits.length; i++) {
              let result = hits[i];
              challengeDataStore[result.id] = result;
            }            
          })
      }
    },

    /**
     * Update search results. Will automatically render using `bind-for` (menu.html).
     */
    searchresults: (state, payload) => {
      var i;
      state.search.hasError = false;
      state.search.page = 0;
      state.search.url = payload.url;
      state.search.urlPage = payload.urlPage;
      state.search.query = payload.query;
      state.search.queryText = truncate(payload.query, 10);
      state.search.results = payload.results || [];
      for (i = 0; i < state.search.results.length; i++) {
        let result = state.search.results[i];
        // result.songSubName = result.songSubName || 'Unknown Artist';
        // result.shortSongName = truncate(result.songName, SONG_NAME_TRUNCATE).toUpperCase();
        // result.shortSongSubName = truncate(result.songSubName, SONG_SUB_NAME_RESULT_TRUNCATE);
        challengeDataStore[result.id] = result;
      }
      computeSearchPagination(state);
      state.menuSelectedChallenge.id = '';  // Clear any selected on new results.
      if (state.isSearching) {
        state.genre = '';
        state.playlist = '';
      }
    },

    songcomplete: state => {
      gtag('event', 'songcomplete', { event_label: state.gameMode });

      // Move back to menu in Ride or Viewer Mode.
      if (state.gameMode === 'ride' || !state.inVR) {
        state.challenge.isBeatsPreloaded = false;
        state.isVictory = false;
        state.menuActive = true;
        state.challenge.id = '';
        return;
      }

      state.isVictory = true;

      state.score.score = isNaN(state.score.score) ? 0 : state.score.score;
      updateScoreAccuracy(state);
      state.score.finalAccuracy = state.score.accuracy;

      const accuracy = parseFloat(state.score.accuracy);
      if (accuracy >= 97) {
        state.score.rank = 'S';
      } else if (accuracy >= 90) {
        state.score.rank = 'A';
      } else if (accuracy >= 80) {
        state.score.rank = 'B';
      } else if (accuracy >= 70) {
        state.score.rank = 'C';
      } else if (accuracy >= 60) {
        state.score.rank = 'D';
      } else {
        state.score.rank = 'F';
      }

      computeBeatsText(state);
    },

    songloadcancel: state => {
      state.challenge.isBeatsPreloaded = false;
      // Unset selected challenge.
      state.challenge.audio = '';
      state.challenge.id = '';
      state.challenge.version = '';

      state.isZipFetching = false;
      state.isLoading = false;
      state.isSongProcessing = false;
      state.menuActive = true;
    },

    songloaderror: state => {
      badSongs[state.menuSelectedChallenge.id || state.challenge.id] = true;

      state.hasSongLoadError = true;
      state.loadingText = 'Sorry! There was an error loading this song.\nPlease select another song.';

      state.challenge.id = '';
      state.challenge.isBeatsPreloaded = false;
      state.isSongProcessing = false;
      state.isZipFetching = false;
    },

    songprocessfinish: state => {
      state.isSongProcessing = false;
      state.isLoading = false;  // Done loading after final step!
    },

    songprocessstart: state => {
      state.isSongProcessing = true;
      state.loadingText = 'Wrapping up...';
    },

    'enter-vr': state => {
      state.inVR = AFRAME.utils.device.checkHeadsetConnected();
      if (!AFRAME.utils.device.isMobile()) { 
        gtag('event', 'entervr', {});
        if (AFRAME.utils.device.isOculusBrowser()) {
          gtag('event', 'oculusbrowser', {});
        }
      }
    },

    'exit-vr': state => {
      state.inVR = false;
      if (state.isPlaying) {
        state.isPaused = true;
      }
    },

    startgame: state => {
      state.introActive = false;
      state.menuActive = true;
    },

    victoryfake: state => {
      state.score.accuracy = '74.99';
      state.score.rank = 'C';
    },

    wallhitstart: state => {
      takeDamage(state);
    },

    // ==================== ONLINE MULTIPLAYER HANDLERS ====================
    
    onlinemenutoggle: state => {
      if (!state.onlineMenuActive) {
        // Opening online menu
        state.onlineMenuActive = true;
        state.onlineShowMainPanel = true;
        state.onlineCreatePanelActive = false;
        state.onlineJoinPanelActive = false;
        state.onlineJoinCodePanelActive = false;
        state.onlineError = '';
        state.onlineHasError = false;
      } else {
        // Closing online menu
        state.onlineMenuActive = false;
        state.onlineCreatePanelActive = false;
        state.onlineJoinPanelActive = false;
        state.onlineJoinCodePanelActive = false;
        state.onlineError = '';
        state.onlineHasError = false;
        state.onlineShowMainPanel = true;
      }
    },

    onlinecreatepanel: state => {
      // Show mode selection panel first (not username entry)
      state.onlineModeSelectPanelActive = true;
      state.onlineCreatePanelActive = false;
      state.onlineJoinPanelActive = false;
      state.onlineShowMainPanel = false;
      state.onlineError = '';
    },

    onlinejoinpanel: state => {
      state.onlineJoinPanelActive = true;
      state.onlineCreatePanelActive = false;
      state.onlineShowMainPanel = false;
      state.onlineError = '';
    },

    onlineusernamesubmit: state => {
      // Username is set by the component, now proceed
      if (!state.onlineUsername || state.onlineUsername.trim() === '') {
        state.onlineError = 'Please enter a username';
        return;
      }
      
      if (state.onlineCreatePanelActive) {
        // Will create room - handled by component
        state.onlineCreatePanelActive = false;
      } else if (state.onlineJoinPanelActive) {
        // Show join code panel
        state.onlineJoinPanelActive = false;
        state.onlineJoinCodePanelActive = true;
      }
    },

    onlinejoincodesubmit: state => {
      // Join code submit - handled by component
      if (!state.onlineJoinCode || state.onlineJoinCode.trim().length < 6) {
        state.onlineError = 'Please enter a valid 6-character room code';
        return;
      }
      state.onlineJoinCodePanelActive = false;
    },

    onlinesetusername: (state, payload) => {
      state.onlineUsername = payload;
    },

    onlinesetjoincode: (state, payload) => {
      state.onlineJoinCode = payload;
    },

    onlineroomcreated: (state, payload) => {
      state.onlineRoomCode = payload.code || payload.roomCode;
      state.onlineRoomState = 'lobby';
      state.onlineGameMode = payload.gameMode || state.onlineGameMode || 'classic';
      state.onlineIsHost = true;
      state.onlineCreatePanelActive = false;
      state.onlineModeSelectPanelActive = false;
      state.onlinePlayers = payload.players || [];
      state.onlineNotInRoom = false;
      state.onlineInLobby = true;
      state.onlineShowMainPanel = false;
      updateOnlinePlayersText(state);
      updateOnlineDisplayTexts(state);
    },

    onlineroomjoined: (state, payload) => {
      state.onlineRoomCode = payload.code || payload.roomCode;
      state.onlineRoomState = 'lobby';
      state.onlineGameMode = payload.gameMode || 'classic';
      state.onlineIsHost = payload.isHost || false;
      state.onlineJoinPanelActive = false;
      state.onlineJoinCodePanelActive = false;
      state.onlinePlayers = payload.players || [];
      state.onlineNotInRoom = false;
      state.onlineInLobby = true;
      state.onlineShowMainPanel = false;
      updateOnlinePlayersText(state);
      updateOnlineDisplayTexts(state);
      state.onlineError = '';
    },

    onlineplayersupdate: (state, payload) => {
      state.onlinePlayers = payload.players || [];
      updateOnlinePlayersText(state);
    },

    onlinestartsong: state => {
      // Host clicked to pick a song - close online menu, open song picker
      state.onlineMenuActive = false;
      state.menuActive = true;
      state.mainMenuActive = true;
    },

    onlinegamestart: (state, payload) => {
      // Server tells everyone to start the game
      state.onlineRoomState = 'playing';
      state.onlineMenuActive = false;
    },

    onlinegameend: (state, payload) => {
      // Game ended, show results
      state.onlineRoomState = 'results';
      state.onlineLeaderboard = payload.leaderboard || [];
      
      // Format leaderboard text
      if (state.onlineLeaderboard.length > 0) {
        state.onlineLeaderboardText = state.onlineLeaderboard
          .sort((a, b) => b.score - a.score)
          .map((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1) + '.';
            return medal + ' ' + player.name + ': ' + player.score + ' pts (' + player.accuracy + '%)';
          })
          .join('\n');
      } else {
        state.onlineLeaderboardText = 'No scores recorded';
      }
    },

    onlinereturnlobby: state => {
      state.onlineRoomState = 'lobby';
      state.onlineLeaderboard = [];
      state.onlineLeaderboardText = '';
    },

    onlineleaveroom: state => {
      // Reset all online state
      state.onlineMenuActive = false;
      state.onlineCreatePanelActive = false;
      state.onlineJoinPanelActive = false;
      state.onlineJoinCodePanelActive = false;
      state.onlineRoomCode = '';
      state.onlineRoomState = '';
      state.onlineIsHost = false;
      state.onlinePlayers = [];
      state.onlinePlayersText = '';
      state.onlineJoinCode = '';
      state.onlineLeaderboard = [];
      state.onlineLeaderboardText = '';
      state.onlineError = '';
    },

    onlinemenuback: state => {
      // Handle back button in online menu
      if (state.onlineRoomState === 'lobby' || state.onlineRoomState === 'results') {
        // In a room - leave it
        state.onlineRoomCode = '';
        state.onlineRoomState = '';
        state.onlineIsHost = false;
        state.onlinePlayers = [];
        state.onlinePlayersText = '';
        state.onlineNotInRoom = true;
        state.onlineInLobby = false;
        state.onlineInResults = false;
        state.onlineShowMainPanel = true;
      } else if (state.onlineJoinCodePanelActive) {
        state.onlineJoinCodePanelActive = false;
        state.onlineJoinPanelActive = true;
      } else if (state.onlineCreatePanelActive) {
        // Go back from username entry to mode selection
        state.onlineCreatePanelActive = false;
        state.onlineModeSelectPanelActive = true;
      } else if (state.onlineModeSelectPanelActive || state.onlineJoinPanelActive) {
        // Go back from mode selection or join panel to main menu
        state.onlineModeSelectPanelActive = false;
        state.onlineJoinPanelActive = false;
        state.onlineShowMainPanel = true;
      } else {
        state.onlineMenuActive = false;
      }
      state.onlineError = '';
      state.onlineHasError = false;
    },

    onlineconnected: state => {
      state.onlineConnected = true;
      state.onlineError = '';
    },

    onlinedisconnected: state => {
      state.onlineConnected = false;
      state.onlineError = 'Disconnected from server';
    },

    // Join flow - after username, go to code entry
    onlinejoinusernamesubmit: state => {
      if (!state.onlineUsername || state.onlineUsername.trim() === '') {
        state.onlineError = 'Please enter a username';
        return;
      }
      state.onlineJoinPanelActive = false;
      state.onlineJoinCodePanelActive = true;
      state.onlineError = '';
    },

    // Host selecting song
    onlinehostselectingsong: state => {
      state.onlineMenuActive = false;
      state.menuActive = true;
    },

    // Challenge selected by host (received by non-hosts)
    onlinechallengeselected: (state, payload) => {
      // Non-hosts receive this when host picks a song
      // They'll see countdown next
    },

    // Game starting - show countdown
    onlinegamestarting: (state, payload) => {
      state.onlineRoomState = 'countdown';
      state.onlineCountdown = payload.countdown || 5;
      state.onlineMenuActive = true;
      state.menuActive = false;
      
      // Store challenge info for non-hosts
      if (payload.challenge && !state.onlineIsHost) {
        Object.assign(state.menuSelectedChallenge, payload.challenge);
      }
    },

    // Countdown tick
    onlinecountdown: (state, payload) => {
      state.onlineCountdown = payload.count;
    },

    // Game started - start playing
    onlinegamestarted: state => {
      state.onlineRoomState = 'playing';
      state.onlineMenuActive = false;
      state.menuActive = false;
      
      // Trigger the actual game start
      if (state.menuSelectedChallenge.id) {
        state.isLoading = true;
        state.loadingText = 'Loading...';
        Object.assign(state.challenge, state.menuSelectedChallenge);
        state.menuSelectedChallenge.id = '';
      }
    },

    // Score update from other player
    onlinescoreupdate: (state, payload) => {
      // Could update a live leaderboard display here
    },

    // Game results received
    onlinegameresults: (state, payload) => {
      state.onlineRoomState = 'results';
      state.onlineMenuActive = true;
      state.menuActive = false;
      state.isVictory = false;
      state.isGameOver = false;
      state.onlineLeaderboard = payload.leaderboard || [];
      
      // Format leaderboard text
      if (state.onlineLeaderboard.length > 0) {
        state.onlineLeaderboardText = state.onlineLeaderboard
          .sort(function(a, b) { return b.score - a.score; })
          .map(function(player, index) {
            var medal = index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : (index + 1) + 'th';
            var acc = typeof player.accuracy === 'number' ? player.accuracy.toFixed(1) : player.accuracy;
            return medal + ' ' + player.name + ': ' + player.score + ' pts (' + acc + '%)';
          })
          .join('\n');
      } else {
        state.onlineLeaderboardText = 'No scores recorded';
      }
    },

    // Returned to lobby
    onlinereturnedtolobby: (state, payload) => {
      state.onlineRoomState = 'lobby';
      state.onlineLeaderboard = [];
      state.onlineLeaderboardText = '';
      state.onlinePlayers = payload.players || [];
      updateOnlinePlayersText(state);
    },

    // Became host (previous host left)
    onlinebecamehost: state => {
      state.onlineIsHost = true;
    },

    // ==================== END ONLINE HANDLERS ====================

    ziploaderend: (state, payload) => {
      state.challenge.audio = payload.audio;
      state.hasSongLoadError = false;
      state.menuSelectedChallenge.version = '';
      state.isZipFetching = false;
    },

    ziploaderstart: state => {
      state.challenge.isBeatsPreloaded = false;
      state.isZipFetching = true;
    }
  },

  /**
   * Post-process the state after each action.
   */
  computeState: state => {
    state.isPlaying =
      !state.menuActive && !state.isLoading && !state.isPaused && !state.isVictory &&
      !state.isGameOver && !state.isZipFetching && !state.isSongProcessing &&
      !!state.challenge.id && !state.introActive;

    const anyMenuOpen = state.menuActive || state.isPaused || state.isVictory ||
      state.isGameOver || state.isLoading || state.introActive;
    state.leftRaycasterActive = anyMenuOpen && state.activeHand === 'left' && state.inVR;
    state.rightRaycasterActive = anyMenuOpen && state.activeHand === 'right' && state.inVR;

    state.mainMenuActive =
      state.menuActive &&
      !state.genreMenuOpen &&
      !state.difficultyFilterMenuOpen &&
      !state.playlistMenuOpen &&
      !state.optionsMenuOpen &&
      !state.isSearching;

    state.score.active =
      state.gameMode !== 'ride' &&
      state.inVR &&
      (state.isPlaying || state.isPaused);
  }
});

function computeSearchPagination(state) {
  let numPages = Math.ceil(state.search.results.length / SEARCH_PER_PAGE);
  state.search.hasPrev = state.search.page > 0;
  state.search.hasNext = state.search.page < numPages - 1;

  state.search.songNameTexts = '';
  state.search.songSubNameTexts = '';

  state.searchResultsPage.length = 0;
  state.searchResultsPage.__dirty = true;
  for (let i = state.search.page * SEARCH_PER_PAGE;
    i < state.search.page * SEARCH_PER_PAGE + SEARCH_PER_PAGE; i++) {
    const result = state.search.results[i];
    if (!result) { break; }
    state.searchResultsPage.push(result);

    state.search.songNameTexts +=
      truncate(result.metadata.songName, SONG_NAME_TRUNCATE).toUpperCase() + '\n';
    state.search.songSubNameTexts +=
      truncate((result.metadata.songSubName || result.metadata.songAuthorName || 'Unknown Artist'),
        SONG_SUB_NAME_RESULT_TRUNCATE) + '\n';
  }

  for (let i = 0; i < state.searchResultsPage.length; i++) {
    state.searchResultsPage[i].index = i;
  }

  computeMenuSelectedChallengeIndex(state);
}

function truncate(str, length) {
  if (!str) { return ''; }
  if (str.length >= length) {
    return str.substring(0, length - 3) + '...';
  }
  return str;
}

const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'expertPlus'];
const CHARACTERISTICS = ['Standard'];
function difficultyComparator(a, b) {
  const aIndex = DIFFICULTIES.indexOf(a.difficulty);
  const bIndex = DIFFICULTIES.indexOf(b.difficulty);
  if (aIndex < bIndex) { return -1; }
  if (aIndex > bIndex) { return 1; }

  const aIndex2 = CHARACTERISTICS.indexOf(a.beatmapCharacteristic);
  const bIndex2 = CHARACTERISTICS.indexOf(b.beatmapCharacteristic);
  if (aIndex2 > bIndex2) { return -1; }
  if (aIndex2 < bIndex2) { return 1; }
  return 0;
}

function takeDamage(state) {
  if (!state.isPlaying || !state.inVR) { return; }
  state.score.combo = 0;
  // No damage for now.
  // state.damage++;
  // if (AFRAME.utils.getUrlParameter('godmode')) { return; }
  // checkGameOver(state);
}

function checkGameOver(state) {
  if (state.damage >= DAMAGE_MAX) {
    state.damage = 0;
    state.isGameOver = true;
  }
}

function resetScore(state) {
  state.damage = 0;
  state.score.accuracy = 100;
  state.score.accuracyInt = 100;
  state.score.accuracyScore = 0;
  state.score.beatsHit = 0;
  state.score.beatsMissed = 0;
  state.score.finalAccuracy = 100;
  state.score.combo = 0;
  state.score.maxCombo = 0;
  state.score.score = 0;
}

function computeMenuSelectedChallengeIndex(state) {
  state.menuSelectedChallenge.index = -1;
  for (let i = 0; i < state.searchResultsPage.length; i++) {
    if (state.searchResultsPage[i].id === state.menuSelectedChallenge.id) {
      state.menuSelectedChallenge.index = i;
      break;
    }
  }
}

function formatSongLength(songLength) {
  songLength /= 60;
  const minutes = `${Math.floor(songLength)}`;
  var seconds = Math.round((songLength - minutes) * 60);
  if (seconds < 10) seconds = '0' + seconds;
  return `${minutes}:${seconds}`;
}

function computeBeatsText(state) {
  state.score.beatsText =
    `${state.score.beatsHit} / ${state.score.beatsMissed + state.score.beatsHit} BEATS`;
}

function updateOnlinePlayersText(state) {
  if (!state.onlinePlayers || state.onlinePlayers.length === 0) {
    state.onlinePlayersText = 'Waiting for players...';
    return;
  }
  
  state.onlinePlayersText = state.onlinePlayers.map(player => {
    let text = player.name;
    if (player.isHost) {
      text += ' (Host)';
    }
    if (player.ready) {
      text += ' ✓';
    }
    return text;
  }).join('\n');
}

function updateOnlineDisplayTexts(state) {
  // Update room code display
  state.onlineRoomCodeDisplay = state.onlineRoomCode ? 'Room: ' + state.onlineRoomCode : '';
  
  // Update game mode display texts
  if (state.onlineGameMode === 'punch') {
    state.onlineGameModeDisplay = 'PUNCH MODE';
    state.onlineCreateModeDisplay = 'MODE: PUNCH';
  } else if (state.onlineGameMode === 'classic') {
    state.onlineGameModeDisplay = 'CLASSIC MODE';
    state.onlineCreateModeDisplay = 'MODE: CLASSIC';
  } else {
    state.onlineGameModeDisplay = '';
    state.onlineCreateModeDisplay = '';
  }
}
function clearLeaderboard(state) {
  state.leaderboard.length = 0;
  state.leaderboard.__dirty = true;
  state.leaderboardNames = '';
  state.leaderboardScores = '';
  state.leaderboardFetched = false;
}

function updateMenuSongInfo(state, challenge) {
  let info = JSON.parse(challenge.metadata.characteristics)[state.menuSelectedChallenge.beatmapCharacteristic][state.menuSelectedChallenge.difficulty];

  state.menuSelectedChallenge.songInfoText = `Mapped by ${truncate(challenge.metadata.levelAuthorName, SONG_SUB_NAME_DETAIL_TRUNCATE)}\n${challenge.genre && challenge.genre !== 'Uncategorized' ? challenge.genre + '\n' : ''}${formatSongLength(challenge.metadata.duration)} / ${info.notes} notes\n${info.bombs} bombs | ${info.obstacles} obstacles\nNJS: ${info.njs}`;
}

function updateScoreAccuracy(state) {
  // Update live accuracy.
  const currentNumBeats = state.score.beatsHit + state.score.beatsMissed;
  state.score.accuracy = (state.score.accuracyScore / (currentNumBeats * 100)) * 100;
  state.score.accuracy = isNaN(state.score.accuracy) ? 100 : state.score.accuracy;
  state.score.accuracy = state.score.accuracy.toFixed(2);
  state.score.accuracyInt = parseInt(state.score.accuracy);
}
