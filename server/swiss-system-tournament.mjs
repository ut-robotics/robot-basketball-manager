import {
    chooseNextBasketColor,
    createSwissMatchIndexPairs,
    decideBaskets,
    decideBasketsForRobots,
    log,
    selectRandom
} from './util.mjs';
import Game, {GameEventChangeType, GameEventName} from "./game.mjs";
import EventEmitter from "events";
import {GameResult} from "./constants.mjs";

export const SwissSystemTournamentEventName = {
    ended: 'ended',
    changed: 'changed',
}

/**
 * Robot info
 * @name Robot
 * @type {Object}
 * @property {string} id
 * @property {string} name
 */

export default class SwissSystemTournament extends EventEmitter {
    /** @type {Robot[]} */
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
                this.emit(SwissSystemTournamentEventName.ended);
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

            if (robotWithBye) {
                this.#giveBye(robotWithBye);
                robotsToMatch = robotsToMatch.filter(r => r.id !== robotWithBye.id);
            }
        }

        /** @type {([Robot, Robot])[]} */
        let matches = [];

        const gameCount = this.#games.length;

        if (gameCount === 0) {
            for (let i = 0; i < robotsToMatch.length; i += 2) {
                matches.push([robotsToMatch[i], robotsToMatch[i + 1]]);
            }
        } else {
            matches = this.#matchRobots(robotsToMatch);
        }

        /*const matches = [];
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
        }*/

        //console.log(matches);

        for (const match of matches) {
            console.log(JSON.stringify(match));
        }

        for (const match of matches) {
            const id = this.#games.length + 1;
            const baskets = decideBasketsForRobots(match, this.#robotStartingBaskets);
            const game = new Game(id, match, baskets);
            this.#games.push(game);
            this.#robotStartingBaskets[match[0].id].push(baskets[0]);
            this.#robotStartingBaskets[match[1].id].push(baskets[1]);

            game.on(GameEventName.changed, this.gameChangedListener);
        }

        this.emit(SwissSystemTournamentEventName.changed);
    }

    /**
     *
     * @param {Robot[]} robots
     * @returns {([Robot, Robot])[]}
     */
    #matchRobots(robots) {
        console.time('matchRobots');

        /** @type {([Robot, Robot])[]} */
        let matches = [];

        const expectedNumberOfMatches = Math.floor(robots.length / 2);

        const robotScores = this.getRobotScores(robots);
        const matchPairs = createSwissMatchIndexPairs(robots.length)
            .map(pair => [robotScores[pair[0]], robotScores[pair[1]]])
            .filter(pair => !this.hasPlayedWith(pair[0].robot, pair[1].robot))
            .sort((pairA, pairB) => {
                const robotScoreA0 = pairA[0];
                const robotScoreA1 = pairA[1];
                const robotScoreB0 = pairB[0];
                const robotScoreB1 = pairB[1];

                /*const scoreDiffA = robotScoreA1.score - robotScoreA0.score;
                const scoreDiffB = robotScoreB1.score - robotScoreB0.score;

                if (scoreDiffA !== scoreDiffB) {
                    return scoreDiffA - scoreDiffB;
                }

                const tieBreakScoreDiffA = robotScoreA1.tieBreakScore - robotScoreA0.tieBreakScore;
                const tieBreakScoreDiffB = robotScoreB1.tieBreakScore - robotScoreB0.tieBreakScore;

                if (tieBreakScoreDiffA !== tieBreakScoreDiffB) {
                    return tieBreakScoreDiffA - tieBreakScoreDiffB;
                }*/

                const rankDiffA = robotScoreA1.rank - robotScoreA0.rank;
                const rankDiffB = robotScoreB1.rank - robotScoreB0.rank;

                return rankDiffB - rankDiffA;
            });

        //console.log(matchPairs);

        for (let activePairsCount = expectedNumberOfMatches; activePairsCount <= matchPairs.length; activePairsCount++) {
            const possibleRounds = this.#createAllPossibleRounds(matchPairs.slice(0, activePairsCount + 1), robotScores.length);
            //const possibleRounds = this.#createAllPossibleRounds(matchPairs, robotScores.length);

            if (possibleRounds.length > 0) {
                matches = [];

                for (const match of possibleRounds[0]) {
                    console.log(JSON.stringify(match));
                    matches.push([match[0].robot, match[1].robot]);
                }

                break;
            }
        }

        console.timeEnd('matchRobots');

        return matches;
    }

    /**
     *
     * @param {([RobotScore, RobotScore])[]} matchPairs
     * @param {number} robotCount
     */
    #createAllPossibleRounds(matchPairs, robotCount) {
        const matchesPerRoundCount = robotCount / 2;

        const rounds = [];

        let matchIndices;
        let matches;
        let addedRanks;

        const combinationCount = Math.pow(matchPairs.length, matchesPerRoundCount);

        for (let combinationIndex = 0; combinationIndex < combinationCount; combinationIndex++) {
            matchIndices = [];
            matches = [];
            addedRanks = {};

            let remainder = combinationIndex;
            let prevMatchIndex = matchPairs.length;

            for (let i = 0; i < matchesPerRoundCount; i++) {
                const matchIndex = remainder % matchPairs.length;

                if (matchIndex >= prevMatchIndex) {
                    break;
                }

                remainder = (remainder - matchIndex) / matchPairs.length;

                matchIndices.push(matchIndex);

                prevMatchIndex = matchIndex;
            }

            if (matchIndices.length !== matchesPerRoundCount) {
                continue;
            }

            for (let i = 0; i < matchIndices.length; i++) {
                const matchIndex = matchIndices[i];

                const rank0 = matchPairs[matchIndex][0].rank;
                const rank1 = matchPairs[matchIndex][1].rank;

                if (!addedRanks[rank0] && !addedRanks[rank1]) {
                    matches.push(matchPairs[matchIndex]);
                    addedRanks[rank0] = true;
                    addedRanks[rank1] = true;
                }
            }

            if (matches.length === matchesPerRoundCount) {
                matches.sort((matchA, matchB) => Math.min(matchB[0].rank, matchB[1].rank) - Math.min(matchA[0].rank, matchA[1].rank))
                rounds.push(matches);
            }
        }

        if (rounds.length < 2) {
            return rounds;
        }

        rounds.sort((matchesA, matchesB) => {
            let sumA = 0;
            let sumB = 0;

            for (let i = 0; i < matchesA.length; i++) {
                sumA += matchesA[i][1].rank - matchesA[i][0].rank;
                sumB += matchesB[i][1].rank - matchesB[i][0].rank;
            }

            return sumB - sumA;
        });

        return rounds;
    }

    #handleGameChange(changeType) {
        log('handleGameChange', changeType);
        if (changeType === GameEventChangeType.ended) {
            this.proceed();
        }
    }

    /**
     *
     * @returns {Robot[]}
     */
    #getNonByeRobots() {
        return this.#robots.filter(r => !this.hasBye(r.id));
    }

    #giveBye(robot) {
        this.#byes.push({robotID: robot.id});
    }

    hasBye(robotId) {
        return this.#byes.some(bye => bye.robotID === robotId);
    }

    /**
     * Robot with a score info
     * @name RobotScore
     * @type {Object}
     * @property {Robot} robot
     * @property {number} score
     * @property {number} tieBreakScore
     * @property {number} rank
     */

    /**
     *
     * @param robots
     * @returns {RobotScore[]}
     */
    getRobotScores(robots) {
        /** @type {RobotScore[]} */
        const robotScores = robots.map(r => {
            return {
                robot: r,
                score: this.calculateScore(r),
                tieBreakScore: this.calculateTieBreakScore(r),
                rank: -1
            };
        });

        robotScores.sort((a, b) => {
            if (a.score === b.score) {
                return a.tieBreakScore - b.tieBreakScore;
            }

            return a.score - b.score;
        });

        for (let i = 0; i < robotScores.length; i++) {
            robotScores[i].rank = robotScores.length - i;
        }

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
                score += 5;
            } else {
                const winnerId = status.winner.id;

                let winnerScore = 0;

                if (game.getRoundCount() === 2) {
                    winnerScore = 10; // 2 out of 2 rounds won
                } else {
                    if (status.roundWinCount === 2 && status.roundTieCount === 1) {
                        winnerScore = 9; // 2 out of 3 rounds won and 1 round tied
                    } else if (status.roundWinCount === 2 && status.roundLossCount === 1) {
                        winnerScore = 8; // 2 out of 3 rounds won and 1 round lost
                    } else if (status.roundWinCount === 1 && status.roundTieCount === 2) {
                        winnerScore = 7; // 1 out of 3 rounds won and 2 rounds tied
                    }
                }

                if (winnerId === robot.id) {
                    score += winnerScore; // Winner gets winnerScore amount of points
                } else {
                    score += 10 - winnerScore; // Loser gets rest of the points
                }
            }
        }

        return score;
    }

    calculateTieBreakScore(robot) {
        const opponents = this.getOpponents(robot, false);
        const opponentScores = opponents.map(o => this.calculateScore(o));

        return opponentScores.reduce((total, value) => total + value, 0);
    }

    /**
     * @param {Robot} robot
     * @param {boolean} includeUnfinishedGames
     * @returns {Game[]}
     */
    getRobotGames(robot, includeUnfinishedGames = true) {
        return this.#games.filter(game => {
            if (!includeUnfinishedGames) {
                const status = game.getStatus();

                if (status.result === GameResult.unknown) {
                    return false;
                }
            }

            return game.robots.some(r => r.id === robot.id);
        });
    }

    getOpponents(robot, includeUnfinishedGames = true) {
        const games = this.getRobotGames(robot, includeUnfinishedGames);

        return games.map(g => g.getOpponent(robot));
    }

    /**
     *
     * @param {Robot} robot
     * @param {Robot} opponent
     * @returns {boolean}
     */
    hasPlayedWith(robot, opponent) {
        const games = this.getRobotGames(robot);

        return games.some(g => g.getOpponent(robot).id === opponent.id);
    }

    getInfo() {
        return {
            robots: this.#robots,
            roundCount: this.#roundCount,
            games: this.#games.map(g => g.getInfo()),
            byes: this.#byes,
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