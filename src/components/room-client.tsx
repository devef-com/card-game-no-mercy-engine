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
            <h2 className="text-xs font-bold">{room.code}</h2>
            <p>Direction: {activeGame.direction === 1 ? "Clockwise" : "Counter-Clockwise"}</p>
            <p>Color: <span className={`font-bold ${getTextColorClass(activeGame.currentColor || 'wild')}`}>{activeGame.currentColor?.toUpperCase()}</span></p>
            {activeGame.stackedPenalty > 0 && <p className="text-red-500 font-bold text-2xl animate-pulse">Acumulado: +{activeGame.stackedPenalty}</p>}
          </div>
          <div>
            <h3 className="font-bold">Players:</h3>
            {activeGame.players.map((p: any) => {
              const user = players.find(u => u.id === p.userId);
              return (
                <div key={p.userId} className={cn("flex items-center gap-2", activeGame.currentTurnUserId === p.userId && "text-yellow-300 font-bold")}>
                  <span>{user?.name}</span>
                  <span>({p.cardCount} cards)</span>
                  {p.isEliminated && <span className="text-red-500">(Eliminated)</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn(
          "text-2xl font-extrabold mb-4 animate-bounce",
          isMyTurn ? `block ${getTextColorClass(activeGame.currentColor || 'wild')}` : "hidden text-white"
        )}>
          Tu turno
        </div>

        <div className="flex gap-8 items-center mb-6">
          <div
            className={cn(
              "w-25 h-37 bg-blue-900 rounded-lg border-2 border-white flex items-center justify-center cursor-pointer hover:bg-blue-800",
              isMyTurn && "ring-4 ring-yellow-400"
            )}
            onClick={() => isMyTurn && drawCard(activeGame.id)}
          >
            <span className="font-bold">Draw Pile</span>
          </div>

          <div className={cn(
            "w-25 h-37 rounded-lg border-2 flex flex-col items-center justify-center overflow-hidden scale-94",
            topCard.type === "number"
              ? [getBgColorClass(topCard.color), "text-white border-white"]
              : ["bg-white border-gray-300", getTextColorClass(topCard.color)]
          )}>
            {topCard.type === "number" ? (
              <>
                {/* <span className="text-2xl font-bold">{topCard.type}</span> */}
                {topCard.value !== undefined && <span className="text-4xl">{topCard.value}</span>}
                {/* <span className="text-sm">{topCard.color}</span> */}
              </>
            ) : (
              <CardComponent color={topCard.color} type={topCard.type} className="w-full h-full" />
            )}
          </div>
        </div>

        <div className="relative w-full max-w-6xl overflow-x-auto p-4">
          <h3 className="text-xl font-bold mb-4 text-center">Your Hand ({myPlayer?.hand.length}) {(myPlayer?.hand ?? []).length >= 20 && <span className="text-red-500 animate-pulse">DANGER!</span>}</h3>
          <div className={cn("flex flex-wrap justify-center gap-0 rounded-sm")} style={{
            backgroundColor: {
              'blue': 'rgba(0, 0, 255, 0.4)',
              'red': 'rgba(255, 0, 0, 0.4)',
              'green': 'rgba(0, 255, 0, 0.4)',
              'yellow': 'rgba(255, 255, 0, 0.4)',
              'wild': 'rgba(139, 92, 246, 0.4)',
            }[activeGame.currentColor as string]
          }}>
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

        {myPlayer?.isEliminated && (
          <div className="fixed inset-0 bg-red-900/20 backdrop-blur-[2px] flex flex-col items-center justify-center z-60 pointer-events-auto cursor-not-allowed">
            <div className="bg-red-600/80 px-8 py-4 rounded-full border-4 border-white shadow-2xl transform -rotate-12">
              <h1 className="text-6xl font-black text-white uppercase italic">
                ELIMINATED
              </h1>
            </div>
            <p className="mt-8 text-2xl font-bold text-white drop-shadow-lg bg-black/50 px-4 py-2 rounded">
              You are spectating the match
            </p>
          </div>
        )}
      </div>
    );
  }

  if (room.status === "finished") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-black">
        <h1 className="text-4xl font-bold mb-4">Game Over!</h1>
        {activeGame?.winnerId && (
          <h2 className="text-2xl text-green-600">Winner: {players.find(p => p.id === activeGame.winnerId)?.name}</h2>
        )}
        <button
          className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-lg"
          onClick={() => router.push("/")}
        >
          Back to Home
        </button>
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
