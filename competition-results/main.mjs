import {html, LitElement} from "./lib/lit-element.mjs";

class ApiError {
    constructor(status, statusText) {
        this.status = status;
        this.statusText = statusText;
    }
}

async function request(url, options) {
    return await fetch(url, options).then(async (response) => {
        const contentType = response.headers.get('Content-Type');

        if (contentType) {
            if (contentType.includes('json')) {
                if (response.ok) {
                    return response.json();
                }
            }
        }

        if (response.ok) {
            return response.text();
        }

        throw new ApiError(response.status, response.statusText);
    }).catch((errorInfo) => {
        console.error(errorInfo);

        throw errorInfo;
    });
}

async function getCompetition() {
    return request('competition-state/competition-summary.json');
}

function getValidScoreCounts(roundScores) {
    const validScoreCounts = [];

    for (const robotScores of roundScores) {
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

function roundToTwoDecimalPlaces(number) {
    return Math.round((number + Number.EPSILON) * 100) / 100;
}

class CompetitionResults extends LitElement {
    static get properties() {
        return {
            competitionInfo: {type: Object}
        };
    }

    createRenderRoot() {
        return this;
    }

    async fetchCompetitionInfo() {
        try {
            this.competitionInfo = await getCompetition();
        } catch (apiError) {
            if (apiError.status === 404) {
                this.competitionInfo = {};
            }
        }
    }

    render() {
        if (!this.competitionInfo) {
            this.fetchCompetitionInfo();

            return html`<div>Loading...</div>`;
        }

        return html`${this.renderHeader()}
            ${this.renderRobots(this.competitionInfo.robots)}
            ${this.renderTournament()}
            ${this.renderSwissGamesList()}
            ${this.renderSwissScoreboard()}
            ${this.renderDoubleElimination()}`;
    }

    renderHeader() {
        return html`<h1>${`${this.competitionInfo.name} | ${this.competitionInfo.id}`}</h1>`
    }

    renderRobots(robots) {
        if (!Array.isArray(robots)) {
            return null;
        }

        return html`<h2>Robots</h2>
            <ol>${robots.map(r => this.renderRobot(r))}</ol>`;
    }

    renderRobot(robot) {
        return html`<li>${`${robot.name} | ${robot.id}`}</li>`;
    }

    renderNewRobotForm() {
        return html`<form @submit=${this.handleAddRobot}>
            <input type="text" name="id" placeholder="id">
            <input type="text" name="name" placeholder="name">
            <button type="submit">Add</button>
        </form>`;
    }

    renderTournament() {
        return html`<h2>Tournament</h2>
            ${this.renderTournamentSettings()}`;
    }

    renderTournamentSettings() {
        if (this.competitionInfo.tournament) {
            const {swissEnabled, numberOfSwissRounds, doubleEliminationEnabled} = this.competitionInfo.tournament;

            return html`<div>${`Swiss: ${swissEnabled}, Swiss rounds: ${numberOfSwissRounds}, Double elimination: ${doubleEliminationEnabled}`}</div>`
        }

        return html`${this.renderStartTournamentForm()}`;
    }

    renderSwissGamesList() {
        const swissInfo = this.competitionInfo.swissSystemTournament;

        if (!swissInfo || !swissInfo.games) {
            return null;
        }

        const {roundCount, byes} = swissInfo;
        const rounds = [];

        for (const [index, game] of swissInfo.games.entries()) {
            const roundIndex = Math.floor(index / roundCount);

            if (!rounds[roundIndex]) {
                rounds[roundIndex] = [];
            }

            rounds[roundIndex].push(game);
        }

        return html`<h2>Swiss games</h2>
            ${rounds.map((r, index) => this.renderSwissGamesRound(index + 1, roundCount, r, byes[index]))}`
    }

    renderSwissGamesRound(roundNumber, roundsInTotal, games, bye) {
        return html`<h3>Round ${roundNumber} of ${roundsInTotal}</h3>
            <ul>${games.map(g => this.renderGamesListItem(g))}</ul>
            <>`
    }

    renderGamesListItem(game, gameType) {
        const activeGame = this.competitionInfo.activeGame;
        let text = `${game.id} ${game.robots[0].name} vs ${game.robots[1].name}`;

        const {status} = game;

        if (status.result !== 'unknown') {
            const {result} = status;

            for (const round of game.rounds) {
                if (!round.hasEnded) {
                    continue;
                }

                const validScoreCounts = getValidScoreCounts(round.scores);
                text += ` (${validScoreCounts[0]} - ${validScoreCounts[1]})`

            }

            if (result === 'won') {
                text += ` (${status.winner.name} ${result})`
            } else {
                text += ` (${result})`;
            }
        }

        if (activeGame && activeGame.id === game.id) {
            text += ' (active)';
        }

        return html`<li>${text}</li>`;
    }

    renderSwissScoreboard() {
        const swissInfo = this.competitionInfo.swissSystemTournament;

        if (!swissInfo) {
            return null;
        }

        const orderedScores = swissInfo.robotScores.slice();

        orderedScores.sort((a, b) => {
            if (a.score === b.score) {
                return b.tieBreakScore - a.tieBreakScore;
            }

            return b.score - a.score;
        });

        return html`<h2>Swiss scoreboard</h2>
            <table>
                <thead><tr><th>Name</th><th>Score</th><th>Tiebreak score</th></tr></thead>
                <tbody>${orderedScores.map(s => this.renderSwissScoreboardRow(s))}</tbody>
            </table>`
    }

    renderSwissScoreboardRow(robotScore) {
        return html`<tr>
            <td>${robotScore.robot.name}</td>
            <td>${roundToTwoDecimalPlaces(robotScore.score)}</td>
            <td>${roundToTwoDecimalPlaces(robotScore.tieBreakScore)}</td>
        </tr>`;
    }

    renderDoubleElimination() {
        const deInfo = this.competitionInfo.doubleEliminationTournament;

        if (!deInfo) {
            return null;
        }

        return html`${this.renderDoubleEliminationGames(deInfo)}
            ${this.renderDoubleEliminationQueues(deInfo)}`;
    }

    renderDoubleEliminationGames(deInfo) {
        return html`<h2>Double elimination games</h2>
            <ul>${deInfo.games.map(g => this.renderGamesListItem(g, deInfo.gameTypes[g.id]))}</ul>`
    }

    renderDoubleEliminationQueues(deInfo) {
        return html`<h2>No games lost</h2>
            <ol>${deInfo.noLossQueue.map(r => this.renderRobot(r))}</ol>
            <h2>1 game lost</h2>
            <ol>${deInfo.oneLossQueue.map(r => this.renderRobot(r))}</ol>
            <h2>Eliminated</h2>
            <ol>${deInfo.eliminatedRobots.map(r => this.renderRobot(r))}</ol>`
    }
}

customElements.define('competition-results', CompetitionResults);