import { Request, Response } from 'express';
import { ILiveMatchState } from '../state/livematchstate.js';
import { IMatchHistoryStorage } from '../storage/matchhistorystorage.interface.js';
import log4js from 'log4js';

export class MatchStateAPI {
    private readonly logger = log4js.getLogger('MatchStateAPI');

    constructor(
        private readonly matchState: ILiveMatchState,
        private readonly matchHistory: IMatchHistoryStorage
    ) {}

    public async matchStateHandler(req: Request, res: Response): Promise<void> {
        try {
            const currentState = await this.matchState.getCurrentState();
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(currentState, null, 2));
        } catch (error) {
            this.logger.error('Error in matchState handler:', error);
            res.status(500).json({ error: 'Failed to fetch match state' });
        }
    };

    public async internalMatchStateHandler(req: Request, res: Response): Promise<void> {
        try {
            const matchIds = await this.matchHistory.getAllMatchIds();

            // Fetch latest match state from all
            const matchEntries = await Promise.all(
                matchIds.map(async (matchId) => {
                    const entry = await this.matchHistory.getCurrentMatchEntry(matchId);
                    if (entry && entry.renderedData) {
                        return JSON.parse(entry.renderedData);
                    }
                    return null;
                })
            );

            // Combine all entries into a single object
            const combinedResult = matchEntries.reduce((acc, entry) => {
                if (entry) {
                    return {
                        ...acc,
                        ...entry
                    };
                }
                return acc;
            }, {});

            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(combinedResult, null, 2));
        } catch (error) {
            this.logger.error('Error in internalMatchState handler:', error);
            res.status(500).json({ error: 'Failed to fetch internal match state' });
        }
    };

    public async matchHistoryHandler(req: Request, res: Response): Promise<void> {
        try {
            const history = await this.matchHistory.getMatchHistory(req.params.match_id);

            if (!history || history.length === 0) {
                res.status(404).json({ error: `No history found for match ${req.params.match_id}` });
                return;
            }

            // Transform the history entries into the desired format
            const formattedHistory = history.map(entry => ({
                stateTimeStamp: new Date(entry.timestamp).toISOString(),
                state: JSON.parse(entry.renderedData)
            }));

            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(formattedHistory, null, 2));
        } catch (error) {
            this.logger.error('Error in matchHistory handler:', error);
            res.status(500).json({ error: 'Failed to fetch match history' });
        }
    }

}