import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { socketClient, RoomData } from '../multiplayer/socketClient';
import { TIME_CONTROLS, TimeControlPreset } from '../chess/types';
import {
  Users,
  PlusCircle,
  LogIn,
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const RoomLobby: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'select' | 'create' | 'join' | 'waiting'>('select');
  const [playerName, setPlayerName] = useState('Grandmaster');
  const [joinCode, setJoinCode] = useState('');
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControlPreset>(TIME_CONTROLS[5]); // Rapid 10+0
  const [preferredColor, setPreferredColor] = useState<'w' | 'b' | 'random'>('w');
  const [createdRoom, setCreatedRoom] = useState<RoomData | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const creatingRef = useRef(false);
  const opponentHandlerRef = useRef<((payload: any) => void) | null>(null);
  const stateHandlerRef = useRef<((roomPayload: any) => void) | null>(null);

  const startMultiplayerGame = useGameStore((s) => s.startMultiplayerGame);
  const setGameMode = useGameStore((s) => s.setGameMode);

  const cleanupWaitingListener = () => {
    const s = socketClient.getSocket();
    if (s) {
      if (opponentHandlerRef.current) {
        s.off('room:opponent-connected', opponentHandlerRef.current);
      }
      if (stateHandlerRef.current) {
        s.off('game:state', stateHandlerRef.current);
      }
    }
    opponentHandlerRef.current = null;
    stateHandlerRef.current = null;
  };

  useEffect(() => {
    socketClient.warmUp();
    return () => {
      cleanupWaitingListener();
    };
  }, []);

  // Sanitize input strictly to 6 numeric digits (preserves leading zeroes)
  const sanitizeSixDigits = (raw: string): string => {
    return raw.replace(/\D/g, '').slice(0, 6);
  };

  // Handle Room Creation
  const handleCreateRoom = () => {
    if (creatingRef.current || loading) return;
    creatingRef.current = true;
    setLoading(true);
    setErrorMsg(null);
    cleanupWaitingListener();

    socketClient.createRoom(
      playerName.trim() || 'Grandmaster',
      selectedTimeControl,
      preferredColor,
      (res) => {
        creatingRef.current = false;
        setLoading(false);
        if (res.success && res.room && res.player) {
          const room = res.room;
          const player = res.player;
          setCreatedRoom(room);
          setActiveTab('waiting');

          const s = socketClient.getSocket();
          if (s) {
            let started = false;
            const beginWhenReady = (latestRoom: RoomData) => {
              if (started) return;
              started = true;
              cleanupWaitingListener();
              startMultiplayerGame(latestRoom, player.color, selectedTimeControl, true);
            };
            const onOpponentConnected = (payload: any) => {
              beginWhenReady(payload?.room || room);
            };
            const onGameState = (roomPayload: any) => {
              if (roomPayload && roomPayload.roomId === room.roomId && roomPayload.status === 'active') {
                beginWhenReady(roomPayload);
              }
            };
            opponentHandlerRef.current = onOpponentConnected;
            stateHandlerRef.current = onGameState;
            s.once('room:opponent-connected', onOpponentConnected);
            s.on('game:state', onGameState);
          }
        } else {
          setErrorMsg(res.error || 'Failed to create room on server. Please try again.');
        }
      }
    );
  };

  // Handle Room Joining
  const handleJoinRoom = () => {
    if (loading) return;
    const cleaned = sanitizeSixDigits(joinCode);
    if (cleaned.length !== 6 || !/^\d{6}$/.test(cleaned)) {
      setErrorMsg('Please enter a complete 6-digit numeric room code.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    socketClient.joinRoom(cleaned, playerName.trim() || 'Challenger', (res) => {
      setLoading(false);
      if (res.success && res.room && res.player) {
        const room = res.room;
        const player = res.player;
        const matchedTc =
          TIME_CONTROLS.find(
            (t) =>
              t.minutes === room.timeControl.initialMinutes &&
              t.increment === room.timeControl.incrementSeconds
          ) || selectedTimeControl;

        startMultiplayerGame(room, player.color, matchedTc, false);
      } else {
        setErrorMsg(res.error || 'Failed to join room. Verify the 6-digit code and try again.');
      }
    });
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (activeTab === 'waiting') {
      cleanupWaitingListener();
      socketClient.leaveRoom();
      setCreatedRoom(null);
      setActiveTab('select');
    } else if (activeTab === 'select') {
      setGameMode('menu');
    } else {
      setActiveTab('select');
    }
  };

  const copyToClipboard = () => {
    if (createdRoom) {
      navigator.clipboard?.writeText(createdRoom.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-[#f7f7f4] border border-[#c6a45c]/40 rounded-3xl p-5 sm:p-8 shadow-2xl text-[#202226] max-h-[90dvh] overflow-y-auto">
        {/* Back Button */}
        <button
          type="button"
          onClick={handleBack}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-xs text-[#666762] hover:text-[#202226] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Title */}
        <div className="text-center mb-6 mt-2">
          <div className="inline-flex p-3 rounded-2xl bg-[#c6a45c]/15 border border-[#c6a45c]/30 text-[#c6a45c] mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#202226]">PLAY WITH FRIEND</h2>
          <p className="text-xs text-[#666762] mt-1">Real-time synchronized 1v1 online chess</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs font-semibold"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: SELECTION MENU (CREATE vs JOIN) */}
        {activeTab === 'select' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setActiveTab('create');
              }}
              className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-[#d6d6d2] hover:border-[#c6a45c] transition-all group active:scale-95 cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="p-4 rounded-full bg-[#c6a45c]/15 text-[#c6a45c] group-hover:scale-110 transition-transform mb-3">
                <PlusCircle className="w-8 h-8" />
              </div>
              <span className="font-serif font-bold text-base text-[#202226] group-hover:text-[#c6a45c]">
                CREATE A ROOM
              </span>
              <span className="text-xs text-[#666762] text-center mt-1">
                Host a match and invite your friend with a 6-digit code
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setJoinCode(''); // Ensure join input always opens completely empty
                setActiveTab('join');
              }}
              className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-[#d6d6d2] hover:border-[#c6a45c] transition-all group active:scale-95 cursor-pointer shadow-sm hover:shadow-md"
            >
              <div className="p-4 rounded-full bg-[#666762]/10 text-[#202226] group-hover:scale-110 transition-transform mb-3">
                <LogIn className="w-8 h-8" />
              </div>
              <span className="font-serif font-bold text-base text-[#202226] group-hover:text-[#c6a45c]">
                JOIN A ROOM
              </span>
              <span className="text-xs text-[#666762] text-center mt-1">
                Enter a 6-digit room code to connect to an existing game
              </span>
            </button>
          </div>
        )}

        {/* TAB 2: CREATE ROOM OPTIONS */}
        {activeTab === 'create' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#666762] mb-1">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6d6d2] text-[#202226] text-sm focus:outline-none focus:border-[#c6a45c]"
                placeholder="Enter your name"
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#666762] mb-1">Preferred Colour</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'w', label: 'White' },
                  { id: 'b', label: 'Black' },
                  { id: 'random', label: 'Random' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPreferredColor(c.id as any)}
                    className={`py-2 rounded-xl text-xs font-serif font-bold border transition-all cursor-pointer ${
                      preferredColor === c.id
                        ? 'bg-[#c6a45c] text-white border-[#c6a45c] shadow-sm'
                        : 'bg-white border-[#d6d6d2] text-[#666762] hover:border-[#c6a45c]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#666762] mb-1">Time Control</label>
              <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                {TIME_CONTROLS.map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setSelectedTimeControl(tc)}
                    className={`p-2 rounded-xl text-xs border text-center transition-all cursor-pointer ${
                      selectedTimeControl.id === tc.id
                        ? 'bg-[#c6a45c] text-white font-bold border-[#c6a45c]'
                        : 'bg-white border-[#d6d6d2] text-[#666762] hover:border-[#c6a45c]'
                    }`}
                  >
                    <div className="font-semibold">{tc.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#c6a45c] hover:bg-[#b5934a] text-white font-serif font-bold text-sm tracking-wider uppercase transition-all shadow-glow-gold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Creating Room...' : 'Create Room & Get Code'}</span>
            </button>
          </div>
        )}

        {/* TAB 3: JOIN ROOM INPUT (Strictly Empty 6-Digit Numeric Input — No CHS Prefix) */}
        {activeTab === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#666762] mb-1">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6d6d2] text-[#202226] text-sm focus:outline-none focus:border-[#c6a45c]"
                placeholder="Enter your name"
                maxLength={20}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="room-code-input" className="block text-xs font-semibold text-[#666762]">
                  Enter 6-Digit Room Code
                </label>
                <span className="text-[11px] font-mono text-[#a7a8a5]">{joinCode.length}/6 digits</span>
              </div>
              <input
                id="room-code-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={joinCode}
                onChange={(e) => {
                  setErrorMsg(null);
                  setJoinCode(sanitizeSixDigits(e.target.value));
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text') || '';
                  setErrorMsg(null);
                  setJoinCode(sanitizeSixDigits(pasted));
                }}
                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-[#c6a45c]/50 text-[#202226] text-center font-mono text-xl tracking-[0.3em] focus:outline-none focus:border-[#c6a45c]"
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
            </div>

            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#c6a45c] hover:bg-[#b5934a] text-white font-serif font-bold text-sm tracking-wider uppercase transition-all shadow-glow-gold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Connecting...' : 'Join Match'}</span>
            </button>
          </div>
        )}

        {/* TAB 4: WAITING LOBBY (ROOM CREATOR WAITING) */}
        {activeTab === 'waiting' && createdRoom && (
          <div className="text-center py-2 space-y-5 animate-fade-in">
            <div className="inline-flex p-3 rounded-full bg-[#c6a45c]/15 text-[#c6a45c] border border-[#c6a45c]/30">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-serif font-bold text-[#202226]">ROOM CREATED SUCCESSFULLY</h3>
              <p className="text-xs text-[#666762] mt-1">Share this 6-digit code with your friend:</p>
            </div>

            {/* Room Code Badge */}
            <div className="p-4 rounded-2xl bg-white border-2 border-[#c6a45c] inline-block w-full max-w-xs shadow-glow-gold">
              <div className="text-xs text-[#666762] uppercase tracking-widest mb-1 font-semibold">Room Code</div>
              <div
                data-testid="created-room-code"
                className="text-3xl font-mono font-extrabold text-[#c6a45c] tracking-[0.25em]"
              >
                {createdRoom.roomCode}
              </div>
            </div>

            {/* Copy / Share Button */}
            <div className="flex gap-2 justify-center max-w-xs mx-auto">
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#c6a45c]/15 hover:bg-[#c6a45c]/25 border border-[#c6a45c] text-[#202226] text-xs font-serif font-bold transition-all cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#c6a45c]" />}
                <span>{copied ? 'Copied Code!' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Waiting Spinner */}
            <div className="flex items-center justify-center gap-2 text-xs text-[#666762] pt-3 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-[#c6a45c]" />
              <span>Waiting for opponent to connect...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
