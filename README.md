# ♟️ 3D Chess
> *"Think Beyond The Board."*
> *"Think. Strategize. Conquer."*

A professional, immersive 3D interactive chess application built with **React**, **Three.js / React Three Fiber**, **chess.js**, **Stockfish 19 WASM with NNUE**, and a real-time **Node.js / Socket.IO** authoritative multiplayer backend.

---

## 🏛️ Project Highlights & Features

### 1. Minimalist 3D Architectural Room
- **Matte Grey Concrete Finishing**: Realistic soft shadows, warm corner ambient gradients, and architectural clean lines.
- **Dark Polished Floor & Ceiling**: Specular reflections, recessed lighting fixtures, and contact shadows beneath the floating chessboard.
- **3D Wall Paintings with Chess Quotes**:
  - *Painting 1 (North)*: "Chess is the gymnasium of the mind." — Blaise Pascal
  - *Painting 2 (East)*: "Every chess master was once a beginner." — Irving Chernev
  - *Painting 3 (West)*: "In life, as in chess, forethought wins." — Charles Buxton
  - Dedicated warm gallery spotlights illuminating each 3D framed artwork.

### 2. Floating 3D Chessboard & Realistic Pieces
- **Floating Levitation**: Horizontally centered with a subtle sinusoidal bob animation.
- **64 Handcrafted Squares**: Alabaster light ivory squares and smokey basalt dark charcoal squares with bevelled dark walnut/titanium outer borders.
- **Realistic Staunton Chess Pieces**:
  - **White Pieces**: Pristine polished ivory / Carrara marble finish (`roughness: 0.16`, `clearcoat: 0.8`).
  - **Black Pieces**: Polished obsidian / black tourmaline marble finish (`roughness: 0.22`, `clearcoat: 0.85`).
  - Tactile selection hover, smooth parabolic translation arcs when moving across squares.
  - Interactive Pawn Promotion modal (Queen, Rook, Bishop, Knight).
  - Kingside and Queenside castling with synchronized two-piece movement.

### 3. 360-Degree Camera System
- **Orbital 3D Navigation**: Left-click drag to orbit, mouse wheel to zoom, right-click drag to pan. Touch and pinch gestures for tablet/mobile.
- **Clamped Polar Damping**: Strictly prevents camera from penetrating the floor or clipping exterior walls.
- **Dynamic Camera Presets**:
  - `FRONT VIEW`
  - `WHITE PLAYER VIEW`
  - `BLACK PLAYER VIEW`
  - `TOP VIEW`
  - `CINEMATIC VIEW` (slow, elegant continuous 360° orbital sweep)
  - `FREE 360 VIEW`
  - Quick Reset Camera button.
- **Independent Camera Rotation**: Inspecting the board from any perspective does not disrupt underlying chess logic or coordinate orientation.

### 4. Play Against Computer (Stockfish WASM + NNUE)
- **High-Strength Engine**: Powered by **Stockfish 19** with WebAssembly and Neural Network Evaluation (NNUE).
- **Dedicated Web Worker**: Calculations execute off the main UI thread to ensure 60 FPS animation smoothness with zero browser lag.
- **7 Configurable Difficulties**:
  1. *Beginner* (Elo ~800, Skill Level 1, Depth 2)
  2. *Easy* (Elo ~1200, Skill Level 4, Depth 4)
  3. *Intermediate* (Elo ~1600, Skill Level 8, Depth 8)
  4. *Advanced* (Elo ~2000, Skill Level 13, Depth 12)
  5. *Expert* (Elo ~2400, Skill Level 17, Depth 16)
  6. *Grandmaster* (Elo ~2800, Skill Level 20, Depth 20)
  7. *Maximum Engine Strength* (Elo 3500+, Skill Level 20, Depth 24+, Full NNUE evaluation targeting ~1% human win rate)
- **Thinking Indicator**: Animated non-blocking HUD alert while AI calculates moves.
- **Colour Selection**: Play as White, Black (engine plays first move instantly), or Random.

### 5. Play With Friend (Online 1v1 Multiplayer)
- **Create Room**: Generates a clean, unique 6-character room code (e.g., `CHS729`) and hosts a waiting lobby with one-click copy and sharing.
- **Join Room**: Instant code validation and player connection.
- **Authoritative Server Validation**: Server validates every legal move with `chess.js`, strictly blocking out-of-turn attempts, illegal piece movements, unauthorized moves, or invalid promotions.
- **Real-Time Synchronization**: Moves, clocks, captured pieces, check states, draw offers, and resignations are synchronized instantly over Socket.IO.
- **Reconnection Grace Period**: Disconnections trigger a 60-second recovery window allowing players to restore active sessions without losing state.

### 6. Official FIDE Chess Rules & Visual Aids
- Complete move verification: standard pieces, en passant, castling, promotion, check, checkmate, stalemate, 3-fold repetition, 50-move rule, and insufficient material.
- **Visual Indicators**:
  - Selected square: Golden glowing border and ground ring.
  - Legal destinations: Emerald dot for empty squares, ruby target ring for captures.
  - Last move: Subtle warm amber illumination on `from` and `to` squares.
  - King in check: Pulsing crimson aura directly beneath the checked King.

### 7. Sound Design & Audio Synthesis
- Built using the **Web Audio API** (zero external MP3 dependencies, zero broken links, ultra-low latency):
  - Tactile piece selection clicks
  - Warm wooden board move placement
  - Heavy capture impact clack
  - Crisp check warning chime
  - Dramatic checkmate chord
  - Ascending pawn promotion fanfare
  - Clock countdown audio ticks for critical time (&le; 10s)
  - Victory fanfare, defeat melody, and draw bells.

---

## 🏗️ Architecture & Project Structure

```
grand-chess-room/
│
├── frontend/
│   ├── public/
│   │   ├── stockfish/           # Stockfish 19 WASM and ASM binaries
│   │   └── stockfishWorker.js   # Dedicated Web Worker bridge
│   ├── src/
│   │   ├── audio/
│   │   │   └── soundManager.ts  # Web Audio API procedural sound synthesizer
│   │   ├── chess/
│   │   │   ├── chessLogic.ts    # chess.js reactive controller & rules engine
│   │   │   ├── stockfishEngine.ts # Stockfish controller & minimax fallback
│   │   │   └── types.ts         # FIDE definitions, difficulties, presets
│   │   ├── components/
│   │   │   ├── CameraController.tsx # 360 OrbitControls & preset lerp transitions
│   │   │   ├── CapturedPieces.tsx   # Material evaluation advantage (+3, +5)
│   │   │   ├── ChessBoard3D.tsx     # 64 squares grid, bevelled border, highlights
│   │   │   ├── ChessPiece3D.tsx     # Staunton procedural 3D piece geometries
│   │   │   ├── GameClock.tsx        # Clocks with increment & low-time warnings
│   │   │   ├── GameHUD.tsx          # Glassmorphism overlay HUD & controls
│   │   │   ├── GameResult.tsx       # Celebration modal with confetti
│   │   │   ├── HowToPlayModal.tsx   # Rules and controls guide
│   │   │   ├── MainMenu.tsx         # Landing screen & game setup drawer
│   │   │   ├── MoveHistory.tsx      # Interactive SAN history & review mode
│   │   │   ├── PawnPromotionModal.tsx # Visual Queen/Rook/Bishop/Knight selector
│   │   │   ├── RoomEnvironment.tsx  # Architectural room, paintings, spotlights
│   │   │   ├── RoomLobby.tsx        # Create & Join Room interface
│   │   │   ├── SettingsModal.tsx    # Graphics (Low..Ultra) & Audio settings
│   │   │   └── ThinkingIndicator.tsx# AI calculation status pill
│   │   ├── multiplayer/
│   │   │   └── socketClient.ts  # Socket.IO client interface
│   │   ├── scenes/
│   │   │   └── ChessRoom.tsx    # R3F Canvas container with dynamic quality
│   │   ├── store/
│   │   │   └── gameStore.ts     # Central Zustand state store
│   │   ├── styles/
│   │   │   └── index.css        # Tailwind styling & typography
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/
│   ├── src/
│   │   ├── security/
│   │   │   ├── rateLimiter.ts      # DoS protection & socket request rate limiter
│   │   │   └── sessionValidator.ts # Session token & room code generator
│   │   ├── services/
│   │   │   ├── clockService.ts     # Authoritative server clocks & increments
│   │   │   ├── gameService.ts      # Authoritative chess.js validation
│   │   │   └── roomService.ts      # Session & room lifecycle manager
│   │   ├── socket/
│   │   │   ├── gameEvents.ts       # Socket event handlers for moves, resign, draw
│   │   │   └── roomEvents.ts       # Socket event handlers for room create, join
│   │   ├── tests/
│   │   │   ├── chessRules.test.ts      # Comprehensive FIDE rules automated tests
│   │   │   └── multiplayerFlow.test.ts # End-to-end 1v1 socket test
│   │   └── server.ts               # Express & Socket.IO server bootstrap
│   ├── package.json
│   └── tsconfig.json
│
├── package.json
├── .env.example
└── README.md
```

---

## 🚀 Getting Started

### Option A: Using VS Code "Go Live" (Live Server)
1. Click the **"Go Live"** button in the bottom status bar of VS Code (or right-click `index.html` at the project root and click **"Open with Live Server"**).
2. The browser will open `http://127.0.0.1:5500/` and immediately render **THE GRAND CHESS ROOM** in full 3D!

> **Note**: For online 1v1 multiplayer with friends, also ensure the backend server is running via `npm run dev:backend`.

### Option B: Running via Vite Development Server (with Hot Module Replacement)
1. In one terminal, start the backend:
   ```bash
   npm run dev:backend
   ```
2. In another terminal, start the Vite frontend:
   ```bash
   npm run dev:frontend
   ```
3. Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Quality Assurance

Both the backend chess rules engine and the real-time 1v1 multiplayer socket integration include automated test suites:

### Run FIDE Chess Rules Tests:
```bash
cd backend
npm run test:rules
```
*Verifies legal/illegal piece movement, castling, castling-through-check rejection, en passant, promotion, checkmate (Fool's mate), clock ticks, and room generation.*

### Run Multiplayer Socket Integration Test:
```bash
cd backend
npx tsx src/tests/multiplayerFlow.test.ts
```
*Connects two live Socket.IO clients, creates a room, joins via code, tests legal move broadcast, verifies rejection of out-of-turn moves, and validates turn transitions.*

### Run Complete Project Build:
```bash
npm run build
```

---

## 🌐 Production Deployment

> **Important Architecture Note:** Vercel static/serverless hosting does **not** support persistent Socket.IO/WebSocket connections or stateful in-memory game rooms. Deploy `frontend/` to Vercel and deploy `backend/` separately to a persistent Node WebSocket host (Render, Railway, Fly.io, etc.), then set Vercel's `VITE_SOCKET_URL` to your deployed `https://` backend URL (never `http://localhost:4000`).

### 1. Backend Deployment (Render Blueprint / Docker / Railway / Fly.io)
- Using **Render**: Connect the GitHub repository (`render.yaml` at project root auto-configures `chessverse3d-backend` in `backend/` with `/health` check).
- Using **Docker / Railway / Fly.io**: Build from [`backend/Dockerfile`](backend/Dockerfile).
- Environment variables:
  ```env
  PORT=4000
  NODE_ENV=production
  CORS_ORIGIN=https://your-vercel-app.vercel.app
  ```

### 2. Frontend Deployment (Vercel)
1. Set the root directory to `frontend`.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set environment variable (must be your HTTPS WebSocket backend URL, never `localhost`):
   ```env
   VITE_SOCKET_URL=https://your-backend-service.onrender.com
   ```

---

## 📜 License
MIT License — free for educational, personal, and commercial development.

