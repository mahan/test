
export type GUID = string & { readonly _brand: unique symbol };

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class GuidNotFoundError extends Error {
    constructor(guid: string) {
        super(`GUID not found: ${guid}`);
        this.name = 'GuidNotFoundError';
    }
}