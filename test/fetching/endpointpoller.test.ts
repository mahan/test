import { describe, it, expect, vi, beforeEach, afterEach, Mocked, test } from 'vitest';
import { EndpointPoller, EndpointChangeListener, PollerState } from '../../src/fetching/endpointpoller.js';
import axios from 'axios';

vi.mock('axios');

const mockAxios = axios as Mocked<typeof axios>;

describe('EndpointPoller', () => {
    let poller: EndpointPoller;
    const url = 'https://api.example.com';

    const mockChangeListener: EndpointChangeListener = {
        onEndpointChange: vi.fn((url: string, data: string): Promise<void> => {
            return Promise.resolve(); // Simulate successful completion
        }),
    };

    beforeEach(() => {
        poller = new EndpointPoller(100, url, [mockChangeListener], mockAxios);
    });

    afterEach(() => {
        poller.stopPolling();
        vi.resetAllMocks();
    });

    it('initializes with the correct state', () => {
        expect(poller.state).toBe(PollerState.INITIALIZING);
    });

    it('starts and stops polling correctly', async () => {
        vi.useFakeTimers();
        mockAxios.get.mockResolvedValue({ data: new ArrayBuffer(8) });

        const startPollingPromise = poller.startPolling();

        await vi.advanceTimersByTimeAsync(10);
        expect(poller.state).toBe(PollerState.POLLING);
        poller.stopPolling();
        await startPollingPromise;
        expect(poller.state).toBe(PollerState.INITIALIZING);
    });

    it('calls change listener on initial content', async () => {
        vi.useFakeTimers();
        const responseData = new TextEncoder().encode('New content');
        mockAxios.get.mockResolvedValueOnce({ data: responseData.buffer });
        const startPollingPromise = poller.startPolling();
        await vi.advanceTimersByTimeAsync(10);
        expect(mockChangeListener.onEndpointChange).toHaveBeenCalledWith(url, 'New content');
        poller.stopPolling();
    });

    it('calls change listener on changed content', async () => {
        vi.useFakeTimers();
        let responseData = new TextEncoder().encode('Old content');
        mockAxios.get.mockResolvedValueOnce({ data: responseData.buffer });
        const startPollingPromise = poller.startPolling();
        await vi.advanceTimersByTimeAsync(10);
        expect(mockChangeListener.onEndpointChange).toHaveBeenCalledWith(url, 'Old content');
        responseData = new TextEncoder().encode('New content');
        mockAxios.get.mockResolvedValueOnce({ data: responseData.buffer });
        await vi.advanceTimersByTimeAsync(120);
        expect(mockChangeListener.onEndpointChange).toHaveBeenCalledWith(url, 'New content');
    });

    it('handles errors and applies backoff strategy', async () => {
        vi.useFakeTimers();
        mockAxios.get.mockRejectedValue(new Error('Network error'));
        const startPollingPromise = poller.startPolling();
        await vi.advanceTimersByTimeAsync(1200);
        expect(poller.state).toBe(PollerState.BACKING_OFF);
    });

    it('handles errors and updates timeSinceLastSuccessfulRequest', async () => {
        vi.useFakeTimers();
        mockAxios.get.mockRejectedValue(new Error('Network error'));
        const startPollingPromise = poller.startPolling();
        await vi.advanceTimersByTimeAsync(12000);
        expect(poller.timeSinceLastSuccessfulRequestMs).toBeGreaterThan(10000);
    });

    it('handles errors and applies backoff strategy after previous successful requests', async () => {
        vi.useFakeTimers();

        let responseData = new TextEncoder().encode('Content');
        mockAxios.get.mockResolvedValueOnce({ data: responseData.buffer });
        const startPollingPromise = poller.startPolling();
        await vi.advanceTimersByTimeAsync(10);
        expect(mockChangeListener.onEndpointChange).toHaveBeenCalledWith(url, 'Content');
        mockAxios.get.mockRejectedValueOnce(new Error('Network error'));
        await vi.advanceTimersByTimeAsync(12000);
        expect(poller.timeSinceLastSuccessfulRequestMs).toBeGreaterThan(10000);
    });



    it('Does not call change listener on getting unchanged content', async () => {
        vi.useFakeTimers();
        const responseData = new TextEncoder().encode('No change');
        let callCount = 0; // Counter for the number of times the mock function is called
        mockAxios.get.mockImplementation(() => {
            callCount++; // Increment the counter
            return Promise.resolve({data: responseData.buffer});
        });
        const startPollingPromise = poller.startPolling();
        await vi.advanceTimersByTimeAsync(1000);
        expect(callCount).toBeGreaterThan(1);
        expect(mockChangeListener.onEndpointChange).toHaveBeenCalledTimes(1);
    });

    it('adds a new change listener successfully', async () => {
        const newListener: EndpointChangeListener = {
            onEndpointChange: vi.fn((url: string, data: string): Promise<void> => {
                return Promise.resolve();
            }),
        };

        poller.addChangeListener(newListener);

        vi.useFakeTimers();
        const responseData = new TextEncoder().encode('New content');
        mockAxios.get.mockResolvedValueOnce({ data: responseData.buffer });
        const startPollingPromise = poller.startPolling();
        await vi.advanceTimersByTimeAsync(10);

        expect(mockChangeListener.onEndpointChange).toHaveBeenCalledWith(url, 'New content');
        expect(newListener.onEndpointChange).toHaveBeenCalledWith(url, 'New content');
    });

    it('removes a change listener successfully', async () => {
        poller.removeChangeListener(mockChangeListener);

        vi.useFakeTimers();
        const responseData = new TextEncoder().encode('New content');
        mockAxios.get.mockResolvedValueOnce({ data: responseData.buffer });
        const startPollingPromise = poller.startPolling();
        await vi.advanceTimersByTimeAsync(10);

        expect(mockChangeListener.onEndpointChange).not.toHaveBeenCalled();
    });

});
