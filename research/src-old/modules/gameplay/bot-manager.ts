import { BotService, type BotConfig, BotServiceError, BotOperationError } from "./bot.service";
import { db } from "@/libs/database/db";
import { userTable } from "@/libs/database/schema";
import { eq } from "drizzle-orm";

// Custom error types for BotManager
export class BotManagerError extends Error
{
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  )
  {
    super(message);
    this.name = "BotManagerError";
  }
}

export class BotManagerInitializationError extends BotManagerError
{
  constructor(message: string, cause?: unknown)
  {
    super(message, "BOT_MANAGER_INITIALIZATION_FAILED", cause);
    this.name = "BotManagerInitializationError";
  }
}

export class BotManagerOperationError extends BotManagerError
{
  constructor(message: string, cause?: unknown)
  {
    super(message, "BOT_MANAGER_OPERATION_FAILED", cause);
    this.name = "BotManagerOperationError";
  }
}

// Interface for bot instance with metadata
export interface BotInstance
{
  id: string;
  userId: string;
  service: BotService;
  status: 'initializing' | 'running' | 'stopped' | 'error';
  error?: string;
  startTime?: Date;
  lastActivity?: Date;
}

// Interface for BotManager configuration
export interface BotManagerConfig
{
  botCount: number;
  botConfig: Partial<BotConfig>;
  maxRetries?: number;
  retryDelay?: number; // in milliseconds
}

// Interface for bot manager status
export interface BotManagerStatus
{
  isRunning: boolean;
  totalBots: number;
  runningBots: number;
  stoppedBots: number;
  errorBots: number;
  botInstances: BotInstance[];
  uptime: number;
}

export class BotManager
{
  private botInstances: Map<string, BotInstance> = new Map();
  private isRunning = false;
  private startTime: Date | null = null;
  private config: BotManagerConfig;
  private readonly dependencies: {
    database: typeof db;
  };

  constructor(config: BotManagerConfig)
  {
    this.config = {
      maxRetries: 3,
      retryDelay: 5000,
      ...config,
    };

    this.dependencies = {
      database: db,
    };

    // Validate configuration
    if (this.config.botCount < 1 || this.config.botCount > 20) {
      throw new BotManagerInitializationError(
        "Bot count must be between 1 and 20"
      );
    }
  }

  /**
   * Fetch random bot users from database
   */
  private async fetchBotUsers(count: number): Promise<Array<{ id: string; username: string; authEmail: string }>>
  {
    try {
      // Use raw SQL to fetch random users with BOT role
      const result = await this.dependencies.database.execute(
        `
        SELECT id, username, auth_email 
        FROM "user" 
        WHERE role = 'BOT' 
        ORDER BY RANDOM() 
        LIMIT ${count}
        `
      );

      if (!result || result.length === 0) {
        throw new BotManagerInitializationError(
          `No users found with role 'BOT'. Please ensure bot users exist in the database.`
        );
      }

      return result.map((user: any) => ({
        id: user.id,
        username: user.username,
        authEmail: user.auth_email,
      }));
    } catch (error) {
      throw new BotManagerInitializationError(
        "Failed to fetch bot users from database",
        error
      );
    }
  }

  /**
   * Initialize all bot instances
   */
  async initialize(): Promise<void>
  {
    try {
      console.log(`Initializing BotManager with ${this.config.botCount} bots...`);

      // Fetch bot users from database
      const botUsers = await this.fetchBotUsers(this.config.botCount);

      // Create bot instances
      const initializationPromises = botUsers.map(async (user, index) => {
        const botId = `bot-${index + 1}`;
        const instance: BotInstance = {
          id: botId,
          userId: user.id,
          service: new BotService(this.config.botConfig),
          status: 'initializing',
        };

        try {
          // Initialize the bot service with existing user
          await instance.service.initializeWithUser(user.id, user.authEmail, "bot-password");
          
          instance.status = 'stopped'; // Ready to start
          this.botInstances.set(botId, instance);
          
          console.log(`Bot ${botId} (User: ${user.username}) initialized successfully`);
        } catch (error) {
          instance.status = 'error';
          instance.error = error instanceof Error ? error.message : 'Unknown initialization error';
          this.botInstances.set(botId, instance);
          
          console.error(`Failed to initialize bot ${botId}:`, error);
          
          // Re-throw to be handled by caller
          throw error;
        }
      });

      // Wait for all initializations to complete
      await Promise.allSettled(initializationPromises);

      // Check if we have enough successfully initialized bots
      const successfulBots = Array.from(this.botInstances.values()).filter(
        instance => instance.status !== 'error'
      );

      if (successfulBots.length === 0) {
        throw new BotManagerInitializationError(
          "Failed to initialize any bot instances"
        );
      }

      if (successfulBots.length < this.config.botCount) {
        console.warn(
          `Only ${successfulBots.length} out of ${this.config.botCount} bots were successfully initialized`
        );
      }

      console.log(`BotManager initialization complete: ${successfulBots.length}/${this.config.botCount} bots ready`);
    } catch (error) {
      if (error instanceof BotManagerError) {
        throw error;
      }
      throw new BotManagerInitializationError(
        "Failed to initialize BotManager",
        error
      );
    }
  }

  /**
   * Start all bot instances concurrently
   */
  async start(): Promise<void>
  {
    if (this.isRunning) {
      return;
    }

    if (this.botInstances.size === 0) {
      throw new BotManagerOperationError(
        "No bot instances available. Call initialize() first."
      );
    }

    try {
      console.log(`Starting ${this.botInstances.size} bot instances...`);
      
      this.isRunning = true;
      this.startTime = new Date();

      // Start all bot instances concurrently
      const startPromises = Array.from(this.botInstances.values()).map(async (instance) => {
        try {
          await instance.service.start();
          instance.status = 'running';
          instance.startTime = new Date();
          instance.lastActivity = new Date();
          
          console.log(`Bot ${instance.id} started successfully`);
        } catch (error) {
          instance.status = 'error';
          instance.error = error instanceof Error ? error.message : 'Failed to start';
          
          console.error(`Failed to start bot ${instance.id}:`, error);
          
          // Implement retry logic for failed bots
          if (this.config.maxRetries && this.config.maxRetries > 0) {
            await this.retryBotStart(instance, this.config.maxRetries);
          }
        }
      });

      // Wait for all start operations to complete
      await Promise.allSettled(startPromises);

      // Log final status
      const runningCount = this.getRunningBotsCount();
      const errorCount = this.getErrorBotsCount();
      
      console.log(`BotManager started: ${runningCount} bots running, ${errorCount} errors`);
      
      if (runningCount === 0) {
        throw new BotManagerOperationError("Failed to start any bot instances");
      }
    } catch (error) {
      this.isRunning = false;
      this.startTime = null;
      
      if (error instanceof BotManagerError) {
        throw error;
      }
      throw new BotManagerOperationError("Failed to start BotManager", error);
    }
  }

  /**
   * Retry starting a failed bot instance
   */
  private async retryBotStart(instance: BotInstance, maxRetries: number): Promise<void>
  {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Retrying bot ${instance.id} (attempt ${attempt}/${maxRetries})...`);
        
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        await instance.service.start();
        
        instance.status = 'running';
        instance.startTime = new Date();
        instance.lastActivity = new Date();
        instance.error = undefined;
        
        console.log(`Bot ${instance.id} started successfully on retry attempt ${attempt}`);
        return;
      } catch (error) {
        console.error(`Retry attempt ${attempt} failed for bot ${instance.id}:`, error);
        
        if (attempt === maxRetries) {
          instance.status = 'error';
          instance.error = error instanceof Error ? error.message : `Failed after ${maxRetries} retries`;
        }
      }
    }
  }

  /**
   * Stop all bot instances
   */
  stop(): void
  {
    if (!this.isRunning) {
      return;
    }

    console.log(`Stopping ${this.botInstances.size} bot instances...`);

    for (const instance of this.botInstances.values()) {
      try {
        instance.service.stop();
        instance.status = 'stopped';
        instance.lastActivity = new Date();
      } catch (error) {
        console.error(`Error stopping bot ${instance.id}:`, error);
        instance.status = 'error';
        instance.error = error instanceof Error ? error.message : 'Stop failed';
      }
    }

    this.isRunning = false;
    this.startTime = null;

    console.log('BotManager stopped');
  }

  /**
   * Get bot instances by status
   */
  private getRunningBotsCount(): number
  {
    return Array.from(this.botInstances.values()).filter(
      instance => instance.status === 'running'
    ).length;
  }

  private getErrorBotsCount(): number
  {
    return Array.from(this.botInstances.values()).filter(
      instance => instance.status === 'error'
    ).length;
  }

  private getStoppedBotsCount(): number
  {
    return Array.from(this.botInstances.values()).filter(
      instance => instance.status === 'stopped'
    ).length;
  }

  /**
   * Get detailed bot manager status
   */
  getStatus(): BotManagerStatus
  {
    const botInstances = Array.from(this.botInstances.values()).map(instance => ({
      ...instance,
      // Don't expose the full service object in status
      service: undefined as any,
    }));

    return {
      isRunning: this.isRunning,
      totalBots: this.botInstances.size,
      runningBots: this.getRunningBotsCount(),
      stoppedBots: this.getStoppedBotsCount(),
      errorBots: this.getErrorBotsCount(),
      botInstances,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
    };
  }

  /**
   * Get metrics from all running bots
   */
  getBotMetrics(): Array<{
    botId: string;
    userId: string;
    status: string;
    metrics: any;
  }>
  {
    return Array.from(this.botInstances.values())
      .filter(instance => instance.status === 'running')
      .map(instance => ({
        botId: instance.id,
        userId: instance.userId,
        status: instance.status,
        metrics: instance.service.getMetrics(),
      }));
  }

  /**
   * Restart a specific bot instance
   */
  async restartBot(botId: string): Promise<void>
  {
    const instance = this.botInstances.get(botId);
    if (!instance) {
      throw new BotManagerOperationError(`Bot instance ${botId} not found`);
    }

    try {
      console.log(`Restarting bot ${botId}...`);
      
      instance.service.stop();
      await instance.service.start();
      
      instance.status = 'running';
      instance.startTime = new Date();
      instance.lastActivity = new Date();
      instance.error = undefined;
      
      console.log(`Bot ${botId} restarted successfully`);
    } catch (error) {
      instance.status = 'error';
      instance.error = error instanceof Error ? error.message : 'Restart failed';
      
      throw new BotManagerOperationError(`Failed to restart bot ${botId}`, error);
    }
  }

  /**
   * Update configuration for all bot instances
   */
  updateBotConfig(newConfig: Partial<BotConfig>): void
  {
    for (const instance of this.botInstances.values()) {
      try {
        instance.service.updateConfig(newConfig);
      } catch (error) {
        console.error(`Failed to update config for bot ${instance.id}:`, error);
      }
    }
  }

  /**
   * Get detailed status for a specific bot
   */
  getBotStatus(botId: string): BotInstance | undefined
  {
    const instance = this.botInstances.get(botId);
    if (!instance) {
      return undefined;
    }

    return {
      ...instance,
      service: undefined as any, // Don't expose service object
    };
  }
}

// Singleton instance for backward compatibility
export const botManager = new BotManager({
  botCount: 5,
  botConfig: {},
});

/**
 * Start manufactured gameplay with multiple bots
 */
export async function startManufacturedGameplay(
  config: Partial<BotManagerConfig> = {}
): Promise<BotManager>
{
  try {
    const managerConfig: BotManagerConfig = {
      botCount: 5,
      botConfig: {},
      maxRetries: 3,
      retryDelay: 5000,
      ...config,
    };

    const manager = new BotManager(managerConfig);
    await manager.initialize();
    await manager.start();

    // Replace singleton instance
    Object.assign(botManager, manager);

    return manager;
  } catch (error) {
    if (error instanceof BotManagerError) {
      throw error;
    }
    throw new BotManagerOperationError("Failed to start manufactured gameplay", error);
  }
}

/**
 * Stop manufactured gameplay
 */
export function stopManufacturedGameplay(): void
{
  botManager.stop();
}

/**
 * Get bot manager instance (for dependency injection testing)
 */
export function createBotManager(
  config: BotManagerConfig
): BotManager
{
  return new BotManager(config);
}