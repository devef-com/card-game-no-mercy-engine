"use client";

import { useEffect, useState } from "react";
import { getRoomState } from "@/src/actions/room";
import { startGame, playCard, drawCard, chooseColor } from "@/src/actions/game";
import { useRouter } from "next/navigation";
import { Card } from "@/src/lib/game-logic";
import { cn } from "@/src/lib/utils";
import CardComponent from "./Card";
import { useToast } from "@/src/components/base-ui/toast";

type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: string;
};

type Room = {
  id: string;
  code: string;
  hostId: string;
  status: string;
};

interface RoomClientProps {
  room: Room;
  currentUser: User;
  players: User[];
}

type GameState = NonNullable<Awaited<ReturnType<typeof getRoomState>>>;

export function RoomClient({ room: initialRoom, currentUser, players: initialPlayers }: RoomClientProps) {
  const [room, setRoom] = useState(initialRoom);
  const [players, setPlayers] = useState(initialPlayers);
  const [activeGame, setActiveGame] = useState<GameState['activeGame'] | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedWildCardId, setSelectedWildCardId] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const router = useRouter();
  const { add: toast } = useToast();
  // const toastManager = Toast.useToastManager();

  useEffect(() => {
    const interval = setInterval(async () => {
      const state = await getRoomState(room.code);
      if (state) {
        setRoom(state.room);
        setPlayers(state.players);
        setActiveGame(state.activeGame);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room.code]);

  const isHost = room.hostId === currentUser.id;

  const isMyTurn = activeGame && activeGame.currentTurnUserId === currentUser.id;

  useEffect(() => {
    if (isMyTurn) {
      // show blicking indicator or play sound
      setShowFlash(true);
      const timeout = setTimeout(() => setShowFlash(false), 1000);

      return () => clearTimeout(timeout);
    }
  }, [isMyTurn]);

  if (room.status === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-4">
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2">Room: {room.code}</h1>
          <p className="text-center text-gray-500 mb-8">Waiting for players...</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {players.map((player) => (
              <div key={player.id} className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {player.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{player.name}</p>
                  {player.id === room.hostId && <span className="text-xs text-yellow-500">Host</span>}
                </div>
              </div>
            ))}
          </div>

          {isHost && (
            <button
              className="w-full py-4 bg-green-600 text-white rounded-lg text-xl font-bold hover:bg-green-700 transition-colors"
              onClick={() => startGame(room.id)}
            >
              Start Game
            </button>
          )}

          {!isHost && (
            <p className="text-center text-gray-500 italic">Waiting for host to start...</p>
          )}
        </div>
      </div>
    );
  }

  if (room.status === "playing" && activeGame) {
    type Player = Omit<typeof activeGame.players[number], 'hand'> & { hand: Card[] };
    const myPlayer = activeGame.players.find((p) => p.userId === currentUser.id) as Player | undefined;
    const isMyTurn = activeGame.currentTurnUserId === currentUser.id;
    //@ts-ignore TODO as discardPile its json, we have the missing type info
    const topCard = activeGame.discardPile[activeGame.discardPile.length - 1];

    // Force update if roulette status is pending and it's my turn
    if (isMyTurn && activeGame.rouletteStatus === "pending_color" && !showColorPicker) {
      // This is handled by the render condition below, but we ensure state is clean
    }

    const { drawPile, ...more } = activeGame;
    return (
      <div className="flex flex-col items-center min-h-svh bg-black p-4 text-white relative">
        <details>
          <pre className="text-xs">{JSON.stringify(more, null, 2)}</pre>
        </details>
        {(showColorPicker || (isMyTurn && activeGame.rouletteStatus === "pending_color")) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl">
              <h3 className="text-xl font-bold mb-4 text-center text-black dark:text-white">
                {activeGame.rouletteStatus === "pending_color" ? "Choose Color (Roulette)" : "Choose Color"}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {["red", "blue", "green", "yellow"].map((color) => (
                  <button
                    key={color}
                    className={`w-24 h-24 rounded-lg ${getBgColorClass(color)} hover:opacity-80 transition-opacity`}
                    onClick={async () => {
                      // TODO wtf with server function of nextjs, this needs to be changed to regular api call
                      if (activeGame.rouletteStatus === "pending_color") {
                        const res = await chooseColor(activeGame.id, color as any);
                        if ('error' in (res || {})) {
                          toast({ title: "Error choosing color", description: res?.error, timeout: 2000 });
                        }
                      } else if (selectedWildCardId) {
                        const res = await playCard(activeGame.id, selectedWildCardId, color)
                        if ('error' in (res || {})) {
                          toast({ title: "Error playing card", description: res?.error, timeout: 2000 });
                        }
                        setShowColorPicker(false);
                        setSelectedWildCardId(null);
                      }
                    }}
                  />
                ))}
              </div>
              {activeGame.rouletteStatus !== "pending_color" && (
                <button
                  className="mt-4 w-full py-2 bg-gray-200 text-black rounded hover:bg-gray-300"
                  onClick={() => {
                    setShowColorPicker(false);
                    setSelectedWildCardId(null);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between w-full max-w-4xl mb-4">
          <div>
            <h2 className="text-xs font-bold opacity-50">{room.code}</h2>
            <p className="text-sm">Color: <span className={`font-bold ${getTextColorClass(activeGame.currentColor || 'wild')}`}>{activeGame.currentColor?.toUpperCase()}</span></p>
            {activeGame.stackedPenalty > 0 && <p className="text-red-500 font-bold text-xl animate-pulse">+{activeGame.stackedPenalty}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm opacity-70">{activeGame.direction === 1 ? "Clockwise" : "Counter-Clockwise"}</p>
          </div>
        </div>

        <div className={cn(
          "text-2xl font-extrabold mb-4 animate-bounce z-30",
          isMyTurn ? `block ${getTextColorClass(activeGame.currentColor || 'wild')}` : "hidden text-white"
        )}>
          Tu turno
        </div>

        <div className="relative w-full max-w-2xl aspect-square flex items-center justify-center mb-8 mt-4">
          {/* Direction Arrows SVG */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <defs>
              <marker id="arrowhead" markerWidth="3" markerHeight="2" refX="2.5" refY="1" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0 0, 3 1, 0 2" fill="currentColor" />
              </marker>
              <marker id="arrowhead-active" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0 0, 5 1.75, 0 3.5" fill="currentColor" />
              </marker>
            </defs>
            {activeGame.players.map((p: any, i: number) => {
              const playerCount = activeGame.players.length;
              const nextIndex = (i + activeGame.direction + playerCount) % playerCount;

              const radius = 32; // Slightly inside the players
              const angle1 = (i / playerCount) * 2 * Math.PI - Math.PI / 2;
              const angle2 = (nextIndex / playerCount) * 2 * Math.PI - Math.PI / 2;

              // Offset the start and end points to create a gap between arrows
              const offset = 0.25;
              const x1 = 50 + radius * Math.cos(angle1 + (activeGame.direction * offset));
              const y1 = 50 + radius * Math.sin(angle1 + (activeGame.direction * offset));
              const x2 = 50 + radius * Math.cos(angle2 - (activeGame.direction * offset));
              const y2 = 50 + radius * Math.sin(angle2 - (activeGame.direction * offset));

              const isCurrentPath = activeGame.currentTurnUserId === p.userId;

              return (
                <path
                  key={`arrow-${i}`}
                  d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 ${activeGame.direction === 1 ? 1 : 0} ${x2} ${y2}`}
                  stroke="currentColor"
                  strokeWidth={isCurrentPath ? "1" : "0.7"}
                  fill="none"
                  markerEnd={isCurrentPath ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                  className={cn(
                    "transition-all duration-500",
                    isCurrentPath ? "text-yellow-400 animate-pulse" : "text-white/20"
                  )}
                />
              );
            })}
          </svg>

          {/* Players */}
          {activeGame.players.map((p: any, i: number) => {
            const playerCount = activeGame.players.length;
            const angle = (i / playerCount) * 2 * Math.PI - Math.PI / 2;
            const radius = 42; // %
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            const user = players.find(u => u.id === p.userId);
            const isCurrent = activeGame.currentTurnUserId === p.userId;

            return (
              <div
                key={p.userId}
                className={cn(
                  "absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500 z-20",
                  isCurrent ? "scale-110" : "scale-100"
                )}
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2",
                  isCurrent ? "bg-yellow-400 border-white text-black shadow-[0_0_15px_rgba(250,204,21,0.5)]" : "bg-zinc-800 border-zinc-600 text-white",
                  p.isEliminated && "opacity-50 grayscale"
                )}>
                  {user?.name[0].toUpperCase()}
                </div>
                <div className="mt-1 text-center bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
                  <p className={cn("text-xs font-bold truncate max-w-20", isCurrent ? "text-yellow-400" : "text-white", p.isEliminated && "text-red-600 line-through font-extrabold")}>
                    {user?.name}
                  </p>
                  <p className="text-[10px] opacity-70">{p.cardCount} cards</p>
                </div>
              </div>
            );
          })}

          {/* Center Piles */}
          <div className="flex gap-4 scale-90 sm:scale-100 z-10">
            <div
              className={cn(
                "w-20 h-28 sm:w-25 sm:h-37 bg-blue-900 rounded-lg border-2 border-white flex flex-col items-center justify-center cursor-pointer hover:bg-blue-800 transition-all",
                isMyTurn && "ring-4 ring-yellow-400"
              )}
              onClick={() => isMyTurn && drawCard(activeGame.id)}
            >
              <p className="font-bold text-xs sm:text-base">Draw</p>
              <p className="text-[10px] sm:text-xs font-extralight">{(activeGame.drawPile as Array<any>).length}</p>
            </div>

            <div className={cn(
              "w-20 h-28 sm:w-25 sm:h-37 rounded-lg border-2 flex flex-col items-center justify-center overflow-hidden transition-all",
              topCard.type === "number"
                ? [getBgColorClass(topCard.color), "text-white border-white"]
                : ["bg-white border-gray-300", getTextColorClass(topCard.color)]
            )}>
              {topCard.type === "number" ? (
                <span className="text-3xl sm:text-4xl font-bold">{topCard.value}</span>
              ) : (
                <CardComponent color={topCard.color} type={topCard.type} className="w-full h-full" />
              )}
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-6xl overflow-x-auto p-4">
          <h3 className="text-xl font-bold mb-4 text-center">Your Hand ({myPlayer?.hand.length}) {(myPlayer?.hand ?? []).length >= 20 && <span className="text-red-500 animate-pulse">DANGER!</span>}</h3>
          <div className={cn("flex flex-wrap justify-center gap-0 rounded-sm")}
          // style={{
          //   backgroundColor: {
          //     'blue': 'rgba(0, 0, 255, 0.4)',
          //     'red': 'rgba(255, 0, 0, 0.4)',
          //     'green': 'rgba(0, 255, 0, 0.4)',
          //     'yellow': 'rgba(255, 255, 0, 0.4)',
          //     'wild': 'rgba(139, 92, 246, 0.4)',
          //   }[activeGame.currentColor as string]
          // }}
          >
            {myPlayer?.hand.map((card: Card) => (
              <div
                key={card.id}
                className={cn(
                  "w-24 h-36 rounded-lg border-2 flex flex-col items-center justify-center shadow-lg transform hover:-translate-y-4 transition-transform cursor-pointer overflow-hidden scale-80",
                  card.type === "number"
                    ? [getBgColorClass(card.color), "text-white border-white"]
                    : ["bg-dark border-gray-300", getTextColorClass(card.color)],
                  isMyTurn ? "hover:border-yellow-400" : "opacity-80"
                )}
                onClick={async () => {
                  if (isMyTurn) {
                    if (card.color === "wild" && card.type !== "wild_color_roulette") {
                      setSelectedWildCardId(card.id);
                      setShowColorPicker(true);
                    } else {
                      const res = await playCard(activeGame.id, card.id)
                      if ('error' in (res || {})) {
                        toast({ title: "Error playing card", description: res?.error, timeout: 1000 });
                      }
                    }
                  }
                }}
              >
                {card.type === 'number' ? (
                  <span className="text-2xl font-bold text-center">{card.value}</span>
                ) : (
                  <CardComponent color={card.color} type={card.type} className="w-full h-full" />
                )}
                {/* <p className="text-white text-xs absolute top-0">{card.type} - {card.color}</p> */}
              </div>
            ))}
          </div>
        </div>
        <div className="hidden gap-2">
          <div className="w-24 h-36">
            <CardComponent color={"green"} type={"skip"} className="w-full h-full" />
          </div>
        </div>
        <div className={cn(
          "fixed inset-0 flex items-center justify-center bg-yellow-400/20 pointer-events-none transition-all duration-500",
          showFlash ? "opacity-100 scale-100" : "opacity-0 scale-105"
        )}>
          <p className="text-6xl font-black text-yellow-400 uppercase italic drop-shadow-2xl">
            Your Turn!
          </p>
        </div>

        <div className={cn("fixed top-4 left-4 rounded-lg p-3 text-sm text-white border border-white/30", getBgColorClassBlur(activeGame.currentColor || 'wild'), ' backdrop-blur-md w-6 h-9')}>

        </div>

        <div className={cn(
          'fixed bottom-10 left-4 rounded-lg',
          topCard.type === 'number' ? getBgColorClassBlur(topCard.color || 'wild') : '',
          'backdrop-blur-[1px] aspect-[0.7] flex items-center justify-center'
        )}>
          {topCard.type != 'number' ? (
            <figure className="w-12 h-18 m-1 rounded-sm border border-white/30">
              <CardComponent color={topCard.color} type={topCard.type} className="w-full h-full" />
            </figure>
          ) : (
            <span className="text-xl font-bold text-white mx-4 my-2">
              {topCard.type == 'number' ? topCard.value : '..'}
            </span>
          )}
        </div>

        {myPlayer?.isEliminated && (
          <div className="fixed inset-0 bg-red-900/20 backdrop-blur-[0px] flex flex-col items-center justify-end z-60 pointer-events-auto cursor-not-allowed">
            <div className="bg-red-600/80 px-8 py-4 rounded-full border-4 border-white shadow-2xl transform -rotate-12">
              <h1 className="text-2xl font-black text-white uppercase italic select-none">
                ELIMINATED
              </h1>
            </div>
            <p className="mt-8 text-2xl font-bold text-white drop-shadow-lg bg-black/50 px-4 py-2 rounded mb-4 select-none">
              You are spectating the match
            </p>
          </div>
        )}
      </div>
    );
  }

  if (room.status === "finished") {
    // Sort players by rank: winner first, then by card count (fewer is better), eliminated last
    const sortedPlayers = activeGame?.players 
      ? [...activeGame.players].sort((a, b) => {
          // Winner always first
          if (a.userId === activeGame.winnerId) return -1;
          if (b.userId === activeGame.winnerId) return 1;
          
          // Eliminated players last
          if (a.isEliminated && !b.isEliminated) return 1;
          if (!a.isEliminated && b.isEliminated) return -1;
          
          // If both eliminated or both not, sort by card count
          return a.cardCount - b.cardCount;
        })
      : [];

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black p-4">
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-8">
          <h1 className="text-4xl font-bold text-center mb-8">🎉 Game Over! 🎉</h1>
          
          {activeGame?.winnerId && (
            <div className="text-center mb-8 p-6 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-500">
              <h2 className="text-3xl font-bold text-green-600 dark:text-green-400">
                👑 {players.find(p => p.id === activeGame.winnerId)?.name} Won!
              </h2>
            </div>
          )}

          {sortedPlayers.length > 0 && (
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-4 text-center">Final Rankings</h3>
              <div className="space-y-3">
                {sortedPlayers.map((player, index) => {
                  const user = players.find(u => u.id === player.userId);
                  const isWinner = player.userId === activeGame?.winnerId;
                  const position = index + 1;
                  
                  return (
                    <div 
                      key={player.userId}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg",
                        isWinner 
                          ? "bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500"
                          : player.isEliminated
                          ? "bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700"
                          : "bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                          isWinner ? "bg-yellow-500 text-white" : "bg-gray-300 dark:bg-zinc-700 text-gray-700 dark:text-gray-300"
                        )}>
                          {position}
                        </div>
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {(user?.name && user.name[0]?.toUpperCase()) || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-lg">{user?.name || 'Unknown Player'}</p>
                          {player.isEliminated && (
                            <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
                              Eliminated (Mercy Rule)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Cards Left</p>
                        <p className="text-2xl font-bold">{player.cardCount}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            className="w-full py-4 bg-blue-600 text-white rounded-lg text-xl font-bold hover:bg-blue-700 transition-colors"
            onClick={() => router.push("/")}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl">Loading...</h1>
    </div>
  );
}

const BG_COLORS: Record<string, string> = {
  red: "bg-red-600",
  blue: "bg-blue-600",
  green: "bg-green-600",
  yellow: "bg-yellow-400",
  wild: "bg-purple-600",
};

const TEXT_COLORS: Record<string, string> = {
  red: "text-red-600",
  blue: "text-blue-600",
  green: "text-green-600",
  yellow: "text-yellow-600",
  wild: "text-purple-600",
} as const;

function getTextColorClass(color: string) {
  if (color === "wild") return "text-purple-600";
  return TEXT_COLORS[color] || "text-black";
}

function getBgColorClass(color: string) {
  if (color === "wild") return "bg-purple-600";
  return BG_COLORS[color] || "bg-gray-800";
}

function getBgColorClassBlur(color: string) {
  if (color === "wild") return "bg-purple-600";
  const colors: Record<string, string> = {
    red: "bg-red-600/90",
    blue: "bg-blue-600/90",
    green: "bg-green-600/90",
    yellow: "bg-yellow-400/90",
    wild: "bg-purple-600/90",
  }
  return colors[color] || "bg-gray-800/90";
}