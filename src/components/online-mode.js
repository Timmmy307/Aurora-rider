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
      console.log('[Online] Room created:', data.roomCode);
      scene.emit('onlineroomcreated', {
        code: data.roomCode,
        players: data.room.players,
        isHost: true
      });
    });
    
    multiplayerClient.on('roomJoined', function (data) {
      console.log('[Online] Joined room:', data.roomCode);
      var isHost = data.room.hostId === multiplayerClient.socket.id;
      scene.emit('onlineroomjoined', {
        code: data.roomCode,
        players: data.room.players,
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
      console.log('[Online] Player finished:', data.playerName);
    });
    
    multiplayerClient.on('gameResults', function (data) {
      console.log('[Online] Game results received');
      self.inOnlineGame = false;
      scene.emit('onlinegameresults', { leaderboard: data.leaderboard });
    });
    
    multiplayerClient.on('returnedToLobby', function (data) {
      console.log('[Online] Returned to lobby');
      scene.emit('onlinereturnedtolobby', { players: data.room.players });
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
    
    // Create room - get username from keyboard and create
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
      
      self.createRoom(username.trim());
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
      if (state.onlineInLobby && state.onlineIsHost && state.menuSelectedChallenge.id) {
        // Send challenge to server and start game
        multiplayerClient.selectChallenge(state.menuSelectedChallenge);
        setTimeout(function () {
          multiplayerClient.startGame();
        }, 100);
      }
    });
    
    // Victory/game complete - send final score
    scene.addEventListener('victory', function () {
      var state = scene.systems.state.state;
      if (self.inOnlineGame) {
        multiplayerClient.gameFinished({
          score: state.score.score,
          accuracy: parseFloat(state.score.finalAccuracy) || 0,
          maxCombo: state.score.maxCombo,
          beatsHit: state.score.beatsHit,
          beatsMissed: state.score.beatsMissed
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
  },

  createRoom: function (playerName) {
    var self = this;
    var scene = this.el.sceneEl;
    
    multiplayerClient.connect().then(function () {
      multiplayerClient.createRoom(playerName, 'classic');
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

/**
 * Score sync - sends periodic score updates during online play
 */
AFRAME.registerComponent('online-score-sync', {
  schema: {
    interval: { type: 'number', default: 2000 }
  },

  init: function () {
    this.lastUpdate = 0;
  },

  tick: function (time) {
    var state = this.el.sceneEl.systems.state.state;
    if (state.onlineRoomState !== 'playing') return;
    if (!state.isPlaying) return;
    
    if (time - this.lastUpdate > this.data.interval) {
      this.lastUpdate = time;
      
      multiplayerClient.updateScore({
        score: state.score.score,
        accuracy: parseFloat(state.score.accuracy) || 100,
        combo: state.score.combo,
        maxCombo: state.score.maxCombo
      });
    }
  }
});
