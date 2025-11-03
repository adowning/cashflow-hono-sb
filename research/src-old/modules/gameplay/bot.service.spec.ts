// Unit tests for the refactored BotService
import { describe, expect, it, vi } from 'vitest';
import
{
    BotAuthenticationError,
    BotInitializationError,
    BotOperationError,
    BotService,
    BotServiceError,
    createBotService,
    BotManager,
    createBotManager,
    BotManagerError,
    BotManagerInitializationError,
    BotManagerOperationError
} from './bot.service';
import type {
  BotManagerError,
  BotManagerInitializationError,
  BotManagerOperationError
} from './bot.service';
import { BotManager as ExternalBotManager } from './bot-manager';

// Mock dependencies
const mockSupabase = {
    auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
    },
} as any;

const mockDb = {
    query: {
        gameTable: {
            findMany: vi.fn(),
        },
        userTable: {
            findFirst: vi.fn(),
        },
        gameSessionTable: {
            findFirst: vi.fn(),
        },
    },
    insert: vi.fn(),
    execute: vi.fn(),
};

const mockBalanceService = {
    getOrCreateBalance: vi.fn(),
};

const mockBetService = {
    processBet: vi.fn(),
};

const mockDepositService = {
    initiateDeposit: vi.fn(),
    processDepositConfirmation: vi.fn(),
};

describe('BotService', () =>
{
    let botService: BotService;

    beforeEach(() =>
    {
        vi.clearAllMocks();

        const dependencies = {
            supabaseClient: mockSupabase,
            database: mockDb,
            balanceService: mockBalanceService,
            betService: mockBetService,
            depositService: mockDepositService,
        } as any;

        botService = createBotService(
            {
                betInterval: 1000,
                minWager: 100,
                maxWager: 1000,
                gameName: null,
            },
            dependencies
        );
    });

    describe('Error Classes', () =>
    {
        it('should create BotServiceError with correct properties', () =>
        {
            const error = new BotServiceError('Test error', 'TEST_CODE', 'test cause');

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.cause).toBe('test cause');
            expect(error.name).toBe('BotServiceError');
        });

        it('should create BotInitializationError with correct code', () =>
        {
            const error = new BotInitializationError('Init failed', 'test cause');

            expect(error.code).toBe('BOT_INITIALIZATION_FAILED');
            expect(error.name).toBe('BotInitializationError');
        });

        it('should create BotAuthenticationError with correct code', () =>
        {
            const error = new BotAuthenticationError('Auth failed', 'test cause');

            expect(error.code).toBe('BOT_AUTHENTICATION_FAILED');
            expect(error.name).toBe('BotAuthenticationError');
        });

        it('should create BotOperationError with correct code', () =>
        {
            const error = new BotOperationError('Operation failed', 'test cause');

            expect(error.code).toBe('BOT_OPERATION_FAILED');
            expect(error.name).toBe('BotOperationError');
        });
    });

    describe('Configuration', () =>
    {
        it('should use default configuration when no config provided', () =>
        {
            const defaultBot = new BotService();
            const status = defaultBot.getStatus();

            expect(status.config.betInterval).toBe(2000);
            expect(status.config.minWager).toBe(100);
            expect(status.config.maxWager).toBe(1000);
            expect(status.config.gameName).toBeNull();
        });

        it('should merge custom configuration with defaults', () =>
        {
            const customBot = new BotService({
                betInterval: 2000,
                maxWager: 2000,
            });

            const status = customBot.getStatus();

            expect(status.config.betInterval).toBe(2000);
            expect(status.config.maxWager).toBe(2000);
            expect(status.config.minWager).toBe(100); // default
            expect(status.config.gameName).toBeNull(); // default
        });

        it('should update configuration at runtime', () =>
        {
            botService.updateConfig({
                betInterval: 3000,
                minWager: 200,
            });

            const status = botService.getStatus();

            expect(status.config.betInterval).toBe(3000);
            expect(status.config.minWager).toBe(200);
            expect(status.config.maxWager).toBe(1000); // unchanged
        });
    });

    describe('Status and Metrics', () =>
    {
        it('should return correct initial status', () =>
        {
            const status = botService.getStatus();

            expect(status.isRunning).toBe(false);
            expect(status.userId).toBeNull();
            expect(status.sessionToken).toBeNull();
            expect(status.gameId).toBeNull();
            expect(status.gameName).toBeNull();
            expect(status.lastActivity).toBeNull();
        });

        it('should return zero metrics initially', () =>
        {
            const metrics = botService.getMetrics();

            expect(metrics.uptime).toBe(0);
            expect(metrics.totalBets).toBe(0);
            expect(metrics.successRate).toBe(0);
            expect(metrics.totalWagered).toBe(0);
            expect(metrics.totalWon).toBe(0);
        });
    });

    describe('Service Lifecycle', () =>
    {
        it('should not start when already running', async () =>
        {
            // First set it as running
            Object.defineProperty(botService, 'isRunning', { value: true });

            await expect(botService.start()).resolves.not.toThrow();
        });

        it('should stop correctly', () =>
        {
            // Set some state
            Object.defineProperty(botService, 'isRunning', { value: true });
            Object.defineProperty(botService, 'sessionToken', { value: 'test-token' });

            botService.stop();

            const status = botService.getStatus();

            expect(status.isRunning).toBe(false);
            expect(status.sessionToken).toBeNull();
        });
    });

    describe('Dependency Injection', () =>
    {
        it('should use provided dependencies', () =>
        {
            const customDeps = {
                supabaseClient: mockSupabase,
                database: mockDb,
                balanceService: mockBalanceService,
                betService: mockBetService,
                depositService: mockDepositService,
            } as any;

            const service = createBotService({}, customDeps);

            expect(service).toBeInstanceOf(BotService);
        });

        it('should fall back to default dependencies when not provided', () =>
        {
            const service = createBotService();

            expect(service).toBeInstanceOf(BotService);
        });
    });
});

describe('Bot Service Factory Functions', () =>
{
    it('should create bot service with factory function', () =>
    {
        const service = createBotService({
            betInterval: 1000,
        });

        expect(service).toBeInstanceOf(BotService);

        const status = service.getStatus();
        expect(status.config.betInterval).toBe(1000);
    });
});

describe('BotManager', () =>
{
    describe('Error Classes', () =>
    {
        it('should create BotManagerError with correct properties', () =>
        {
            const error = new Error('Test error');

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.cause).toBe('test cause');
            expect(error.name).toBe('BotManagerError');
        });

        it('should create BotManagerInitializationError with correct code', () =>
        {
            const error = new Error('Init failed');

            expect(error.code).toBe('BOT_MANAGER_INITIALIZATION_FAILED');
            expect(error.name).toBe('BotManagerInitializationError');
        });

        it('should create BotManagerOperationError with correct code', () =>
        {
            const error = new Error('Operation failed');

            expect(error.code).toBe('BOT_MANAGER_OPERATION_FAILED');
            expect(error.name).toBe('BotManagerOperationError');
        });
    });

    describe('Configuration', () =>
    {
        it('should throw error for invalid bot count', () =>
        {
            expect(() => new ExternalBotManager({ botCount: 0 })).toThrow(BotManagerInitializationError);
            expect(() => new ExternalBotManager({ botCount: 25 })).toThrow(BotManagerInitializationError);
        });

        it('should create manager with valid configuration', () =>
        {
            const manager = new ExternalBotManager({
                botCount: 3,
                botConfig: { betInterval: 3000 },
            });

            expect(manager).toBeInstanceOf(ExternalBotManager);
        });

        it('should use default configuration when not provided', () =>
        {
            const manager = new ExternalBotManager({
                botCount: 5,
            });

            expect(manager).toBeInstanceOf(ExternalBotManager);
        });
    });

    describe('Status and Metrics', () =>
    {
        it('should return correct initial status', () =>
        {
            const manager = new ExternalBotManager({ botCount: 3 });
            const status = manager.getStatus();

            expect(status.isRunning).toBe(false);
            expect(status.totalBots).toBe(0); // Not initialized yet
            expect(status.runningBots).toBe(0);
            expect(status.stoppedBots).toBe(0);
            expect(status.errorBots).toBe(0);
            expect(status.uptime).toBe(0);
            expect(status.botInstances).toEqual([]);
        });
    });

    describe('Service Lifecycle', () =>
    {
        it('should not start when already running', async () =>
        {
            const manager = new ExternalBotManager({ botCount: 2 });

            // Mock the initialization to avoid database calls
            vi.spyOn(manager as any, 'initialize').mockResolvedValue(undefined);
            Object.defineProperty(manager, 'isRunning', { value: true });

            await expect(manager.start()).resolves.not.toThrow();
        });

        it('should stop correctly', () =>
        {
            const manager = new ExternalBotManager({ botCount: 2 });

            // Set some state
            Object.defineProperty(manager, 'isRunning', { value: true });
            Object.defineProperty(manager, 'startTime', { value: new Date() });

            manager.stop();

            const status = manager.getStatus();
            expect(status.isRunning).toBe(false);
            expect(status.uptime).toBe(0);
        });
    });

    describe('Dependency Injection', () =>
    {
        it('should create bot manager with factory function', () =>
        {
            const manager = createBotManager({
                botCount: 3,
                botConfig: { betInterval: 2000 },
            });

            expect(manager).toBeInstanceOf(ExternalBotManager);
        });
    });
});

describe('Bot Service Factory Functions', () =>
{
    it('should create bot manager with factory function', () =>
    {
        const manager = createBotManager({
            botCount: 3,
            botConfig: { betInterval: 1000 },
        });

        expect(manager).toBeInstanceOf(ExternalBotManager);
    });
});