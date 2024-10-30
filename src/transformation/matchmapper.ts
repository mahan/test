import {validate as isUuid} from 'uuid';
import {GUID, ValidationError} from "../common/types.js";
import {IGuidMapper} from "../fetching/guidmapper.js";

export enum EventStatus {
    LIVE = "LIVE",
    PRE = "PRE",
    REMOVED = "REMOVED"
}

export enum CompetitorType {
    HOME = "HOME",
    AWAY = "AWAY"
}

interface GoalInfo {
    period: GUID;
    homeGoals: number;
    awayGoals: number;
}

interface Score {
    type: string;
    home: number;
    away: number;
}

interface Competitor {
    type: CompetitorType;
    name: string;
}

export interface MappedMatch {
    id: string;
    status: string;
    scores: Record<string, Score>;
    startTime: string;
    sport: string;
    competitors: Record<CompetitorType, Competitor>;
    competition: string;
}

export interface IMatchMapper {
    parseRecord(record: string): void;
    renderMatchObject(): Promise<Record<string, MappedMatch>>;
}

export class MatchMapper implements IMatchMapper {
    private rawData: string | null = null;
    private id: string | null = null;
    private sportId: GUID | null = null;
    private leagueId: GUID | null = null;
    private startTime: number | null = null;
    private homeTeamId: GUID | null = null;
    private awayTeamId: GUID | null = null;
    private statusId: GUID | null = null;
    private goals: GoalInfo[] = [];

    constructor(private guidMapper: IGuidMapper) {}

    public parseRecord(record: string): void {
        this.clearState();
        this.rawData = record;
        const fields = record.split(',');

        if (fields.length < 7 || fields.length > 8) {
            throw new ValidationError(`Invalid record format: expected 7 or 8 fields, got ${fields.length}`);
        }

        // Validate all GUIDs
        const guidFields = [0, 1, 2, 4, 5, 6];  // Indexes of fields that should be GUIDs
        for (const index of guidFields) {
            if (!isUuid(fields[index])) {
                throw new ValidationError(`Invalid GUID at position ${index + 1}: ${fields[index]}`);
            }
        }

        // Validate timestamp
        const timestamp = Number(fields[3]);
        if (isNaN(timestamp)) {
            throw new ValidationError(`Invalid timestamp: ${fields[3]}`);
        }

        this.id = fields[0];
        this.sportId = fields[1] as GUID;
        this.leagueId = fields[2] as GUID;
        this.startTime = timestamp;
        this.homeTeamId = fields[4] as GUID;
        this.awayTeamId = fields[5] as GUID;
        this.statusId = fields[6] as GUID;
        this.goals = [];

        // Parse goals if present
        if (fields.length === 8 && fields[7]) {
            this.goals = this.parseGoals(fields[7]);
        }
    }

    private parseGoals(goalsString: string): GoalInfo[] {
        const periods = goalsString.split('|');
        return periods.map(period => {
            const [_periodId, scores] = period.split('@');
            const periodId = _periodId as GUID;

            if (!isUuid(periodId)) {
                throw new ValidationError(`Invalid period GUID: ${periodId}`);
            }

            const [homeGoals, awayGoals] = scores.split(':').map(Number);

            if (isNaN(homeGoals) || isNaN(awayGoals)) {
                throw new ValidationError(`Invalid goals format: ${scores}`);
            }

            return {
                period: periodId,
                homeGoals,
                awayGoals
            };
        });
    }

    public async renderMatchObject(): Promise<Record<string, MappedMatch>> {
        if (!this.rawData || !this.id || !this.sportId || !this.leagueId ||
            !this.startTime || !this.homeTeamId || !this.awayTeamId || !this.statusId) {
            throw new ValidationError('Match data not initialized. Call parseRecord first.');
        }

        // Serialize the GUID mapping requests to take advantage of caching
        const sport = await this.guidMapper.get(this.sportId);
        const competition = await this.guidMapper.get(this.leagueId);
        const status = await this.guidMapper.get(this.statusId);
        const homeTeam = await this.guidMapper.get(this.homeTeamId);
        const awayTeam = await this.guidMapper.get(this.awayTeamId);

        // Serialize period mapping requests
        const scores: Record<string, Score> = {};
        for (const goal of this.goals) {
            const periodName = await this.guidMapper.get(goal.period);
            scores[periodName] = {
                type: periodName,
                home: goal.homeGoals,
                away: goal.awayGoals
            };
        }

        const competitors: Record<CompetitorType, Competitor> = {
            [CompetitorType.HOME]: {
                type: CompetitorType.HOME,
                name: homeTeam
            },
            [CompetitorType.AWAY]: {
                type: CompetitorType.AWAY,
                name: awayTeam
            }
        };

        const mappedMatch: MappedMatch = {
            id: this.id,
            status,
            scores,
            startTime: new Date(this.startTime).toISOString(),
            sport,
            competitors,
            competition
        };

        return {
            [this.id]: mappedMatch
        };
    }

    public getRawData(): string | null {
        return this.rawData;
    }

    public static serialize(match: Record<string, MappedMatch>): string {
        return JSON.stringify(match, null, 2);
    }

    private clearState(): void {
        this.rawData = null;
        this.id = null;
        this.sportId = null;
        this.leagueId = null;
        this.startTime = null;
        this.homeTeamId = null;
        this.awayTeamId = null;
        this.statusId = null;
        this.goals = [];
    }
}