/**
 * Aurora Rider - Multiplayer Server
 * 
 * Handles online multiplayer sessions with room codes,
 * game mode selection (normal/punch), and player synchronization.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuration
const PORT = process.env.PORT || 3000;
const ROOM_CODE_LENGTH = 6;

// Store for active rooms
const rooms = new Map();

// Store for player data
const players = new Map();

/**
 * Generate a random room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Make sure code is unique
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

/**
 * Room class to manage multiplayer sessions
 */
class Room {
  constructor(hostId, hostName, gameMode) {
    this.code = generateRoomCode();
    this.hostId = hostId;
    this.hostName = hostName;
    this.gameMode = gameMode; // 'classic' or 'punch'
    this.players = new Map();
    this.state = 'lobby'; // 'lobby', 'selecting', 'countdown', 'playing', 'results'
    this.selectedChallenge = null;
    this.playerScores = new Map();
    this.playerReady = new Map();
    this.createdAt = Date.now();
    this.maxPlayers = 5;
    
    // Add host as first player
    this.addPlayer(hostId, hostName, true);
  }

  addPlayer(playerId, playerName, isHost = false) {
    if (this.players.size >= this.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }
    
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      isHost: isHost,
      ready: false,
      score: 0,
      combo: 0,
      accuracy: 100,
      connected: true
    });
    
    this.playerScores.set(playerId, {
      score: 0,
      combo: 0,
      maxCombo: 0,
      beatsHit: 0,
      beatsMissed: 0,
      accuracy: 100
    });
    
    this.playerReady.set(playerId, false);
    
    return { success: true };
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.playerScores.delete(playerId);
    this.playerReady.delete(playerId);
    
    // If host left, assign new host or close room
    if (playerId === this.hostId && this.players.size > 0) {
      const newHost = this.players.keys().next().value;
      this.hostId = newHost;
      const hostPlayer = this.players.get(newHost);
      if (hostPlayer) {
        hostPlayer.isHost = true;
      }
    }
    
    return this.players.size;
  }

  setPlayerReady(playerId, ready) {
    this.playerReady.set(playerId, ready);
    const player = this.players.get(playerId);
    if (player) {
      player.ready = ready;
    }
  }

  allPlayersReady() {
    for (const ready of this.playerReady.values()) {
      if (!ready) return false;
    }
    return true;
  }

  updatePlayerScore(playerId, scoreData) {
    const scores = this.playerScores.get(playerId);
    if (scores) {
      Object.assign(scores, scoreData);
    }
    
    const player = this.players.get(playerId);
    if (player) {
      player.score = scoreData.score || player.score;
      player.combo = scoreData.combo || player.combo;
      player.accuracy = scoreData.accuracy || player.accuracy;
    }
  }

  getPlayerList() {
    return Array.from(this.players.values());
  }

  getLeaderboard() {
    const leaderboard = [];
    for (const [playerId, scores] of this.playerScores.entries()) {
      const player = this.players.get(playerId);
      if (player) {
        leaderboard.push({
          id: playerId,
          name: player.name,
          ...scores
        });
      }
    }
    return leaderboard.sort((a, b) => b.score - a.score);
  }

  toJSON() {
    return {
      code: this.code,
      hostId: this.hostId,
      hostName: this.hostName,
      gameMode: this.gameMode,
      players: this.getPlayerList(),
      state: this.state,
      selectedChallenge: this.selectedChallenge,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers
    };
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', name: 'Aurora Rider Server' });
});

app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(room.toJSON());
});

app.get('/api/stats', (req, res) => {
  res.json({
    activeRooms: rooms.size,
    activePlayers: players.size
  });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Store player reference
  players.set(socket.id, {
    id: socket.id,
    name: null,
    roomCode: null
  });

  /**
   * Create a new room
   * @param {Object} data - { playerName: string, gameMode: 'classic' | 'punch' }
   */
  socket.on('createRoom', (data) => {
    const { playerName, gameMode } = data;
    
    if (!playerName || !gameMode) {
      socket.emit('error', { message: 'Player name and game mode are required' });
      return;
    }
    
    if (!['classic', 'punch'].includes(gameMode)) {
      socket.emit('error', { message: 'Invalid game mode. Choose "classic" or "punch"' });
      return;
    }
    
    // Create new room
    const room = new Room(socket.id, playerName, gameMode);
    rooms.set(room.code, room);
    
    // Update player data
    const player = players.get(socket.id);
    if (player) {
      player.name = playerName;
      player.roomCode = room.code;
    }
    
    // Join socket room
    socket.join(room.code);
    
    console.log(`Room created: ${room.code} by ${playerName} (${gameMode} mode)`);
    
    socket.emit('roomCreated', {
      roomCode: room.code,
      room: room.toJSON()
    });
  });

  /**
   * Join an existing room
   * @param {Object} data - { playerName: string, roomCode: string }
   */
  socket.on('joinRoom', (data) => {
    const { playerName, roomCode } = data;
    
    if (!playerName || !roomCode) {
      socket.emit('error', { message: 'Player name and room code are required' });
      return;
    }
    
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (room.state !== 'lobby' && room.state !== 'selecting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }
    
    const result = room.addPlayer(socket.id, playerName);
    
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }
    
    // Update player data
    const player = players.get(socket.id);
    if (player) {
      player.name = playerName;
      player.roomCode = code;
    }
    
    // Join socket room
    socket.join(code);
    
    console.log(`${playerName} joined room ${code}`);
    
    // Notify the joining player
    socket.emit('roomJoined', {
      roomCode: code,
      room: room.toJSON()
    });
    
    // Notify other players
    socket.to(code).emit('playerJoined', {
      player: room.players.get(socket.id),
      room: room.toJSON()
    });
  });

  /**
   * Leave current room
   */
  socket.on('leaveRoom', () => {
    const player = players.get(socket.id);
    if (!player || !player.roomCode) return;
    
    const room = rooms.get(player.roomCode);
    if (!room) return;
    
    const roomCode = player.roomCode;
    const remainingPlayers = room.removePlayer(socket.id);
    
    socket.leave(roomCode);
    player.roomCode = null;
    
    if (remainingPlayers === 0) {
      // Delete empty room
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} deleted (empty)`);
    } else {
      // Notify remaining players
      io.to(roomCode).emit('playerLeft', {
        playerId: socket.id,
        room: room.toJSON()
      });
    }
    
    socket.emit('leftRoom');
  });

  /**
   * Set player ready status
   * @param {Object} data - { ready: boolean }
   */
  socket.on('setReady', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomCode) return;
    
    const room = rooms.get(player.roomCode);
    if (!room) return;
    
    room.setPlayerReady(socket.id, data.ready);
    
    io.to(player.roomCode).emit('playerReady', {
      playerId: socket.id,
      ready: data.ready,
      room: room.toJSON()
    });
    
    // Check if all players are ready
    if (room.allPlayersReady() && room.players.size > 1) {
      io.to(player.roomCode).emit('allReady', {
        room: room.toJSON()
      });
    }
  });

  /**
   * Host selects a song/challenge
   * @param {Object} data - { challenge: Object }
   */
  socket.on('selectChallenge', (data) => {
    console.log('Song selected:', data.challenge ? data.challenge.id : 'no challenge');
    const player = players.get(socket.id);
    if (!player || !player.roomCode) {
      console.log('selectChallenge: No player or room code');
      return;
    }
    
    const room = rooms.get(player.roomCode);
    if (!room || room.hostId !== socket.id) {
      console.log('selectChallenge: No room or not host');
      return;
    }
    
    room.selectedChallenge = data.challenge;
    room.state = 'selecting';
    console.log('Challenge set for room', player.roomCode, ':', data.challenge.id);
    
    // Reset ready status
    for (const [playerId] of room.players) {
      room.setPlayerReady(playerId, false);
    }
    
    io.to(player.roomCode).emit('challengeSelected', {
      challenge: data.challenge,
      room: room.toJSON()
    });
  });

  /**
   * Host starts the game
   */
  socket.on('startGame', () => {
    const player = players.get(socket.id);
    if (!player || !player.roomCode) return;
    
    const room = rooms.get(player.roomCode);
    if (!room || room.hostId !== socket.id) return;
    
    if (!room.selectedChallenge) {
      socket.emit('error', { message: 'Please select a song first' });
      return;
    }
    
    room.state = 'countdown';
    
    // Reset scores
    for (const [playerId] of room.players) {
      room.playerScores.set(playerId, {
        score: 0,
        combo: 0,
        maxCombo: 0,
        beatsHit: 0,
        beatsMissed: 0,
        accuracy: 100
      });
    }
    
    io.to(player.roomCode).emit('gameStarting', {
      countdown: 5,
      challenge: room.selectedChallenge,
      gameMode: room.gameMode,
      room: room.toJSON()
    });
    
    // Start countdown
    let countdown = 5;
    const countdownInterval = setInterval(() => {
      countdown--;
      io.to(player.roomCode).emit('countdown', { count: countdown });
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        room.state = 'playing';
        io.to(player.roomCode).emit('gameStarted', {
          room: room.toJSON()
        });
      }
    }, 1000);
  });

  /**
   * Update player score during game
   * @param {Object} data - { score, combo, maxCombo, beatsHit, beatsMissed, accuracy }
   */
  socket.on('updateScore', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomCode) return;
    
    const room = rooms.get(player.roomCode);
    if (!room || room.state !== 'playing') return;
    
    room.updatePlayerScore(socket.id, data);
    
    // Broadcast to other players in room
    socket.to(player.roomCode).emit('scoreUpdate', {
      playerId: socket.id,
      playerName: player.name,
      ...data,
      leaderboard: room.getLeaderboard()
    });
  });

  /**
   * Player finished the song
   * @param {Object} data - { finalScore: Object }
   */
  socket.on('gameFinished', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomCode) return;
    
    const room = rooms.get(player.roomCode);
    if (!room) return;
    
    room.updatePlayerScore(socket.id, data.finalScore);
    
    const roomPlayer = room.players.get(socket.id);
    if (roomPlayer) {
      roomPlayer.finished = true;
    }
    
    // Count finished players
    let finishedCount = 0;
    let totalPlayers = room.players.size;
    for (const [, p] of room.players) {
      if (p.finished) {
        finishedCount++;
      }
    }
    
    console.log(`[GAME] Player ${player.name} finished. ${finishedCount}/${totalPlayers} players done.`);
    
    // Broadcast player finished to ALL players in room (including the one who finished)
    io.to(player.roomCode).emit('playerFinished', {
      playerId: socket.id,
      playerName: player.name,
      score: data.finalScore,
      playersFinished: finishedCount,
      totalPlayers: totalPlayers
    });
    
    // Check if all players finished
    if (finishedCount >= totalPlayers) {
      console.log(`[GAME] All players finished in room ${player.roomCode}. Sending results...`);
      room.state = 'results';
      
      // Small delay to let waiting screen show before results
      setTimeout(() => {
        io.to(player.roomCode).emit('gameResults', {
          leaderboard: room.getLeaderboard(),
          room: room.toJSON()
        });
      }, 1500);
    }
  });

  /**
   * Return to lobby after game
   */
  socket.on('returnToLobby', () => {
    const player = players.get(socket.id);
    if (!player || !player.roomCode) return;
    
    const room = rooms.get(player.roomCode);
    if (!room || room.hostId !== socket.id) return;
    
    room.state = 'lobby';
    room.selectedChallenge = null;
    
    // Reset all players
    for (const [playerId] of room.players) {
      room.setPlayerReady(playerId, false);
      const p = room.players.get(playerId);
      if (p) {
        p.finished = false;
      }
    }
    
    io.to(player.roomCode).emit('returnedToLobby', {
      room: room.toJSON()
    });
  });

  /**
   * Chat message
   * @param {Object} data - { message: string }
   */
  socket.on('chatMessage', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.roomCode) return;
    
    io.to(player.roomCode).emit('chatMessage', {
      playerId: socket.id,
      playerName: player.name,
      message: data.message,
      timestamp: Date.now()
    });
  });

  /**
   * Handle disconnection
   */
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    const player = players.get(socket.id);
    if (player && player.roomCode) {
      const room = rooms.get(player.roomCode);
      if (room) {
        const remainingPlayers = room.removePlayer(socket.id);
        
        if (remainingPlayers === 0) {
          rooms.delete(player.roomCode);
          console.log(`Room ${player.roomCode} deleted (empty)`);
        } else {
          io.to(player.roomCode).emit('playerLeft', {
            playerId: socket.id,
            room: room.toJSON()
          });
        }
      }
    }
    
    players.delete(socket.id);
  });
});

// Clean up old rooms periodically (rooms older than 2 hours with no activity)
setInterval(() => {
  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000;
  
  for (const [code, room] of rooms) {
    if (now - room.createdAt > twoHours && room.players.size === 0) {
      rooms.delete(code);
      console.log(`Cleaned up old room: ${code}`);
    }
  }
}, 60000); // Check every minute

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     █████╗ ██╗   ██╗██████╗  ██████╗ ██████╗  █████╗     ║
║    ██╔══██╗██║   ██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗    ║
║    ███████║██║   ██║██████╔╝██║   ██║██████╔╝███████║    ║
║    ██╔══██║██║   ██║██╔══██╗██║   ██║██╔══██╗██╔══██║    ║
║    ██║  ██║╚██████╔╝██║  ██║╚██████╔╝██║  ██║██║  ██║    ║
║    ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝    ║
║                                                           ║
║                    ██████╗ ██╗██████╗ ███████╗██████╗    ║
║                    ██╔══██╗██║██╔══██╗██╔════╝██╔══██╗   ║
║                    ██████╔╝██║██║  ██║█████╗  ██████╔╝   ║
║                    ██╔══██╗██║██║  ██║██╔══╝  ██╔══██╗   ║
║                    ██║  ██║██║██████╔╝███████╗██║  ██║   ║
║                    ╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝   ║
║                                                           ║
║            Multiplayer VR Rhythm Game Server              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

🎮 Server running on port ${PORT}
🌐 Open http://localhost:${PORT} to play
🔌 WebSocket ready for multiplayer connections
  `);
});

module.exports = { app, server, io };
