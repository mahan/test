import {BaseMatchHistoryStorage} from "./basematchhistorystorage.js";
import {MatchHistoryEntry} from "./matchhistorystorage.interface.js";

export class InMemoryMatchHistoryStorage extends BaseMatchHistoryStorage {
    private storage: Map<string, MatchHistoryEntry[]> = new Map();

    async insertMatchRecord(matchId: string, entry: MatchHistoryEntry): Promise<void> {
        //console.log(`Inserting record ${matchId}, data: ${JSON.stringify(entry)}`);
        const existingHistory = this.storage.get(matchId) || [];
        existingHistory.push(entry);
        this.storage.set(matchId, existingHistory);
    }

    async getCurrentMatchEntry(matchId: string): Promise<MatchHistoryEntry | undefined> {
        const history = this.storage.get(matchId);
        if (!history || history.length === 0) {
            return undefined;
        }
        return history[history.length - 1];
    }

    async getMatchHistory(matchId: string): Promise<MatchHistoryEntry[]> {
        return this.storage.get(matchId) || [];
    }

    async clearHistory(): Promise<void> {
        this.storage.clear();
    }

    async getAllMatchIds(): Promise<string[]> {
        return Array.from(this.storage.keys());
    }

    async getAllMatchIdsByStatus(status: string): Promise<string[]> {
        const results: string[] = [];
        for (const [matchId, entries] of this.storage.entries()) {
            if (entries[entries.length-1].matchStatus === status) {
                results.push(matchId);
            }
        }
        return results;
    }
}