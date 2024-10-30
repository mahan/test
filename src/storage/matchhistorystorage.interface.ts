import {EndpointChangeListener} from "../fetching/endpointpoller.js";


export type MatchHistoryEntry = {
    timestamp: number;
    rawData: string;
    renderedData: string;
    matchStatus: string;
}

export interface IMatchHistoryStorage extends EndpointChangeListener {
    getCurrentMatchEntry(matchId: string): Promise<MatchHistoryEntry | undefined>;
    getMatchHistory(matchId: string): Promise<MatchHistoryEntry[]>;
    clearHistory(): Promise<void>;
    getAllMatchIds(): Promise<string[]>;
    insertMatchRecord(matchId: string, entry: MatchHistoryEntry): Promise<void>;
    getAllMatchIdsByStatus(status: string): Promise<string[]>;
}
