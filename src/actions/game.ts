"use server";

import { headers } from "next/headers";
import { getAuth } from "@/src/lib/auth";
import { getDb } from "@/src/db/index";
import { room, roomPlayer, game, gamePlayer, gameMove } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import {
  initializeGame,
  GameState,
  Card,
  canPlayCard,
  applyCardEffect,
  getNextPlayer,
  handleRouletteChoice,
  Color,
  reshuffleDiscardPile,
  shuffle,
} from "@/src/lib/game-logic";
import { nanoid } from "nanoid";

export async function startGame(roomId: string) {
  const db = getDb();
  const auth = getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "Unauthorized" };
  }

  const foundRoom = await db.query.room.findFirst({
    where: eq(room.id, roomId),
  });

  if (!foundRoom) {
    return { error: "Room not found" };
  }
  if (foundRoom.hostId !== session.user.id) {
    return { error: "Only host can start game" };
  }

  const players = await db.query.roomPlayer.findMany({
    where: eq(roomPlayer.roomId, roomId),
  });

  if (players.length < 2) {
    return { error: "Need at least 2 players" };
  }

  // Shuffle player positions randomly
  const shuffledUserIds = shuffle(players.map((p) => p.userId));

  const gameId = nanoid();
  const gameState = initializeGame(gameId, roomId, shuffledUserIds);

  // Transaction would be better, but Drizzle SQLite transaction support depends on driver.
  // I'll do sequential inserts.

  await db.insert(game).values({
    id: gameId,
    roomId,
    status: "active",
    currentTurnUserId: gameState.currentTurnUserId,
    direction: gameState.direction,
    drawPile: gameState.drawPile,
    discardPile: gameState.discardPile,
    currentColor: gameState.currentColor,
    stackedPenalty: 0,
  });

  for (const player of gameState.players) {
    await db.insert(gamePlayer).values({
      gameId,
      userId: player.userId,
      hand: player.hand,
      cardCount: player.hand.length,
      isEliminated: player.isEliminated,
      score: player.score,
    });
  }

  await db.update(room).set({ status: "playing" }).where(eq(room.id, roomId));

  return { gameId };
}

async function getGameState(gameId: string): Promise<GameState | null> {
  const db = getDb();
  const gameRecord = await db.query.game.findFirst({
    where: eq(game.id, gameId),
    with: {
      players: true,
    },
  });

  if (!gameRecord) return null;

  return {
    id: gameRecord.id,
    roomId: gameRecord.roomId,
    status: gameRecord.status as "active" | "finished",
    players: gameRecord.players.map((p) => ({
      userId: p.userId,
      hand: p.hand as Card[],
      isEliminated: p.isEliminated,
      score: p.score,
    })),
    currentTurnUserId: gameRecord.currentTurnUserId!,
    direction: gameRecord.direction as 1 | -1,
    drawPile: gameRecord.drawPile as Card[],
    discardPile: gameRecord.discardPile as Card[],
    currentColor: gameRecord.currentColor as any,
    stackedPenalty: gameRecord.stackedPenalty,
    winnerId: gameRecord.winnerId || undefined,
    rouletteStatus: gameRecord.rouletteStatus as any,
    showNextPlayerAction: Boolean(gameRecord.showNextPlayerAction),
  };
}

async function saveGameState(state: GameState) {
  const db = getDb();
  await db
    .update(game)
    .set({
      status: state.status,
      currentTurnUserId: state.currentTurnUserId,
      direction: state.direction,
      drawPile: state.drawPile,
      discardPile: state.discardPile,
      currentColor: state.currentColor,
      stackedPenalty: state.stackedPenalty,
      winnerId: state.winnerId,
      rouletteStatus: state.rouletteStatus || null,
      showNextPlayerAction: state.showNextPlayerAction || false,
    })
    .where(eq(game.id, state.id));

  for (const player of state.players) {
    await db
      .update(gamePlayer)
      .set({
        hand: player.hand,
        cardCount: player.hand.length,
        isEliminated: player.isEliminated,
        score: player.score,
      })
      .where(
        and(
          eq(gamePlayer.gameId, state.id),
          eq(gamePlayer.userId, player.userId)
        )
      );
  }
}

export async function playCard(
  gameId: string,
  cardId: string,
  chosenColor?: any
) {
  const db = getDb();
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const gameState = await getGameState(gameId);
  if (!gameState) {
    return { error: "Game not found" };
  }

  if (gameState.currentTurnUserId !== session.user.id) {
    return { error: "Not your turn" };
  }

  const player = gameState.players.find((p) => p.userId === session.user.id);
  if (!player) {
    return { error: "Player not found" };
  }

  const card = player.hand.find((c) => c.id === cardId);
  if (!card) {
    return { error: "Card not found in hand" };
  }

  if (!canPlayCard(card, gameState)) {
    return { error: "Invalid move" };
  }

  if (gameState.drawPile.length <= 3) {
    reshuffleDiscardPile(gameState);
  }

  if (player.hand.length === 1 && player.hand.at(0)?.type != "number") {
    // Player is about to go out with a special card, must play a number card if possible
    // dont allow to play with wild card if they have just one card, they must draw from pile
    return {
      error: "Must play a number card when going out, take from the pile",
    };
  }

  gameState.showNextPlayerAction = false;

  // Find identical number cards to discard together
  const duplicatedCards =
    card.type === "number"
      ? player.hand.filter(
          (c) =>
            c.id !== card.id &&
            c.type === "number" &&
            c.color === card.color &&
            c.value === card.value
        )
      : [];

  // Remove played card and duplicates from hand
  const idsToRemove = new Set([card.id, ...duplicatedCards.map((c) => c.id)]);
  player.hand = player.hand.filter((c) => !idsToRemove.has(c.id));

  // Add to discard pile (duplicates first, then the played card on top)
  if (duplicatedCards.length > 0) {
    gameState.discardPile.push(...duplicatedCards);
  }
  gameState.discardPile.push(card);

  // Apply effects
  const newState = applyCardEffect(
    gameState,
    card,
    session.user.id,
    chosenColor
  );

  // Check for winner
  const updatedPlayer = newState.players.find(
    (p) => p.userId === session.user.id
  )!;
  if (updatedPlayer.hand.length === 0) {
    newState.status = "finished";
    newState.winnerId = session.user.id;
    await db
      .update(room)
      .set({ status: "finished" })
      .where(eq(room.id, newState.roomId));
  }

  // Save state
  await saveGameState(newState);

  // Log move
  await db.insert(gameMove).values({
    id: nanoid(),
    gameId,
    userId: session.user.id,
    action: "PLAY",
    card: card,
    metadata: { chosenColor },
  });
}

export async function drawCard(gameId: string) {
  const auth = getAuth();
  const db = getDb();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const gameState = await getGameState(gameId);
  if (!gameState) {
    return { error: "Game not found" };
  }

  if (gameState.currentTurnUserId !== session.user.id) {
    return { error: "Not your turn" };
  }

  console.log("showNextPlayerAction:", gameState.showNextPlayerAction);
  if (gameState.showNextPlayerAction) {
    return { error: "You have a playable card, cannot draw." };
  }
  const player = gameState.players.find((p) => p.userId === session.user.id)!;

  // Calculate cards to draw
  let drawCount = 1;
  if (gameState.stackedPenalty > 0) {
    drawCount = gameState.stackedPenalty;
    gameState.stackedPenalty = 0; // Reset penalty after drawing
  }

  // Draw cards
  const drawnCards: Card[] = [];
  for (let i = 0; i < drawCount; i++) {
    if (gameState.drawPile.length === 0) {
      reshuffleDiscardPile(gameState);
      if (gameState.drawPile.length === 0) break;
    }
    const card = gameState.drawPile.pop();
    if (card) drawnCards.push(card);
  }

  player.hand.push(...drawnCards);
  gameState.showNextPlayerAction = false;

  // Mercy Rule Check
  if (player.hand.length >= 25) {
    player.isEliminated = true;

    // Move eliminated player's cards to the end of the discard pile
    gameState.discardPile.push(...player.hand);
    player.hand = [];

    // Log elimination
    await db.insert(gameMove).values({
      id: nanoid(),
      gameId,
      userId: session.user.id,
      action: "ELIMINATED",
    });

    // Check if only one player left
    const activePlayers = gameState.players.filter((p) => !p.isEliminated);
    if (activePlayers.length === 1) {
      gameState.status = "finished";
      gameState.winnerId = activePlayers[0].userId;
      await db
        .update(room)
        .set({ status: "finished" })
        .where(eq(room.id, gameState.roomId));
    }
  }

  const hasPlayableCard = player.hand.some((card) =>
    canPlayCard(card, gameState)
  );

  // Only advance turn if no playable card was drawn or player was eliminated
  if (!hasPlayableCard || player.isEliminated) {
    console.log("Advancing turn to next player");
    gameState.currentTurnUserId = getNextPlayer(
      gameState.currentTurnUserId,
      gameState.players,
      gameState.direction
    );
  } else {
    console.log("Player has a playable card, must play it");
    gameState.showNextPlayerAction = true;
  }
  // // Advance turn
  // gameState.currentTurnUserId = getNextPlayer(
  //   gameState.currentTurnUserId,
  //   gameState.players,
  //   gameState.direction
  // );

  await saveGameState(gameState);

  await db.insert(gameMove).values({
    id: nanoid(),
    gameId,
    userId: session.user.id,
    action: "DRAW",
    metadata: { count: drawCount },
  });
}

export async function chooseColor(gameId: string, color: Color) {
  const auth = getAuth();
  const db = getDb();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const gameState = await getGameState(gameId);
  if (!gameState) {
    return { error: "Game not found" };
  }

  if (gameState.currentTurnUserId !== session.user.id) {
    return { error: "Not your turn" };
  }

  if (gameState.rouletteStatus !== "pending_color") {
    return { error: "Not waiting for color choice" };
  }

  const newState = handleRouletteChoice(gameState, session.user.id, color);

  // Check for elimination (Mercy Rule)
  const player = newState.players.find((p) => p.userId === session.user.id);
  if (player?.isEliminated) {
    // Move eliminated player's cards to the end of the discard pile
    newState.discardPile.push(...player.hand);
    player.hand = [];

    await db.insert(gameMove).values({
      id: nanoid(),
      gameId,
      userId: session.user.id,
      action: "ELIMINATED",
    });

    const activePlayers = newState.players.filter((p) => !p.isEliminated);
    if (activePlayers.length === 1) {
      newState.status = "finished";
      newState.winnerId = activePlayers[0].userId;
      await db
        .update(room)
        .set({ status: "finished" })
        .where(eq(room.id, newState.roomId));
    }
  }

  await saveGameState(newState);

  await db.insert(gameMove).values({
    id: nanoid(),
    gameId,
    userId: session.user.id,
    action: "CHOOSE_COLOR",
    metadata: { color },
  });
}

export async function passTurn(gameId: string) {
  const auth = getAuth();
  const db = getDb();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorized" };
  }

  const gameState = await getGameState(gameId);
  if (!gameState) {
    return { error: "Game not found" };
  }

  if (gameState.currentTurnUserId !== session.user.id) {
    return { error: "Not your turn" };
  }

  const player = gameState.players.find((p) => p.userId === session.user.id)!;

  if (player.hand.length === 0) {
    return { error: "Cannot pass turn with no cards" };
  }

  // if (gameState.showNextPlayerAction) {
  //   return { error: "You have a playable card, cannot pass." };
  // }

  // Advance turn
  gameState.currentTurnUserId = getNextPlayer(
    gameState.currentTurnUserId,
    gameState.players,
    gameState.direction
  );
  gameState.showNextPlayerAction = false;

  await saveGameState(gameState);

  await db.insert(gameMove).values({
    id: nanoid(),
    gameId,
    userId: session.user.id,
    action: "PASS",
  });
}
