import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { MatchStateServer } from '../src/index.js';
import { ILiveMatchState } from '../src/state/livematchstate.js';
import { IMatchHistoryStorage } from '../src/storage/matchhistorystorage.interface.js';
import { EndpointPoller } from '../src/fetching/endpointpoller.js';
import express, { Application } from 'express';
import log4js from 'log4js';
import path from "node:path";

// Mock external dependencies
vi.mock('express', () => ({
  default: vi.fn(() => ({
    use: vi.fn(),
    get: vi.fn(),
    listen: vi.fn()
  }))
}));

vi.mock('log4js', () => ({
  default: {
    configure: vi.fn(),
    getLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn()
    })),
    connectLogger: vi.fn()
  }
}));

vi.mock('../src/fetching/endpointpoller.js', () => ({
  EndpointPoller: vi.fn(() => ({
    startPolling: vi.fn()
  }))
}));

// Updated import.meta mock
const mockedImportMeta = {
  url: 'file:///path/to/project/test/index.test.ts',
  resolve: vi.fn((specifier: string) => {
    return path.join(path.dirname('file:///path/to/project/test/index.test.ts'), specifier);
  })
};

vi.stubGlobal('import.meta', mockedImportMeta);

describe('MatchStateServer', () => {
  let matchState: ILiveMatchState;
  let matchStorage: IMatchHistoryStorage;
  let server: MatchStateServer;
  let mockApp: ReturnType<typeof express>;
  let loggerInfoMock: Mock;
  let loggerErrorMock: Mock;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env = {};

    loggerInfoMock = vi.fn();
    loggerErrorMock = vi.fn();

    // Mock dependencies
    matchState = {
      getCurrentState: vi.fn(),
      onEndpointChange: vi.fn()
    };

    matchStorage = {
      getCurrentMatchEntry: vi.fn(),
      getMatchHistory: vi.fn(),
      clearHistory: vi.fn(),
      getAllMatchIds: vi.fn(),
      insertMatchRecord: vi.fn(),
      getAllMatchIdsByStatus: vi.fn(),
      onEndpointChange: vi.fn()
    };

    // Update the logger mock to track both info and error calls
    vi.mocked(log4js.getLogger).mockReturnValue({
      info: loggerInfoMock,
      error: loggerErrorMock
    } as any);

    mockApp = {
      use: vi.fn(),
      get: vi.fn(),
      listen: vi.fn((port: number, callback?: () => void) => {
        if (callback) callback();
        return mockApp;
      }),
      request: {},
      response: {}
    } as unknown as ReturnType<typeof express>;

    vi.mocked(express).mockReturnValue(mockApp);

    // Create server with test config
    const testConfig = {
      port: 4000,
      logLevel: 'info',
      mappingEndpoint: 'http://test.local/mappings',
      oddsEndpoint: 'http://test.local/odds',
      oddsPollingIntervalMs: 1000
    };

    server = new MatchStateServer(matchState, matchStorage, testConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling process events', () => {
    let processExitSpy: ReturnType<typeof vi.spyOn>;
    let processOnSpy: ReturnType<typeof vi.spyOn>;
    let mockLogger: { info: Mock, error: Mock };

    beforeEach(() => {
      // Set up logger mock
      mockLogger = {
        info: vi.fn(),
        error: vi.fn()
      };
      vi.mocked(log4js.getLogger).mockReturnValue(mockLogger as any);

      // Mock process.exit and process.on before creating server
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      processOnSpy = vi.spyOn(process, 'on');

      // Force NODE_ENV to be 'test' to trigger handler registration
      process.env.NODE_ENV = 'test';

      // Clear any cached modules
      vi.resetModules();
    });

    afterEach(() => {
      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
      vi.clearAllMocks();
    });

    it('should handle unhandled rejections', async () => {
      // Import module to trigger handler registration
      await import('../src/index.js');

      // Verify that process.on was called correctly
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

      const handler = processOnSpy.mock.calls.find(
          call => call[0] === 'unhandledRejection'
      )?.[1] as (error: Error) => void;

      expect(handler).toBeDefined();

      const testError = new Error('Test rejection');
      handler(testError);

      // Verify error was logged and process.exit was called
      expect(mockLogger.error).toHaveBeenCalledWith('Unhandled rejection:', testError);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle server start failures during module initialization', async () => {
      // Mock express listen to throw error
      const startError = new Error('Server start failed');
      vi.mocked(express).mockReturnValue({
        ...mockApp,
        listen: vi.fn(() => { throw startError; })
      } as any);

      // Import module which will attempt to start server
      await import('../src/index.js');

      // Verify error was logged and process.exit was called
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start server:', startError);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('constructor', () => {
    it('should initialize with default config when no config provided', () => {
      const defaultServer = new MatchStateServer(matchState, matchStorage);
      expect(EndpointPoller).toHaveBeenCalledWith(
          100, // default polling interval
          'http://127.0.0.1:3000/api/state', // default odds endpoint
          expect.arrayContaining([matchState, matchStorage])
      );
    });

    it('should initialize with custom config when provided', () => {
      const customConfig = {
        oddsPollingIntervalMs: 2000,
        oddsEndpoint: 'http://custom.local/odds'
      };
      const customServer = new MatchStateServer(matchState, matchStorage, customConfig);
      expect(EndpointPoller).toHaveBeenCalledWith(
          2000,
          'http://custom.local/odds',
          expect.arrayContaining([matchState, matchStorage])
      );
    });

    it('should set up express middleware', () => {
      expect(mockApp.use).toHaveBeenCalled();
      expect(log4js.connectLogger).toHaveBeenCalled();
    });

    it('should set up routes', () => {
      expect(mockApp.get).toHaveBeenCalledWith(
          '/state',
          expect.any(Function)
      );
      expect(mockApp.get).toHaveBeenCalledWith(
          '/internalstate',
          expect.any(Function)
      );
      expect(mockApp.get).toHaveBeenCalledWith(
          '/matchhistory/:match_id',
          expect.any(Function)
      );
    });
  });

  describe('start', () => {
    it('should start the server on the configured port', async () => {
      const listenSpy = vi.spyOn(mockApp, 'listen');

      await server.start();

      expect(listenSpy).toHaveBeenCalledWith(4000, expect.any(Function));
    });

    it('should log server start message', async () => {
      await server.start();

      expect(loggerInfoMock).toHaveBeenCalledWith(
          'Server started on port 4000'
      );
    });
  });

  describe('error handling', () => {
    it('should set up error handling middleware', () => {
      type ErrorHandler = (err: Error, req: any, res: any, next: any) => void;

      const errorHandler = vi.mocked(mockApp.use).mock.calls.find(
          call => typeof call[0] === 'function'
      )?.[0] as unknown as ErrorHandler;

      expect(errorHandler).toBeDefined();

      if (errorHandler) {
        const mockReq = {} as any;
        const mockRes = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn()
        } as any;
        const mockNext = vi.fn();
        const mockError = new Error('Test error');

        errorHandler(mockError, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Internal Server Error'
        });
      }
    });
  });

  describe('environment configuration', () => {
    it('should use environment variables when provided', () => {
      process.env.PORT = '5000';
      process.env.LOG_LEVEL = 'debug';
      process.env.MAPPING_ENDPOINT = 'http://custom/mappings';
      process.env.ODDS_ENDPOINT = 'http://custom/odds';
      process.env.ODDS_POLLING_INTERVAL_MS = '2000';

      const envServer = new MatchStateServer(matchState, matchStorage);

      expect(EndpointPoller).toHaveBeenCalledWith(
          2000,
          'http://custom/odds',
          expect.any(Array)
      );
    });

    it('should use default values when environment variables are not provided', () => {
      const envServer = new MatchStateServer(matchState, matchStorage);

      expect(EndpointPoller).toHaveBeenCalledWith(
          100,
          'http://127.0.0.1:3000/api/state',
          expect.any(Array)
      );
    });
  });
});