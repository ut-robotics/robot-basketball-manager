import {chooseNextBasketColor, decideBaskets, decideBasketsForRobots, log, selectRandom} from './util.mjs';
import Game from "./game.mjs";
import EventEmitter from "events";
import {GameResult} from "./constants.mjs";

export default class SwissSystemTournament extends EventEmitter {
    /** @type {{id: string, name: string}[]} */
    #robots;
    /** @type {number} */
    #roundCount;
    /** @type {{robotID: string}[]} */
    #byes = [];
    /** @type {Game[]} */
    #games = [];
    /** @type {Object.<number, string[]>} */
    #robotStartingBaskets = {};
    /** @type {boolean} */
    #hasEnded = false;

    get robots() {
        return this.#robots;
    }

    get hasEnded() {
        return this.#hasEnded;
    }

    get robotStartingBaskets() {
        return this.#robotStartingBaskets;
    }

    constructor(robots, roundCount) {
        super();
        this.#robots = robots.slice();
        this.#roundCount = roundCount;

        for (const robot of this.#robots) {
            this.#robotStartingBaskets[robot.id] = [];
        }

        this.gameChangedListener = this.#handleGameChange.bind(this);
    }

    proceed() {
        log('Continue Swiss system tournament');

        const gamesPerRound = Math.floor(this.#robots.length / 2);
        const gamesInTotal = this.#roundCount * gamesPerRound;

        if (this.#games.some(g => !g.hasEnded)) {
            log('All games have not ended');
            return;
        }

        if (this.#games.length === gamesInTotal) {
            log('No more games to play');

            if (!this.#hasEnded) {
                this.#hasEnded = true;
                this.emit('ended');
            }

            return;
        }

        if (this.#games.length < gamesInTotal) {
            this.#createRound();
        }
    }

    getGames() {
        return this.#games;
    }

    #createRound() {
        log('Create swiss round');

        const isByeNeeded = this.#robots.length % 2 === 1;
        let robotsToMatch = this.#robots.slice();

        if (isByeNeeded) {
            const robotWithBye = selectRandom(this.#getNonByeRobots());
            this.#giveBye(robotWithBye);
            robotsToMatch = robotsToMatch.filter(r => r.id !== robotWithBye.id);
        }

        const robotScores = this.getRobotScores(robotsToMatch);
        const matches = [];
        const isMatchedMap = {};

        for (let i = 0; i < robotScores.length; i++) {
            const robotScore = robotScores[i];

            if (isMatchedMap[robotScore.robot.id]) {
                continue;
            }

            for (let j = i + 1; j < robotScores.length; j++) {
                const opponentRobotScore = robotScores[j];

                if (isMatchedMap[opponentRobotScore.robot.id]) {
                    continue;
                }

                if (this.hasPlayedWith(robotScore.robot, opponentRobotScore.robot)) {
                    continue;
                }

                matches.push([robotScore.robot, opponentRobotScore.robot]);
                isMatchedMap[robotScore.robot.id] = true;
                isMatchedMap[opponentRobotScore.robot.id] = true;

                break;
            }
        }

        console.log(matches);

        for (const match of matches) {
            const id = this.#games.length + 1;
            const baskets = decideBasketsForRobots(match, this.#robotStartingBaskets);
            const game = new Game(id, match, baskets);
            this.#games.push(game);
            this.#robotStartingBaskets[match[0].id].push(baskets[0]);
            this.#robotStartingBaskets[match[1].id].push(baskets[1]);

            game.on('changed', this.gameChangedListener);
        }

        this.emit('changed');
    }

    #handleGameChange(changeType) {
        log('handleGameChange', changeType);
        if (changeType === 'ended') {
            this.proceed();
        }
    }

    #getNonByeRobots() {
        return this.#robots.filter(r => !this.hasBye(r.id));
    }

    #giveBye(robot) {
        this.#byes.push({robotID: robot.id});
    }

    hasBye(robotId) {
        return this.#byes.some(bye => bye.robotID === robotId);
    }

    getRobotScores(robots) {
        const robotScores = robots.map(r => {
            return {
                robot: r,
                score: this.calculateScore(r),
                tieBreakScore: this.calculateTieBreakScore(r)
            };
        });

        robotScores.sort((a, b) => {
            if (a.score === b.score) {
                return a.tieBreakScore - b.tieBreakScore;
            }

            return a.score - b.score;
        });

        return robotScores;
    }

    calculateScore(robot) {
        let score = 0;

        if (this.hasBye(robot.id)) {
            score += 1;
        }

        const games = this.getRobotGames(robot);

        for (const game of games) {
            const status = game.getStatus();

            if (status.result === GameResult.unknown) {
                continue;
            }

            if (status.result === GameResult.tied) {
                score += 0.5;
            } else if (status.winner.id === robot.id) {
                if (game.getRoundCount() === 2) {
                    score += 1; // 2 out of 2 rounds won
                } else {
                    if (status.roundWinCount === 2) {
                        score += 0.9; // 2 out of 3 rounds won
                    } else {
                        score += 0.8; // 1 out of 3 rounds won
                    }
                }
            }
        }

        return score;
    }

    calculateTieBreakScore(robot) {
        const opponents = this.getOpponents(robot);
        const opponentScores = opponents.map(o => this.calculateScore(o));

        return opponentScores.reduce((total, value) => total + value, 0);
    }

    /**
     * @param {{id: string, name: string}} robot
     * @returns {Game[]}
     */
    getRobotGames(robot) {
        return this.#games.filter(g => g.robots.some(r => r.id === robot.id));
    }

    getOpponents(robot) {
        const games = this.getRobotGames(robot);

        return games.map(g => g.getOpponent(robot));
    }

    hasPlayedWith(robot, opponent) {
        const games = this.getRobotGames(robot);

        return games.some(g => g.getOpponent(robot).id === opponent.id);
    }

    getInfo() {
        return {
            robots: this.#robots,
            roundCount: this.#roundCount,
            games: this.#games.map(g => g.getInfo()),
            robotScores: this.getRobotScores(this.#robots),
            robotStartingBaskets: this.#robotStartingBaskets,
            hasEnded: this.#hasEnded,
        };
    }

    getState() {
        return {
            robots: this.#robots,
            roundCount: this.#roundCount,
            gameIDs: this.#games.map(g => g.id),
            byes: this.#byes,
            robotStartingBaskets: this.#robotStartingBaskets,
            hasEnded: this.#hasEnded,
        };
    }

    setState(state) {
        this.#robots = state.robots;
        this.#roundCount = state.roundCount;
        this.#games = state.games || [];
        this.#byes = state.byes || [];
        this.#robotStartingBaskets = state.robotStartingBaskets || {};
        this.#hasEnded = state.hasEnded;

        for (const game of this.#games) {
            game.on('changed', this.gameChangedListener);
        }
    }
}

SwissSystemTournament.fromState = (state) => {
    const tournament = new SwissSystemTournament(state.robots, state.roundCount);

    tournament.setState(state);

    return tournament;
};