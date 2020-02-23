export default function getRoundRuntime(runs) {
    if (!runs || runs.length === 0) {
        return 0;
    }

    const time = Date.now();
    const lastRun = runs[runs.length - 1];
    let runtime = 0;

    for  (const run of runs) {
        const {startTime, endTime} = run;

        if (startTime && endTime) {
            runtime += endTime - startTime;
        } else if (startTime && run === lastRun) {
            runtime += time - startTime;
        }
    }

    return runtime;
}