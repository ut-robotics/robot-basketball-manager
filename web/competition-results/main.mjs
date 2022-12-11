import {html, LitElement} from "./lib/lit.mjs";
import WebsocketManager from "../js/util/websocket-manager.js";
import serverApi from "../js/server-api.js";

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

    constructor() {
        super();

        this.socketManager = new WebsocketManager(this.onSocketMessage.bind(this));

        this.fetchCompetitionInfo();
    }

    createRenderRoot() {
        return this;
    }

    onSocketMessage(message) {
        try {
            const info = JSON.parse(message);

            switch (info.event) {
                case 'competition_summary':
                    this.competitionInfo = info.params;
                    break;
            }
        } catch (error) {
            console.info(error);
        }
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

    render() {
        if (!this.competitionInfo) {
            return html`<div>Loading...</div>`;
        }

        if (!this.competitionInfo.name) {
            return null;
        }

        return html`${this.renderHeader()}
            ${this.renderCompetitionResults()}
            ${this.renderDoubleElimination()}
            ${this.renderSwiss()}`;
    }

    renderHeader() {
        if (this.competitionInfo.name)

        return html`<h1>${`${this.competitionInfo.name}`}</h1>`
    }

    renderCompetitionResults() {
        const deInfo = this.competitionInfo.doubleEliminationTournament;

        if (!deInfo) {
            return null;
        }

        const robotCount = deInfo.robots.length;

        let firstPlaceRobot = deInfo.noLossQueue.length + deInfo.oneLossQueue.length === 1
            ? deInfo.noLossQueue[0] || deInfo.oneLossQueue[0]
            : null;
        let secondPlaceRobot = deInfo.eliminatedRobots[robotCount - 2];
        let thirdPlaceRobot = deInfo.eliminatedRobots[robotCount - 3];

        if (!thirdPlaceRobot) {
            return null;
        }

        return html`<ul>
            <li>Winner: ${firstPlaceRobot ? firstPlaceRobot.name : '???'}</li>
            <li>2nd place: ${secondPlaceRobot ? secondPlaceRobot.name : '???'}</li>
            <li>3rd place: ${thirdPlaceRobot ? thirdPlaceRobot.name : '???'}</li>
        </ul>`;
    }

    renderRobots(robots) {
        if (!Array.isArray(robots)) {
            return null;
        }

        return html`<h2>Robots</h2>
            <ol>${robots.map(r => this.renderRobot(r))}</ol>`;
    }

    renderRobot(robot) {
        return html`<li>${`${robot.name}`}</li>`;
    }

    renderSwiss() {
        const swissInfo = this.competitionInfo.swissSystemTournament;

        if (!swissInfo || !swissInfo.games) {
            return null;
        }

        return html`<h2>Swiss-system tournament</h2>
            ${this.renderSwissScoreboard()}
            ${this.renderSwissGamesList()}`;
    }

    renderSwissGamesList() {
        const swissInfo = this.competitionInfo.swissSystemTournament;

        if (!swissInfo || !swissInfo.games) {
            return null;
        }

        const {roundCount, byes} = swissInfo;
        const rounds = [];
        const gamesPerRound = Math.floor(swissInfo.robots.length / 2);

        for (const [index, game] of swissInfo.games.entries()) {
            const roundIndex = Math.floor(index / gamesPerRound);

            if (!rounds[roundIndex]) {
                rounds[roundIndex] = [];
            }

            rounds[roundIndex].push(game);
        }

        const reversedRounds = rounds.slice().reverse();

        return html`${reversedRounds.map((r, index) => this.renderSwissGamesRound(rounds.length - index, roundCount, r, byes[rounds.length - index - 1]))}`
    }

    renderSwissGamesRound(roundNumber, roundsInTotal, games, bye) {
        return html`<h3>Round ${roundNumber} of ${roundsInTotal}</h3>
            <ul>
                ${games.map(g => this.renderGamesListItem(g))}
                ${this.renderBye(bye)}
            </ul>`
    }

    renderBye(bye) {
        if (!bye) {
            return null;
        }

        const robot = this.competitionInfo.robots.find(r => r.id === bye.robotID);

        if (!robot) {
            return null;
        }

        return html`<li>Bye: ${robot.name} | bye = 1 point</li>`;
    }

    renderGamesListItem(game, gameType) {
        let robotsText = `${game.robots[0].name} vs ${game.robots[1].name}`;

        const {status} = game;

        if (status.result === 'unknown' && game.rounds.length === 0) {
            return html`<li>${robotsText}</li>`;
        }

        const {result} = status;

        let roundsText = '';

        for (const round of game.rounds) {
            let prefix = '(';
            let suffix = ')';

            if (!round.hasEnded) {
                prefix = '[';
                suffix = ']';
            }

            const validScoreCounts = getValidScoreCounts(round.scores);
            roundsText += ` ${prefix}${validScoreCounts[0]} - ${validScoreCounts[1]}${suffix}`

        }
        if (status.result === 'unknown') {
            return html`<li>${robotsText} | ${roundsText}</li>`;
        }

        const resultContent =  result === 'won'
            ? html`<b>${status.winner.name} ${result}</b>`
            : `${result}`;

        let pointsText = '';

        if (!gameType) {
            const roundCount = game.rounds.length;

            pointsText += ' | ';

            if (result === 'tied') {
                pointsText += 'tie = 0.5 points';
            } else {
                if (roundCount === 2) {
                    pointsText += '2 out of 2 round wins = 1 point';
                } else {
                    if (status.roundWinCount === 2) {
                        pointsText += '2 out of 3 round wins = 0.9 points';
                    } else {
                        pointsText += ' 1 out of 3 round wins = 0.8 points';
                    }
                }
            }
        }

        return html`<li>${robotsText} | ${roundsText} | ${resultContent}${pointsText}</li>`;
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

        return html`<h3>Scoreboard</h3>
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

        return html`<h2>Double elimination tournament</h2>
            ${this.renderDoubleEliminationQueues(deInfo)}`;
    }

    renderDoubleEliminationGames(deInfo) {
        return html`<h2>Double elimination games</h2>
            <ul>${deInfo.games.map(g => this.renderGamesListItem(g, deInfo.gameTypes[g.id]))}</ul>`
    }

    renderDoubleEliminationQueues(deInfo) {
        const {games, gameTypes} = deInfo;

        const noLossGames = [];
        const oneLossGames = [];
        const finalGames = [];

        for (const game of games) {
            const gameType = gameTypes[game.id];

            if (gameType === 'noLoss') {
                noLossGames.push(game);
            } else if (gameType === 'oneLoss') {
                oneLossGames.push(game);
            } else if (gameType.endsWith('Final')) {
                finalGames.push(game);
            }
        }

        return html`${this.renderDoubleEliminationFinalGames(finalGames)}
            <h3>No games lost</h3>
            <ul>${noLossGames.map(g => this.renderGamesListItem(g, gameTypes[g.id]))}</ul>
            ${this.renderDoubleEliminationNextGames(deInfo.noLossQueue)}
            
            <h3>1 game lost</h3>
            <ul>${oneLossGames.map(g => this.renderGamesListItem(g, gameTypes[g.id]))}</ul>
            ${this.renderDoubleEliminationNextGames(deInfo.oneLossQueue)}
        
            <h3>Eliminated</h3>
            <ul>${deInfo.eliminatedRobots.map(r => this.renderRobot(r))}</ul>`
    }

    renderDoubleEliminationFinalGames(games) {
        if (games.length === 0) {
            return null;
        }

        const deInfo = this.competitionInfo.doubleEliminationTournament;
        const {gameTypes} = deInfo;

        return html`<h3>Final games</h3>
            <ul>${games.map(g => this.renderGamesListItem(g, gameTypes[g.id]))}</ul>`;
    }

    renderDoubleEliminationNextGames(robots) {
        const matches = [];

        for (let i = 0; i < robots.length; i += 2) {
            matches.push(robots.slice(i, i+ 2));
        }

        return html`<ul>${matches.map(m => this.renderMatch(m))}</ul>`;
    }

    renderMatch(robots) {
        if (robots.length === 1) {
            return html`<li>${robots[0].name}</li>`;
        }

        return html`<li>${robots[0].name} vs ${robots[1].name}</li>`;
    }
}

customElements.define('competition-results', CompetitionResults);