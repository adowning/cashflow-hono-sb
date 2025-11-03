#!/usr/bin/env node

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./src/libs/database/schema/index.js";
import { randomUUID } from "crypto";

// Game data to import
const gamesData = [
  {
    "id": "12147",
    "developer": "kickass",
    "type": "1",
    "vipLevel": "5",
    "name": "SpaceCatKA",
    "title": "Space Cat",
    "shopId": "1",
    "jpgId": "0",
    "label": "1",
    "device": "2",
    "gamebank": "fish",
    "lines_percent_config_spin": "1",
    "lines_percent_config_spin_bonus": "1",
    "lines_percent_config_bonus": "1",
    "lines_percent_config_bonus_bonus": "1",
    "rezerv": "4",
    "cask": "1",
    "advanced": "1",
    "bet": "0.01, 0.02, 0.05, 0.10, 0.20",
    "scalemode": "1",
    "slotviewstate": "1",
    "view": "1",
    "denomination": "1.00",
    "category_temp": "1",
    "original_id": "1053",
    "bids": "299",
    "statIn": "59.8000",
    "statOut": "47.4000",
    "created_at": "2021-09-08 03:00:25",
    "updated_at": "2021-09-08 03:00:25",
    "standard_rtp": "1",
    "active": "true",
    "featured": "true",
    "popularity": "9",
    "current_rtp": "",
    "rtpStatIn": "",
    "rtpStatOut": ""
  },
  {
    "id": "13239",
    "developer": "kickass",
    "type": "1",
    "vipLevel": "5",
    "name": "SpaceCatKA",
    "title": "Space Cat",
    "shopId": "3",
    "jpgId": "0",
    "label": "1",
    "device": "2",
    "gamebank": "fish",
    "lines_percent_config_spin": "1",
    "lines_percent_config_spin_bonus": "1",
    "lines_percent_config_bonus": "1",
    "lines_percent_config_bonus_bonus": "1",
    "rezerv": "4",
    "cask": "1",
    "advanced": "1",
    "bet": "0.01, 0.02, 0.05, 0.10, 0.20",
    "scalemode": "1",
    "slotviewstate": "1",
    "view": "1",
    "denomination": "1.00",
    "category_temp": "1",
    "original_id": "1053",
    "bids": "0",
    "statIn": "0.0000",
    "statOut": "0.0000",
    "created_at": "2022-08-29 16:03:55",
    "updated_at": "2022-08-29 16:03:55",
    "standard_rtp": "1",
    "active": "false",
    "featured": "false",
    "popularity": "1",
    "current_rtp": "",
    "rtpStatIn": "",
    "rtpStatOut": ""
  },
  {
    "id": "13238",
    "developer": "kickass",
    "type": "1",
    "vipLevel": "5",
    "name": "GoldenDragonKA",
    "title": "Golden Dragon",
    "shopId": "3",
    "jpgId": "0",
    "label": "1",
    "device": "2",
    "gamebank": "fish",
    "lines_percent_config_spin": "1",
    "lines_percent_config_spin_bonus": "1",
    "lines_percent_config_bonus": "1",
    "lines_percent_config_bonus_bonus": "1",
    "rezerv": "4",
    "cask": "1",
    "advanced": "1",
    "bet": "0.01, 0.02, 0.05, 0.10, 0.20",
    "scalemode": "1",
    "slotviewstate": "1",
    "view": "1",
    "denomination": "1.00",
    "category_temp": "1",
    "original_id": "1052",
    "bids": "0",
    "statIn": "0.0000",
    "statOut": "0.0000",
    "created_at": "2022-08-29 16:03:55",
    "updated_at": "2022-08-29 16:03:55",
    "standard_rtp": "1",
    "active": "false",
    "featured": "false",
    "popularity": "1",
    "current_rtp": "",
    "rtpStatIn": "",
    "rtpStatOut": ""
  },
  {
    "id": "13226",
    "developer": "cqnine",
    "type": "1",
    "vipLevel": "5",
    "name": "ParadiseCQ9",
    "title": "Paradise",
    "shopId": "3",
    "jpgId": "0",
    "label": "1",
    "device": "2",
    "gamebank": "fish",
    "lines_percent_config_spin": "1",
    "lines_percent_config_spin_bonus": "1",
    "lines_percent_config_bonus": "1",
    "lines_percent_config_bonus_bonus": "1",
    "rezerv": "4",
    "cask": "1",
    "advanced": "1",
    "bet": "0.01, 0.02, 0.05, 0.10, 0.20",
    "scalemode": "1",
    "slotviewstate": "1",
    "view": "1",
    "denomination": "1.00",
    "category_temp": "1",
    "original_id": "1040",
    "bids": "0",
    "statIn": "0.0000",
    "statOut": "0.0000",
    "created_at": "2022-08-29 16:03:55",
    "updated_at": "2022-08-29 16:03:55",
    "standard_rtp": "1",
    "active": "false",
    "featured": "false",
    "popularity": "1",
    "current_rtp": "",
    "rtpStatIn": "",
    "rtpStatOut": ""
  },
  {
    "id": "12134",
    "developer": "cqnine",
    "type": "1",
    "vipLevel": "5",
    "name": "ParadiseCQ9",
    "title": "Paradise",
    "shopId": "1",
    "jpgId": "0",
    "label": "1",
    "device": "2",
    "gamebank": "fish",
    "lines_percent_config_spin": "1",
    "lines_percent_config_spin_bonus": "1",
    "lines_percent_config_bonus": "1",
    "lines_percent_config_bonus_bonus": "1",
    "rezerv": "4",
    "cask": "1",
    "advanced": "1",
    "bet": "0.01, 0.02, 0.05, 0.10, 0.20",
    "scalemode": "1",
    "slotviewstate": "1",
    "view": "1",
    "denomination": "1.00",
    "category_temp": "1",
    "original_id": "1040",
    "bids": "0",
    "statIn": "0.0000",
    "statOut": "0.0000",
    "created_at": "2021-09-08 03:00:25",
    "updated_at": "2021-09-08 03:00:25",
    "standard_rtp": "1",
    "active": "true",
    "featured": "true",
    "popularity": "7",
    "current_rtp": "",
    "rtpStatIn": "",
    "rtpStatOut": ""
  },
  {
    "id": "11040",
    "developer": "cqnine",
    "type": "1",
    "vipLevel": "5",
    "name": "ParadiseCQ9",
    "title": "Paradise",
    "shopId": "0",
    "jpgId": "0",
    "label": "1",
    "device": "2",
    "gamebank": "fish",
    "lines_percent_config_spin": "1",
    "lines_percent_config_spin_bonus": "1",
    "lines_percent_config_bonus": "1",
    "lines_percent_config_bonus_bonus": "1",
    "rezerv": "4",
    "cask": "1",
    "advanced": "1",
    "bet": "0.01, 0.02, 0.05, 0.10, 0.20",
    "scalemode": "1",
    "slotviewstate": "1",
    "view": "1",
    "denomination": "1.00",
    "category_temp": "1",
    "original_id": "1040",
    "bids": "0",
    "statIn": "0.0000",
    "statOut": "0.0000",
    "created_at": "2020-01-30 00:00:00",
    "updated_at": "2021-01-18 15:58:11",
    "standard_rtp": "1",
    "active": "false",
    "featured": "false",
    "popularity": "1",
    "current_rtp": "",
    "rtpStatIn": "",
    "rtpStatOut": ""
  }
];

// Initialize database connection
const client = new SQL(
  process.env.DATABASE_URL || "postgresql://user:asdfasdf@localhost:5439/sugarlips"
);
const db = drizzle({ client, schema });

/**
 * Map the source game data to the games table schema
 */
function mapGameData(sourceGame) {
  // Parse betting range to get min/max bets
  const betRange = sourceGame.bet ? sourceGame.bet.split(',').map(b => parseFloat(b.trim())) : [0.01, 0.20];
  const minBet = Math.min(...betRange) * 100; // Convert to cents
  const maxBet = Math.max(...betRange) * 100; // Convert to cents

  // Map category_temp to game categories
  let category = "SLOTS"; // Default
  if (sourceGame.category_temp === "1") {
    category = "SLOTS";
  } else if (sourceGame.gamebank === "fish") {
    category = "FISH";
  }

  // Map denomination to target RTP (if it's numeric)
  let targetRtp = null;
  if (sourceGame.denomination && !isNaN(parseFloat(sourceGame.denomination))) {
    // Use denomination as a base for calculating a reasonable RTP
    const denom = parseFloat(sourceGame.denomination);
    targetRtp = Math.min(98, Math.max(85, 95 - (denom - 1) * 2)); // Map 1.00 denomination to ~95% RTP
  }

  // Store original data in goldsvetData
  const goldsvetData = {
    originalId: sourceGame.id,
    shopId: sourceGame.shopId,
    denomination: sourceGame.denomination,
    bids: sourceGame.bids,
    statIn: parseFloat(sourceGame.statIn || "0"),
    statOut: parseFloat(sourceGame.statOut || "0"),
    popularity: sourceGame.popularity,
    vipLevel: sourceGame.vipLevel,
    gamebank: sourceGame.gamebank,
    originalId: sourceGame.original_id,
    createdAt: sourceGame.created_at,
    updatedAt: sourceGame.updated_at,
    currentRtp: sourceGame.current_rtp,
    rtpStatIn: sourceGame.rtpStatIn,
    rtpStatOut: sourceGame.rtpStatOut
  };

  return {
    id: randomUUID(), // Generate new UUID for the games table
    name: sourceGame.name,
    title: sourceGame.title,
    developer: sourceGame.developer,
    isActive: sourceGame.active === "true",
    isFeatured: sourceGame.featured === "true",
    category: category,
    targetRtp: targetRtp,
    status: sourceGame.active === "true" ? "ACTIVE" : "INACTIVE",
    minBet: minBet,
    maxBet: maxBet,
    goldsvetData: goldsvetData
  };
}

/**
 * Main function to import games
 */
async function importGames() {
  console.log("Starting game import...");
  
  try {
    // Check if games already exist to avoid duplicates
    const existingGames = await db.select().from(schema.gameTable);
    const existingNames = new Set(existingGames.map(game => game.name));
    
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const sourceGame of gamesData) {
      // Skip if game with same name already exists
      if (existingNames.has(sourceGame.name)) {
        console.log(`Skipping game "${sourceGame.name}" - already exists`);
        skippedCount++;
        continue;
      }
      
      // Map the source data to our schema
      const mappedGame = mapGameData(sourceGame);
      
      // Insert into database
      await db.insert(schema.gameTable).values(mappedGame);
      console.log(`Imported game: ${sourceGame.name} (${sourceGame.title})`);
      importedCount++;
    }
    
    console.log(`\nImport completed:`);
    console.log(`- Games imported: ${importedCount}`);
    console.log(`- Games skipped (already exist): ${skippedCount}`);
    console.log(`- Total source games: ${gamesData.length}`);
    
  } catch (error) {
    console.error("Error importing games:", error);
    throw error;
  }
}

// Run the import
if (import.meta.url === `file://${process.argv[1]}`) {
  importGames()
    .then(() => {
      console.log("Game import finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Game import failed:", error);
      process.exit(1);
    });
}

export { importGames, mapGameData };