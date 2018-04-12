/*--------------------------------------------------------------------------------------------- 
 *  Copyright (c) Microsoft Corporation. All rights reserved. 
 *  Licensed under the MIT License. See License.txt in the project root for license information. 
 *--------------------------------------------------------------------------------------------*/ 
 
import { Subscription } from "rxjs/Subscription"; 
import Disposable from "./Disposable"; 
 
export default class CompositeDisposable extends Disposable { 
    private disposables = new Subscription(); 
 
    constructor (...disposables: Disposable[]){ 
        super(() => this.disposables.unsubscribe()); 
 
        for (const disposable of disposables) { 
            if (disposable) { 
                this.disposables.add(disposable.dispose); 
            } 
            else { 
                throw new Error("null disposables are not supported"); 
            } 
        } 
    } 
 
    public add(disposable: Disposable | {(): void}) { 
        if (!disposable) { 
            throw new Error("disposable cannot be null"); 
        } 
 
        const actualDisposable =  
            disposable.constructor.name === Disposable.name 
                ? <Disposable>disposable 
                : new Disposable(<{(): void}>disposable); 
         
        this.disposables.add(actualDisposable.dispose); 
    } 
}
