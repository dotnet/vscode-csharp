'use strict';

export class Delimiter {

    private _start: string;
    private _end: string;

    public get start(): string {
        return this._start;
    }

    public get end(): string {
        return this._end;
    }

    constructor(start: string, end: string) {
        this._start = start;
        this._end = end;
    }

    public wrap(value: any): string {
        return this.start + value + this.end;
    }

    public replace(text: string, replace: string | ((found: string) => string)): string {
        let range = this._findRange(text);
        if (!range) {
            return text;
        }

        let before = text.substr(0, range.start);
        let after = text.substring(range.end, text.length);
        let replaceString: string = undefined;

        if (typeof replace === 'string') {
            replaceString = replace;
        } else {
            replaceString = replace(text.substring(range.start, range.end));
        }

        return before + replaceString + after;
    }

    private _findRange(text: string): TextRange {
        let startIndex = text.indexOf(this.start);
        if (startIndex >= 0) {
            startIndex += this.start.length;
            let endIndex = text.indexOf(this.end, startIndex);
            if (endIndex >= 0) {
                return { start: startIndex, end: endIndex };
            }
        }
        return undefined;
    }
}

interface TextRange {
    start: number;
    end: number;
}