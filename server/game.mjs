import EventEmitter from 'events';
import GameRound from './game-round.mjs';
import  FreeThrows from './free-throw-round.mjs';
import {
    mainRoundLength,
    extraRoundLength,
    freeThrowAttemptRoundLength,
    outOfRoundFoulCount,
    GameResult,
    FreeThrowsResult,
    Basket
} from './constants.mjs';
import {generateBallPlacement} from "./util.mjs";

export default class Game extends EventEmitter {
    #id;
    #robots;
    #startingBaskets;
    #oppositeBaskets;
    /** @type {GameRound[]}*/
    #rounds = [];
    /** @type {FreeThrows}*/
    #freeThrows;
    #ballPlacement;
    #hasEnded = false;
    #isTieAllowed = false;

    get id() {
        return this.#id;
    }

    get hasEnded() {
        return this.#hasEnded;
    }

    get robots() {
        return this.#robots;
    }

    get startingBaskets() {
        return this.#startingBaskets;
    }

    constructor(id, robots, startingBaskets, isTieAllowed = true, ballPlacement = null) {
        super();
        this.#id = id;
        this.#robots = robots;
        this.#startingBaskets = startingBaskets.slice();
        this.#oppositeBaskets = startingBaskets.slice().reverse();
        this.#isTieAllowed = isTieAllowed;

        if (Array.isArray(ballPlacement)) {
            this.#ballPlacement = ballPlacement;
        } else {
            this.#ballPlacement = generateBallPlacement();
        }

        this.#proceed();
    }

    getRoundCount() {
        return this.#rounds.length;
    }

    start() {
        if (this.#freeThrows) {
            this.#freeThrows.start();
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound && !lastRound.hasEnded) {
            lastRound.start();
        } else {
            this.#proceed();
        }
    }

    stop() {
        if (this.#freeThrows) {
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound) {
            lastRound.stop();
        }
    }

    endRound() {
        if (this.#freeThrows) {
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound && !lastRound.hasEnded) {
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

    confirm() {
        if (this.#freeThrows) {
            this.#freeThrows.confirm();
            this.#proceed();
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound) {
            lastRound.confirm();
            this.#proceed();
        }
    }

    unconfirm() {
        if (this.#freeThrows) {
            this.#freeThrows.confirm();
            return;
        }

        const lastRound = this.#getLastRound();

        if (lastRound) {
            lastRound.unconfirm();
        }
    }

    setScoreValidity(sideIndex, scoreIndex, isValid) {
        const lastRound = this.#getLastRound();

        if (lastRound) {
            lastRound.setScoreValidity(sideIndex, scoreIndex, isValid);
        }
    }

    #addNewRound = () => {
        const completedRoundCount = this.#rounds.length;
        const maxDuration = completedRoundCount >= 3 ? extraRoundLength : mainRoundLength;
        const baskets = completedRoundCount % 2 === 0 ? this.#startingBaskets : this.#oppositeBaskets;

        this.#addRound(new GameRound(maxDuration, baskets));

        this.emit('changed', 'roundAdded');
    };

    #addRoundFromState = (state) => {
        this.#addRound(GameRound.fromState(state));
    };

    #addRound = (round) => {
        this.#rounds.push(round);

        round.on('started', () => {
            this.emit('changed', 'roundStarted');
        });

        round.on('stopped', () => {
            this.emit('changed', 'roundStopped');
        });

        round.on('ended', () => {
            console.log(`Round ${this.#rounds.length} ended`);
            this.emit('changed', 'roundEnded');
        });

        round.on('isConfirmedChanged', () => {
            this.emit('changed', 'roundIsConfirmedChanged');
        });

        round.on('scoreValidityChanged', () => {
            this.emit('changed', 'roundScoreValidityChanged');
        });
    };

    #addNewFreeThrows = () => {
        const basket = Math.random() < 0.5 ? Basket.blue : Basket.magenta;

        this.#addFreeThrows(new FreeThrows(this.#robots, [basket, basket],3, freeThrowAttemptRoundLength));

        this.emit('changed', 'freeThrowsAdded');
    };

    #addFreeThrowsFromState = (state) => {
        this.#addFreeThrows(FreeThrows.fromState(state));
    };

    #addFreeThrows = (freeThrows) => {
        this.#freeThrows = freeThrows;

        this.#freeThrows.on('attemptStarted', () => {
            console.log('Free throw attempt started');
            this.emit('changed', 'freeThrowAttemptStarted');
        });

        this.#freeThrows.on('attemptEnded', () => {
            console.log('Free throw attempt ended');
            this.emit('changed', 'freeThrowAttemptEnded');
        });

        this.#freeThrows.on('ended', () => {
            console.log('Free throws ended');
            this.emit('changed', 'freeThrowsEnded');
        });

        this.emit('change', 'freeThrowsStarted');

        this.#freeThrows.on('isConfirmedChanged', () => {
            console.log('Free throw attempt isConfirmed changed');
            this.emit('changed', 'freeThrowAttemptIsConfirmedChanged');
        });
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

        if (!lastRound || lastRound.isConfirmed) {
            if (this.#rounds.length < 6) {
                this.#addNewRound();
            } else if (!this.#freeThrows) {
                this.#addNewFreeThrows();
            }
        }
    };

    /**
     * @returns {GameRound|null}
     */
    #getLastRound = () => {
        return this.#rounds[this.#rounds.length - 1] || null;
    };

    #composeStatusRoundInfo(indexCounts, winnerIndex) {
        return {
            roundWinCount: indexCounts[winnerIndex],
            roundLossCount: indexCounts[1 - winnerIndex],
            roundTieCount: indexCounts[-1]
        }
    }

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
                return {
                    result: GameResult.won,
                    winner: this.#robots[index],
                    ...this.#composeStatusRoundInfo(indexCounts, index)
                };
            }
        }

        if (roundCount <= 2) {
            return {result: GameResult.unknown};
        }

        if (indexCounts[0] > indexCounts[1]) {
            return {
                result: GameResult.won,
                winner: this.#robots[0],
                ...this.#composeStatusRoundInfo(indexCounts, 0)
            };
        }

        if (indexCounts[0] < indexCounts[1]) {
            return {
                result: GameResult.won,
                winner: this.#robots[1],
                ...this.#composeStatusRoundInfo(indexCounts, 1)
            };
        }

        if (this.#isTieAllowed) {
            return {result: GameResult.tied};
        }

        // Extra rounds
        for (const index of winnerIndices.slice(3, 6)) {
            if (index !== -1) {
                return {
                    result: GameResult.won,
                    winner: this.#robots[index],
                    ...this.#composeStatusRoundInfo(indexCounts, index)
                };
            }
        }

        // Free throws
        if (this.#freeThrows) {
            const freeThrowStatus = this.#freeThrows.getStatus();

            if (freeThrowStatus.result === FreeThrowsResult.won) {
                return {
                    result: GameResult.won,
                    winner: this.#robots[freeThrowStatus.winner],
                    ...this.#composeStatusRoundInfo(indexCounts, freeThrowStatus.winner)
                };
            }
        }

        return {result: GameResult.unknown};
    }

    getInfo() {
        const info = {
            id: this.#id,
            robots: this.#robots,
            startingBaskets: this.#startingBaskets,
            isTieAllowed: this.#isTieAllowed,
            hasEnded: this.#hasEnded,
            rounds: this.#rounds.map(round => round.getInfo()),
            status: this.getStatus(),
            ballPlacement: this.#ballPlacement,
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

    getInGameRobotIds() {
        const robotIds = this.getRobotIds();
        const lastRound = this.#getLastRound();

        if (this.#freeThrows) {
            return [this.#freeThrows.getCurrentRobotId()];
        }

        if (!lastRound || lastRound.hasEnded) {
            return robotIds;
        }

        const fouls = lastRound.getFouls();

        return robotIds.filter((robot, index) => fouls[index].length < outOfRoundFoulCount);
    }

    getBasketsForRobots(robotIds) {
        const robotIdsInGame = this.getRobotIds();
        const lastRound = this.#getLastRound();
        let baskets = this.#startingBaskets;

        if (this.#freeThrows) {
            baskets = this.#freeThrows.getBaskets();
        } else if (lastRound) {
            baskets = lastRound.getBaskets();
        }

        return robotIds.map(id => baskets[robotIdsInGame.indexOf(id)] || null);
    }

    getOpponent(robot) {
        return this.#robots[0].id === robot.id ? this.#robots[1] : this.#robots[0];
    }

    getState() {
        const state = {
            id: this.#id,
            robots: this.#robots,
            startingBaskets: this.#startingBaskets,
            isTieAllowed: this.#isTieAllowed,
            hasEnded: this.#hasEnded,
            rounds: this.#rounds.map(round => round.getState()),
            ballPlacement: this.#ballPlacement,
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
        this.#ballPlacement = state.ballPlacement;

        this.#rounds = [];

        for (const roundState of state.rounds) {
            this.#addRoundFromState(roundState);
        }

        if (state.freeThrows) {
            this.#addFreeThrowsFromState(state.freeThrows);
        }

        this.#proceed();
    }
}

Game.fromState = function (state) {
    const game = new Game(state.id, state.robots, state.startingBaskets, state.isTieAllowed, state.ballPlacement);

    game.setState(state);

    return game;
};