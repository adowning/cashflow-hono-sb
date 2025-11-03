# Game Import Script

This standalone JavaScript script imports game data into the `games` table from the provided legacy format.

## Overview

The script maps the provided game data to the new `games` table schema with the following key transformations:

### Data Mappings

1. **ID Mapping**: Legacy ID → New UUID
2. **Category Mapping**: `category_temp` + `gamebank` → Standardized categories (SLOTS, FISH, etc.)
3. **Status Mapping**: `active` field → `isActive` boolean + `status` enum
4. **Betting Range**: Parses `bet` field string → `minBet` and `maxBet` (converted to cents)
5. **Developer**: Directly mapped from `developer` field
6. **RTP**: Maps `denomination` to a reasonable `targetRtp` value
7. **Legacy Data**: Stores original data in `goldsvetData` JSON field for reference

### Key Features

- **Duplicate Prevention**: Skips games that already exist in the database
- **Schema Validation**: Uses Drizzle ORM to ensure data conforms to the database schema
- **Error Handling**: Includes proper error handling and logging
- **Atomic Operations**: Each game import is handled individually for reliability

## Prerequisites

1. **Database Connection**: Ensure `DATABASE_URL` environment variable is set or edit the script to use your database URL
2. **Dependencies**: Make sure you have the required packages installed:
   ```bash
   bun add bun drizzle-orm drizzle-zod
   ```

## Usage

### Basic Usage

```bash
# Set database URL (if not using environment variable)
export DATABASE_URL="postgresql://user:password@localhost:5439/database"

# Run the import script
node import-games.js
```

### Programmatic Usage

```javascript
import { importGames, mapGameData } from './import-games.js';

// Import all games
await importGames();

// Or map individual game data
const mappedGame = mapGameData(legacyGameData);
```

## Data Transformations Explained

### Betting Range Conversion
- Input: `"0.01, 0.02, 0.05, 0.10, 0.20"`
- Output: `minBet: 1` (0.01 * 100), `maxBet: 20` (0.20 * 100) in cents

### Category Mapping
- When `category_temp = "1"` → `SLOTS`
- When `gamebank = "fish"` → `FISH`
- Default → `SLOTS`

### Status Mapping
- `active = "true"` → `isActive: true`, `status: "ACTIVE"`
- `active = "false"` → `isActive: false`, `status: "INACTIVE"`

### RTP Calculation
- Uses `denomination` field to calculate a reasonable target RTP
- Maps denominations between 85-98% RTP range

## Output

The script provides detailed logging:
- Shows which games are being imported
- Skips games that already exist
- Provides summary statistics at completion

## Sample Output

```
Starting game import...
Imported game: SpaceCatKA (Space Cat)
Skipping game ParadiseCQ9 - already exists
Imported game: GoldenDragonKA (Golden Dragon)

Import completed:
- Games imported: 5
- Games skipped (already exist): 1
- Total source games: 6
```

## Database Schema Compatibility

The script ensures compatibility with the current `games` table schema:
- Uses proper UUID generation
- Respects all enum constraints
- Handles nullable fields appropriately
- Preserves original data in JSON format for reference

## Troubleshooting

### Common Issues

1. **Connection Errors**: Verify your `DATABASE_URL` is correct and accessible
2. **Schema Mismatch**: Ensure your database has the updated schema with the `games` table
3. **Permission Errors**: Make sure your database user has INSERT permissions

### Error Recovery

If the script fails midway:
- Check the console output to see which games were successfully imported
- The script doesn't delete existing data, so you can safely re-run it
- Duplicates are automatically skipped on subsequent runs