import {html, LitElement} from "../lib/lit.mjs";
import serverApi from "../js/server-api.js";

class CompetitionView extends LitElement {
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
            this.competitionInfo = await serverApi.getCompetition();
        } catch (apiError) {
            if (apiError.status === 404) {
                this.competitionInfo = {};
            }
        }
    }

    async handleAddRobot(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const id = data.get('id');
        const name = data.get('name');

        try {
            await serverApi.addRobot({id, name});

            await this.fetchCompetitionInfo();
        } catch (error) {
            console.error(error);
        }
    }

    async handleStartTournament(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const swissEnabled = data.get('swissEnabled') === 'on';
        const numberOfSwissRounds = parseInt(data.get('numberOfSwissRounds').toString(), 10);
        const doubleEliminationEnabled = data.get('doubleEliminationEnabled') === 'on';

        try {
            await serverApi.startTournament({
                swissEnabled,
                numberOfSwissRounds,
                doubleEliminationEnabled
            });

            await this.fetchCompetitionInfo();
        } catch (error) {
            console.error(error);
        }
    }

    async handleSetCompetition(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const id = data.get('id');
        const name = data.get('name');

        try {
            await serverApi.setCompetition({id, name});

            await this.fetchCompetitionInfo();
        } catch (error) {
            console.error(error);
        }
    }

    render() {
        if (!this.competitionInfo) {
            this.fetchCompetitionInfo();

            return html`<div>Loading...</div>`;
        }

        if (!this.competitionInfo.id) {
            return html`<div>${this.renderNewCompetitionForm()}</div>`;
        }

        return html`${this.renderHeader()}
            ${this.renderRobots(this.competitionInfo.robots)}
            ${this.competitionInfo.tournament ? null : this.renderNewRobotForm()}
            ${this.renderTournament()}
            ${this.renderSwissGamesList()}
            ${this.renderSwissScoreboard()}
            ${this.renderDoubleElimination()}`;
    }

    renderNewCompetitionForm() {
        return html`<form @submit=${this.handleSetCompetition}>
            <input type="text" name="id" placeholder="id">
            <input type="text" name="name" placeholder="name">
            <button type="submit">Confirm</button>
        </form>`;
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

    renderStartTournamentForm() {
        const robotsCount = this.competitionInfo.robots.length;
        const isSwissNeeded = robotsCount > 4;
        const minNumberOfSwissRounds = isSwissNeeded ? Math.ceil(Math.log(robotsCount) / Math.log(2)) : 0;

        return html`<form @submit=${this.handleStartTournament}>
            <div><label>
                <input type="checkbox" name="swissEnabled" ?checked=${isSwissNeeded}>
                Swiss
            </label></div>
            <div><label>
                Number of swiss rounds
                <input type="number" name="numberOfSwissRounds" .value=${minNumberOfSwissRounds}>
            </label></div>
            <div><label>
                <input type="checkbox" name="doubleEliminationEnabled" checked>
                Double elimination
            </label></div>
            <button type="submit">Start tournament</button>
        </form>`;
    }

    renderSwissGamesList() {
        const swissInfo = this.competitionInfo.swissSystemTournament;

        if (!swissInfo) {
            return null;
        }

        return html`<h2>Swiss games</h2>
            <ul>${swissInfo.games.map(g => this.renderGamesListItem(g))}</ul>`
    }

    renderGamesListItem(game, gameType) {
        const activeGame = this.competitionInfo.activeGame;
        const link = `/game/?id=${game.id}`;
        let text = `${game.id} ${game.robots[0].name} vs ${game.robots[1].name}`;

        if (gameType) {
            text += ` (${gameType})`
        }

        if (game.hasEnded) {
            text += ' (has ended)'
        }

        if (activeGame && activeGame.id === game.id) {
            text += ' (active)'
        }

        return html`<li><a href=${link}>${text}</a></li>`;
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
            <td>${robotScore.score}</td>
            <td>${robotScore.tieBreakScore}</td>
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

customElements.define('competition-view', CompetitionView);