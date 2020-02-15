const EventEmitter = require('events');
const {FreeThrowsResult} = require('./constants');

class FreeThrows extends EventEmitter {
    #minRounds = 3;
    #timeLimit = 10000;
    #rounds = [];
    #robots;
    #robotIndex = 0;
    #hasEnded = false;
    #timeCheckInterval;

    get hasEnded() {
        return this.#hasEnded;
    }

    constructor(robots, minRounds, timeLimit) {
        super();
        this.#robots = robots;
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

        this.#startTimeCheck();
    }

    stop(didScore) {
        clearInterval(this.#timeCheckInterval);
        this.#timeCheckInterval = null;

        const time = Date.now();
        const lastRound = this.#getLastRound();
        const attempt = lastRound[this.#robotIndex];

        if (lastRound) {
            attempt.endTime = time;
            attempt.didScore = didScore;
        }

        this.#checkStatus();

        this.emit('attemptEnded');
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
        if (!this.#timeCheckInterval) {
            this.#timeCheckInterval = setInterval(() => {
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

        // Round not finished
        if (lastRound.length !== this.#robots.length || !lastRound[lastRound.length - 1].endTime) {
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
        }

        return info;
    };

    getInfo() {
        return {
            hasEnded: this.#hasEnded,
            robots: this.#robots,
            scores: this.getScores(),
            timeLimit: this.#timeLimit,
            rounds: this.#rounds.map(round => round.map(attempt => this.#getAttemptInfo(attempt))),
            status: this.getStatus(),
        }
    }

    isRunning() {
        const lastRound = this.#getLastRound();

        if (!lastRound) {
            return false;
        }

        return !lastRound.endTime;
    }
}

module.exports = FreeThrows;