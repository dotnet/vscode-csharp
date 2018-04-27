/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const ImmedateDelayMax = 25;
const NearImmediateDelayMax = 50;
const ShortDelayMax = 250;
const MediumDelayMax = 500;
const IdleDelayMax = 1500;
const NonFocusDelayMax = 3000;

export class DelayTracker {
    private _name: string;

    private _immediateDelays: number = 0;      // 0-25 milliseconds
    private _nearImmediateDelays: number = 0;  // 26-50 milliseconds
    private _shortDelays: number = 0;          // 51-250 milliseconds
    private _mediumDelays: number = 0;         // 251-500 milliseconds
    private _idleDelays: number = 0;           // 501-1500 milliseconds
    private _nonFocusDelays: number = 0;       // 1501-3000 milliseconds
    private _bigDelays: number = 0;            // 3000+ milliseconds

    constructor(name: string) {
        this._name = name;
    }

    public reportDelay(elapsedTime: number) {
        if (elapsedTime <= ImmedateDelayMax) {
            this._immediateDelays += 1;
        }
        else if (elapsedTime <= NearImmediateDelayMax) {
            this._nearImmediateDelays += 1;
        }
        else if (elapsedTime <= ShortDelayMax) {
            this._shortDelays += 1;
        }
        else if (elapsedTime <= MediumDelayMax) {
            this._mediumDelays += 1;
        }
        else if (elapsedTime <= IdleDelayMax) {
            this._idleDelays += 1;
        }
        else if (elapsedTime <= NonFocusDelayMax) {
            this._nonFocusDelays += 1;
        }
        else {
            this._bigDelays += 1;
        }
    }

    public name(): string {
        return this._name;
    }

    public clearMeasures() {
        this._immediateDelays = 0;
        this._nearImmediateDelays = 0;
        this._shortDelays = 0;
        this._mediumDelays = 0;
        this._idleDelays = 0;
        this._nonFocusDelays = 0;
        this._bigDelays = 0;
    }

    public hasMeasures() {
        return this._immediateDelays > 0
            || this._nearImmediateDelays > 0
            || this._shortDelays > 0
            || this._mediumDelays > 0
            || this._idleDelays > 0
            || this._nonFocusDelays > 0
            || this._bigDelays > 0;
    }

    public getMeasures(): { [key: string]: number } {
        return {
            immediateDelays: this._immediateDelays,
            nearImmediateDelays: this._nearImmediateDelays,
            shortDelays: this._shortDelays,
            mediumDelays: this._mediumDelays,
            idleDelays: this._idleDelays,
            nonFocusDelays: this._nonFocusDelays,
            bigDelays: this._bigDelays
        };
    }
}
