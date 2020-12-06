function time() {
    const date = new Date();

    return `${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}.${('00' + date.getMilliseconds()).slice(-3)}`;
}

function log(...parts) {
    console.log.apply(console, [time(), ...parts]);
}

function logError(...parts) {
    console.error.apply(console, [time(), ...parts]);
}

module.exports = {
    log,
    logError,
}