import express, { Application, Request, Response, NextFunction } from 'express';
import log4js, { Logger } from 'log4js';
import { fileURLToPath } from 'url';
import { MatchStateAPI } from './api/matchstateapi.js';
import { ILiveMatchState, LiveMatchState } from './state/livematchstate.js';
import { IMatchHistoryStorage } from './storage/matchhistorystorage.interface.js';
import { InMemoryMatchHistoryStorage } from './storage/inmemorymatchhistorystorage.js';
import { IMatchMapper, MatchMapper } from "./transformation/matchmapper.js";
import { IGuidMapper, GuidMapper } from "./fetching/guidmapper.js";
import {EndpointPoller} from "./fetching/endpointpoller.js";

// Configuration interface
interface ServerConfig {
    readonly port: number;
    readonly logLevel: string;
    readonly mappingEndpoint: string;
    readonly oddsEndpoint: string;
    readonly oddsPollingIntervalMs: number;
}

// Environment configuration with validation
const getConfig = (): ServerConfig => {
    return {
        port: parseInt(process.env.PORT ?? '4000', 10),
        logLevel: process.env.LOG_LEVEL ?? 'info',
        mappingEndpoint: process.env.MAPPING_ENDPOINT ?? 'http://127.0.0.0:3000/api/mappings',
        oddsEndpoint: process.env.ODDS_ENDPOINT ?? 'http://127.0.0.1:3000/api/state',
        oddsPollingIntervalMs: parseInt(process.env.ODDS_POLLING_INTERVAL_MS ?? '100', 10), // set to 0 to poll continuously
    };
};

// Logger configuration
const configureLogger = (logLevel: string): Logger => {
    log4js.configure({
        appenders: {
            console: { type: 'console' }
        },
        categories: {
            default: { appenders: ['console'], level: logLevel },
        }
    });

    return log4js.getLogger('Index');
};

export class MatchStateServer {
    private readonly app: Application;
    private readonly logger: Logger;
    private readonly config: ServerConfig;
    private readonly matchStateAPI: MatchStateAPI;
    // EndpointPoller polls the odds endpoint and propagates all state change
    private readonly endpointPoller: EndpointPoller

    constructor(
        private readonly matchState: ILiveMatchState,
        private readonly matchStorage: IMatchHistoryStorage,
        config?: Partial<ServerConfig>
    ) {
        this.config = { ...getConfig(), ...config };
        this.logger = configureLogger(this.config.logLevel);
        this.app = express();
        this.endpointPoller = new EndpointPoller(this.config.oddsPollingIntervalMs, this.config.oddsEndpoint, [this.matchState, this.matchStorage])
        this.endpointPoller.startPolling()
        this.matchStateAPI = new MatchStateAPI(this.matchState, this.matchStorage);
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    private setupMiddleware(): void {
        this.app.use(log4js.connectLogger(this.logger, {
            level: 'info',
            format: ':method :url :status'
        }));
    }

    private setupRoutes(): void {
        this.app.get('/state', (req, res) => this.matchStateAPI.matchStateHandler(req, res));
        this.app.get('/internalstate', (req, res) => this.matchStateAPI.internalMatchStateHandler(req, res));
        this.app.get('/matchhistory/:match_id', (req, res) => this.matchStateAPI.matchHistoryHandler(req, res));
    }

    private setupErrorHandling(): void {
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            this.logger.error('Server error:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        });
    }

    public async start(): Promise<void> {
        return new Promise((resolve) => {
            this.app.listen(this.config.port, () => {
                this.logger.info(`Server started on port ${this.config.port}`);
                resolve();
            });
        });
    }
}

const createServerDependencies = (config: ServerConfig) => {
    const guidMapper: IGuidMapper = new GuidMapper(config.mappingEndpoint);
    const matchMapper: IMatchMapper = new MatchMapper(guidMapper);
    const storage: IMatchHistoryStorage = new InMemoryMatchHistoryStorage(matchMapper);
    const liveMatchState: ILiveMatchState = new LiveMatchState(matchMapper);

    return { storage, liveMatchState };
};


const isMainModule = process.env.NODE_ENV !== 'test' && import.meta.url === import.meta.resolve(process.argv[1]);

if (isMainModule || process.env.NODE_ENV == 'test') {
    const config = getConfig();
    const logger = configureLogger(config.logLevel);
    logger.info(`Starting server with log level: ${config.logLevel}`);

    const { storage, liveMatchState } = createServerDependencies(config);
    const server = new MatchStateServer(liveMatchState, storage);

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection:', reason);
        process.exit(1);
    });

    server.start().catch((error) => {
        logger.error('Failed to start server:', error);
        process.exit(1);
    });
}