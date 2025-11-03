#!/bin/bash
#
# This script creates the new domain-driven directory structure for your project.
# It ONLY creates directories and does NOT move any files.
# Run this script from your project's root directory.

set -e

echo "Creating new directory structure inside 'src/'..."

# 1. Top-level domains (moving libs/ to core/)
mkdir -p src/config
mkdir -p src/core
mkdir -p src/api
mkdir -p src/modules/bot
mkdir -p src/modules/vip
mkdir -p src/modules/system

# 2. API sub-folders
mkdir -p src/api/routes
mkdir -p src/api/middlewares

# 3. Core sub-folders (most already exist, but -p makes it safe)
mkdir -p src/core/database
mkdir -p src/core/cache
mkdir -p src/core/kv-store
mkdir -p src/core/supabase

# 4. Gameplay sub-folders (for the orchestrators and core logic)
mkdir -p src/modules/gameplay/orchestrators
mkdir -p src/modules/gameplay/core

# 5. Listeners (ensuring it exists for your namespaced files)
mkdir -p src/modules/gameplay/listeners

echo "Directory structure created successfully."
echo "You can now manually move your files."