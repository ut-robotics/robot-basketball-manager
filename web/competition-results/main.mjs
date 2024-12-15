import {html, classMap, LitElement} from "./lib/lit.mjs";
import WebsocketManager from "../js/util/websocket-manager.js";
import serverApi from "../js/server-api.js";

import '../components/game-info-box/game-info-box.js';

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
            competitionInfo: {type: Object},
            activeGameState: {type: Object},
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
                case 'game_state':
                    console.log(info.params);
                    this.activeGameState = info.params;
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

        return html`<div class="top-content">
                ${this.renderActiveGame()}
            </div>
            <div class="bottom-content">
                ${this.renderHeader()}
                ${this.renderCompetitionResults()}
                ${this.renderDoubleElimination()}
                ${this.renderSwiss()}
            </div>`;
    }

    renderHeader() {
        if (this.competitionInfo.name)

        return html`<h1>${`${this.competitionInfo.name}`}</h1>`
    }

    renderActiveGame() {
        const activeGame = this.activeGameState || this.competitionInfo.activeGame;

        if (!activeGame) {
            return null;
        }

        const classes = {
            extended: !activeGame.hasEnded,
        }

        return html`<game-info-box class=${classMap(classes)} .activeGameState=${activeGame}></game-info-box>`;
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

        return html`
            <h2>Podium</h2>
            <ul class="podium-list">
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

        return html`<div>
            <h2>Swiss-system tournament</h2>
            <div class="columns">
                <div class="column">
                    ${this.renderSwissScoreboard()}
                    ${this.renderSwissGamePointExplanation()}
                </div>
                <div class="column">
                    ${this.renderSwissGamesList()}
                </div>
            </div>
        </div>`;
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
            <ol>
                ${games.map(g => this.renderGamesListItem(g))}
                ${this.renderBye(bye)}
            </ol>`
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

        const classes = {
            'active-game': game.id === this.activeGameState?.id,
        };

        const test = classMap(classes);
        console.log(test);

        if (status.result === 'unknown' && game.rounds.length === 0) {
            return html`<li class=${classMap(classes)}>${robotsText}</li>`;
        }

        const {result} = status;

        let roundsText = '';

        if (
            game.rounds.length >= 1 && game.rounds[0].duration > 0
            || this.competitionInfo.activeGame?.id === game.id
        ) {
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
        } else {
            return html`<li class=${classMap(classes)}>${robotsText}</li>`;
        }

        if (game.freeThrows) {
            let prefix = '(';
            let suffix = ')';

            if (!game.freeThrows.hasEnded) {
                prefix = '[';
                suffix = ']';
            }

            roundsText += ` ${prefix}${game.freeThrows.scores[0]} - ${game.freeThrows.scores[1]}${suffix}`
        }

        if (status.result === 'unknown') {
            return html`<li class=${classMap(classes)}>${robotsText} | ${roundsText}</li>`;
        }

        const resultContent =  result === 'won'
            ? html`<span class="game-result-win">${status.winner.name} ${result}</span>`
            : html`<span class="game-result-other">${result}</span>`;

        let pointsText = '';

        if (!gameType) {
            const roundCount = game.rounds.length;

            pointsText += ' (';

            if (result === 'tied') {
                pointsText += '0.5 points';
            } else {
                if (roundCount === 2) {
                    pointsText += '1 point';
                } else {
                    if (status.roundWinCount === 2 && status.roundTieCount === 1) {
                        pointsText += '0.9 points';
                    } else if (status.roundWinCount === 2 && status.roundLossCount === 1) {
                        pointsText += '0.8 points';
                    } else if (status.roundWinCount === 1 && status.roundTieCount === 2) {
                        pointsText += '0.7 points';
                    }
                }
            }

            pointsText += ')';
        }

        return html`<li class=${classMap(classes)}>${robotsText} | ${roundsText} | ${resultContent}${pointsText}</li>`;
    }

    renderSwissGamePointExplanation() {
        return html`<h3>Swiss-system tournament game point system</h3>
            <table>
                <thead><th>Round results</th><th>Winner points</th><th>Loser points</th></thead>
                <tbody>
                <tr><td>2 out of 2 wins</td><td>1</td><td>0</td></tr>
                <tr><td>2 wins and 1 tie</td><td>0.9</td><td>0.1</td></tr>
                <tr><td>2 wins and 1 loss</td><td>0.8</td><td>0.2</td></tr>
                <tr><td>1 win and 2 ties</td><td>0.7</td><td>0.3</td></tr>
                <tr><td>Tie</td><td>0.5</td><td>0.5</td></tr>
                </tbody>
            </table>`;
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

        const fourthPlaceScore = orderedScores[3];

        function isInFinals(robotScore) {
            if (robotScore.score > fourthPlaceScore.score) {
                return true;
            }

            if (robotScore.score === fourthPlaceScore.score && robotScore.tieBreakScore >= fourthPlaceScore.tieBreakScore) {
                return true;
            }

            return false;
        }

        return html`<h3>Scoreboard</h3>
            <table class="scoreboard">
                <thead><tr><th></th><th>Name</th><th>Score</th><th>Tiebreak score</th></tr></thead>
                <tbody>${orderedScores.map((s, i) => this.renderSwissScoreboardRow(s, i, isInFinals(s)))}</tbody>
            </table>`
    }

    renderSwissScoreboardRow(robotScore, index, isFinalist) {
        const classes = {
            'is-finalist': isFinalist,
        }

        return html`<tr class=${classMap(classes)}>
            <td>${index + 1}</td>
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
            <h3 class="de-title">No games lost</h3>
            <ul class="de-games">${noLossGames.map(g => this.renderGamesListItem(g, gameTypes[g.id]))}</ul>
            ${this.renderDoubleEliminationNextGames(deInfo.noLossQueue)}
            
            <h3 class="de-title">1 game lost</h3>
            <ul class="de-games">${oneLossGames.map(g => this.renderGamesListItem(g, gameTypes[g.id]))}</ul>
            ${this.renderDoubleEliminationNextGames(deInfo.oneLossQueue)}
        
            <h3 class="de-title">Eliminated</h3>
            <ul class="de-games">${deInfo.eliminatedRobots.map(r => this.renderRobot(r))}</ul>`
    }

    renderDoubleEliminationFinalGames(games) {
        if (games.length === 0) {
            return null;
        }

        const deInfo = this.competitionInfo.doubleEliminationTournament;
        const {gameTypes} = deInfo;

        return html`<h3 class="de-title">Final games</h3>
            <ul class="de-games">${games.map(g => this.renderGamesListItem(g, gameTypes[g.id]))}</ul>`;
    }

    renderDoubleEliminationNextGames(robots) {
        const matches = [];

        for (let i = 0; i < robots.length; i += 2) {
            matches.push(robots.slice(i, i+ 2));
        }

        return html`<ul class="de-games">${matches.map(m => this.renderMatch(m))}</ul>`;
    }

    renderMatch(robots) {
        if (robots.length === 1) {
            return html`<li>${robots[0].name}</li>`;
        }

        return html`<li>${robots[0].name} vs ${robots[1].name}</li>`;
    }
}

customElements.define('competition-results', CompetitionResults);