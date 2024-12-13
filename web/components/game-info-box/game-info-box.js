import {classMap, html, LitElement, unsafeHTML} from "../../competition-results/lib/lit.mjs";
import zip from "../../js/util/zip.js";
import getValidScoreCounts from "../../js/util/get-valid-score-counts.js";

import '../game-info-box-counter/game-info-box-counter.js';

class GameInfoBox extends LitElement {
    static get properties() {
        return {
            activeGameState: {type: Object}
        };
    }

    constructor() {
        super();
    }

    createRenderRoot() {
        return this;
    }

    render() {
        if (!this.activeGameState) {
            return null;
        }

        const {rounds, robots, freeThrows, hasEnded, status} = this.activeGameState;
        const lastRound = rounds[rounds.length - 1];

        if (!lastRound) {
            return null;
        }

        const foulCounts = (freeThrows || hasEnded) ? [0, 0] : lastRound.fouls.map(f => f.length);
        const gameStatuses = [null, null];

        if (status.result !== 'unknown') {
            for (const [index, robot] of robots.entries()) {
                if (status.result === 'won') {
                    if (robot.id === status.winner.id) {
                        gameStatuses[index] = 'won';
                    } else {
                        gameStatuses[index] = 'lost';
                    }
                } else if (status.result === 'tied') {
                    gameStatuses[index] = 'tied';
                }
            }
        }

        return html`${this.renderRobots(robots, foulCounts, gameStatuses)}
            ${this.renderRounds(rounds, freeThrows)}
            ${this.renderTime(hasEnded, lastRound, freeThrows)}
            ${this.renderResults(hasEnded, status, robots)}
            </div>`
    }

    renderTime(hasEnded, round, freeThrows) {
        if (hasEnded) {
            return null;
        }

        let elapsed = 0;
        let running = false;
        let lastStartTime = Date.now();
        let timeLimit = 60;

        if (freeThrows) {
            timeLimit = freeThrows.timeLimit;

            if (freeThrows.rounds && freeThrows.rounds.length > 0) {
                const lastRound = freeThrows.rounds[freeThrows.rounds.length - 1];
                const lastAttempt = lastRound[lastRound.length -1];

                if (lastAttempt && !lastAttempt.isConfirmed) {
                    running = !lastAttempt.endTime;
                    lastStartTime = lastAttempt.startTime;
                }
            }
        } else {
            const {runs} = round;

            timeLimit = round.timeLimit;

            for (const run of runs) {
                if (!run.endTime) {
                    running = true;
                } else {
                    elapsed += run.endTime - run.startTime;
                }

                lastStartTime = run.startTime;
            }
        }

        return html`<game-info-box-counter class="time active" ?running=${running} .elapsed=${elapsed} .laststarttime=${lastStartTime} .timelimit=${timeLimit}></game-info-box-counter>`;
    }

    renderRobots(robots, foulCounts, gameStatuses) {
        return html`<div class="robots">
            ${zip(robots, foulCounts, gameStatuses).map(([r, f, s]) => this.renderRobot(r, f, s))}
        </div>`;
    }

    renderRobot(robot, foulCount, gameStatus) {
        const foulClasses = {
            'robot-fouls': true,
            active: foulCount > 0,
            first: foulCount === 1,
            second: foulCount >= 2,
            [gameStatus]: typeof gameStatus === 'string',
        };

        return html`<div class="robot">
            <div class="robot-name">${robot.name}</div>
            <div class=${classMap(foulClasses)}></div>
        </div>`;
    }

    renderRounds(rounds, freeThrows) {
        const lastRound = rounds[rounds.length - 1];

        return html`<div class="game-rounds">
            <div class="main-rounds">
                ${rounds.map(r => this.renderMainRound(r, r === lastRound))}
            </div>
            ${this.renderFreeThrowsRound(freeThrows)}
        </div>`;
    }

    renderMainRound(round, isLastRound) {
        const validScoreCounts = getValidScoreCounts(round.scores);
        const shouldShowBasketColors = isLastRound && !round.isConfirmed;

        const robot1Classes = {
            'won': round.isConfirmed && round.winnerIndex === 0,
            'lost': round.isConfirmed && round.winnerIndex === 1,
            'tied': round.isConfirmed && round.winnerIndex === -1,
            'blue-basket': shouldShowBasketColors && round.baskets[0] === 'blue',
            'magenta-basket': shouldShowBasketColors && round.baskets[0] === 'magenta',
        }

        const robot2Classes = {
            'won': round.isConfirmed && round.winnerIndex === 1,
            'lost': round.isConfirmed && round.winnerIndex === 0,
            'tied': round.isConfirmed && round.winnerIndex === -1,
            'blue-basket': shouldShowBasketColors && round.baskets[1] === 'blue',
            'magenta-basket': shouldShowBasketColors && round.baskets[1] === 'magenta',
        }

        return html`<div class="main-round active">
            <div class="${classMap(robot1Classes)}">${validScoreCounts[0]}</div>
            <div class="${classMap(robot2Classes)}">${validScoreCounts[1]}</div>
        </div>`;
    }

    renderFreeThrowsRound(freeThrows) {
        if (!freeThrows) {
            return null;
        }

        const rounds = freeThrows.rounds;
        const scoreCounts = [0, 0];
        const shouldShowBasketColors = !freeThrows.hasEnded;
        const lastRound = rounds[rounds.length - 1];

        for (const round of rounds) {
            scoreCounts[0] += round[0]?.didScore ? 1 : 0;
            scoreCounts[1] += round[1]?.didScore ? 1 : 0;
        }

        let robotIndex = 0;

        if (lastRound) {
            const firstAttempt = lastRound[0];
            const secondAttempt = lastRound[1];

            if (firstAttempt.endTime && !secondAttempt || secondAttempt && !secondAttempt.endTime) {
                robotIndex = 1;
            }
        }

        const robot1Classes = {
            'blue-basket': shouldShowBasketColors && robotIndex === 0 && freeThrows.baskets[0] === 'blue',
            'magenta-basket': shouldShowBasketColors && robotIndex === 0 && freeThrows.baskets[0] === 'magenta',
        }

        const robot2Classes = {
            'blue-basket': shouldShowBasketColors && robotIndex === 1 && freeThrows.baskets[1] === 'blue',
            'magenta-basket': shouldShowBasketColors && robotIndex === 1 && freeThrows.baskets[1] === 'magenta',
        }

        return html`<div class="freethrows-round active">
            <div class=${classMap(robot1Classes)}>${scoreCounts[0]}</div>
            <div class=${classMap(robot2Classes)}>${scoreCounts[1]}</div>
        </div>`;
    }

    renderResults(hasEnded, status, robots) {
        if (!hasEnded) {
            return null;
        }

        let robot1Content = '';
        let robot2Content = '';

        if (status.result === 'won') {
            if (robots[0].id === status.winner.id) {
                robot1Content = '&#9734;';
            } else {
                robot2Content = '&#9734;';
            }
        } else if (status.result === 'tied') {
            robot1Content = '='
            robot2Content = '='
        }

        return html`<div class="game-results active">
            <div>${unsafeHTML(robot1Content)}</div>
            <div>${unsafeHTML(robot2Content)}</div>
        </div>`;
    }
}

customElements.define('game-info-box', GameInfoBox);