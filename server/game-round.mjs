import EventEmitter from 'events';
import {mainRoundLength} from './constants.mjs';

export const GameRoundEventName = {
    isConfirmedChanged: 'isConfirmedChanged',
    started: 'started',
    stopped: 'stopped',
    ended: 'ended',
    scoreValidityChanged: 'scoreValidityChanged',
    foulValidityChanged: 'foulValidityChanged',
};

export default class GameRound extends EventEmitter {
    #runs = [];
    #runtimeCheckInterval;
    #roundMaxLength = mainRoundLength; // milliseconds
    #hasEnded = false;
    #isConfirmed = false;
    #baskets;
    #scores = [[], []];
    #fouls = [[], []];

    get isConfirmed() {
        return this.#isConfirmed;
    }

    set isConfirmed(value) {
        if (this.#hasEnded) {
            const oldValue = this.#isConfirmed;
            this.#isConfirmed = value;

            if (oldValue !== value) {
                this.emit(GameRoundEventName.isConfirmedChanged);
            }
        }
    }

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
            this.emit(GameRoundEventName.started);
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
            this.emit(GameRoundEventName.stopped);
        }
    }

    end() {
        if (this.hasEnded) {
            return;
        }

        clearInterval(this.#runtimeCheckInterval);
        this.stop();
        this.#hasEnded = true;
        this.emit(GameRoundEventName.ended);
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

        this.incrementScoreAtIndex(basketIndex);
    }

    incrementScoreAtIndex(basketIndex) {
        if (basketIndex === 0 || basketIndex === 1) {
            this.#scores[basketIndex].push({time: Date.now(), isValid: true});
        }
    }

    incrementFouls(robotIndex) {
        if (robotIndex === 0 || robotIndex === 1) {
            this.#fouls[robotIndex].push({time: Date.now(), isValid: true});
        }
    }

    confirm() {
        this.isConfirmed = true;
    }

    unconfirm() {
        this.isConfirmed = false;
    }

    setScoreValidity(sideIndex, scoreIndex, isValid) {
        const sideScores = this.#scores[sideIndex];
        const score = sideScores[scoreIndex];

        if (score) {
            const oldValue = score.isValid;
            score.isValid = isValid;

            if (oldValue !== isValid) {
                this.emit(GameRoundEventName.scoreValidityChanged);
            }
        }
    }

    setFoulValidity(sideIndex, foulIndex, isValid) {
        const sideFouls = this.#fouls[sideIndex];
        const foul = sideFouls[foulIndex];

        if (foul) {
            const oldValue = foul.isValid;
            foul.isValid = isValid;

            if (oldValue !== isValid) {
                this.emit(GameRoundEventName.foulValidityChanged, {sideIndex});
            }
        }
    }

    getScores() {
        return this.#scores;
    }

    getFouls() {
        return this.#fouls;
    }

    getBaskets() {
        return this.#baskets;
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
        if (!this.hasEnded || !this.isConfirmed) {
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
            isConfirmed: this.#isConfirmed,
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
            isConfirmed: this.#isConfirmed,
            roundMaxLength: this.#roundMaxLength,
            runs: this.#runs,
        }
    }

    setState(state) {
        this.#scores = state.scores;
        this.#fouls = state.fouls;
        this.#baskets = state.baskets;
        this.#hasEnded = state.hasEnded || false;
        this.#isConfirmed = state.isConfirmed || false;
        this.#roundMaxLength = state.roundMaxLength;
        this.#runs = state.runs;
    }
}

GameRound.fromState = function (state) {
    const round = new GameRound(state.roundMaxLength, state.baskets);

    round.setState(state);

    return round;
};