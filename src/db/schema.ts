import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role").default("base").notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const room = sqliteTable("room", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostId: text("host_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").default("waiting").notNull(), // waiting, playing, finished
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const roomPlayer = sqliteTable(
  "room_player",
  {
    roomId: text("room_id")
      .notNull()
      .references(() => room.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (t) => [index("room_player_pk").on(t.roomId, t.userId)]
);

export const game = sqliteTable("game", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  status: text("status").default("active").notNull(), // active, finished
  currentTurnUserId: text("current_turn_user_id").references(() => user.id),
  direction: integer("direction").default(1).notNull(), // 1 or -1
  winnerId: text("winner_id").references(() => user.id),
  drawPile: text("draw_pile", { mode: "json" }).notNull(), // Array of cards
  discardPile: text("discard_pile", { mode: "json" }).notNull(), // Array of cards
  currentColor: text("current_color"), // For wild cards
  stackedPenalty: integer("stacked_penalty").default(0).notNull(),
  rouletteStatus: text("roulette_status"), // pending_color, drawing
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  endedAt: integer("ended_at", { mode: "timestamp_ms" }),
});

export const gamePlayer = sqliteTable(
  "game_player",
  {
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hand: text("hand", { mode: "json" }).notNull(), // Array of cards
    cardCount: integer("card_count").notNull(),
    isEliminated: integer("is_eliminated", { mode: "boolean" })
      .default(false)
      .notNull(),
    score: integer("score").default(0).notNull(),
  },
  (t) => [index("game_player_pk").on(t.gameId, t.userId)]
);

export const gameMove = sqliteTable("game_move", {
  id: text("id").primaryKey(),
  gameId: text("game_id")
    .notNull()
    .references(() => game.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // PLAY, DRAW, PASS, ELIMINATED
  card: text("card", { mode: "json" }), // The card played or drawn (if visible)
  metadata: text("metadata", { mode: "json" }), // Extra info like color chosen, stacked penalty, etc.
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

export const roomRelations = relations(room, ({ one, many }) => ({
  host: one(user, {
    fields: [room.hostId],
    references: [user.id],
  }),
  players: many(roomPlayer),
  games: many(game),
}));

export const roomPlayerRelations = relations(roomPlayer, ({ one }) => ({
  room: one(room, {
    fields: [roomPlayer.roomId],
    references: [room.id],
  }),
  user: one(user, {
    fields: [roomPlayer.userId],
    references: [user.id],
  }),
}));

export const gameRelations = relations(game, ({ one, many }) => ({
  room: one(room, {
    fields: [game.roomId],
    references: [room.id],
  }),
  players: many(gamePlayer),
  moves: many(gameMove),
  winner: one(user, {
    fields: [game.winnerId],
    references: [user.id],
  }),
}));

export const gamePlayerRelations = relations(gamePlayer, ({ one }) => ({
  game: one(game, {
    fields: [gamePlayer.gameId],
    references: [game.id],
  }),
  user: one(user, {
    fields: [gamePlayer.userId],
    references: [user.id],
  }),
}));

export const gameMoveRelations = relations(gameMove, ({ one }) => ({
  game: one(game, {
    fields: [gameMove.gameId],
    references: [game.id],
  }),
  user: one(user, {
    fields: [gameMove.userId],
    references: [user.id],
  }),
}));
