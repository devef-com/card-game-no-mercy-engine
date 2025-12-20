import { eq, ne, and } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/src/db";
import { room, roomPlayer } from "@/src/db/schema";
import { getAuth } from "@/src/lib/auth";

export async function GET() {
  const auth = getAuth();
  const db = getDb();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rooms = await db
    .select({
      room: room,
    })
    .from(roomPlayer)
    .innerJoin(room, eq(roomPlayer.roomId, room.id))
    .where(
      and(eq(roomPlayer.userId, session.user.id), ne(room.status, "finished"))
    );

  return NextResponse.json({ rooms: rooms.map((r) => r.room) });
}

export type PlayingRooms = Awaited<ReturnType<typeof GET>> extends NextResponse<
  infer T
>
  ? T extends { rooms: infer R }
    ? R
    : never
  : never;
