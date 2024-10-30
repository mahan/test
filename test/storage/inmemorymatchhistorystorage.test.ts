import {InMemoryMatchHistoryStorage} from '../../src/storage/inmemorymatchhistorystorage.js';
import {IMatchHistoryStorage, MatchHistoryEntry} from '../../src/storage/matchhistorystorage.interface.js';
import {beforeEach, describe, expect, test} from 'vitest';
import {CompetitorType, EventStatus, IMatchMapper, MappedMatch} from "../../src/transformation/matchmapper.js";

describe('MatchHistoryStorage', () => {
    let storage: IMatchHistoryStorage;

    class MockMatchMapper implements IMatchMapper {
        parseRecord(record: string): void {
            // Do nothing for testing
        }

        async renderMatchObject(): Promise<Record<string, MappedMatch>> {
            return {
                'match1': {
                    id: 'match1',
                    status: EventStatus.LIVE,
                    startTime: '2024-10-25T15:00:00Z',
                    sport: 'FOOTBALL',
                    competition: 'Test League',
                    scores: {
                        fullTime: {
                            type: 'fullTime',
                            home: 2,
                            away: 1
                        }
                    },
                    competitors: {
                        [CompetitorType.HOME]: {
                            type: CompetitorType.HOME,
                            name: 'Team A'
                        },
                        [CompetitorType.AWAY]: {
                            type: CompetitorType.AWAY,
                            name: 'Team B'
                        }
                    }
                }
            };
        }
    }

    beforeEach(() => {
        storage = new InMemoryMatchHistoryStorage(new MockMatchMapper());
    });

    describe('insertMatchRecord', () => {
        test('should store a new match record', async () => {
            const jsonData = {
                odds: '08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797447562,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@5:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@5:4'
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));
            const history = await storage.getMatchHistory('08c9dcb8-b231-4651-9e66-acbd9a0a7010');

            expect(history).toHaveLength(1);
            expect(history[0].rawData).toBe(jsonData.odds);
        });

        test('should append new records to existing match history', async () => {
            const jsonData1 = {
                odds: '08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797447562,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@5:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@5:4'
            };
            const jsonData2 = {
                odds: '08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797453047,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@6:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@6:4'
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData1));
            await storage.onEndpointChange('test-url', JSON.stringify(jsonData2));

            const history = await storage.getMatchHistory('08c9dcb8-b231-4651-9e66-acbd9a0a7010');
            expect(history).toHaveLength(2);
            expect(history[0].rawData).toBe(jsonData1.odds);
            expect(history[1].rawData).toBe(jsonData2.odds);
        });

        test('should handle malformed match ID (non GUID)', async () => {
            const jsonData = {
                odds: 'not-a-valid-guid,some-other-data,more-data'
            };

            await expect(storage.onEndpointChange('test-url', JSON.stringify(jsonData)))
                .rejects
                .toThrow('Invalid match ID format');
        });
    });

    describe('getCurrentMatchEntry', () => {
        test('should return undefined for non-existent match', async () => {
            const entry = await storage.getCurrentMatchEntry('622def4b-df54-4938-b4f2-d73e7463f1bf');
            expect(entry).toBeUndefined();
        });

        test('should return the most recent entry', async () => {
            const jsonData = {
                odds: `fb766505-8953-465f-a4ec-eafe95c3e583,622def4b-df54-4938-b4f2-d73e7463f1bf,7244cf9b-df64-40ea-8793-356fb20bfc0d,1729797421325,c3f9a25d-f5ad-437c-a71e-b17d40d08bc2,225b46d9-e3a7-43b5-b05f-336cf76a123a,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@4:6|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@3:5|7da06a00-0b01-4358-969e-80654da529bd@1:1\n49e0a4c7-d0e5-4358-88d9-44386b66ffc7,622def4b-df54-4938-b4f2-d73e7463f1bf,7244cf9b-df64-40ea-8793-356fb20bfc0d,1729797431608,4d38d45a-df39-49fe-9f4f-504203fabf2d,20f70c95-db9b-4dd4-9f6e-2b6fa4d4fa48,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@8:5|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@7:5|7da06a00-0b01-4358-969e-80654da529bd@1:0`
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));

            const currentEntry = await storage.getCurrentMatchEntry('fb766505-8953-465f-a4ec-eafe95c3e583');
            expect(currentEntry?.rawData).toContain('@4:6');
        });
    });

    describe('getMatchHistory', () => {
        test('should return empty array for non-existent match', async () => {
            const history = await storage.getMatchHistory('622def4b-df54-4938-b4f2-d73e7463f1bf');
            expect(history).toEqual([]);
        });

        test('should return all entries in chronological order', async () => {
            const jsonData = {
                odds: `fb766505-8953-465f-a4ec-eafe95c3e583,622def4b-df54-4938-b4f2-d73e7463f1bf,7244cf9b-df64-40ea-8793-356fb20bfc0d,1729797421325,c3f9a25d-f5ad-437c-a71e-b17d40d08bc2,225b46d9-e3a7-43b5-b05f-336cf76a123a,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@4:6|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@3:5|7da06a00-0b01-4358-969e-80654da529bd@1:1\n49e0a4c7-d0e5-4358-88d9-44386b66ffc7,622def4b-df54-4938-b4f2-d73e7463f1bf,7244cf9b-df64-40ea-8793-356fb20bfc0d,1729797431608,4d38d45a-df39-49fe-9f4f-504203fabf2d,20f70c95-db9b-4dd4-9f6e-2b6fa4d4fa48,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@8:5|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@7:5|7da06a00-0b01-4358-969e-80654da529bd@1:0\n3fe61f1e-977c-4d5c-8bf8-a287c075d657,622def4b-df54-4938-b4f2-d73e7463f1bf,7244cf9b-df64-40ea-8793-356fb20bfc0d,1729797443312,a91a9b58-cacd-43a5-98e6-0eecb1213730,54683ced-6f11-492c-b4e9-31396596e26b,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@7:6|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@4:4|7da06a00-0b01-4358-969e-80654da529bd@3:2`
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));

            const history = await storage.getMatchHistory('fb766505-8953-465f-a4ec-eafe95c3e583');
            expect(history).toHaveLength(1);
            expect(history[0].rawData).toContain('@4:6');
        });
    });

    describe('onEndpointChange', () => {
        test('should process multiple match updates', async () => {
            const jsonData = {
                odds: `08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797447562,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@5:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@5:4\nbf1b36ec-b239-4a26-98b2-26ee46c45caa,b622de9f-5500-4c81-b49a-bf6da30cfc1b,2e1d2139-e2e7-40e2-b594-fec16bc5e24b,1729797453047,a7e80b96-e7a7-4a23-9b96-8388de6b6956,e81c7b70-5de6-4773-9be9-ff4bb110da61,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@6:7|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@6:7`
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));

            const history1 = await storage.getMatchHistory('08c9dcb8-b231-4651-9e66-acbd9a0a7010');
            const history2 = await storage.getMatchHistory('bf1b36ec-b239-4a26-98b2-26ee46c45caa');

            expect(history1).toHaveLength(1);
            expect(history2).toHaveLength(1);
            expect(history1[0].rawData).toContain('@5:4');
            expect(history2[0].rawData).toContain('@6:7');
        });

        test('should not duplicate identical records', async () => {
            const jsonData = {
                odds: '08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797447562,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@5:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@5:4'
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));
            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));

            const history = await storage.getMatchHistory('08c9dcb8-b231-4651-9e66-acbd9a0a7010');
            expect(history).toHaveLength(1);
            expect(history[0].rawData).toContain('@5:4');
        });

        test('should handle empty lines in data', async () => {
            const jsonData = {
                odds: `08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797447562,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@5:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@5:4\nbf1b36ec-b239-4a26-98b2-26ee46c45caa,b622de9f-5500-4c81-b49a-bf6da30cfc1b,2e1d2139-e2e7-40e2-b594-fec16bc5e24b,1729797453047,a7e80b96-e7a7-4a23-9b96-8388de6b6956,e81c7b70-5de6-4773-9be9-ff4bb110da61,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@6:7|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@6:7`
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));

            const matchIds = await storage.getAllMatchIds();
            expect(matchIds).toHaveLength(2);
            expect(matchIds).toContain('08c9dcb8-b231-4651-9e66-acbd9a0a7010');
            expect(matchIds).toContain('bf1b36ec-b239-4a26-98b2-26ee46c45caa');
        });

        test('should handle malformed JSON', async () => {
            const invalidJson = '{odds: "not valid json"}';

            await expect(storage.onEndpointChange('test-url', invalidJson))
                .rejects
                .toThrow(SyntaxError);
        });
    });

    describe('clearHistory', () => {
        test('should remove all stored matches', async () => {
            const jsonData = {
                odds: `08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797447562,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@5:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@5:4\nbf1b36ec-b239-4a26-98b2-26ee46c45caa,b622de9f-5500-4c81-b49a-bf6da30cfc1b,2e1d2139-e2e7-40e2-b594-fec16bc5e24b,1729797453047,a7e80b96-e7a7-4a23-9b96-8388de6b6956,e81c7b70-5de6-4773-9be9-ff4bb110da61,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@6:7|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@6:7`
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));
            await storage.clearHistory();

            const allMatchIds = await storage.getAllMatchIds();
            expect(allMatchIds).toHaveLength(0);

            const history1 = await storage.getMatchHistory('08c9dcb8-b231-4651-9e66-acbd9a0a7010');
            const history2 = await storage.getMatchHistory('bf1b36ec-b239-4a26-98b2-26ee46c45caa');

            expect(history1).toHaveLength(0);
            expect(history2).toHaveLength(0);
        });
    });

    describe('getAllMatchIds', () => {
        test('should return empty array when no matches stored', async () => {
            const matchIds = await storage.getAllMatchIds();
            expect(matchIds).toEqual([]);
        });

        test('should return all unique match IDs from the data', async () => {
            const jsonData = {
                odds: `08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797447562,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@5:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@5:4\n08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797448562,updated-data,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@6:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@6:4\nbf1b36ec-b239-4a26-98b2-26ee46c45caa,b622de9f-5500-4c81-b49a-bf6da30cfc1b,2e1d2139-e2e7-40e2-b594-fec16bc5e24b,1729797453047,a7e80b96-e7a7-4a23-9b96-8388de6b6956,e81c7b70-5de6-4773-9be9-ff4bb110da61,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@6:7|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@6:7`
            };

            await storage.onEndpointChange('test-url', JSON.stringify(jsonData));

            const matchIds = await storage.getAllMatchIds();
            expect(matchIds).toHaveLength(2);
            expect(matchIds).toContain('08c9dcb8-b231-4651-9e66-acbd9a0a7010');
            expect(matchIds).toContain('bf1b36ec-b239-4a26-98b2-26ee46c45caa');
        });
    });

    test('should mark match as REMOVED when it disappears from updates', async () => {
        // First update with two live matches
        const initialData = {
            odds: `08c9dcb8-b231-4651-9e66-acbd9a0a7010,b622de9f-5500-4c81-b49a-bf6da30cfc1b,92850ff1-071e-4497-afc4-6455714f4309,1729797447562,aef57797-3f7e-43a3-8870-5082ed3a0ca9,1bbcac86-d0bc-4376-a8a3-22ae8a6962d2,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@5:4|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@5:4\nbf1b36ec-b239-4a26-98b2-26ee46c45caa,b622de9f-5500-4c81-b49a-bf6da30cfc1b,2e1d2139-e2e7-40e2-b594-fec16bc5e24b,1729797453047,a7e80b96-e7a7-4a23-9b96-8388de6b6956,e81c7b70-5de6-4773-9be9-ff4bb110da61,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@6:7|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@6:7`
        };

        // Second update with only one match (first match removed)
        const subsequentData = {
            odds: `bf1b36ec-b239-4a26-98b2-26ee46c45caa,b622de9f-5500-4c81-b49a-bf6da30cfc1b,2e1d2139-e2e7-40e2-b594-fec16bc5e24b,1729797463047,a7e80b96-e7a7-4a23-9b96-8388de6b6956,e81c7b70-5de6-4773-9be9-ff4bb110da61,bb247d2b-4601-4898-8b4a-79ee251bc468,1fbc8a52-93f8-4204-93e7-5322059de98c@7:7|49f3fffd-8c89-4c2e-8b92-dc6edee7dc13@7:7`
        };

        // Process initial data
        await storage.onEndpointChange('test-url', JSON.stringify(initialData));

        // Process subsequent data where first match is missing
        await storage.onEndpointChange('test-url', JSON.stringify(subsequentData));

        // Get the current entry for the removed match
        const removedMatchEntry = <MatchHistoryEntry>await storage.getCurrentMatchEntry('08c9dcb8-b231-4651-9e66-acbd9a0a7010');

        // Parse the rendered data and check status
        const renderedData = JSON.parse(removedMatchEntry.renderedData);
        expect(renderedData['match1'].status).toBe('REMOVED');
    });
});