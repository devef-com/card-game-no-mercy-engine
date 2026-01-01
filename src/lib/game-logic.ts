export type Color = "red" | "blue" | "green" | "yellow" | "wild";
export type CardType =
  | "number"
  | "skip"
  | "reverse"
  | "draw2"
  | "draw4"
  | "discard_all"
  | "skip_everyone"
  | "wild_color_roulette"
  | "draw6"
  | "draw10"
  | "wild_reverse_draw4";

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
  rouletteStatus?: "pending_color" | "drawing" | null;
  showNextPlayerAction?: boolean;
}

export const COLORS: Color[] = ["red", "blue", "green", "yellow"];

export function generateDeck(playerCount: number): Card[] {
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

  // 20 Number Cards per color (2 each of 0-9)
  COLORS.forEach((color) => {
    if (color === "wild") return;

    // Numbers 0-9 (2 of each)
    for (let n = 0; n <= 9; n++) {
      addCard(color, "number", n, 2);
    }

    // Action cards
    addCard(color, "discard_all", undefined, 3);
    addCard(color, "draw2", undefined, 3);
    addCard(color, "draw4", undefined, 2);
    addCard(color, "reverse", undefined, 3);
    addCard(color, "skip", undefined, 3);
    addCard(color, "skip_everyone", undefined, 2);
  });

  // Wilds
  addCard("wild", "wild_color_roulette", undefined, 8);
  addCard("wild", "draw6", undefined, 4);
  addCard("wild", "draw10", undefined, 4);
  addCard("wild", "wild_reverse_draw4", undefined, 8);

  if (playerCount > 6) {
    // For larger games, add an extra set of cards
    const amount = Math.floor((playerCount - 6) / 2) + 1;
    for (let i = 0; i < amount; i++) {
      COLORS.forEach((color) => {
        if (color === "wild") return;

        // Numbers 0-9 (1 of each)
        for (let n = 0; n <= 9; n++) {
          addCard(color, "number", n, 1);
        }

        // Action cards
        addCard(color, "discard_all", undefined, 1);
        addCard(color, "draw2", undefined, 1);
        addCard(color, "draw4", undefined, 1);
        addCard(color, "reverse", undefined, 1);
        addCard(color, "skip", undefined, 1);
        addCard(color, "skip_everyone", undefined, 1);
      });

      // Wilds
      addCard("wild", "wild_color_roulette", undefined, 2);
      addCard("wild", "draw6", undefined, 1);
      addCard("wild", "draw10", undefined, 1);
      addCard("wild", "wild_reverse_draw4", undefined, 2);
    }
  }

  return shuffle(deck);
}

export function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function reshuffleDiscardPile(gameState: GameState) {
  if (gameState.discardPile.length <= 1) return;

  const topCard = gameState.discardPile.pop()!;
  const newCards = shuffle(gameState.discardPile);

  // Add new cards to the BOTTOM of the draw pile (start of array)
  // so that existing cards are drawn first.
  gameState.drawPile = [...newCards, ...gameState.drawPile];
  gameState.discardPile = [topCard];
}

export function initializeGame(
  gameId: string,
  roomId: string,
  userIds: string[]
): GameState {
  const players: PlayerState[] = userIds.map((userId) => ({
    userId,
    hand: [],
    isEliminated: false,
    score: 0,
  }));

  const deck = generateDeck(players.length);

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

export function getDrawValue(type: CardType): number {
  switch (type) {
    case "draw2":
      return 2;
    case "draw4":
    case "wild_reverse_draw4":
      return 4;
    case "draw6":
      return 6;
    case "draw10":
      return 10;
    default:
      return 0;
  }
}

export function canPlayCard(card: Card, gameState: GameState): boolean {
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  // If there is a stacked penalty, must play a stacking card
  if (gameState.stackedPenalty > 0) {
    const currentPenaltyValue = getDrawValue(topCard.type);
    const newPenaltyValue = getDrawValue(card.type);
    return newPenaltyValue >= currentPenaltyValue;
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
    if (card.type === "wild_color_roulette") {
      newState.currentColor = "wild";
      newState.rouletteStatus = "pending_color";
    } else if (chosenColor) {
      newState.currentColor = chosenColor;
    }
  } else {
    newState.currentColor = card.color;
  }

  // Handle Discard All
  if (card.type === "discard_all") {
    const playerIndex = newState.players.findIndex((p) => p.userId === userId);
    if (playerIndex !== -1) {
      const player = newState.players[playerIndex];
      const colorToDiscard = newState.currentColor;
      // Remove matching colors from hand
      const cardsToDiscard = player.hand
        .filter((c) => c.color === colorToDiscard)
        .sort((a, b) =>
          a.type === "discard_all" ? 1 : b.type === "discard_all" ? -1 : 0
        );

      player.hand = player.hand.filter((c) => c.color !== colorToDiscard);

      // The played card is already at the end of discardPile.
      // To keep it at the end, we insert the other cards before it.
      const playedCard = newState.discardPile.pop();
      newState.discardPile.push(...cardsToDiscard);
      if (playedCard) newState.discardPile.push(playedCard);
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
      newState.stackedPenalty += 4;
      break;
    case "wild_reverse_draw4":
      newState.stackedPenalty += 4;
      // disabled as my girlfriend didnt like to lose :c
      newState.direction *= -1;
      if (newState.players.filter((p) => !p.isEliminated).length === 2) {
        skip = 1;
      }
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
    case "wild_color_roulette":
      // Logic for roulette is handled in the next player's turn interaction
      // The next player will choose the color and draw until they get it
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

export function handleRouletteChoice(
  gameState: GameState,
  userId: string,
  chosenColor: Color
): GameState {
  let newState = { ...gameState };

  if (newState.rouletteStatus !== "pending_color") return newState;

  newState.currentColor = chosenColor;
  newState.rouletteStatus = null;

  const player = newState.players.find((p) => p.userId === userId);
  if (!player) return newState;

  // Draw until match
  while (true) {
    if (newState.drawPile.length === 0) {
      reshuffleDiscardPile(newState);
      if (newState.drawPile.length === 0) break;
    }

    const card = newState.drawPile.pop();
    if (!card) break;

    player.hand.push(card);

    if (card.color === chosenColor && card.type === "number") {
      break;
    }

    // Mercy rule check is handled in the action to allow DB updates
    if (player.hand.length >= 25) {
      player.isEliminated = true;
      break;
    }
  }

  newState.currentTurnUserId = getNextPlayer(
    newState.currentTurnUserId,
    newState.players,
    newState.direction
  );

  return newState;
}
