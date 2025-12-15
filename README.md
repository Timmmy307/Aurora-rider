# Aurora Rider


**An Online Multiplayer VR Rhythm Game!**

Slash beats with your friends in virtual reality. Aurora Rider is a free and open source 
rhythm game with real-time online multiplayer support, allowing you to compete with friends 
in Classic (saber) or Punch (boxing) mode.

Based on the original Moon Rider project, Aurora Rider adds exciting multiplayer features 
similar to Beat Saber's online mode!

## Features

🎮 **Game Modes:**
- **Classic Mode** - Slice beats with virtual sabers, mind color and direction
- **Punch Mode** - Box your way through beats with your fists
- **Ride Mode** - Sit back and enjoy the musical journey

🌐 **Online Multiplayer:**
- Create private rooms with 6-character join codes
- Play with up to 5 friends
- Real-time score synchronization and leaderboards
- Choose Classic or Punch mode for your room
- See live scores during gameplay

🎵 **Content:**
- Thousands of songs from BeatSaver
- Multiple difficulty levels
- Various music genres

## Quick Start

### Prerequisites
- Node.js 16+ and npm installed

### Installation

```bash
# Install dependencies
npm install

# Start the server (includes multiplayer backend)
npm start
```

Then open `http://localhost:3000` in your browser!

### Development Mode

```bash
# Run with hot-reloading for development
npm run start:dev
```

## How to Play Online

### Creating a Room

1. Click **ONLINE MODE** from the main menu
2. Click **CREATE ROOM**
3. Select your game mode:
   - **CLASSIC MODE** - Slice beats with sabers
   - **PUNCH MODE** - Punch beats with fists
4. Share the 6-character room code with friends
5. Wait for players to join and mark themselves as "Ready"
6. Click **START GAME** to begin!

### Joining a Room

1. Click **ONLINE MODE** from the main menu
2. Click **JOIN ROOM**
3. Enter the 6-character room code
4. Click **JOIN**
5. Mark yourself as "Ready" when you're set to play

### During Gameplay

- Your live score is synced with other players
- See the leaderboard on the left side of your view
- Complete the song to see final results

## Project Structure

```
aurora-rider/
├── server/           # Node.js multiplayer server
│   └── index.js      # WebSocket server with room management
├── src/
│   ├── components/   # A-Frame components
│   │   └── online-mode.js  # Multiplayer UI components
│   ├── lib/
│   │   └── multiplayer-client.js  # WebSocket client
│   ├── state/        # Game state management
│   ├── templates/    # HTML templates
│   │   └── online.html  # Online mode UI
│   └── index.js      # Main entry point
├── assets/           # Game assets (models, sounds, images)
├── vendor/           # Third-party libraries
└── package.json
```

## Server API

The multiplayer server provides both REST API and WebSocket connections:

### REST Endpoints

- `GET /api/health` - Server health check
- `GET /api/rooms/:code` - Get room information
- `GET /api/stats` - Get server statistics

### WebSocket Events

**Client → Server:**
- `createRoom` - Create a new multiplayer room
- `joinRoom` - Join an existing room
- `leaveRoom` - Leave current room
- `setReady` - Toggle ready status
- `selectChallenge` - Select a song (host only)
- `startGame` - Start the game (host only)
- `updateScore` - Send score updates during gameplay
- `gameFinished` - Signal game completion

**Server → Client:**
- `roomCreated` - Room successfully created
- `roomJoined` - Successfully joined a room
- `playerJoined` - New player joined the room
- `playerLeft` - Player left the room
- `gameStarting` - Game countdown beginning
- `countdown` - Countdown tick
- `gameStarted` - Game has started
- `scoreUpdate` - Other player's score update
- `gameResults` - Final game results

## Credits

Aurora Rider is based on [Moon Rider](https://github.com/supermedium/moonrider) by Supermedium.

- Original game by [@ngokevin](https://github.com/ngokevin) and team
- Song maps from [BeatSaver](https://beatsaver.com)
- Built with [A-Frame](https://aframe.io) and [Three.js](https://threejs.org)

## License

MIT License - Feel free to use, modify, and distribute!

---

**Enjoy slashing beats with your friends! 🎮🎵**
