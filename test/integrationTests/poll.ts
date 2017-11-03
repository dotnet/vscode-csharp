export default async function poll<T>(getValue: () => T, duration: number, step: number): Promise<T> {
    while (duration > 0) {
        let value = getValue();

        if (value) {
            return value;
        }

        await sleep(step);

        duration -= step;
    }

    throw new Error("Polling did not succeed within the alotted duration.");
}

function sleep(ms = 0) {
    return new Promise(r => setTimeout(r, ms));
}