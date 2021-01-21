import EventEmitter from 'events';
import {FreeThrowsResult}  from './constants.mjs';

export default class FreeThrows extends EventEmitter {
    #minRounds = 3;
    #timeLimit = 10000;
    #rounds = [];
    #robots;
    #baskets;
    #robotIndex = 0;
    #hasEnded = false;
    #timeCheckTimeout;

    get hasEnded() {
        return this.#hasEnded;
    }

    constructor(robots, baskets, minRounds, timeLimit) {
        super();
        this.#robots = robots;
        this.#baskets = baskets;
        this.#minRounds = minRounds;
        this.#timeLimit = timeLimit;
    }

    start() {
        const time = Date.now();

        if (this.hasEnded) {
            return;
        }

        let lastRound = this.#getLastRound();

        if (lastRound) {
            const lastAttempt = lastRound[lastRound.length -1];

            if (!lastAttempt.endTime) {
                return;
            }
        }

        if (this.#robotIndex === this.#robots.length - 1 || this.#rounds.length === 0) {
            this.#rounds.push([]);
            this.#robotIndex = 0;
        } else {
            this.#robotIndex++;
        }

        lastRound = this.#getLastRound();
        lastRound.push({startTime: time, didScore: false, robot: this.#robots[this.#robotIndex]});

        this.emit('attemptStarted');

        this.#startTimeCheck();
    }

    stop(didScore) {
        clearTimeout(this.#timeCheckTimeout);
        this.#timeCheckTimeout = null;

        const time = Date.now();
        const lastRound = this.#getLastRound();
        const attempt = lastRound[this.#robotIndex];

        if (lastRound) {
            attempt.endTime = time;
            attempt.didScore = didScore;
        }

        this.emit('attemptEnded');
    }

    confirm() {
        const lastAttempt = this.#getLastAttempt();

        if (lastAttempt) {
            lastAttempt.isConfirmed = true;

            this.emit('isConfirmedChanged');

            this.#checkStatus();
        }
    }

    unconfirm() {
        const lastAttempt = this.#getLastAttempt();

        if (lastAttempt) {
            lastAttempt.isConfirmed = false;

            this.emit('isConfirmedChanged');
        }
    }

    #end = () => {
        this.#hasEnded = true;
        this.emit('ended');
    };

    #checkStatus = () => {
        const status = this.getStatus();

        if (status.result === FreeThrowsResult.won) {
            this.#end();
        }
    };

    #startTimeCheck = () => {
        if (!this.#timeCheckTimeout) {
            this.#timeCheckTimeout = setTimeout(() => {
                this.stop(false);
            }, this.#timeLimit);
        }
    };

    #getLastRound = () => {
        return this.#rounds[this.#rounds.length - 1] || null;
    };

    #getLastAttempt = () => {
        const lastRound = this.#getLastRound();

        if (!lastRound) {
            return null;
        }

        return lastRound[lastRound.length - 1];
    };

    getCurrentRobotId() {
        return this.#robots[this.#robotIndex].id;
    }

    getBaskets() {
        return this.#baskets;
    }

    getScores() {
        const scores = [0, 0];

        for (const round of this.#rounds) {
            for (let i = 0; i < round.length; i++) {
                if (round[i].didScore) {
                     scores[i]++;
                }
            }
        }

        return scores;
    }

    getStatus() {
        if (this.#rounds.length < this.#minRounds) {
            return {result: FreeThrowsResult.unknown}
        }

        const lastRound = this.#getLastRound();
        const lastAttempt = lastRound[lastRound.length - 1];

        // Round not finished
        if (lastRound.length !== this.#robots.length || !lastAttempt.endTime || !lastAttempt.isConfirmed) {
            return {result: FreeThrowsResult.unknown};
        }

        const winnerIndices = this.#rounds.map(([attempt1, attempt2]) => {
            if (attempt1.didScore && !attempt2.didScore) {
                return 0;
            } else if (!attempt1.didScore && attempt2.didScore) {
                return 1;
            }

            return -1;
        });

        const indexCounts = {'-1': 0, 0: 0, 1: 0};

        // Required rounds
        for (const index of winnerIndices.slice(0, this.#minRounds)) {
            indexCounts[index]++;
        }

        if (indexCounts[0] > indexCounts[1]) {
            return {result: FreeThrowsResult.won, winner: 0}
        }

        if (indexCounts[0] < indexCounts[1]) {
            return {result: FreeThrowsResult.won, winner: 1}
        }

        // Extra rounds
        for (const index of winnerIndices.slice(this.#minRounds)) {
            indexCounts[index]++;

            if (indexCounts[0] > indexCounts[1]) {
                return {result: FreeThrowsResult.won, winner: 0}
            }

            if (indexCounts[0] < indexCounts[1]) {
                return {result: FreeThrowsResult.won, winner: 1}
            }
        }

        return {result: FreeThrowsResult.unknown};
    }

    #getAttemptInfo = (attempt) => {
        const time = Date.now();
        const info = {
            robot: attempt.robot,
            startTime: attempt.startTime,
        };

        if (attempt.endTime) {
            info.endTime = attempt.endTime;
            info.didScore = attempt.didScore;
            info.isConfirmed = attempt.isConfirmed;
        }

        return info;
    };

    isRunning() {
        const lastRound = this.#getLastRound();

        if (!lastRound) {
            return false;
        }

        return !lastRound.endTime;
    }

    getInfo() {
        return {
            hasEnded: this.#hasEnded,
            robots: this.#robots,
            baskets: this.#baskets,
            scores: this.getScores(),
            timeLimit: this.#timeLimit,
            rounds: this.#rounds.map(round => round.map(attempt => this.#getAttemptInfo(attempt))),
            status: this.getStatus(),
        }
    }

    getState() {
        return {
            hasEnded: this.#hasEnded,
            robots: this.#robots,
            baskets: this.#baskets,
            minRounds: this.#minRounds,
            timeLimit: this.#timeLimit,
            rounds: this.#rounds,
            robotIndex: this.#robotIndex,
        }
    }

    setState(state) {
        this.#hasEnded = state.hasEnded;
        this.#robots = state.robots;
        this.#baskets = state.baskets;
        this.#minRounds = state.minRounds;
        this.#timeLimit = state.timeLimit;
        this.#rounds = state.rounds;
        this.#robotIndex = state.robotIndex;
    }
}

FreeThrows.fromState = function (state) {
    const freeThrows = new FreeThrows(state.robots, state.baskets, state.minRounds, state.timeLimit);

    freeThrows.setState(state);

    return freeThrows;
};