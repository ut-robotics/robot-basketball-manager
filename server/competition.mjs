import SwissSystemTournament, {SwissSystemTournamentEventName} from "./swiss-system-tournament.mjs";
import {cloneObject, log, shuffledArray} from "./util.mjs";
import EventEmitter from "events";
import DoubleEliminationTournament, {DoubleEliminationTournamentEventName} from "./double-elimination-tournament.mjs";
import {GameEventName} from "./game.mjs";

export const CompetitionEventName = {
    changed: 'changed',
    gameChanged: 'gameChanged',
    gameSetActive: 'gameSetActive',
};

export default class Competition extends EventEmitter {
    /** @type {string} */
    #id;
    /** @type {string} */
    #name;
    /** @type {{id: string, name: string}[]} */
    #robots = [];
    /** @type {?{swissEnabled : boolean, numberOfSwissRounds: number, doubleEliminationEnabled: boolean}}*/
    #tournament = null;
    /** @type {?SwissSystemTournament} */
    #swissSystemTournament;
    /** @type {?DoubleEliminationTournament} */
    #doubleEliminationTournament;
    /** @type {?Game} */
    #activeGame;

    get id() {
        return this.#id;
    }

    constructor(id, name) {
        super();
        this.#id = id;
        this.#name = name;
        this.swissTournamentChangedListener = this.#handleSwissTournamentChanged.bind(this);
        this.doubleEliminationTournamentChangedListener = this.#handleDoubleEliminationTournamentChanged.bind(this);
    }

    proceed() {
        if (!this.#tournament) {
            return;
        }

        if (this.#tournament.swissEnabled && !this.#swissSystemTournament) {
            const swissTournament = new SwissSystemTournament(
                shuffledArray(this.#robots),
                this.#tournament.numberOfSwissRounds
            );

            this.#setSwissTournament(swissTournament);
        }

        if (this.#tournament.doubleEliminationEnabled && !this.#doubleEliminationTournament) {
            if (this.#tournament.swissEnabled) {
                if (this.#swissSystemTournament.hasEnded) {
                    const robotScores = this.#swissSystemTournament.getRobotScores(this.#swissSystemTournament.robots);

                    robotScores.sort((a, b) => {
                        if (a.score === b.score) {
                            return b.tieBreakScore - a.tieBreakScore;
                        }

                        return b.score - a.score;
                    });

                    const bestRobots = [];

                    for (const [index, robotScore] of robotScores.entries()) {
                        if (index < 4) {
                            // 4 best go straight through
                            bestRobots.push(robotScore.robot);
                        } else if (
                            robotScores[index - 1].score === robotScores[index].score &&
                            robotScores[index - 1].tieBreakScore === robotScores[index].tieBreakScore
                        ) {
                            // Others go through if score same as fourth best
                            bestRobots.push(robotScore.robot);
                        } else {
                            break;
                        }
                    }

                    const doubleEliminationTournament = new DoubleEliminationTournament(
                        shuffledArray(bestRobots),
                        cloneObject(this.#swissSystemTournament.robotStartingBaskets)
                    );

                    this.#setDoubleEliminationTournament(doubleEliminationTournament);
                }
            } else {
                const doubleEliminationTournament = new DoubleEliminationTournament(shuffledArray(this.#robots));
                this.#setDoubleEliminationTournament(doubleEliminationTournament);
            }
        }

        if (this.#swissSystemTournament && !this.#swissSystemTournament.hasEnded) {
            this.#swissSystemTournament.proceed();
        } else if (this.#doubleEliminationTournament && !this.#doubleEliminationTournament.hasEnded) {
            this.#doubleEliminationTournament.proceed();
        }
    }

    addRobot(id, name) {
        return this.#robots.push({id, name});
    }

    setRobots(robotsList) {
        this.#robots = [];

        for (const robotInfo of robotsList) {
            const {id, name} = robotInfo;
            this.#robots.push({id, name});
        }
    }

    #setSwissTournament(swissTournament) {
        log('Set swiss tournament');

        if (this.#swissSystemTournament) {
            this.#swissSystemTournament.off(SwissSystemTournamentEventName.changed, this.swissTournamentChangedListener);
            this.#swissSystemTournament.removeAllListeners(SwissSystemTournamentEventName.ended);
        }

        this.#swissSystemTournament = swissTournament;

        this.#swissSystemTournament.on(SwissSystemTournamentEventName.changed, this.swissTournamentChangedListener);

        this.#swissSystemTournament.on(SwissSystemTournamentEventName.ended, () => {
            log('Swiss tournament ended');
            this.proceed();
        });
    }

    #setDoubleEliminationTournament(doubleEliminationTournament) {
        log('Set double elimination tournament');

        if (this.#doubleEliminationTournament) {
            this.#doubleEliminationTournament.off(DoubleEliminationTournamentEventName.changed, this.doubleEliminationTournamentChangedListener);
        }

        this.#doubleEliminationTournament = doubleEliminationTournament;

        this.#doubleEliminationTournament.on(DoubleEliminationTournamentEventName.changed, this.doubleEliminationTournamentChangedListener);
    }

    #handleSwissTournamentChanged() {
        // log('Swiss tournament changed');
        this.emit(CompetitionEventName.changed);
    }

    #handleDoubleEliminationTournamentChanged() {
        log('Double elimination tournament changed');
        this.emit(CompetitionEventName.changed);
    }

    startTournament(swissEnabled, numberOfSwissRounds, doubleEliminationEnabled) {
        this.#tournament = {
            swissEnabled,
            numberOfSwissRounds,
            doubleEliminationEnabled
        }

        this.proceed();
    }

    /**
     *
     * @returns {Game[]}
     */
    getGames() {
        /** @type {Game[]} */
        const games = [];

        if (this.#swissSystemTournament) {
            games.push(...this.#swissSystemTournament.getGames());
        }

        if (this.#doubleEliminationTournament) {
            games.push(...this.#doubleEliminationTournament.getGames());
        }

        return games;
    }

    getGame(id) {
        if (this.#swissSystemTournament) {
            for (const game of this.#swissSystemTournament.getGames()) {
                if (game.id.toString() === id.toString()) {
                    return game;
                }
            }
        }

        if (this.#doubleEliminationTournament) {
            for (const game of this.#doubleEliminationTournament.getGames()) {
                if (game.id.toString() === id.toString()) {
                    return game;
                }
            }
        }

        return null;
    }

    /**
     * @returns {?Game}
     */
    getActiveGame() {
        return this.#activeGame;
    }

    setActiveGame(id) {
        log(`Try to set active game (id = ${id})`);

        if (this.#activeGame?.hasEnded === false) {
            log(`Another game (id = ${id}) already active`);
            return;
        }

        const game = this.getGame(id);

        if (game) {
            this.#activeGame = game;

            game.on(GameEventName.changed, (changeType) => {
                console.log('changed', changeType, this);
                this.emit(CompetitionEventName.gameChanged, changeType, game);
            });

            this.emit(CompetitionEventName.gameSetActive, game);

            log(`Game (id = ${id}) now active`);
        } else {
            log(`Game (id = ${id}) not found`);
        }
    }

    getInfo() {
        return {
            id: this.#id,
            name: this.#name,
            robots: this.#robots,
            tournament: this.#tournament,
            swissSystemTournament: this.#swissSystemTournament?.getInfo(),
            doubleEliminationTournament: this.#doubleEliminationTournament?.getInfo(),
            activeGame: this.getActiveGame()?.getInfo(),
        };
    }

    getState() {
        return {
            id: this.#id,
            name: this.#name,
            robots: this.#robots,
            tournament: this.#tournament,
            swissSystemTournament: this.#swissSystemTournament?.getState(),
            doubleEliminationTournament: this.#doubleEliminationTournament?.getState(),
        };
    }

    setState(state) {
        this.#id = state.id;
        this.#name = state.name;
        this.#robots = state.robots;
        this.#tournament = state.tournament;

        if (state.swissSystemTournament) {
            if (this.#swissSystemTournament) {
                this.#swissSystemTournament.setState(state.swissSystemTournament);
            } else {
                this.#setSwissTournament(SwissSystemTournament.fromState(state.swissSystemTournament));
            }
        }

        if (state.doubleEliminationTournament) {
            if (this.#doubleEliminationTournament) {
                this.#doubleEliminationTournament.setState(state.doubleEliminationTournament);
            } else {
                this.#setDoubleEliminationTournament(
                    DoubleEliminationTournament.fromState(state.doubleEliminationTournament)
                );
            }
        }
    }
}

Competition.fromState = (state) => {
    const competition = new Competition(state.id, state.name);

    competition.setState(state);

    return competition;
};