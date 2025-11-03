import { SQL } from "bun";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";
import { gameTable } from "./schema/game";

const client = new SQL(
  // process.env.DATABASE_URL || "postgresql://postgres.crqbazcsrncvbnapuxcp:crqbazcsrncvbnapuxcp@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
  process.env.DATABASE_URL || "postgresql://user:asdfasdf@localhost:5439/sugarlips"
);

export const db = drizzle({ client, schema });

function snakeToCamelCase(str: string): string
{
  return str.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace("-", "").replace("_", "")
  );
}

/**
 * Recursively converts the keys of an object (and its nested objects/arrays) from snake_case to camelCase.
 * @param obj The object or array to convert.
 * @returns A new object or array with camelCase keys.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function snakeToCamelCaseObject(obj: any): any
{
  if (Array.isArray(obj)) {
    return obj.map((v) => snakeToCamelCaseObject(v));
  } else if (
    obj !== null &&
    typeof obj === "object" &&
    !(obj instanceof Date)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = snakeToCamelCase(key);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newObj[newKey] = snakeToCamelCaseObject((obj as any)[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export async function findFirstUserNative(userId: string)
{
  try {
    const result = await client`
      SELECT *
      FROM "user"
      WHERE "id" = ${userId}
      LIMIT 1
    `;
    const row = result.length > 0 ? result[0] : null;
    return row ? snakeToCamelCaseObject(row) : null; // Convert keys before returning
  } catch (error) {
    console.error("Error fetching user natively:", error);
    return null;
  }
}

export async function selectUserBalanceNative(userId: string)
{
  try {
    const result = await client`
      SELECT *
      FROM "user_balances"
      WHERE "user_id" = ${userId}
      LIMIT 1
    `;
    const row = result.length > 0 ? result[0] : null;
    return row ? snakeToCamelCaseObject(row) : null; // Convert keys before returning
  } catch (error) {
    console.error("Error fetching user balance natively:", error);
    return null;
  }
}

export async function findFirstGameNative(gameId: string)
{
  try {
    const result = await client`
      SELECT *
      FROM "games"
      WHERE "id" = ${gameId}
      LIMIT 1
    `;
    const row = result.length > 0 ? result[0] : null;
    return row ? snakeToCamelCaseObject(row) : null; // Convert keys before returning
  } catch (error) {
    console.error("Error fetching game natively:", error);
    return null;
  }
}

export async function findFirstActiveGameSessionNative(
  userId: string,
  gameId: string
)
{
  try {
    const result = await client`
      SELECT *
      FROM "game_sessions"
      WHERE "user_id" = ${userId}
        AND "status" = 'ACTIVE'
        AND "game_id" = ${gameId}
      LIMIT 1
    `;
    const row = result.length > 0 ? result[0] : null;
    return row ? snakeToCamelCaseObject(row) : null; // Convert keys before returning
  } catch (error) {
    console.error("Error fetching active game session natively:", error);
    return null;
  }
}

export async function updateGameNative(gameId: string, updates: Record<string, any>)
{
  try {
    // Validate input parameters
    if (!gameId || typeof gameId !== 'string') {
      throw new Error(`Invalid gameId provided: ${gameId}`);
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('Invalid updates object provided');
    }

    // Use Drizzle ORM for the update to maintain consistency

    // First check if game exists and validate its state
    const existingGame = await client`
      SELECT * FROM "games" WHERE "id" = ${gameId} LIMIT 1
    `;

    if (!existingGame || existingGame.length === 0) {
      console.error(`[updateGameNative] Game not found: ${gameId}`);
      throw new Error(`Game with ID ${gameId} not found`);
    }

    const gameData = snakeToCamelCaseObject(existingGame[0]);

    // Validate game initialization state
    if (!gameData.startedAt) {
      console.warn(`[updateGameNative] Game ${gameId} (${gameData.name}) has null startedAt - should be initialized`);
    }

    // Validate update data for critical fields
    const criticalFields = ['totalBetAmount', 'totalWonAmount', 'totalBets', 'totalWins'];
    for (const field of criticalFields) {
      if (updates[field] !== undefined) {
        const value = updates[field];
        if (typeof value !== 'number' || isNaN(value) || value < 0) {
          throw new Error(`Invalid value for ${field}: ${value} - must be a non-negative number`);
        }
      }
    }

    // Validate hit percentage if provided
    if (updates.hitPercentage !== undefined) {
      const hitPct = updates.hitPercentage;
      if (typeof hitPct !== 'number' || isNaN(hitPct) || hitPct < 0 || hitPct > 100) {
        throw new Error(`Invalid hitPercentage: ${hitPct} - must be between 0 and 100`);
      }
    }

    // Validate totalMinutesPlayed if provided
    if (updates.totalMinutesPlayed !== undefined) {
      const minutes = updates.totalMinutesPlayed;
      if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
        throw new Error(`Invalid totalMinutesPlayed: ${minutes} - must be a non-negative number`);
      }
    }

    const result = await db.update(gameTable)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(sql`id = ${gameId}`)
      .returning();


    const row = result.length > 0 ? result[0] : null;
    if (!row) {
      console.error(`[updateGameNative] Update operation failed for game ID: ${gameId} - no rows affected`);
      throw new Error(`Game update failed - no changes were made to game ${gameId}`);
    }

    const converted = snakeToCamelCaseObject(row);

    // Log successful update for debugging
    console.log(`[updateGameNative] Successfully updated game ${converted.name} (${gameId})`);

    return converted;
  } catch (error) {
    // Enhanced error logging with context
    const errorContext = {
      gameId,
      updates: JSON.stringify(updates, null, 2),
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    };

    console.error("[updateGameNative] Game update failed:", errorContext);

    // Re-throw with more context to make failures visible
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Game update failed for ${gameId}: ${String(error)}`);
    }
  }
}


/**
 * Recursively removes all fields with null values from an object.
 * @param obj The object to clean.
 * @returns A new object without null-valued fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeNullValues(obj: any): any
{
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleaned: { [key: string]: any } = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          // Recursively clean nested objects (but not Date objects)
          cleaned[key] = removeNullValues(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
  }

  return cleaned;
}

const prepared = db.query.userTable.findMany({
  where: ((userTable, { eq }) => eq(userTable.id, sql.placeholder('id'))),
  with: {
    userBalances: true
    // where: ((userTable, { eq }) => eq(userTable.id, placeholder('pid'))),
    // },
  },
}).prepare('query_name');

export async function getUserWithBalance(id: string)
{
  try {
    const result = await prepared.execute({ id });
    const user = result[0];

    // Remove all fields with null values, including from nested objects like balance
    if (user) {
      return removeNullValues(user);
    }

    return null;
  } catch (error) {
    console.error("Error fetching user with balance natively:", error);
    return null;
  }
}

export const updateWithAllGameSessionsToCompleted = async () =>
{
  try {
    const result = await client`
      UPDATE "game_sessions"
      SET "status" = ${'COMPLETED' as const},
          "is_active" = ${false as const},
          "updated_at" = NOW()
    `;

    console.log(`Updated ${result.length} game sessions to COMPLETED status`);
    return result;
  } catch (error) {
    console.error('Error updating game sessions:', error);
    throw error;
  }
};