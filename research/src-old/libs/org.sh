#!/bin/bash

# This script will refactor your Drizzle schema files to use the customTimestamp type.
# It performs the following actions:
# 1. Imports `sql` from 'drizzle-orm'.
# 2. Imports `customTimestamp` from './custom-types'.
# 3. Removes old/incorrect imports for `customTimestamp`.
# 4. Replaces `.defaultNow()` with `.default(sql\`now()\`)` for custom types.
# 5. Replaces `timestamp(...)` with `customTimestamp(...)` for all tables *except* `sessionTable` using perl.

# Define the paths to your schema files
SCHEMA_FILES=(
  "database/schema/user.ts"
  "database/schema/game.ts"
  "database/schema/finance.ts"
  "database/schema/bonus.ts"
  "database/schema/jackpot.ts"
  "database/schema/affiliate.ts"
)

# --- 1. Create or update custom-types.ts ---
# (Ensuring this file is correct first)
mkdir -p database/schema
cat > database/schema/custom-types.ts << 'EOF'
import { customType } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Custom Drizzle type for handling timestamps.
 *
 * - In the database, it's stored as 'timestamp with time zone'.
 * - In your application code (Drizzle queries), it's a native JavaScript `Date` object.
 *
 * This avoids the need for `mode: "string"` and manual parsing.
 *
 * @see https://orm.drizzle.team/docs/custom-types
 */
export const customTimestamp = customType<{
  data: Date; // The type in your application code
  driverData: string; // The type in the database driver
  config: { precision: number | undefined };
  zodType: z.ZodDate; // For drizzle-zod
}>({
  /**
   * Returns the SQL data type for the column.
   * We can optionally use config.precision here.
   */
  dataType(config) {
    const precision = config.precision;
    return precision
      ? `timestamp(${precision}) with time zone`
      : "timestamp with time zone";
  },

  /**
   * `toDriver`: Called when writing to the database.
   * Converts a `Date` object from your code into an ISO string for Postgres.
   */
  toDriver(value: Date): string {
    return value.toISOString();
  },

  /**
   * `fromDriver`: Called when reading from the database.
   * Converts the string from the database driver into a new `Date` object.
   */
  fromDriver(value: string): Date {
    return new Date(value);
  },
});
EOF

echo "Updated database/schema/custom-types.ts"

# --- 2. Iterate over schema files and apply transformations ---
for FILE in "${SCHEMA_FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "Processing $FILE..."

    # Remove any old, incorrect imports for `custom`
    sed -i.bak -e "/import { customTimestamp } from \".\/custom\";/d" "$FILE"

    # Add `sql` import if it's not already there
    if ! grep -q "import { sql } from \"drizzle-orm\";" "$FILE"; then
      # Check if drizzle-orm import exists to append sql
      if grep -q "from \"drizzle-orm\";" "$FILE"; then
        sed -i.bak -e "/from \"drizzle-orm\";/ s/import {/import { sql,/" "$FILE"
      else
        # Add a new import line at the top
        sed -i.bak -e '1i\'$'\n''import { sql } from "drizzle-orm";' "$FILE"
      fi
    fi

    # Add `customTimestamp` import
    if ! grep -q "import { customTimestamp } from \"./custom-types\";" "$FILE"; then
      sed -i.bak -e '1i\'$'\n''import { customTimestamp } from "./custom-types";' "$FILE"
    fi

    # Replace .defaultNow() with .default(sql`now()`)
    # This is safe to run everywhere as it fixes the error
    sed -i.bak -e "s/\.defaultNow()/\.default(sql\`now()\`)/g" "$FILE"

    # Replace timestamp with customTimestamp using perl
    # This is more portable than awk/gensub
    perl -i.bak -pe '
      BEGIN { $in_session_table = 0 }
      # *** FIX: Removed backslash from escaped double quotes in the regex ***
      /sessionTable = pgTable\("session",/ { $in_session_table = 1 }
      
      # Unset flag *after* the closing );
      if ($in_session_table && /}\);/) { 
        $in_session_table = 0; 
      }

      if (!$in_session_table) {
        s/timestamp\(([^,]+), \{ precision: 3, mode: "string" \}\)/customTimestamp($1, { precision: 3 })/g;
        s/timestamp\(([^,]+), \{ mode: "string" \}\)/customTimestamp($1)/g;
      }
    ' "$FILE"

    # Clean up backup files created by sed and perl
    rm -f "$FILE.bak"
    echo "Finished processing $FILE"
  else
    echo "Warning: File $FILE does not exist. Skipping."
  fi
done

echo "Timestamp refactoring complete."

