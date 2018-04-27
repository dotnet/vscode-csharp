declare module 'async-child-process' {

    import { ChildProcess } from "child_process";

    export function join(childProcess: ChildProcess): Promise<Result>;

    export interface Result {
        code: string;
        signal: string;
    }
}
