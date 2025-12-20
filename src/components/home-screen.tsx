"use client";

import { useState } from "react";
import { authClient } from "@/src/lib/client";
import { createRoom, joinRoom } from "@/src/actions/room";
import { useQuery } from "@tanstack/react-query";
import { PlayingRooms } from "@/app/api/rooms/route";
import Link from "next/link";

export function HomeScreen() {
  const { data: session, isPending, error } = authClient.useSession();
  const { data: UserRooms } = useQuery<{ rooms: PlayingRooms }>({
    queryKey: ['rooms'],
    queryFn: async () => {
      return fetch('/api/rooms').then(res => res.json());
    },
  })
  const [joinCode, setJoinCode] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-md mx-auto p-6 border rounded-lg shadow-lg bg-white dark:bg-zinc-900">
        <h2 className="text-2xl font-bold text-center">
          {authMode === "signin" ? "Sign In" : "Sign Up"}
        </h2>
        <div className="flex flex-col gap-2">
          {authMode === "signup" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="p-2 border rounded"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border rounded"
          />
          <button
            onClick={async () => {
              if (authMode === "signin") {
                await authClient.signIn.email({ email, password });
              } else {
                await authClient.signUp.email({ email, password, name });
              }
            }}
            className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {authMode === "signin" ? "Sign In" : "Sign Up"}
          </button>
          <button
            onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
            className="text-sm text-blue-500 hover:underline"
          >
            {authMode === "signin"
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-md mx-auto p-6 border rounded-lg shadow-lg bg-white dark:bg-zinc-900">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Welcome, {session.user.name}</h2>
        <button
          onClick={() => authClient.signOut()}
          className="text-sm text-red-500 hover:underline"
        >
          Sign Out
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <form action={createRoom}>
          <button
            type="submit"
            className="w-full p-4 bg-green-600 text-white rounded-lg text-lg font-bold hover:bg-green-700 transition-colors"
          >
            Create New Room
          </button>
        </form>

        <div className="flex items-center gap-2">
          <div className="h-px bg-gray-300 flex-1"></div>
          <span className="text-gray-500">OR</span>
          <div className="h-px bg-gray-300 flex-1"></div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium">Join Existing Room</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter Room Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1 p-2 border rounded uppercase"
              maxLength={6}
            />
            <button
              onClick={() => joinRoom(joinCode)}
              disabled={joinCode.length < 6}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold">Your Rooms</h3>
          <ul className="mt-2 space-y-2">
            {UserRooms && UserRooms.rooms.length > 0 ? (
              UserRooms.rooms.map((room) => (
                <li key={room.id} className="p-2 border rounded hover:bg-gray-100">
                  <Link href={`/room/${room.code}`} className="font-medium">
                    {room.code} - <span className="text-green-800 text-xs">{room.status}</span>
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-gray-500">You are not part of any rooms yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
