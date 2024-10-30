import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from 'vitest';
import { GuidMapper } from '../../src/fetching/guidmapper.js';
import axios from 'axios';

vi.mock('axios');

const mockAxios = axios as Mocked<typeof axios>;

describe('GuidMapper', () => {
    let mapper: GuidMapper;
    const url = 'https://api.example.com/mappings';
    const validMappingsResponse = {
        mappings: 'ca657bde-7b35-4627-9f8b-809ea1f79340:Real Madrid;6fa5777e-94a5-4f20-8a1a-055039d619c6:Barcelona'
    };

    beforeEach(() => {
        mapper = new GuidMapper(url, mockAxios);
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('successfully gets a value for a valid GUID', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: validMappingsResponse });

        const value = await mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340');

        expect(value).toBe('Real Madrid');
        expect(mockAxios.get).toHaveBeenCalledWith(url);
    });

    it('throws ValidationError for invalid GUID format', async () => {
        await expect(mapper.get('invalid-guid'))
            .rejects
            .toThrow('Invalid GUID format');
    });

    it('throws GuidNotFoundError when GUID is not found after fetching', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: validMappingsResponse });

        await expect(mapper.get('550e8400-e29b-41d4-a716-446655440000'))
            .rejects
            .toThrow('GUID not found');
    });

    it('caches values and does not fetch again for known GUIDs', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: validMappingsResponse });

        // First call should fetch
        await mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340');
        // Second call should use cache
        await mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340');

        expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    it('throws ValidationError for empty response', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: { mappings: '' } });

        await expect(mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340'))
            .rejects
            .toThrow('Invalid response format');
    });

    it('throws ValidationError for invalid response format', async () => {
        mockAxios.get.mockResolvedValueOnce({ data: {} });

        await expect(mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340'))
            .rejects
            .toThrow('Invalid response format');
    });

    it('throws ValidationError for duplicate GUIDs in response', async () => {
        const duplicateResponse = {
            mappings: 'ca657bde-7b35-4627-9f8b-809ea1f79340:Real Madrid;ca657bde-7b35-4627-9f8b-809ea1f79340:Barcelona'
        };
        mockAxios.get.mockResolvedValueOnce({ data: duplicateResponse });

        await expect(mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340'))
            .rejects
            .toThrow('Duplicate GUID found');
    });

    it('handles malformed entries in response', async () => {
        const malformedResponse = {
            mappings: 'ca657bde-7b35-4627-9f8b-809ea1f79340:Real Madrid;invalid:entry;6fa5777e-94a5-4f20-8a1a-055039d619c6:Barcelona'
        };
        mockAxios.get.mockResolvedValueOnce({ data: malformedResponse });

        await expect(mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340'))
            .rejects
            .toThrow('Invalid Guid');
    });

    it('handles network errors gracefully', async () => {
        mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

        await expect(mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340'))
            .rejects
            .toThrow();
    });

    it('handles response with missing value part correctly', async () => {
        const invalidResponse = {
            mappings: 'ca657bde-7b35-4627-9f8b-809ea1f79340:;6fa5777e-94a5-4f20-8a1a-055039d619c6:Barcelona'
        };
        mockAxios.get.mockResolvedValueOnce({ data: invalidResponse });

        await expect(mapper.get('6fa5777e-94a5-4f20-8a1a-055039d619c6'))
            .rejects
            .toThrow('Guid or Value empty');
    });

    it('handles response with whitespace value part correctly', async () => {
        const invalidResponse = {
            mappings: 'ca657bde-7b35-4627-9f8b-809ea1f79340:    ;6fa5777e-94a5-4f20-8a1a-055039d619c6:Barcelona'
        };
        mockAxios.get.mockResolvedValueOnce({ data: invalidResponse });

        await expect(mapper.get('6fa5777e-94a5-4f20-8a1a-055039d619c6'))
            .rejects
            .toThrow('Guid or Value empty');
    });

    it('throws ValidationError when fetching response contains GUID that exists in state', async () => {
        // First call to populate state
        mockAxios.get.mockResolvedValueOnce({
            data: {
                mappings: 'ca657bde-7b35-4627-9f8b-809ea1f79340:Real Madrid'
            }
        });
        await mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340');

        // Second call with same GUID but different value
        mockAxios.get.mockResolvedValueOnce({
            data: {
                mappings: 'ca657bde-7b35-4627-9f8b-809ea1f79340:Barcelona'
            }
        });

        // now try to fetch another GUID to trigger the fetching, which is expected to pull the duplicate
        await expect(mapper.get('ca657bde-7b35-4627-9f8b-000000000000'))
            .rejects
            .toThrow('Duplicate GUID found');
    });

    it('throws ValidationError for response with no entries', async () => {
        mockAxios.get.mockResolvedValueOnce({
            data: {
                mappings: ';'
            }
        });

        await expect(mapper.get('ca657bde-7b35-4627-9f8b-809ea1f79340'))
            .rejects
            .toThrow('No valid entries found');
    });

});