import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
import { assert } from "console";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';
import { db } from "./db";
import { bonusTable, gameTable, operatorTable, userTable, type Bonus, type Game } from "./schema";

const supabaseUrl = "https://crqbazcsrncvbnapuxcp.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNycWJhemNzcm5jdmJuYXB1eGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk1MDYsImV4cCI6MjA3Njg4NTUwNn0.AQdRVvPqeK8l8NtTwhZhXKnjPIIcv_4dRU-bSZkVPs8";
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAuth()
{
  try {
    // Create default roless if they don't exist
    // const defaultroless = [
    //   { name: "admin", description: "Administrator with full access" },
    //   {
    //     name: "affiliate",
    //     description: "Affiliate with limited access, to certain users",
    //   },
    //   { name: "user", description: "Default user roles" },
    // ];

    // Ensure environment variables are set
    // if (!process.env.BETTER_AUTH_SECRET) {
    //   console.warn(
    //     "⚠️  BETTER_AUTH_SECRET not set. Using default for development."
    //   );
    // }

    // if (!process.env.BETTER_AUTH_URL) {
    //   console.warn(
    //     "⚠️  BETTER_AUTH_URL not set. Using default for development."
    //   );
    // }

    console.log("✓ Authentication setup complete");
    return true;
  } catch (error) {
    console.error("✗ Authentication setup failed:", error);
    return false;
  }
}
export const seedGames = async () =>
{
  const _games = await fetch(
    "https://configs.cashflowcasino.com/house/games_small.json"
  );
  const games = await _games.json() as unknown as Game[]

  const now = new Date();

  for (const game of games) {
    // Generate UUID for game ID
    game.id = uuidv4();

    // Enhanced game initialization with proper timestamps and statistics seeding
    game.createdAt = game.createdAt || now;
    game.updatedAt = now;

    // Initialize startedAt with createdAt timestamp for proper tracking
    game.startedAt = game.createdAt;

    // Initialize statistics fields with proper defaults (0 instead of null)
    game.totalBetAmount = game.totalBetAmount ?? 0;
    game.totalWonAmount = game.totalWonAmount ?? 0;
    game.totalBets = game.totalBets ?? 0;
    game.totalWins = game.totalWins ?? 0;
    game.hitPercentage = game.hitPercentage ?? 0;
    game.totalPlayers = game.totalPlayers ?? 0;
    game.totalMinutesPlayed = game.totalMinutesPlayed ?? 0;

    // Initialize distinctPlayers as empty array if not provided
    game.distinctPlayers = game.distinctPlayers ?? [];

    // Initialize current RTP calculation (will be updated with first bet)
    game.currentRtp = game.currentRtp ?? 0;

    // Log game initialization for debugging
    console.log(`Initializing game "${game.name}" (${game.id}) with startedAt: ${game.startedAt.toISOString()}`);

    await db.insert(gameTable).values(game).onConflictDoNothing();
  }

  console.log(`Successfully seeded ${games.length} games with proper initialization`);
};
async function setupOperators()
{
  try {
    const existingOperator = await db.query.operatorTable.findFirst({
      where: eq(operatorTable.name, "The House"),
    });
    if (!existingOperator) {
      console.log("setting up operator");

      const _products = await fetch(
        "https://configs.cashflowcasino.com/house/products.json"
      );
      const products = await _products.json();

      const defaultOperator = {
        // id: "house",
        id: uuidv4(),
        name: "The House",
        slotsBalance: 100000,
        arcadeBalance: 100000,
        currentFloat: 0,
        isActive: true,
        ownerId: "superadmin",
        products,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.insert(operatorTable).values(defaultOperator);

      console.log("✓ BonusData, Settings, Games and Operator setup complete");
      return true;
    }
    const existingBonuses = await db.query.bonusTable.findMany();
    if (existingBonuses.length < 2) {

      const _bonuses = await fetch(
        "https://configs.cashflowcasino.com/house/bonuses.seed.json")
      const bonuses = await _bonuses.json() as unknown as Bonus[]
      for (var b of bonuses) {
        b.id = uuidv4();
        b.type = 'MANUAL'
        b.wageringMultiplier = 20
      }
      // console.log(bonuses[0])
      await db.insert(bonusTable).values(bonuses);
    }

  } catch (error) {
    console.error(
      "✗ BonusData, Settings, Games and Operator setup failed:",
      error
    );
    return false;
  }
}
// Generate a random password for the admin account
const generateRandomPassword = () =>
{
  return randomBytes(16).toString("hex");
};

const adminEmail = "adminuser@cashflowcasino.com";
const adminName = "adminuser";
const randomPassword = "asdfasdf"; //generateRandomPassword();

// Create an admin account if it doesn't exist, and create two sample posts
export const setupAccounts = async () =>
{
  let ownerId: string;

  try {

    const result = await supabase.auth.signUp({
      email: adminEmail,
      password: randomPassword,
      options: {
        data: {
          username: adminName,
        },
      },
    });

    console.log(result)
    if (result) {
      // Get the created user
      const userRecord = await db.query.userTable.findFirst({
        where: eq(userTable.username, adminName),
      });

      if (userRecord) {
        ownerId = userRecord.id;

        // Create admin roles if it doesn't exist

        // Verify the admin account email
        await db
          .update(userTable)
          .set({ banned: false })
          .where(eq(userTable.id, userRecord.id));

        console.log(
          `Admin account created with email: ${adminEmail} and password: ${randomPassword}`
        );
      } else {
        throw new Error("Failed to find created user");
      }
    } else {
      throw new Error("Failed to create admin account");
    }
  } catch (error: unknown) {
    // Account might already exist, try to get existing user
    const existingUser = await db.query.userTable.findFirst({
      where: eq(userTable.username, adminName),
    });

    if (existingUser) {
      console.log(`Admin account already exists with email: ${adminEmail}`);
      ownerId = existingUser.id;
    } else {
      console.error("Error creating admin account:", error);
      throw error;
    }
  }
};

// Create 10 users 
const setupUsers = async () =>
{
  console.log("Starting user creation...");

  try {

    const usersToCreate: any[] = [];
    const createdUsers: any[] = [];

    // Create 10 users
    for (let i = 0; i < 10; i++) {
      const email = faker.internet.email();
      const name = faker.internet.username();
      const password = generateRandomPassword();
      const createdAt = faker.date.recent({ days: 60 });

      try {

        const result = await supabase.auth.signUp({
          email,
          password: randomPassword,
          options: {
            data: {
              username: name,
              bot: true
            },
          },
        });
        console.log(result)
        if (result) {
          // Get the created user
          const userRecord = await db.query.userTable.findFirst({
            where: eq(userTable.username, name),
          });

          if (userRecord) {
            // Update createdAt date
            await db
              .update(userTable)
              .set({ createdAt })
              .where(eq(userTable.id, userRecord.id));

            // Bypass email verification
            await db
              .update(userTable)
              .set({ banned: false })
              .where(eq(userTable.id, userRecord.id));



            createdUsers.push(userRecord);
            console.log(`✓ Created user: ${email} with password: ${password}`);
          } else {
            throw new Error(`Failed to find created user: ${email}`);
          }
        } else {
          throw new Error(`Failed to create user: ${email}`);
        }
      } catch (error: unknown) {
        console.error(`✗ Failed to create user ${email}:`, error);
        // Continue with next user
      }
    }

    console.log(`Successfully created ${createdUsers.length} users`);
    assert(createdUsers.length > 0, "No users were created");

    console.log("User creation completed successfully!");
    return createdUsers;
  } catch (error: unknown) {
    console.error("Error during user creation:", error);
    throw error;
  }
};

export async function setupDatabase()
{
  const existingPlayers = await db.query.userTable.findMany();
  // if (existingPlayers && existingPlayers?.length < 3) {
  // await setupAuth();
  // await setupOperators();
  // await setupAccounts();
  await setupUsers();
  // }
  const existingGames = await db.query.gameTable.findMany();
  if (existingGames && existingGames?.length < 2) {
    await seedGames();
    // }
  }
}

setupDatabase();
