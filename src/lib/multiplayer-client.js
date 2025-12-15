/**
 * Aurora Rider - Multiplayer Client
 * 
 * Handles WebSocket connection to the multiplayer server
 * and synchronizes game state between players.
 */

const MULTIPLAYER_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Room management
  CREATE_ROOM: 'createRoom',
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  ROOM_CREATED: 'roomCreated',
  ROOM_JOINED: 'roomJoined',
  LEFT_ROOM: 'leftRoom',
  
  // Player events
  PLAYER_JOINED: 'playerJoined',
  PLAYER_LEFT: 'playerLeft',
  PLAYER_READY: 'playerReady',
  SET_READY: 'setReady',
  ALL_READY: 'allReady',
  
  // Game events
  SELECT_CHALLENGE: 'selectChallenge',
  CHALLENGE_SELECTED: 'challengeSelected',
  START_GAME: 'startGame',
  GAME_STARTING: 'gameStarting',
  COUNTDOWN: 'countdown',
  GAME_STARTED: 'gameStarted',
  UPDATE_SCORE: 'updateScore',
  SCORE_UPDATE: 'scoreUpdate',
  GAME_FINISHED: 'gameFinished',
  PLAYER_FINISHED: 'playerFinished',
  GAME_RESULTS: 'gameResults',
  RETURN_TO_LOBBY: 'returnToLobby',
  RETURNED_TO_LOBBY: 'returnedToLobby',
  
  // Chat
  CHAT_MESSAGE: 'chatMessage'
};

class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.roomCode = null;
    this.room = null;
    this.playerName = localStorage.getItem('auroraRiderPlayerName') || '';
    this.isHost = false;
    this.listeners = new Map();
    this.serverUrl = this.getServerUrl();
  }

  getServerUrl() {
    // In production, use the same host
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.origin;
    }
    // In development, connect to local server
    return 'http://localhost:3000';
  }

  /**
   * Connect to the multiplayer server
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket && this.connected) {
        resolve();
        return;
      }

      // Load Socket.IO client if not already loaded
      if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => {
          this.initSocket(resolve, reject);
        };
        script.onerror = () => {
          reject(new Error('Failed to load Socket.IO client'));
        };
        document.head.appendChild(script);
      } else {
        this.initSocket(resolve, reject);
      }
    });
  }

  initSocket(resolve, reject) {
    try {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('[Aurora Rider] Connected to multiplayer server');
        this.connected = true;
        this.emit('connected');
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Aurora Rider] Disconnected from server:', reason);
        this.connected = false;
        this.roomCode = null;
        this.room = null;
        this.emit('disconnected', { reason });
      });

      this.socket.on('error', (error) => {
        console.error('[Aurora Rider] Server error:', error);
        this.emit('error', error);
      });

      // Room events
      this.socket.on(MULTIPLAYER_EVENTS.ROOM_CREATED, (data) => {
        this.roomCode = data.roomCode;
        this.room = data.room;
        this.isHost = true;
        this.emit('roomCreated', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.ROOM_JOINED, (data) => {
        this.roomCode = data.roomCode;
        this.room = data.room;
        this.isHost = false;
        this.emit('roomJoined', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.LEFT_ROOM, () => {
        this.roomCode = null;
        this.room = null;
        this.isHost = false;
        this.emit('leftRoom');
      });

      this.socket.on(MULTIPLAYER_EVENTS.PLAYER_JOINED, (data) => {
        this.room = data.room;
        this.emit('playerJoined', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.PLAYER_LEFT, (data) => {
        this.room = data.room;
        // Check if we became host
        if (data.room.hostId === this.socket.id) {
          this.isHost = true;
        }
        this.emit('playerLeft', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.PLAYER_READY, (data) => {
        this.room = data.room;
        this.emit('playerReady', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.ALL_READY, (data) => {
        this.room = data.room;
        this.emit('allReady', data);
      });

      // Game events
      this.socket.on(MULTIPLAYER_EVENTS.CHALLENGE_SELECTED, (data) => {
        this.room = data.room;
        this.emit('challengeSelected', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.GAME_STARTING, (data) => {
        this.room = data.room;
        this.emit('gameStarting', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.COUNTDOWN, (data) => {
        this.emit('countdown', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.GAME_STARTED, (data) => {
        this.room = data.room;
        this.emit('gameStarted', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.SCORE_UPDATE, (data) => {
        this.emit('scoreUpdate', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.PLAYER_FINISHED, (data) => {
        this.emit('playerFinished', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.GAME_RESULTS, (data) => {
        this.room = data.room;
        this.emit('gameResults', data);
      });

      this.socket.on(MULTIPLAYER_EVENTS.RETURNED_TO_LOBBY, (data) => {
        this.room = data.room;
        this.emit('returnedToLobby', data);
      });

      // Chat
      this.socket.on(MULTIPLAYER_EVENTS.CHAT_MESSAGE, (data) => {
        this.emit('chatMessage', data);
      });

    } catch (error) {
      reject(error);
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.roomCode = null;
      this.room = null;
    }
  }

  /**
   * Create a new multiplayer room
   * @param {string} playerName 
   * @param {string} gameMode - 'classic' or 'punch'
   */
  createRoom(playerName, gameMode) {
    if (!this.socket || !this.connected) {
      console.error('[Aurora Rider] Not connected to server');
      return;
    }
    
    this.playerName = playerName;
    localStorage.setItem('auroraRiderPlayerName', playerName);
    
    this.socket.emit(MULTIPLAYER_EVENTS.CREATE_ROOM, {
      playerName,
      gameMode
    });
  }

  /**
   * Join an existing room
   * @param {string} playerName 
   * @param {string} roomCode 
   */
  joinRoom(playerName, roomCode) {
    if (!this.socket || !this.connected) {
      console.error('[Aurora Rider] Not connected to server');
      return;
    }
    
    this.playerName = playerName;
    localStorage.setItem('auroraRiderPlayerName', playerName);
    
    this.socket.emit(MULTIPLAYER_EVENTS.JOIN_ROOM, {
      playerName,
      roomCode: roomCode.toUpperCase()
    });
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    console.log('[MultiplayerClient] leaveRoom called');
    console.trace('[MultiplayerClient] leaveRoom stack trace');
    if (this.socket && this.connected) {
      this.socket.emit(MULTIPLAYER_EVENTS.LEAVE_ROOM);
    }
  }

  /**
   * Set ready status
   * @param {boolean} ready 
   */
  setReady(ready) {
    if (this.socket && this.connected && this.roomCode) {
      this.socket.emit(MULTIPLAYER_EVENTS.SET_READY, { ready });
    }
  }

  /**
   * Select a challenge (host only)
   * @param {Object} challenge 
   */
  selectChallenge(challenge) {
    console.log('[MultiplayerClient] selectChallenge called. socket:', !!this.socket, 'connected:', this.connected, 'roomCode:', this.roomCode, 'isHost:', this.isHost);
    if (this.socket && this.connected && this.roomCode && this.isHost) {
      console.log('[MultiplayerClient] Emitting selectChallenge:', challenge.id);
      this.socket.emit(MULTIPLAYER_EVENTS.SELECT_CHALLENGE, { challenge });
    } else {
      console.warn('[MultiplayerClient] Cannot select challenge - not connected or not host');
    }
  }

  /**
   * Start the game (host only)
   */
  startGame() {
    if (this.socket && this.connected && this.roomCode && this.isHost) {
      this.socket.emit(MULTIPLAYER_EVENTS.START_GAME);
    }
  }

  /**
   * Update score during gameplay
   * @param {Object} scoreData 
   */
  updateScore(scoreData) {
    if (this.socket && this.connected && this.roomCode) {
      this.socket.emit(MULTIPLAYER_EVENTS.UPDATE_SCORE, scoreData);
    }
  }

  /**
   * Signal game finished
   * @param {Object} finalScore 
   */
  gameFinished(finalScore) {
    if (this.socket && this.connected && this.roomCode) {
      this.socket.emit(MULTIPLAYER_EVENTS.GAME_FINISHED, { finalScore });
    }
  }

  /**
   * Return to lobby (host only)
   */
  returnToLobby() {
    if (this.socket && this.connected && this.roomCode && this.isHost) {
      this.socket.emit(MULTIPLAYER_EVENTS.RETURN_TO_LOBBY);
    }
  }

  /**
   * Kick a player from the room (host only)
   * @param {string} playerId - The socket ID of the player to kick
   */
  kickPlayer(playerId) {
    if (this.socket && this.connected && this.roomCode && this.isHost) {
      this.socket.emit('kickPlayer', { playerId });
    }
  }

  /**
   * Send chat message
   * @param {string} message 
   */
  sendChatMessage(message) {
    if (this.socket && this.connected && this.roomCode) {
      this.socket.emit(MULTIPLAYER_EVENTS.CHAT_MESSAGE, { message });
    }
  }

  /**
   * Submit final score at end of game
   * @param {Object} scoreData 
   */
  submitScore(scoreData) {
    if (this.socket && this.connected && this.roomCode) {
      this.socket.emit(MULTIPLAYER_EVENTS.GAME_FINISHED, { finalScore: scoreData });
    }
  }

  /**
   * Select a challenge and start game immediately (host only)
   * @param {Object} challenge 
   */
  selectAndStartChallenge(challenge) {
    if (this.socket && this.connected && this.roomCode && this.isHost) {
      this.socket.emit(MULTIPLAYER_EVENTS.SELECT_CHALLENGE, { challenge });
      // Start game after a brief delay
      setTimeout(() => {
        this.socket.emit(MULTIPLAYER_EVENTS.START_GAME);
      }, 500);
    }
  }

  /**
   * Add event listener
   * @param {string} event 
   * @param {Function} callback 
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event 
   * @param {*} data 
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        callback(data);
      }
    }
  }

  /**
   * Get current room info
   */
  getRoom() {
    return this.room;
  }

  /**
   * Get room code
   */
  getRoomCode() {
    return this.roomCode;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Check if user is host
   */
  getIsHost() {
    return this.isHost;
  }
}

// Create singleton instance
const multiplayerClient = new MultiplayerClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MultiplayerClient, multiplayerClient, MULTIPLAYER_EVENTS };
}

// Also attach to window for browser access
if (typeof window !== 'undefined') {
  window.AuroraRiderMultiplayer = multiplayerClient;
  window.MULTIPLAYER_EVENTS = MULTIPLAYER_EVENTS;
}
