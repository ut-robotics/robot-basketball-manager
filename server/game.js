const EventEmitter = require('events');
const GameRound = require('./game-round');
const FreeThrows = require('./free-throw-round');
const {
    mainRoundLength,
    extraRoundLength,
    freeThrowAttemptRoundLength,
    GameResult,
    FreeThrowsResult
} = require('./constants');

class Game extends EventEmitter {
    #robots;
    #startingBaskets;
    #oppositeBaskets;
    #rounds = [];
    #freeThrows;
    #hasEnded = false;
    #isTieAllowed = false;

    get hasEnded() {
        return this.#hasEnded;
    }

    constructor(robots, startingBaskets, isTieAllowed = true) {
        super();
        this.#robots = robots;
        this.#startingBaskets = startingBaskets.slice();
        this.#oppositeBaskets = startingBaskets.slice().reverse();
        this.#isTieAllowed = isTieAllowed;

        //this.#proceed();
    }

    start() {
        if (this.#freeThrows) {
            this.#freeThrows.start();
            this.emit('changed', 'freeThrowStarted');
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound && !lastRound.hasEnded) {
            lastRound.start();
            this.emit('changed', 'roundStarted');
        }
    }

    stop() {
        if (this.#freeThrows) {
            //this.#freeThrows.stop();
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound) {
            lastRound.stop();
            this.emit('changed', 'roundStopped');
        }
    }

    endRound() {
        const lastRound = this.#getLastRound();

        if (lastRound) {
            lastRound.end();
        }
    }

    #end = () => {
        this.#hasEnded = true;
        this.emit('changed', 'ended');
    };

    incrementScore(basket) {
        if (this.#freeThrows) {
            this.#freeThrows.stop(true);
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound) {
            lastRound.incrementScore(basket);
            this.emit('changed', 'scoreChanged');
        }
    }

    incrementFouls(robotIndex) {
        if (this.#freeThrows) {
            this.#freeThrows.stop(false);
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound) {
            lastRound.incrementFouls(robotIndex);
            this.emit('changed', 'foulsChanged');
        }
    }

    #addNewRound = () => {
        const completedRoundCount = this.#rounds.length;
        const maxDuration = completedRoundCount >= 3 ? extraRoundLength : mainRoundLength;
        const baskets = completedRoundCount % 2 === 0 ? this.#startingBaskets : this.#oppositeBaskets;

        this.#addRound(new GameRound(maxDuration, baskets));
    };

    #addRoundFromState = (state) => {
        this.#addRound(GameRound.fromState(state));
    };

    #addRound = (round) => {
        this.#rounds.push(round);

        round.on('ended', () => {
            console.log(`Round ${this.#rounds.length} ended`);
            this.#proceed();
            this.emit('changed', 'roundEnded');
        });
    };

    #addNewFreeThrows = () => {
        this.#addFreeThrows(new FreeThrows(this.#robots, 3, freeThrowAttemptRoundLength));
    };

    #addFreeThrowsFromState = (state) => {
        this.#addFreeThrows(FreeThrows.fromState(state));
    };

    #addFreeThrows = (freeThrows) => {
        this.#freeThrows = freeThrows;

        this.#freeThrows.on('attemptEnded', () => {
            console.log('Free throw attempt ended');
            this.#proceed();
            this.emit('changed', 'freeThrowAttemptEnded');
        });

        this.#freeThrows.on('ended', () => {
            console.log('Free throws ended');
            this.#proceed();
            this.emit('changed', 'freeThrowsEnded');
        });

        this.emit('change', 'freeThrowsStarted');
    };

    #proceed = () => {
        if (this.hasEnded) {
            return;
        }

        const status = this.getStatus();

        if (status.result !== GameResult.unknown) {
            this.#end();
            return;
        }

        if (this.#freeThrows) {
            return
        }

        const lastRound = this.#getLastRound();

        if (!lastRound || lastRound.hasEnded) {
            if (this.#rounds.length < 6) {
                this.#addNewRound();
            } else if (!this.#freeThrows) {
                this.#addNewFreeThrows();
            }
        }
    };

    #getLastRound = () => {
        return this.#rounds[this.#rounds.length - 1] || null;
    };

    getStatus() {
        const completedRounds = this.#rounds.filter(round => round.hasEnded);
        const roundCount = completedRounds.length;

        if (roundCount < 2) {
            return {result: GameResult.unknown};
        }

        const winnerIndices = completedRounds.map(round => round.getWinnerIndex());
        const indexCounts = {'-1': 0, 0: 0, 1: 0};

        // Main rounds
        for (const index of winnerIndices.slice(0, 3)) {
            indexCounts[index]++;

            if (indexCounts[index] === 2 && index >= 0) {
                return {result: GameResult.won, winner: this.#robots[index]};
            }
        }

        if (roundCount <= 2) {
            return {result: GameResult.unknown};
        }

        if (indexCounts[0] > indexCounts[1]) {
            return {result: GameResult.won, winner: this.#robots[0]};
        }

        if (indexCounts[0] < indexCounts[1]) {
            return {result: GameResult.won, winner: this.#robots[1]};
        }

        if (this.#isTieAllowed) {
            return {result: GameResult.tied};
        }

        // Extra rounds
        for (const index of winnerIndices.slice(3, 6)) {
            if (index !== -1) {
                return {result: GameResult.won, winner: this.#robots[index]};
            }
        }

        // Free throws
        if (this.#freeThrows) {
            const freeThrowStatus = this.#freeThrows.getStatus();

            if (freeThrowStatus.result === FreeThrowsResult.won) {
                return {result: GameResult.won, winner: this.#robots[freeThrowStatus.winner]};
            }
        }

        return {result: GameResult.unknown};
    }

    getInfo() {
        const info = {
            robots: this.#robots,
            startingBaskets: this.#startingBaskets,
            isTieAllowed: this.#isTieAllowed,
            hasEnded: this.#hasEnded,
            rounds: this.#rounds.map(round => round.getInfo()),
            status: this.getStatus(),
        };

        if (this.#freeThrows) {
            info.freeThrows = this.#freeThrows.getInfo();
        }

        return info;
    }

    isRunning() {
        if (this.#freeThrows) {
            return this.#freeThrows.isRunning();
        }

        const lastRound = this.#getLastRound();

        if (lastRound) {
            return lastRound.isRunning();
        }

        return false;
    }

    getRobotIds() {
        return this.#robots.map(robot => robot.id);
    }

    getState() {
        const state = {
            robots: this.#robots,
            startingBaskets: this.#startingBaskets,
            isTieAllowed: this.#isTieAllowed,
            hasEnded: this.#hasEnded,
            rounds: this.#rounds.map(round => round.getState()),
        };

        if (this.#freeThrows) {
            state.freeThrows = this.#freeThrows.getState();
        }

        return state;
    }

    setState(state) {
        this.#robots = state.robots;
        this.#startingBaskets = state.startingBaskets;
        this.#isTieAllowed = state.isTieAllowed;
        this.#hasEnded = state.hasEnded;

        for (const roundState of state.rounds) {
            this.#addRoundFromState(roundState);
        }

        if (state.freeThrows) {
            this.#addFreeThrowsFromState(state.freeThrows);
        }
    }
}

Game.fromState = function (state) {
    const game = new Game(state.robots, state.startingBaskets, state.isTieAllowed);

    game.setState(state);

    return game;
};

module.exports = Game;