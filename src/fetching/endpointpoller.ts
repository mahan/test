import {createHash} from 'crypto';
import axios, {AxiosInstance} from 'axios';
import * as http from "node:http";
import log4js from 'log4js';

/**
 * EndpointPoller - A robust HTTP endpoint monitoring class
 *
 * This class implements a polling mechanism that monitors an HTTP endpoint for changes.
 * It features automatic backoff on errors, checksum comparison to detect changes,
 * state management, and the ability to handle binary data responses.
 *
 * The polling process involves making HTTP GET requests to a specified URL at regular intervals.
 * If the response differs from the previous one (based on a SHA-256 checksum of the response body),
 * it notifies all change listeners. The class automatically handles request errors and applies an
 * exponential backoff strategy to minimize impact on both the client and server.
 *
 * Example usage:

 * class MyChangeListener implements EndpointChangeListener {
 *   onEndpointChange(url: string, data: string): void {
 *     console.log(`Content changed at ${url}:`, data);
 *   }
 * }
 *
 * const poller = new EndpointPoller(
 *   1000, // Poll every second
 *   'http://api.example.com', // URL to monitor
 *    [new MyChangeListener()] // Your change handlers
 * );
 *
 * await poller.startPolling(); // Begin polling
 */

export enum PollerState {
    INITIALIZING = 'INITIALIZING',
    POLLING = 'POLLING',
    BACKING_OFF = 'BACKING_OFF',
    ERROR = 'ERROR'
}

export interface EndpointChangeListener {
    onEndpointChange(url: string, data: string): Promise<void>;
}

export class EndpointPoller {
    private readonly _axiosInstance: AxiosInstance;
    private lastSuccessfulRequest: number = 0;
    private currentBackoffDelay: number = 1000;
    private lastChecksum: string = '';
    private currentState: PollerState = PollerState.INITIALIZING;
    private isPolling: boolean = false;
    private pollPromiseResolve?: () => void;
    private readonly REQUEST_TIMEOUT = 5000;
    private readonly MAX_BACKOFF_DELAY = 10000;
    private readonly BACKOFF_MULTIPLIER = 2;
    private changeListeners: EndpointChangeListener[];
    private logger: log4js.Logger;

    constructor(
        private readonly requestDelayMs: number,
        private readonly url: string,
        changeListeners: EndpointChangeListener[],
        axiosInstance: AxiosInstance | null = null
    ) {
        this.logger = log4js.getLogger('EndpointPoller');
        this.changeListeners = [...changeListeners];
        if (axiosInstance != null) {
            this._axiosInstance = axiosInstance
        } else {
            this._axiosInstance = axios.create({
                timeout: this.REQUEST_TIMEOUT,
                validateStatus: (status) => status >= 200 && status < 300,
                httpAgent: new http.Agent({keepAlive: true, maxSockets: 10})
            });
        }
        let pollingInterval = requestDelayMs == 0 ? 'continuous' : `${requestDelayMs}ms`
        this.logger.info(`Initialized EndpointPoller for URL: ${this.url} interval: ${pollingInterval}`);
    }

    public async startPolling(): Promise<void> {
        if (this.isPolling) return;

        this.isPolling = true;
        this.currentState = PollerState.POLLING;
        this.logger.debug(`Starting polling for URL: ${this.url}`);

        return new Promise<void>((resolve) => {
            this.pollPromiseResolve = resolve;
            this.poll();
        });
    }

    public stopPolling(): void {
        this.logger.debug(`Stopping polling for URL: ${this.url}`);
        this.isPolling = false;
        this.currentState = PollerState.INITIALIZING;
        if (this.pollPromiseResolve) {
            this.pollPromiseResolve();
            this.pollPromiseResolve = undefined;
        }
    }

    public addChangeListener(listener: EndpointChangeListener): void {
        this.changeListeners.push(listener);
        this.logger.trace(`Added change listener. Total listeners: ${this.changeListeners.length}`);
    }

    public removeChangeListener(listener: EndpointChangeListener): void {
        const index = this.changeListeners.indexOf(listener);
        if (index > -1) {
            this.changeListeners.splice(index, 1);
            this.logger.trace(`Removed change listener. Total listeners: ${this.changeListeners.length}`);
        }
    }

    private async poll(): Promise<void> {
        while (this.isPolling) {
            try {
                await this.performRequest();
                this.currentBackoffDelay = 1000;
                this.currentState = PollerState.POLLING;

                if (this.requestDelayMs > 0 && this.isPolling) {
                    await this.delay(this.requestDelayMs);
                }
            } catch (error) {
                this.currentState = PollerState.ERROR;
                await this.handleError();
            }
        }
    }

    private async performRequest(): Promise<void> {
        this.logger.trace(`Performing request to ${this.url}`);
        const response = await this._axiosInstance.get(this.url, {
            responseType: 'arraybuffer'
        }).catch(error => {
            if (axios.isAxiosError(error)) {
                const errorMessage = error.code === 'ECONNABORTED'
                    ? 'Request timed out'
                    : error.message;
                throw new Error(errorMessage);
            }
            throw error;
        });

        const data = response.data;
        const newChecksum = this.calculateChecksum(data);

        if (this.lastChecksum !== newChecksum) {
            this.lastChecksum = newChecksum;
            const decoder = new TextDecoder('utf-8');
            const decodedData = decoder.decode(data);
            this.logger.trace(`Content changed for ${this.url}. Notifying listeners.`);
            // Execute all change listeners serially
            for (const listener of this.changeListeners) {
                await listener.onEndpointChange(this.url, decodedData);
            }
        }

        this.lastSuccessfulRequest = Date.now();
    }

    private async handleError(): Promise<void> {
        this.currentState = PollerState.BACKING_OFF;
        this.currentBackoffDelay = Math.min(
            this.currentBackoffDelay * this.BACKOFF_MULTIPLIER,
            this.MAX_BACKOFF_DELAY
        );

        this.logger.warn(
            `Entering backoff state for ${this.url}. ` +
            `Next retry in ${this.currentBackoffDelay}ms`
        );

        if (this.isPolling) {
            await this.delay(this.currentBackoffDelay);
        }
    }

    private calculateChecksum(data: ArrayBuffer): string {
        const buffer = Buffer.from(data);
        return createHash('sha256').update(buffer).digest('hex');
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public get state(): PollerState {
        return this.currentState;
    }

    public get timeSinceLastSuccessfulRequestMs(): number {
        return this.lastSuccessfulRequest === 0
            ? Number.MAX_SAFE_INTEGER
            : Date.now() - this.lastSuccessfulRequest
    }
}