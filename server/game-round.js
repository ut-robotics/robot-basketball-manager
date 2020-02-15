const EventEmitter = require('events');
const {mainRoundLength} = require('./constants');

class GameRound extends EventEmitter {
    #runs = [];
    #runtimeCheckInterval;
    #roundMaxLength = mainRoundLength; // milliseconds
    #hasEnded = false;
    #baskets;
    #scores = [0, 0];
    #fouls = [0, 0];

    get hasEnded() {
        return this.#hasEnded;
    }

    constructor(roundMaxLength, baskets) {
        super();
        this.#roundMaxLength = roundMaxLength;
        this.#baskets = baskets;
    }

    start() {
        const time = Date.now();

        if (this.hasEnded) {
            return;
        }

        const lastRun = this.#getLastRun();

        if (lastRun && lastRun.endTime || !lastRun) {
            this.#runs.push({startTime: time, endTime: null});
        }

        if (!this.#runtimeCheckInterval) {
            this.#startRuntimeCheck();
        }
    }

    stop() {
        const time = Date.now();
        const lastRun = this.#getLastRun();

        if (lastRun && !lastRun.endTime) {
            lastRun.endTime = time;
        }
    }

    end() {
        if (this.hasEnded) {
            return;
        }

        clearInterval(this.#runtimeCheckInterval);
        this.stop();
        this.#hasEnded = true;
        this.emit('ended');
    }

    #startRuntimeCheck = () => {
        if (!this.#runtimeCheckInterval) {
            this.#runtimeCheckInterval = setInterval(() => {
                const runtime = this.getRuntime();

                console.log('Round runtime', runtime);

                if (runtime >= this.#roundMaxLength) {
                    this.end();
                }
            }, 1000);
        }
    };

    #getLastRun = () => {
        return this.#runs[this.#runs.length - 1] || null;
    };

    getRuntime() {
        const time = Date.now();
        const lastRun = this.#getLastRun();
        let runtime = 0;

        for  (const run of this.#runs) {
            const {startTime, endTime} = run;

            if (startTime && endTime) {
                runtime += endTime - startTime;
            } else if (startTime && run === lastRun) {
                runtime += time - startTime;
            }
        }

        return runtime;
    }

    incrementScore(basket) {
        const basketIndex = this.#baskets.indexOf(basket);

        if (basketIndex === 0 || basketIndex === 1) {
            this.#scores[basketIndex]++;
        }
    }

    incrementFouls(robotIndex) {
        if (robotIndex === 0 || robotIndex === 1) {
            this.#fouls[robotIndex]++;
        }
    }

    getScores() {
        return this.#scores;
    }

    getWinnerIndex() {
        if (!this.hasEnded) {
            return -1;
        }

        const [score1, score2] = this.#scores;

        if (score1 > score2) {
            return 0;
        } else if (score1 < score2) {
            return 1;
        }

        return -1;
    }

    getInfo() {
        return {
            scores: this.#scores,
            fouls: this.#fouls,
            baskets: this.#baskets,
            hasEnded: this.#hasEnded,
            duration: this.getRuntime(),
            timeLimit: this.#roundMaxLength,
            winnerIndex: this.getWinnerIndex(),
            runs: this.#runs,
        }
    }

    isRunning() {
        const lastRun = this.#getLastRun();

        if (!lastRun) {
            return false;
        }

        return !lastRun.endTime;
    }
}

module.exports = GameRound;