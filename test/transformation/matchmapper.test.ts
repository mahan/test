import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatchMapper } from '../../src/transformation/matchmapper.js';
import { IGuidMapper } from '../../src/fetching/guidmapper.js';
import { ValidationError } from '../../src/common/types.js';

describe('MatchMapper', () => {
    let guidMapper: IGuidMapper;

    beforeEach(() => {
        // Mock IGuidMapper
        guidMapper = {
            get: vi.fn(async (guid: string) => {
                const mappings: Record<string, string> = {
                    '9860e748-1f53-45ed-9a3f-2eeb46550083': 'FOOTBALL',
                    '13605dbb-fb95-4373-8354-dbce8272086c': 'UEFA Champions League',
                    'c22ca89b-50db-4a90-84d3-25daf31de9db': 'Bayern Munich',
                    '54963ddf-ddc6-41b6-a7d1-3e2b76f531c0': 'Juventus',
                    '93f346fd-c921-4f67-b4c3-64fe1f466140': 'LIVE',
                    '5c3a00b4-6dca-4439-8340-9eba10777517': 'CURRENT',
                    'dcbade30-42ad-47bc-8698-71ff7e6c337f': 'PERIOD_1',
                    '7e373f85-3dd1-4b8a-8e9b-5bd0cbe22e64': 'PERIOD_2'
                };
                return mappings[guid] || guid;
            })
        };
    });

    describe('constructor', () => {
        it('should successfully create instance with valid record', () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,1729839678453,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140';

            const mapper = new MatchMapper(guidMapper);
            mapper.parseRecord(record)
            expect(mapper.getRawData()).toBe(record);
        });

        it('should throw ValidationError if record has incorrect number of fields', () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083';

            const mapper = new MatchMapper(guidMapper);
            expect(() => mapper.parseRecord(record))
                .toThrow(ValidationError);
        });

        it('should throw ValidationError if any GUID field is invalid', () => {
            const record = 'invalid-guid,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,1729839678453,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140';

            const mapper = new MatchMapper(guidMapper);
            expect(() => mapper.parseRecord(record))
                .toThrow(ValidationError);
        });

        it('should throw ValidationError if timestamp is invalid', () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,invalid-timestamp,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140';

            const mapper = new MatchMapper(guidMapper);
            expect(() => mapper.parseRecord(record))
                .toThrow(ValidationError);
        });
    });

    describe('goal parsing', () => {
        it('should successfully parse valid goals string', () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,1729839678453,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140,5c3a00b4-6dca-4439-8340-9eba10777517@14:9|dcbade30-42ad-47bc-8698-71ff7e6c337f@8:3';

            const mapper = new MatchMapper(guidMapper);
            mapper.parseRecord(record);
            expect(mapper.getRawData()).toBe(record);
        });

        it('should throw ValidationError if period GUID is invalid', () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,1729839678453,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140,invalid-guid@14:9';

            const mapper = new MatchMapper(guidMapper);
            expect(() => mapper.parseRecord(record))
                .toThrow(ValidationError);
        });

        it('should throw ValidationError if goals format is invalid', () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,1729839678453,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140,5c3a00b4-6dca-4439-8340-9eba10777517@invalid:goals';

            const mapper = new MatchMapper(guidMapper);
            expect(() => mapper.parseRecord(record))
                .toThrow(ValidationError);
        });
    });

    describe('renderOutputObject', () => {
        it('should correctly render match object with goals', async () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,1729839678453,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140,5c3a00b4-6dca-4439-8340-9eba10777517@14:9|dcbade30-42ad-47bc-8698-71ff7e6c337f@8:3';

            const mapper = new MatchMapper(guidMapper);
            mapper.parseRecord(record);
            const result = await mapper.renderMatchObject();

            expect(result).toHaveProperty('ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9');
            const match = result['ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9'];

            expect(match).toMatchObject({
                id: 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9',
                status: 'LIVE',
                sport: 'FOOTBALL',
                competition: 'UEFA Champions League',
                startTime: new Date(1729839678453).toISOString(),
                competitors: {
                    HOME: {
                        type: 'HOME',
                        name: 'Bayern Munich'
                    },
                    AWAY: {
                        type: 'AWAY',
                        name: 'Juventus'
                    }
                },
                scores: {
                    'CURRENT': {
                        type: 'CURRENT',
                        home: 14,
                        away: 9
                    },
                    'PERIOD_1': {
                        type: 'PERIOD_1',
                        home: 8,
                        away: 3
                    }
                }
            });
        });

        it('should handle match without goals', async () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,1729839678453,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140';

            const mapper = new MatchMapper(guidMapper);
            mapper.parseRecord(record);
            const result = await mapper.renderMatchObject();

            expect(result).toHaveProperty('ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9');
            const match = result['ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9'];

            expect(match.scores).toEqual({});
        });

        it('should throw on renderOutputObject if object is not initialized.', async () => {
            const mapper = new MatchMapper(guidMapper);
            await expect(mapper.renderMatchObject())
                .rejects
                .toThrow(ValidationError);
        });
    });

    describe('serialize', () => {
        it('should correctly serialize match object', async () => {
            const record = 'ec517b6c-6ed8-4449-ad9b-0a1dbbbf8fb9,9860e748-1f53-45ed-9a3f-2eeb46550083,13605dbb-fb95-4373-8354-dbce8272086c,1729839678453,c22ca89b-50db-4a90-84d3-25daf31de9db,54963ddf-ddc6-41b6-a7d1-3e2b76f531c0,93f346fd-c921-4f67-b4c3-64fe1f466140';

            const mapper = new MatchMapper(guidMapper);
            mapper.parseRecord(record);
            const result = await mapper.renderMatchObject();
            const serialized = MatchMapper.serialize(result);

            expect(serialized).toBe(JSON.stringify(result, null, 2));
        });
    });
});