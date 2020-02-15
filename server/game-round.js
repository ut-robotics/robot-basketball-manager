const EventEmitter = require('events');
const {mainRoundLength} = require('./constants');

class GameRound extends EventEmitter {
    #runs = [];
    #runtimeCheckInterval;
    #roundMaxLength = mainRoundLength; // milliseconds
    #hasEnded = false;
    #baskets;
    #scores = [[], []];
    #fouls = [[], []];

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

                //console.log('Round runtime', runtime);

                if (runtime >= this.#roundMaxLength) {
                    this.end();
                }
            }, 100);
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
            this.#scores[basketIndex].push({time: Date.now(), isValid: true});
        }
    }

    incrementFouls(robotIndex) {
        if (robotIndex === 0 || robotIndex === 1) {
            this.#fouls[robotIndex].push({time: Date.now()});
        }
    }

    getScores() {
        return this.#scores;
    }

    getValidScoreCounts() {
        const validScoreCounts = [];

        for (const robotScores of this.#scores) {
            let validCount = 0;

            for (const score of robotScores) {
                if (score.isValid) {
                    validCount++;
                }
            }

            validScoreCounts.push(validCount);
        }

        return validScoreCounts;
    }

    getWinnerIndex() {
        if (!this.hasEnded) {
            return -1;
        }

        const [score1, score2] = this.getValidScoreCounts();

        if (score1 > score2) {
            return 0;
        } else if (score1 < score2) {
            return 1;
        }

        return -1;
    }

    isRunning() {
        const lastRun = this.#getLastRun();

        if (!lastRun) {
            return false;
        }

        return !lastRun.endTime;
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

    getState() {
        return {
            scores: this.#scores,
            fouls: this.#fouls,
            baskets: this.#baskets,
            hasEnded: this.#hasEnded,
            roundMaxLength: this.#roundMaxLength,
            runs: this.#runs,
        }
    }

    setState(state) {
        this.#scores = state.scores;
        this.#fouls = state.fouls;
        this.#baskets = state.baskets;
        this.#hasEnded = state.hasEnded;
        this.#roundMaxLength = state.roundMaxLength;
        this.#runs = state.runs;
    }
}

GameRound.fromState = function (state) {
    const round = new GameRound(state.roundMaxLength, state.baskets);

    round.setState(state);

    return round;
};

module.exports = GameRound;