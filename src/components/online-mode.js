/**
 * Aurora Rider - Online Mode Component
 * 
 * Handles multiplayer game flow:
 * 1. Create/Join room with username
 * 2. Lobby - waiting for host to pick song
 * 3. Host picks song, 5 second countdown
 * 4. Everyone plays
 * 5. Results screen with scores
 * 6. Back to lobby or exit
 */

var multiplayerClient = require('../lib/multiplayer-client').multiplayerClient;

AFRAME.registerComponent('online-mode', {
  init: function () {
    var self = this;
    var scene = this.el.sceneEl;
    
    this.setupMultiplayerListeners();
    this.setupUIListeners();
    
    // Track if we're in online mode
    this.inOnlineGame = false;
  },

  setupMultiplayerListeners: function () {
    var self = this;
    var scene = this.el.sceneEl;
    
    multiplayerClient.on('connected', function () {
      console.log('[Online] Connected to server');
      scene.emit('onlineconnected');
    });
    
    multiplayerClient.on('disconnected', function () {
      console.log('[Online] Disconnected from server');
      scene.emit('onlinedisconnected');
    });
    
    multiplayerClient.on('roomCreated', function (data) {
      console.log('[Online] Room created:', data.roomCode, 'mode:', data.room.gameMode);
      scene.emit('onlineroomcreated', {
        code: data.roomCode,
        players: data.room.players,
        gameMode: data.room.gameMode || 'classic',
        isHost: true
      });
    });
    
    multiplayerClient.on('roomJoined', function (data) {
      console.log('[Online] Joined room:', data.roomCode, 'mode:', data.room.gameMode);
      var isHost = data.room.hostId === multiplayerClient.socket.id;
      scene.emit('onlineroomjoined', {
        code: data.roomCode,
        players: data.room.players,
        gameMode: data.room.gameMode || 'classic',
        isHost: isHost
      });
    });
    
    multiplayerClient.on('playerJoined', function (data) {
      console.log('[Online] Player joined:', data.player.name);
      scene.emit('onlineplayersupdate', { players: data.room.players });
    });
    
    multiplayerClient.on('playerLeft', function (data) {
      console.log('[Online] Player left');
      scene.emit('onlineplayersupdate', { players: data.room.players });
      // Check if we became host
      if (data.room.hostId === multiplayerClient.socket.id) {
        scene.emit('onlinebecamehost');
      }
    });
    
    multiplayerClient.on('challengeSelected', function (data) {
      console.log('[Online] Challenge selected by host');
      scene.emit('onlinechallengeselected', { challenge: data.challenge });
    });
    
    multiplayerClient.on('gameStarting', function (data) {
      console.log('[Online] Game starting, countdown:', data.countdown);
      self.inOnlineGame = true;
      scene.emit('onlinegamestarting', {
        countdown: data.countdown,
        challenge: data.challenge,
        gameMode: data.gameMode
      });
    });
    
    multiplayerClient.on('countdown', function (data) {
      console.log('[Online] Countdown:', data.count);
      scene.emit('onlinecountdown', { count: data.count });
    });
    
    multiplayerClient.on('gameStarted', function (data) {
      console.log('[Online] Game started!');
      scene.emit('onlinegamestarted');
    });
    
    multiplayerClient.on('scoreUpdate', function (data) {
      scene.emit('onlinescoreupdate', {
        playerId: data.playerId,
        playerName: data.playerName,
        score: data.score,
        leaderboard: data.leaderboard
      });
    });
    
    multiplayerClient.on('playerFinished', function (data) {
      console.log('[Online] Player finished:', data.playerName, 'Finished:', data.playersFinished, '/', data.totalPlayers);
      // Update waiting count for everyone
      scene.emit('onlineotherplayerfinished', {
        playerName: data.playerName,
        playersFinished: data.playersFinished,
        totalPlayers: data.totalPlayers
      });
    });
    
    multiplayerClient.on('gameResults', function (data) {
      console.log('[Online] Game results received:', data);
      console.log('[Online] Leaderboard:', JSON.stringify(data.leaderboard));
      self.inOnlineGame = false;
      scene.emit('onlinegameresults', { leaderboard: data.leaderboard });
    });
    
    multiplayerClient.on('returnedToLobby', function (data) {
      console.log('[Online] Returned to lobby');
      scene.emit('onlinereturnedtolobby', { players: data.room.players });
    });
    
    multiplayerClient.on('youWereKicked', function (data) {
      console.log('[Online] You were kicked:', data.reason);
      self.inOnlineGame = false;
      scene.emit('onlineerror', 'Game ended by host');
      // Show results immediately for kicked player
      scene.emit('onlinegameresults', { leaderboard: [] });
    });
    
    multiplayerClient.on('error', function (data) {
      console.error('[Online] Error:', data.message);
      scene.emit('onlineerror', data.message);
    });
    
    multiplayerClient.on('leftRoom', function () {
      console.log('[Online] Left room');
      self.inOnlineGame = false;
    });
  },

  setupUIListeners: function () {
    var self = this;
    var scene = this.el.sceneEl;
    
    // Clear keyboards when going back in menu
    scene.addEventListener('onlinemenuback', function () {
      self.clearKeyboards();
    });
    
    // Clear keyboards when menu closes
    scene.addEventListener('onlinemenuclose', function () {
      self.clearKeyboards();
    });
    
    // Create room - get username from keyboard and create with selected game mode
    scene.addEventListener('onlinecreateroom', function () {
      var keyboard = document.getElementById('createUsernameKeyboard');
      var username = '';
      if (keyboard && keyboard.components['super-keyboard']) {
        username = keyboard.components['super-keyboard'].data.value || '';
      }
      
      if (!username || username.trim() === '') {
        scene.emit('onlineerror', 'Please enter a username');
        return;
      }
      
      // Get selected game mode from state
      var state = scene.systems.state.state;
      var gameMode = state.onlineGameMode || 'classic';
      
      self.createRoom(username.trim(), gameMode);
    });
    
    // Show join code panel after username entry
    scene.addEventListener('onlineshowjoincode', function () {
      var keyboard = document.getElementById('joinUsernameKeyboard');
      var username = '';
      if (keyboard && keyboard.components['super-keyboard']) {
        username = keyboard.components['super-keyboard'].data.value || '';
      }
      
      if (!username || username.trim() === '') {
        scene.emit('onlineerror', 'Please enter a username');
        return;
      }
      
      scene.emit('onlinesetusername', username.trim());
      scene.emit('onlinejoincodepanelshow');
    });
    
    // Join room with code
    scene.addEventListener('onlinejoinroom', function () {
      var state = scene.systems.state.state;
      var keyboard = document.getElementById('joinCodeKeyboard');
      var joinCode = '';
      if (keyboard && keyboard.components['super-keyboard']) {
        joinCode = keyboard.components['super-keyboard'].data.value || '';
      }
      
      if (!joinCode || joinCode.trim().length < 6) {
        scene.emit('onlineerror', 'Enter a 6-character room code');
        return;
      }
      
      var username = state.onlineUsername || 'Player';
      self.joinRoom(username, joinCode.trim().toUpperCase());
    });
    
    // Host clicks to pick song - switch to song menu
    scene.addEventListener('onlineselectsong', function () {
      var state = scene.systems.state.state;
      if (state.onlineIsHost && state.onlineInLobby) {
        scene.emit('onlinehostselectingsong');
      }
    });
    
    // When host clicks play on a song in online mode
    scene.addEventListener('playbuttonclick', function () {
      var state = scene.systems.state.state;
      console.log('=== PLAY BUTTON CLICKED ===');
      console.log('onlineInLobby:', state.onlineInLobby);
      console.log('onlineIsHost:', state.onlineIsHost);
      console.log('onlineSelectedChallenge:', state.onlineSelectedChallenge ? state.onlineSelectedChallenge.id : 'none');
      console.log('multiplayerClient connected:', multiplayerClient.connected);
      console.log('multiplayerClient roomCode:', multiplayerClient.roomCode);
      console.log('multiplayerClient isHost:', multiplayerClient.isHost);
      
      if (state.onlineInLobby && state.onlineIsHost && state.onlineSelectedChallenge) {
        console.log('[Online] Sending challenge to server:', state.onlineSelectedChallenge.id);
        // Send challenge to server and start game
        multiplayerClient.selectChallenge(state.onlineSelectedChallenge);
        setTimeout(function () {
          console.log('[Online] Starting game');
          multiplayerClient.startGame();
        }, 500);
      } else {
        console.log('[Online] Conditions not met for online play');
      }
    });
    
    // Song complete - send final score and show waiting screen
    // Using songcomplete instead of victory because victory event is unreliable (async audio callback)
    scene.addEventListener('songcomplete', function () {
      var state = scene.systems.state.state;
      if (self.inOnlineGame) {
        console.log('[Online] Song complete - sending final score to server');
        console.log('[Online] Score:', state.score.score, 'Accuracy:', state.score.finalAccuracy);
        
        // Send score to server
        multiplayerClient.gameFinished({
          score: state.score.score,
          accuracy: parseFloat(state.score.finalAccuracy) || 0,
          maxCombo: state.score.maxCombo,
          beatsHit: state.score.beatsHit,
          beatsMissed: state.score.beatsMissed
        });
        
        // Show initial waiting screen immediately - will be updated by server's playerFinished event
        scene.emit('onlineplayerfinished', {
          playersFinished: 0,  // Will be updated by server
          totalPlayers: state.onlinePlayers.length,
          playersStillPlaying: []
        });
      }
    });
    
    // Also listen to victory event as backup (for VR players)
    scene.addEventListener('victory', function () {
      var state = scene.systems.state.state;
      // Only handle if we haven't already sent score via songcomplete
      if (self.inOnlineGame && !state.onlineWaitingForPlayers) {
        console.log('[Online] Victory event - sending final score to server (backup)');
        // Send score to server
        multiplayerClient.gameFinished({
          score: state.score.score,
          accuracy: parseFloat(state.score.finalAccuracy) || 0,
          maxCombo: state.score.maxCombo,
          beatsHit: state.score.beatsHit,
          beatsMissed: state.score.beatsMissed
        });
        
        // Show initial waiting screen - will be updated by server's playerFinished event
        scene.emit('onlineplayerfinished', {
          playersFinished: 0,  // Will be updated by server
          totalPlayers: state.onlinePlayers.length,
          playersStillPlaying: []
        });
      }
    });
    
    // Leave room
    scene.addEventListener('onlineleaveroom', function () {
      multiplayerClient.leaveRoom();
      self.inOnlineGame = false;
    });
    
    // Return to lobby (host only)
    scene.addEventListener('onlinereturnlobby', function () {
      multiplayerClient.returnToLobby();
    });
    
    // Force show results (host only) - skips waiting for slow players
    scene.addEventListener('onlineforceresults', function () {
      var state = scene.systems.state.state;
      if (state.onlineIsHost) {
        console.log('[Online] Host forcing results');
        multiplayerClient.forceResults();
      }
    });
    
    // Kick player (host only)
    scene.addEventListener('onlinekickplayer', function (evt) {
      var state = scene.systems.state.state;
      if (state.onlineIsHost && evt.detail && evt.detail.playerId) {
        multiplayerClient.kickPlayer(evt.detail.playerId);
      }
    });
  },

  clearKeyboards: function () {
    // Clear all online keyboards
    var keyboards = ['createUsernameKeyboard', 'joinUsernameKeyboard', 'joinCodeKeyboard'];
    keyboards.forEach(function (id) {
      var keyboard = document.getElementById(id);
      if (keyboard && keyboard.components['super-keyboard']) {
        keyboard.setAttribute('super-keyboard', 'value', '');
        keyboard.components['super-keyboard'].rawValue = '';
        keyboard.components['super-keyboard'].close();
      }
    });
  },

  createRoom: function (playerName, gameMode) {
    var self = this;
    var scene = this.el.sceneEl;
    
    multiplayerClient.connect().then(function () {
      multiplayerClient.createRoom(playerName, gameMode || 'classic');
    }).catch(function (err) {
      console.error('[Online] Failed to connect:', err);
      scene.emit('onlineerror', 'Failed to connect to server');
    });
  },

  joinRoom: function (playerName, roomCode) {
    var self = this;
    var scene = this.el.sceneEl;
    
    multiplayerClient.connect().then(function () {
      multiplayerClient.joinRoom(playerName, roomCode);
    }).catch(function (err) {
      console.error('[Online] Failed to connect:', err);
      scene.emit('onlineerror', 'Failed to connect to server');
    });
  }
});

/**
 * Username keyboard input handler
 */
AFRAME.registerComponent('online-username-input', {
  init: function () {
    var scene = this.el.sceneEl;
    this.el.addEventListener('superkeyboardchange', function (evt) {
      scene.emit('onlinesetusername', evt.detail.value);
    });
  }
});

/**
 * Join code keyboard input handler
 */
AFRAME.registerComponent('online-joincode-input', {
  init: function () {
    var scene = this.el.sceneEl;
    this.el.addEventListener('superkeyboardchange', function (evt) {
      scene.emit('onlinesetjoincode', evt.detail.value);
    });
  }
});
