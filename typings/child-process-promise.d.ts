declare module 'child-process-promise' {

    import { ChildProcess, ExecOptions } from "child_process";
    export function exec(command: string, options?: ExecOptions): Promise<Result>;

    export interface Result{
        childProcess: ChildProcess;
        stdout: string;
        stdErr: string;
    }
}
