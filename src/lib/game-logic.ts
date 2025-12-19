export type Color = "red" | "blue" | "green" | "yellow" | "wild";
export type CardType =
  | "number"
  | "skip"
  | "reverse"
  | "draw2"
  | "draw4"
  | "wild"
  | "wild_draw4"
  | "discard_all"
  | "skip_everyone"
  | "wild_color_roulette"
  | "draw6"
  | "draw10";

export interface Card {
  id: string;
  color: Color;
  type: CardType;
  value?: number; // For number cards
}

export interface PlayerState {
  userId: string;
  hand: Card[];
  isEliminated: boolean;
  score: number;
}

export interface GameState {
  id: string;
  roomId: string;
  status: "active" | "finished";
  players: PlayerState[];
  currentTurnUserId: string;
  direction: 1 | -1;
  drawPile: Card[];
  discardPile: Card[];
  currentColor: Color;
  stackedPenalty: number;
  winnerId?: string;
}

export const COLORS: Color[] = ["red", "blue", "green", "yellow"];

export function generateDeck(): Card[] {
  const deck: Card[] = [];
  const addCard = (
    color: Color,
    type: CardType,
    value?: number,
    count: number = 1
  ) => {
    for (let i = 0; i < count; i++) {
      deck.push({
        id: Math.random().toString(36).substring(2, 15),
        color,
        type,
        value,
      });
    }
  };

  // Number cards 0-9 (2 of each except 0 usually, but No Mercy has more)
  // I'll assume 2 of each 0-9 for simplicity + extra action cards
  COLORS.forEach((color) => {
    if (color === "wild") return;

    // Numbers
    for (let n = 0; n <= 9; n++) {
      addCard(color, "number", n, 2);
    }

    // Action cards
    addCard(color, "skip", undefined, 2);
    addCard(color, "reverse", undefined, 2);
    addCard(color, "draw2", undefined, 2);
    addCard(color, "discard_all", undefined, 1); // Rare?
    addCard(color, "skip_everyone", undefined, 1);
    addCard(color, "draw4", undefined, 1); // Colored draw 4 in No Mercy? Or just wild?
    // Actually Draw 4 is usually Wild, but No Mercy might have colored Draw 2/4 stacking.
    // I'll stick to standard + known specials.
  });

  // Wilds
  addCard("wild", "wild", undefined, 4);
  addCard("wild", "wild_draw4", undefined, 4);
  addCard("wild", "wild_color_roulette", undefined, 4);
  addCard("wild", "draw6", undefined, 2); // Usually wild?
  addCard("wild", "draw10", undefined, 2); // Usually wild?

  return shuffle(deck);
}

export function shuffle(deck: Card[]): Card[] {
  return deck.sort(() => Math.random() - 0.5);
}

export function initializeGame(
  gameId: string,
  roomId: string,
  userIds: string[]
): GameState {
  const deck = generateDeck();
  const players: PlayerState[] = userIds.map((userId) => ({
    userId,
    hand: [],
    isEliminated: false,
    score: 0,
  }));

  // Deal 7 cards to each player
  players.forEach((player) => {
    for (let i = 0; i < 7; i++) {
      const card = deck.pop();
      if (card) player.hand.push(card);
    }
  });

  const firstCard = deck.pop()!;
  const discardPile = [firstCard];

  // If first card is wild, we need a color. Randomly pick one for now or let first player choose (complex).
  let currentColor = firstCard.color;
  if (currentColor === "wild") {
    currentColor = COLORS[Math.floor(Math.random() * 4)];
  }

  return {
    id: gameId,
    roomId,
    status: "active",
    players,
    currentTurnUserId: userIds[0],
    direction: 1,
    drawPile: deck,
    discardPile,
    currentColor,
    stackedPenalty: 0,
  };
}

export function canPlayCard(card: Card, gameState: GameState): boolean {
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  // If there is a stacked penalty, must play a stacking card
  if (gameState.stackedPenalty > 0) {
    const isDrawCard = [
      "draw2",
      "draw4",
      "draw6",
      "draw10",
      "wild_draw4",
    ].includes(card.type);
    return isDrawCard;
  }

  if (card.color === "wild") return true;
  if (card.color === gameState.currentColor) return true;
  if (card.type === topCard.type && card.type !== "number") return true;
  if (
    card.type === "number" &&
    topCard.type === "number" &&
    card.value === topCard.value
  )
    return true;

  return false;
}

export function getNextPlayer(
  currentUserId: string,
  players: PlayerState[],
  direction: 1 | -1,
  skip: number = 0
): string {
  const activePlayers = players.filter((p) => !p.isEliminated);
  const currentIndex = activePlayers.findIndex(
    (p) => p.userId === currentUserId
  );
  if (currentIndex === -1) return activePlayers[0].userId;

  let nextIndex =
    (currentIndex + direction * (1 + skip)) % activePlayers.length;
  if (nextIndex < 0) nextIndex += activePlayers.length;

  return activePlayers[nextIndex].userId;
}

export function applyCardEffect(
  gameState: GameState,
  card: Card,
  userId: string,
  chosenColor?: Color
): GameState {
  let newState = { ...gameState };

  // Set current color
  if (card.color === "wild") {
    if (chosenColor) newState.currentColor = chosenColor;
  } else {
    newState.currentColor = card.color;
  }

  // Handle Discard All
  if (card.type === "discard_all") {
    const playerIndex = newState.players.findIndex((p) => p.userId === userId);
    if (playerIndex !== -1) {
      const player = newState.players[playerIndex];
      const colorToDiscard = newState.currentColor;
      // Remove matching colors from hand (excluding the played card if it was still there, but it should be gone)
      const cardsToDiscard = player.hand.filter(
        (c) => c.color === colorToDiscard
      );
      player.hand = player.hand.filter((c) => c.color !== colorToDiscard);
      newState.discardPile.push(...cardsToDiscard);
    }
  }

  // Effects
  let skip = 0;
  let nextTurnSamePlayer = false;

  switch (card.type) {
    case "skip":
      skip = 1;
      break;
    case "reverse":
      newState.direction *= -1;
      if (newState.players.filter((p) => !p.isEliminated).length === 2) {
        skip = 1;
      }
      break;
    case "draw2":
      newState.stackedPenalty += 2;
      break;
    case "draw4":
    case "wild_draw4":
      newState.stackedPenalty += 4;
      break;
    case "draw6":
      newState.stackedPenalty += 6;
      break;
    case "draw10":
      newState.stackedPenalty += 10;
      break;
    case "skip_everyone":
      nextTurnSamePlayer = true;
      break;
  }

  if (!nextTurnSamePlayer) {
    newState.currentTurnUserId = getNextPlayer(
      newState.currentTurnUserId,
      newState.players,
      newState.direction,
      skip
    );
  }

  return newState;
}
