import axios, {AxiosInstance} from 'axios';
import {validate as isUuid} from 'uuid';
import {GUID, GuidNotFoundError, ValidationError} from "../common/types.js";
import log4js from 'log4js';

/**
 * A utility class for mapping GUIDs to string values with dynamic fetching capabilities.
 *
 * This module provides functionality to:
 * - Validate and manage UUID/GUID mappings
 * - Fetch mappings from a remote data source
 * - Handle mapping retrieval with automatic updates
 *
 * The GuidMapper maintains a local cache of mappings and automatically fetches
 * new mappings when requesting unknown GUIDs and prevents duplicate entries.
 *
 * Example usage:
 * ```typescript
 * const mapper = new GuidMapper('http://api.example.com/mappings');
 * const value = await mapper.get('123e4567-e89b-12d3-a456-426614174000');
 * ```
 *
 * @throws {ValidationError} When encountering invalid GUID formats or duplicate entries
 * @throws {GuidNotFoundError} When a requested GUID cannot be found after fetching
 */

export interface IGuidMapper {
    get(guid: string): Promise<string>;
}

interface MappingsResponse {
    mappings: string;
}

export class GuidMapper {
    private readonly mappings = new Map<GUID, string>();
    private readonly logger = log4js.getLogger('GuidMapper');

    constructor(
        private readonly dataUrl: string,
        private readonly axiosInstance: AxiosInstance = axios,
    ) {
        this.logger.info(`GuidMapper initialized with data URL: ${dataUrl}`);
    }

    public async get(guid: string): Promise<string> {
        this.validateGuid(guid);

        const existing = this.mappings.get(guid);
        if (existing) {
            this.logger.debug(`Found existing mapping for GUID: ${guid}`);
            return existing;
        }

        this.logger.debug(`No existing mapping found for GUID: ${guid}, fetching new mappings`);
        await this.fetchAndUpdateMappings();

        const updated = this.mappings.get(guid);
        if (!updated) {
            this.logger.error(`GUID not found after fetch attempt: ${guid}`);
            throw new GuidNotFoundError(guid);
        }

        return updated;
    }

    private validateGuid(guid: string): asserts guid is GUID {
        if (!isUuid(guid)) {
            this.logger.error(`Invalid GUID format received: ${guid}`);
            throw new ValidationError(`Invalid GUID format: ${guid}`);
        }
    }

    private parseEntries(data: string): Array<[GUID, string]> {
        const entries = data
            .split(';')
            .filter(Boolean)
            .map(entry => {
                const [guid, value] = entry.split(':').map(s => s.trim());

                if (!guid || !value) {
                    this.logger.error('Empty GUID or value encountered in data');
                    throw new ValidationError('Guid or Value empty');
                }

                try {
                    this.validateGuid(guid);
                    return [guid, value] as [GUID, string];
                } catch {
                    this.logger.error(`Invalid GUID format in data: ${guid}`);
                    throw new ValidationError('Invalid Guid');
                }
            })
            .filter((entry): entry is [GUID, string] => entry !== null);

        if (entries.length === 0) {
            this.logger.error('No valid entries found in parsed data');
            throw new ValidationError('No valid entries found');
        }

        return entries;
    }

    private async fetchAndUpdateMappings(): Promise<void> {
        this.logger.info(`Fetching new mappings from ${this.dataUrl}`);
        try {
            const {data} = await this.axiosInstance.get<MappingsResponse>(this.dataUrl);

            if (!data?.mappings) {
                this.logger.error('Invalid response format: missing mappings property');
                throw new ValidationError('Invalid response format');
            }

            const newEntries = this.parseEntries(data.mappings);

            const seenGuids = new Set<string>();
            for (const [guid] of newEntries) {
                if (seenGuids.has(guid)) {
                    this.logger.error(`Duplicate GUID found in new entries: ${guid}`);
                    throw new ValidationError(`Duplicate GUID found in new entries: ${guid}`);
                }
                seenGuids.add(guid);
            }

            for (const [guid] of newEntries) {
                if (this.mappings.has(guid)) {
                    this.logger.error(`Duplicate GUID found with existing mapping: ${guid}`);
                    throw new ValidationError(`Duplicate GUID found: ${guid}`);
                }
            }

            for (const [guid, value] of newEntries) {
                this.mappings.set(guid, value);
            }

            this.logger.info(`Successfully updated mappings with ${newEntries.length} new entries`);
        } catch (error) {
            this.logger.error('Error fetching mappings:', error);
            throw error;
        }
    }
}