import EventEmitter from "events";
import Game from "./game.mjs";
import {doubleEliminationGameIdOffset, DoubleEliminationGameType} from "./constants.mjs";
import {decideBasketsForRobots, log} from "./util.mjs";
import SwissSystemTournament from "./swiss-system-tournament.mjs";

export default class DoubleEliminationTournament extends EventEmitter {
    /** @type {{id: string, name: string}[]} */
    #robots;
    /** @type {Game[]} */
    #games = [];
    /** @type {Object.<string, DoubleEliminationGameType>} */
    #gameTypes = {};
    /** @type {{id: string, name: string}[]} */
    #noLossQueue = [];
    /** @type {{id: string, name: string}[]} */
    #oneLossQueue = [];
    /** @type {{id: string, name: string}[]} */
    #eliminatedRobots = [];
    /** @type {Object.<number, string[]>} */
    #robotStartingBaskets = {};
    /** @type {boolean} */
    #hasEnded = false;

    get hasEnded() {
        return this.#hasEnded;
    }

    constructor(robots, prevGamesStartingBaskets = {}) {
        super();
        this.#robots = robots;

        this.#noLossQueue.push(...robots);

        for (const robot of this.#robots) {
            this.#robotStartingBaskets[robot.id] = prevGamesStartingBaskets[robot.id] || [];
        }

        //this.firstFinalGameIndex = this.#robots.length * 2 - 3;
    }

    /**
     * @param {Game} game
     * @param {DoubleEliminationGameType} gameType
     */
    #addGame(game, gameType) {
        log('DE addGame', game, gameType);

        this.#games.push(game);
        this.#gameTypes[game.id] = gameType;
        const match = game.robots;
        const baskets = game.startingBaskets;
        this.#robotStartingBaskets[match[0].id].push(baskets[0]);
        this.#robotStartingBaskets[match[1].id].push(baskets[1]);

        game.on('changed', (changeType) => {
            this.#handleGameChange(changeType, game);
        });
    }

    proceed() {
        log('DE proceed');

        if (this.#games.length !== 0 && !this.#games[this.#games.length - 1].hasEnded) {
            log('DE last game has not ended yet');
            return;
        }

        if (this.#noLossQueue.length === 1 && this.#oneLossQueue.length === 1) {
            const noLossRobot = this.#noLossQueue.pop();
            const oneLossRobot = this.#oneLossQueue.pop();

            const id = doubleEliminationGameIdOffset + this.#games.length + 1;
            const match = [noLossRobot, oneLossRobot];
            const baskets = decideBasketsForRobots(match, this.#robotStartingBaskets);
            const game = new Game(id, match, baskets, false);

            this.#addGame(game, DoubleEliminationGameType.firstFinal);
        } else if (this.#noLossQueue.length === 0 && this.#oneLossQueue.length === 2) {
            const id = doubleEliminationGameIdOffset + this.#games.length + 1;
            const match = this.#oneLossQueue.splice(0, 2);
            const baskets = decideBasketsForRobots(match, this.#robotStartingBaskets);
            const game = new Game(id, match, baskets, false);

            this.#addGame(game, DoubleEliminationGameType.secondFinal);
        } else {
            const isOneLossQueueLonger = this.#oneLossQueue.length > this.#noLossQueue.length;
            const activeQueue = isOneLossQueueLonger ? this.#oneLossQueue : this.#noLossQueue;
            const gameType = isOneLossQueueLonger
                ? DoubleEliminationGameType.oneLoss
                : DoubleEliminationGameType.noLoss;

            if (activeQueue.length >= 2) {
                const id = doubleEliminationGameIdOffset + this.#games.length + 1;
                const match = activeQueue.splice(0, 2);
                const baskets = decideBasketsForRobots(match, this.#robotStartingBaskets);
                const game = new Game(id, match, baskets, false);

                this.#addGame(game, gameType);
            }
        }

        console.log('noLoss', this.#noLossQueue.map(r => r.id).join(', '));
        console.log('oneLoss', this.#oneLossQueue.map(r => r.id).join(', '));

        this.emit('changed');
    }

    getGames() {
        return this.#games;
    }

    #handleGameChange(changeType, game) {
        log('handleGameChange', changeType);
        if (changeType === 'ended') {
            const gameType = this.#gameTypes[game.id];
            const status = game.getStatus();

            if (gameType === DoubleEliminationGameType.firstFinal) {
                const noLossRobot = game.robots[0];

                if (status.winner.id === noLossRobot.id) {
                    log('WINNER', status.winner.id);
                    this.#noLossQueue.push(status.winner);
                    this.#eliminatedRobots.push(game.getOpponent(status.winner));
                    this.#end();
                } else {
                    this.#oneLossQueue.push(...game.robots);
                    this.proceed();
                }
            } else if (gameType === DoubleEliminationGameType.secondFinal) {
                log('WINNER', status.winner.id);
                this.#oneLossQueue.push(status.winner);
                this.#eliminatedRobots.push(game.getOpponent(status.winner));
                this.#end();
            } else {
                const queue = gameType === DoubleEliminationGameType.oneLoss ? this.#oneLossQueue : this.#noLossQueue;

                queue.push(status.winner);

                const loser = game.getOpponent(status.winner);

                if (queue === this.#noLossQueue) {
                    this.#oneLossQueue.push(loser);
                } else {
                    this.#eliminatedRobots.push(loser);
                }

                this.proceed();
            }
        }
    }

    #end() {
        if (!this.#hasEnded) {
            this.#hasEnded = true;
            this.emit('changed');
            this.emit('ended');
        }
    }

    getInfo() {
        return {
            robots: this.#robots,
            games: this.#games.map(g => g.getInfo()),
            gameTypes: this.#gameTypes,
            noLossQueue: this.#noLossQueue,
            oneLossQueue: this.#oneLossQueue,
            eliminatedRobots: this.#eliminatedRobots,
            robotStartingBaskets: this.#robotStartingBaskets,
            hasEnded: this.#hasEnded,
        };
    }

    getState() {
        return {
            robots: this.#robots,
            gameIDs: this.#games.map(g => g.id),
            gameTypes: this.#gameTypes,
            noLossQueue: this.#noLossQueue,
            oneLossQueue: this.#oneLossQueue,
            eliminatedRobots: this.#eliminatedRobots,
            robotStartingBaskets: this.#robotStartingBaskets,
            hasEnded: this.#hasEnded,
        };
    }

    setState(state) {
        this.#robots = state.robots;
        this.#games = state.games || [];
        this.#gameTypes = state.gameTypes || {};
        this.#noLossQueue = state.noLossQueue;
        this.#oneLossQueue = state.oneLossQueue;
        this.#eliminatedRobots = state.eliminatedRobots;
        this.#robotStartingBaskets = state.robotStartingBaskets || {};
        this.#hasEnded = state.hasEnded;

        for (const game of this.#games) {
            game.on('changed', (changeType) => {
                this.#handleGameChange(changeType, game);
            });
        }
    }
}

DoubleEliminationTournament.fromState = (state) => {
    const tournament = new DoubleEliminationTournament(state.robots);

    tournament.setState(state);

    return tournament;
};