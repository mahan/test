import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { MatchStateAPI } from '../../src/api/matchstateapi.js';
import { ILiveMatchState } from '../../src/state/livematchstate.js';
import { IMatchHistoryStorage, MatchHistoryEntry } from '../../src/storage/matchhistorystorage.interface.js';
import { CompetitorType, EventStatus, MappedMatch } from '../../src/transformation/matchmapper.js';

describe('MatchStateAPI', () => {
    let matchState: ILiveMatchState;
    let matchHistory: IMatchHistoryStorage;
    let api: MatchStateAPI;
    let req: Request;
    let res: Response;

    const mockMappedMatch: MappedMatch = {
        id: 'match123',
        status: EventStatus.LIVE,
        scores: {
            'CURRENT': {
                type: 'CURRENT',
                home: 2,
                away: 1
            },
            'HT': {
                type: 'HT',
                home: 1,
                away: 1
            }
        },
        startTime: '2024-10-26T15:00:00Z',
        sport: 'FOOTBALL',
        competitors: {
            [CompetitorType.HOME]: {
                type: CompetitorType.HOME,
                name: 'Home Team FC'
            },
            [CompetitorType.AWAY]: {
                type: CompetitorType.AWAY,
                name: 'Away Team United'
            }
        },
        competition: 'Premier League'
    };

    beforeEach(() => {
        // Mock dependencies
        matchState = {
            getCurrentState: vi.fn(),
            onEndpointChange: vi.fn()
        };

        matchHistory = {
            getCurrentMatchEntry: vi.fn(),
            getMatchHistory: vi.fn(),
            clearHistory: vi.fn(),
            getAllMatchIds: vi.fn(),
            insertMatchRecord: vi.fn(),
            getAllMatchIdsByStatus: vi.fn(),
            onEndpointChange: vi.fn()
        };

        // Mock Express request and response
        req = {
            params: {}
        } as unknown as Request;

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            send: vi.fn(),
            setHeader: vi.fn()
        } as unknown as Response;

        api = new MatchStateAPI(matchState, matchHistory);
    });

    describe('matchStateHandler', () => {
        it('should return current match state successfully', async () => {
            const mockState: Record<string, MappedMatch> = {
                'match123': mockMappedMatch
            };
            vi.mocked(matchState.getCurrentState).mockResolvedValue(mockState);

            await api.matchStateHandler(req, res);

            expect(matchState.getCurrentState).toHaveBeenCalled();
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(res.send).toHaveBeenCalledWith(JSON.stringify(mockState, null, 2));
        });

        it('should handle errors appropriately', async () => {
            vi.mocked(matchState.getCurrentState).mockRejectedValue(new Error('Test error'));

            await api.matchStateHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch match state' });
        });
    });

    describe('internalMatchStateHandler', () => {
        it('should combine match entries successfully', async () => {
            const mockMatchIds = ['match123', 'match456'];
            const mockEntries: MatchHistoryEntry[] = [
                {
                    timestamp: 1698332400000, // 2024-10-26T15:00:00Z
                    rawData: '{}',
                    renderedData: JSON.stringify({
                        'match123': mockMappedMatch
                    }),
                    matchStatus: EventStatus.LIVE
                },
                {
                    timestamp: 1698332400000,
                    rawData: '{}',
                    renderedData: JSON.stringify({
                        'match456': {
                            ...mockMappedMatch,
                            id: 'match456',
                            status: EventStatus.PRE
                        }
                    }),
                    matchStatus: EventStatus.PRE
                }
            ];

            vi.mocked(matchHistory.getAllMatchIds).mockResolvedValue(mockMatchIds);
            vi.mocked(matchHistory.getCurrentMatchEntry)
                .mockImplementation(async (id) => mockEntries[mockMatchIds.indexOf(id)]);

            await api.internalMatchStateHandler(req, res);

            expect(matchHistory.getAllMatchIds).toHaveBeenCalled();
            expect(matchHistory.getCurrentMatchEntry).toHaveBeenCalledTimes(2);
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(res.send).toHaveBeenCalledWith(JSON.stringify({
                'match123': mockMappedMatch,
                'match456': {
                    ...mockMappedMatch,
                    id: 'match456',
                    status: EventStatus.PRE
                }
            }, null, 2));
        });

        it('should handle null entries appropriately', async () => {
            vi.mocked(matchHistory.getAllMatchIds).mockResolvedValue(['match123']);
            vi.mocked(matchHistory.getCurrentMatchEntry).mockResolvedValue(undefined);

            await api.internalMatchStateHandler(req, res);

            expect(res.send).toHaveBeenCalledWith(JSON.stringify({}, null, 2));
        });

        it('should handle errors appropriately', async () => {
            vi.mocked(matchHistory.getAllMatchIds).mockRejectedValue(new Error('Test error'));

            await api.internalMatchStateHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch internal match state' });
        });
    });

    describe('matchHistoryHandler', () => {
        it('should return formatted match history successfully', async () => {
            const mockHistory: MatchHistoryEntry[] = [{
                timestamp: 1698332400000, // 2024-10-26T15:00:00Z
                rawData: '{}',
                renderedData: JSON.stringify(mockMappedMatch),
                matchStatus: EventStatus.LIVE
            }];

            req.params.match_id = 'match123';
            vi.mocked(matchHistory.getMatchHistory).mockResolvedValue(mockHistory);

            await api.matchHistoryHandler(req, res);

            expect(matchHistory.getMatchHistory).toHaveBeenCalledWith('match123');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
            expect(res.send).toHaveBeenCalledWith(JSON.stringify([{
                stateTimeStamp: new Date(1698332400000).toISOString(),
                state: mockMappedMatch
            }], null, 2));
        });

        it('should handle empty history appropriately', async () => {
            req.params.match_id = 'match123';
            vi.mocked(matchHistory.getMatchHistory).mockResolvedValue([]);

            await api.matchHistoryHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'No history found for match match123' });
        });

        it('should handle errors appropriately', async () => {
            req.params.match_id = 'match123';
            vi.mocked(matchHistory.getMatchHistory).mockRejectedValue(new Error('Test error'));

            await api.matchHistoryHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch match history' });
        });
    });
});