import {beforeEach, describe, expect, it, vi} from 'vitest';
import {LiveMatchState} from '../../src/state/livematchstate.js';
import {CompetitorType, EventStatus, IMatchMapper, MappedMatch} from '../../src/transformation/matchmapper.js';


// Mock the logger
vi.mock('log4js', () => ({
    default: {
        getLogger: vi.fn(() => ({
            info: vi.fn(),
            trace: vi.fn(),
            error: vi.fn(),
        })),
    },
}));

const testMatchID = '16da55b2-6131-4de2-8695-11b18fe980c8';

// Mock mapped match data
const mockMappedMatch: MappedMatch = {
    id: testMatchID,
    status: EventStatus.LIVE,
    scores: {
        CURRENT: { type: 'CURRENT', home: 1, away: 0 },
        PERIOD_1: { type: 'PERIOD_1', home: 1, away: 0 },
    },
    startTime: new Date().toISOString(),
    sport: 'FOOTBALL',
    competitors: {
        HOME: { type: CompetitorType.HOME, name: 'Team A' },
        AWAY: { type: CompetitorType.AWAY, name: 'Team B' },
    },
    competition: 'Test League',
};

// Mock MatchMapper
class MockMatchMapper implements IMatchMapper {

    private mockReturnValue: Record<string, MappedMatch>;

    constructor() {
        this.mockReturnValue =  {
        }
        this.mockReturnValue[testMatchID] = mockMappedMatch;
    }

    setMockReturnValue(value: Record<string, MappedMatch>) {
        this.mockReturnValue = value;
    }

    parseRecord(record: string): void {
        return;
    }

    async renderMatchObject(): Promise<Record<string, MappedMatch>> {
        return this.mockReturnValue;
    }
}

describe('LiveMatchState', () => {
    let liveMatchState: LiveMatchState;
    let mockMatchMapper: MockMatchMapper;

    beforeEach(() => {
        mockMatchMapper = new MockMatchMapper();
        liveMatchState = new LiveMatchState(mockMatchMapper);
    });

    it('should initialize with empty state', async () => {
        const currentState = await liveMatchState.getCurrentState();
        expect(currentState).toEqual({});
    });

    it('should process valid endpoint data and update state', async () => {
        const mockData = {
            odds: '16da55b2-6131-4de2-8695-11b18fe980c8,event-id,market-id,timestamp,team-a-id,team-b-id,status-id,\n' +
                '2d69dab4-bef5-4ee3-9dbd-260478d79b08,event-id,market-id,timestamp,team-a-id,team-b-id,status-id,'
        };

        await liveMatchState.onEndpointChange('/api/state', JSON.stringify(mockData));

        const currentState = await liveMatchState.getCurrentState();
        expect(Object.keys(currentState)).toHaveLength(1);
        expect(currentState[testMatchID]).toBeDefined();
        expect(currentState[testMatchID].status).toBe(EventStatus.LIVE);
    });

    it('should filter out matches with non-included statuses', async () => {
        const mockMatchRemoved = {
            ...mockMappedMatch,
            status: EventStatus.REMOVED,
        };

        let mockReturnValue: Record<string, MappedMatch> = {}
        mockReturnValue[mockMatchRemoved.id] = mockMatchRemoved;
        mockMatchMapper.setMockReturnValue(mockReturnValue);

        const mockData = {
            odds: '16da55b2-6131-4de2-8695-11b18fe980c8,event-id,market-id,timestamp,team-a-id,team-b-id,status-id,'
        };

        await liveMatchState.onEndpointChange('/api/state', JSON.stringify(mockData));

        const currentState = liveMatchState.getCurrentState();
        expect(Object.keys(currentState)).toHaveLength(0);
    });

    it('should handle invalid JSON data', async () => {
        const invalidData = 'invalid-json-data';

        await expect(
            liveMatchState.onEndpointChange('/api/state', invalidData)
        ).rejects.toThrow();
    });

    it('should handle empty odds data', async () => {
        const mockData = {
            odds: ''
        };

        await liveMatchState.onEndpointChange('/api/state', JSON.stringify(mockData));

        const currentState = await liveMatchState.getCurrentState();
        expect(currentState).toEqual({});
    });

    it('should maintain state isolation between updates', async () => {
        // First update
        const mockData1 = {
            odds: '16da55b2-6131-4de2-8695-11b18fe980c8,event-id,market-id,timestamp,team-a-id,team-b-id,status-id,'
        };

        await liveMatchState.onEndpointChange('/api/state', JSON.stringify(mockData1));
        const state1 = liveMatchState.getCurrentState();

        // Modify the returned state
        state1['new-match'] = mockMappedMatch;

        // Verify original state wasn't modified
        const currentState = liveMatchState.getCurrentState();
        expect(currentState['new-match']).toBeUndefined();
    });

    it('should throw when processing fails', async () => {
        // Mock MatchMapper to throw an error
        vi.spyOn(mockMatchMapper, 'parseRecord').mockImplementationOnce(() => {
            throw new Error('Parse error');
        });

        const mockData = {
            odds: '16da55b2-6131-4de2-8695-11b18fe980c8,event-id,market-id,timestamp,team-a-id,team-b-id,status-id,'
        };

        await expect(
            liveMatchState.onEndpointChange('/api/state', JSON.stringify(mockData))
        ).rejects.toThrow();

    });

    it('should include PRE status matches in state', async () => {
        const mockPreMatch = {
            ...mockMappedMatch,
            status: EventStatus.PRE,
        };

        mockMatchMapper.setMockReturnValue({
            'test-match-id': mockPreMatch
        });

        const mockData = {
            odds: '16da55b2-6131-4de2-8695-11b18fe980c8,event-id,market-id,timestamp,team-a-id,team-b-id,status-id,'
        };

        await liveMatchState.onEndpointChange('/api/state', JSON.stringify(mockData));

        const currentState = await liveMatchState.getCurrentState();
        expect(Object.keys(currentState)).toHaveLength(1);
        expect(currentState['test-match-id'].status).toBe(EventStatus.PRE);
    });

    it('should process multiple matches in a single update', async () => {

        // Create a spy on the parseRecord method
        const parseRecordSpy = vi.spyOn(mockMatchMapper, 'parseRecord');

        const mockData = {
            odds: '16da55b2-6131-4de2-8695-11b18fe980c8,event-id,market-id,timestamp,team-a-id,team-b-id,status-id,\n' +
                '2d69dab4-bef5-4ee3-9dbd-260478d79b08,event-id,market-id,timestamp,team-a-id,team-b-id,status-id,'
        };

        await liveMatchState.onEndpointChange('/api/state', JSON.stringify(mockData));

        // Verify parseRecord was called twice
        expect(parseRecordSpy).toHaveBeenCalledTimes(2);
    });
});