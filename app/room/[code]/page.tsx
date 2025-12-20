import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/src/lib/auth";
import { getDb } from "@/src/db/index";
import { room, roomPlayer } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { RoomClient } from "@/src/components/room-client";
import { ToastProvider, Toaster } from "@/src/components/base-ui/toast";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = getDb();
  const auth = getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const foundRoom = await db.query.room.findFirst({
    where: eq(room.code, code),
    with: {
      host: true,
    }
  });

  if (!foundRoom) {
    notFound();
  }

  // Check if user is in room
  const player = await db.query.roomPlayer.findFirst({
    where: and(eq(roomPlayer.roomId, foundRoom.id), eq(roomPlayer.userId, session.user.id)),
  });

  if (!player) {
    redirect("/");
  }

  // Fetch all players
  const players = await db.query.roomPlayer.findMany({
    where: eq(roomPlayer.roomId, foundRoom.id),
    with: {
      user: true,
    },
  });

  return (
    <ToastProvider>
      <RoomClient
        room={foundRoom}
        //@ts-expect-error
        currentUser={session.user}
        players={players.map((p) => p.user)}
      />
      <Toaster />
    </ToastProvider>
  );
}
