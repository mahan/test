import {IMatchHistoryStorage, MatchHistoryEntry} from "./matchhistorystorage.interface.js";
import {validate as isUuid} from 'uuid';
import {ValidationError} from "../common/types.js";
import {EventStatus, IMatchMapper} from "../transformation/matchmapper.js";

export abstract class BaseMatchHistoryStorage implements IMatchHistoryStorage {

    constructor(private matchMapper: IMatchMapper) {
    }
    async onEndpointChange(url: string, data: string): Promise<void> {
        let matchData = JSON.parse(data).odds;
        const records = matchData.split('\n').filter(record => record.trim().length > 0);

        const activeMatchIds: string[] = [];
        for (const record of records) {
            const matchId = record.split(',')[0];
            activeMatchIds.push(matchId);
            if (!isUuid(matchId)) {
                throw new ValidationError('Invalid match ID format')
            }
            await this.processMatchUpdate(matchId, record);
        }
        await this.markMissingLiveMatchesAsRemoved(activeMatchIds);
    }

    // Matches that are "LIVE" in storage but no longer in the odds endpoint get a new entry in storage that is
    // identical as their last LIVE state but with the status set to REMOVED.
    private async markMissingLiveMatchesAsRemoved(activeMatchIds: string[]) {
        const liveMatchesInStorage = await this.getAllMatchIdsByStatus(EventStatus.LIVE)
        const removedMatches = liveMatchesInStorage.filter(item => !activeMatchIds.includes(item));
        for (const removedMatchId of removedMatches) {
            const lastRemovedMatchIdState: MatchHistoryEntry = <MatchHistoryEntry>await this.getCurrentMatchEntry(removedMatchId);
            this.matchMapper.parseRecord(lastRemovedMatchIdState.rawData)
            const generatedMatchObject = await this.matchMapper.renderMatchObject();
            const [firstMatch] = Object.values(generatedMatchObject);
            if (firstMatch && firstMatch.status) {
                firstMatch.status = EventStatus.REMOVED;
            }
            const generatedEntry: MatchHistoryEntry = {
                timestamp: Date.now(),
                rawData: "(Generated)",
                renderedData: JSON.stringify(generatedMatchObject),
                matchStatus: EventStatus.REMOVED,
            };
            await this.insertMatchRecord(removedMatchId, generatedEntry);
        }
    }

    protected async processMatchUpdate(matchId: string, record: string): Promise<void> {
        const currentEntry = await this.getCurrentMatchEntry(matchId);

        // Only insert if the state has changed or there is no current state
        this.matchMapper.parseRecord(record)
        if (!currentEntry || currentEntry.rawData !== record) {
            let renderedMatchObject = await this.matchMapper.renderMatchObject();
            const [firstMatch] = Object.values(renderedMatchObject);
            const entry: MatchHistoryEntry = {
                timestamp: Date.now(),
                rawData: record,
                renderedData: JSON.stringify(renderedMatchObject),
                matchStatus: firstMatch?.status,
            };
            await this.insertMatchRecord(matchId, entry);
        }
    }

    abstract getCurrentMatchEntry(matchId: string): Promise<MatchHistoryEntry | undefined>;
    abstract getMatchHistory(matchId: string): Promise<MatchHistoryEntry[]>;
    abstract clearHistory(): Promise<void>;
    abstract getAllMatchIds(): Promise<string[]>;
    abstract insertMatchRecord(matchId: string, entry: MatchHistoryEntry): Promise<void>;
    abstract getAllMatchIdsByStatus(status: string): Promise<string[]>;
}