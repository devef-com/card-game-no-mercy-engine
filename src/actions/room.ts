"use server";

import { nanoid } from "nanoid";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import db from "@/src/db/index";
import { room, roomPlayer, game } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";

export async function createRoom() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const foundRoom = await db.query.room.findFirst({
    where: eq(room.code, code),
  });

  if (!foundRoom) {
    throw new Error("Room not found");
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

export async function getRoomState(code: string) {
  const foundRoom = await db.query.room.findFirst({
    where: eq(room.code, code),
    with: {
      host: true,
      games: {
        where: eq(game.status, "active"),
        with: {
          players: true,
        },
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
  }

  return { room: foundRoom, players: players.map((p) => p.user), activeGame };
}
