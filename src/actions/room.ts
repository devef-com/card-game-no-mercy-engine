"use server";

import { nanoid } from "nanoid";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/src/lib/auth";
import { getDb } from "@/src/db/index";
import { room, roomPlayer, game } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";

export async function createRoom() {
  const auth = getAuth();
  const db = getDb();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/");
  }

  const code = nanoid(6).toUpperCase();
  const id = nanoid();

  await db.insert(room).values({
    id,
    code,
    hostId: session.user.id,
    status: "waiting",
  });

  await db.insert(roomPlayer).values({
    roomId: id,
    userId: session.user.id,
  });

  redirect(`/room/${code}`);
}

export async function joinRoom(code: string) {
  const auth = getAuth();
  const db = getDb();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  const foundRoom = await db.query.room.findFirst({
    where: eq(room.code, code),
  });

  if (!foundRoom) {
    return { error: "Room not found" };
  }

  // Check if already joined
  const existingPlayer = await db.query.roomPlayer.findFirst({
    where: and(
      eq(roomPlayer.roomId, foundRoom.id),
      eq(roomPlayer.userId, session.user.id)
    ),
  });

  if (!existingPlayer) {
    await db.insert(roomPlayer).values({
      roomId: foundRoom.id,
      userId: session.user.id,
    });
  }

  redirect(`/room/${code}`);
}

export async function getRoomState(code: string, activeGameOnly = false) {
  const db = getDb();
  const foundRoom = await db.query.room.findFirst({
    where: eq(room.code, code),
    with: {
      host: true,
      games: {
        // where: eq(game.status, "active"),
        with: {
          players: true,
        },
        orderBy: (games, { desc }) => [desc(games.createdAt)],
        limit: 1,
      },
    },
  });

  if (!foundRoom) return null;

  const players = await db.query.roomPlayer.findMany({
    where: eq(roomPlayer.roomId, foundRoom.id),
    with: {
      user: true,
    },
  });

  let activeGame = null;
  if (foundRoom.games && foundRoom.games.length > 0) {
    activeGame = foundRoom.games[0];
    // Ensure rouletteStatus is passed
    if (activeGame.rouletteStatus === null) {
      //@ts-ignore
      activeGame.rouletteStatus = undefined;
    }
  }

  return { room: foundRoom, players: players.map((p) => p.user), activeGame };
}
