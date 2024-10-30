import {EventStatus, IMatchMapper, MappedMatch} from '../transformation/matchmapper.js';
import {EndpointChangeListener} from "../fetching/endpointpoller.js";
import log4js from 'log4js';

export interface ILiveMatchState extends EndpointChangeListener {
    getCurrentState(): Promise<Record<string, MappedMatch>>;
}

export class LiveMatchState implements ILiveMatchState {
    private currentState: Record<string, MappedMatch> = {};
    private readonly INCLUDED_STATE_STATUSES = [EventStatus.PRE, EventStatus.LIVE].map(status => status.toString());
    private logger: log4js.Logger;

    constructor(private matchMapper: IMatchMapper) {
        this.logger = log4js.getLogger('LiveMatchState');
        this.logger.info('LiveMatchState started');
    }

    async onEndpointChange(url: string, data: string): Promise<void> {
        try {
            this.logger.trace(`Processing endpoint change for URL: ${url}`);
            const jsonData = JSON.parse(data);
            const oddsRecords = jsonData.odds.split('\n').filter(Boolean);

            // Create a new state to replace the current one
            const newState: Record<string, MappedMatch> = {};

            // Process each record
            for (const record of oddsRecords) {
                this.matchMapper.parseRecord(record);
                const mappedObject = await this.matchMapper.renderMatchObject();

                // Get the match ID and mapped match from the rendered object
                const [matchId, mappedMatch] = Object.entries(mappedObject)[0];

                // Only include matches with the specified statuses
                if (this.INCLUDED_STATE_STATUSES.includes(mappedMatch.status)) {
                    newState[matchId] = mappedMatch;
                    this.logger.trace(`Match ${matchId} added to state with status: ${mappedMatch.status}`);
                }
            }

            // Update the current state
            this.currentState = newState;
            //console.log(JSON.stringify(this.currentState, null, 2));
            //process.exit(1);
            this.logger.trace(`State updated successfully with ${Object.keys(newState).length} matches`);

        } catch (error) {
            this.logger.error('Error processing endpoint data:', error);
            throw error;
        }
    }

    getCurrentState(): Promise<Record<string, MappedMatch>> {
        return Promise.resolve({ ...this.currentState });
    }
}