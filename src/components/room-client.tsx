"use client";

import { useEffect, useState } from "react";
import { getRoomState } from "@/src/actions/room";
import { startGame, playCard, drawCard } from "@/src/actions/game";
import { useRouter } from "next/navigation";
import { Card } from "@/src/lib/game-logic";

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

export function RoomClient({ room: initialRoom, currentUser, players: initialPlayers }: RoomClientProps) {
  const [room, setRoom] = useState(initialRoom);
  const [players, setPlayers] = useState(initialPlayers);
  const [activeGame, setActiveGame] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      const state = await getRoomState(room.code);
      if (state) {
        setRoom(state.room);
        setPlayers(state.players);
        setActiveGame(state.activeGame);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [room.code]);

  const isHost = room.hostId === currentUser.id;

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
    const myPlayer = activeGame.players.find((p: any) => p.userId === currentUser.id);
    const isMyTurn = activeGame.currentTurnUserId === currentUser.id;
    const topCard = activeGame.discardPile[activeGame.discardPile.length - 1];

    if (myPlayer?.isEliminated) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-900 text-white">
          <h1 className="text-4xl font-bold mb-4">ELIMINATED</h1>
          <p>You have been shown NO MERCY!</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center min-h-screen bg-green-800 p-4 text-white">
        <div className="flex justify-between w-full max-w-4xl mb-8">
          <div>
            <h2 className="text-xl font-bold">Room: {room.code}</h2>
            <p>Direction: {activeGame.direction === 1 ? "Clockwise" : "Counter-Clockwise"}</p>
            <p>Current Color: <span className={`font-bold ${getColorClass(activeGame.currentColor)}`}>{activeGame.currentColor.toUpperCase()}</span></p>
            {activeGame.stackedPenalty > 0 && <p className="text-red-500 font-bold text-2xl animate-pulse">Penalty: +{activeGame.stackedPenalty}</p>}
          </div>
          <div>
            <h3 className="font-bold">Players:</h3>
            {activeGame.players.map((p: any) => {
              const user = players.find(u => u.id === p.userId);
              return (
                <div key={p.userId} className={`flex items-center gap-2 ${activeGame.currentTurnUserId === p.userId ? "text-yellow-300 font-bold" : ""}`}>
                  <span>{user?.name}</span>
                  <span>({p.cardCount} cards)</span>
                  {p.isEliminated && <span className="text-red-500">(Eliminated)</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-8 items-center mb-12">
          <div 
            className={`w-32 h-48 bg-blue-900 rounded-lg border-2 border-white flex items-center justify-center cursor-pointer hover:bg-blue-800 ${isMyTurn ? "ring-4 ring-yellow-400" : ""}`}
            onClick={() => isMyTurn && drawCard(activeGame.id)}
          >
            <span className="font-bold">Draw Pile</span>
          </div>
          
          <div className="w-32 h-48 bg-white rounded-lg border-2 border-gray-300 flex flex-col items-center justify-center text-black">
            <span className={`text-2xl font-bold ${getColorClass(topCard.color)}`}>{topCard.type}</span>
            {topCard.value !== undefined && <span className="text-4xl">{topCard.value}</span>}
            <span className="text-sm">{topCard.color}</span>
          </div>
        </div>

        <div className="w-full max-w-6xl overflow-x-auto p-4">
          <h3 className="text-xl font-bold mb-4">Your Hand ({myPlayer?.hand.length}) {myPlayer?.hand.length >= 20 && <span className="text-red-500 animate-pulse">DANGER!</span>}</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {myPlayer?.hand.map((card: Card) => (
              <div 
                key={card.id}
                className={`w-24 h-36 bg-white rounded-lg border-2 border-gray-300 flex flex-col items-center justify-center text-black shadow-lg transform hover:-translate-y-4 transition-transform cursor-pointer ${isMyTurn ? "hover:border-yellow-400" : "opacity-80"}`}
                onClick={() => {
                  if (isMyTurn) {
                    if (card.color === "wild") {
                      const color = prompt("Choose color (red, blue, green, yellow):");
                      if (color && ["red", "blue", "green", "yellow"].includes(color)) {
                        playCard(activeGame.id, card.id, color);
                      }
                    } else {
                      playCard(activeGame.id, card.id);
                    }
                  }
                }}
              >
                <span className={`text-lg font-bold ${getColorClass(card.color)} text-center`}>{card.type}</span>
                {card.value !== undefined && <span className="text-2xl">{card.value}</span>}
              </div>
            ))}
          </div>
        </div>
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

function getColorClass(color: string) {
  switch (color) {
    case "red": return "text-red-600";
    case "blue": return "text-blue-600";
    case "green": return "text-green-600";
    case "yellow": return "text-yellow-600";
    case "wild": return "text-purple-600";
    default: return "text-black";
  }
}
