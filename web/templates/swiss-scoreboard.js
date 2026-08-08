import {html, classMap} from "../lib/lit.mjs";
import {roundToTwoDecimalPlaces} from "../js/util/rounding.mjs";

export function renderSwissScoreboard(swissInfo) {
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
                <thead><tr>
                    <th></th>
                    <th>Name</th>
                    <th>Score</th>
                    <th>Tiebreak<br />score</th>
                    <th>Game<br />scores</th>
                    <th>Total</th>
                    <th>Games</th>
                    </tr></thead>
                <tbody>${orderedScores.map((s, i) => renderSwissScoreboardRow(s, i, isInFinals(s)))}</tbody>
            </table>`
}

export function createNumberRange(from, to) {
    return `[${roundToTwoDecimalPlaces(from)}..${roundToTwoDecimalPlaces(to)}]`
}

export function renderSwissScoreboardRow(robotScore, index, isFinalist) {
    const gameScoreParts = [];
    const finishedGamesCount = robotScore.finishedGamesCount;
    let totalMax = 0;
    let totalMin = 0;
    let gameCount = 0;

    for (const gameScore of robotScore.gameScores) {
        if (Number.isFinite(gameScore)) {
            gameScoreParts.push(roundToTwoDecimalPlaces(gameScore));
            totalMin += gameScore;
            totalMax += gameScore;
            gameCount++;
        } else if (gameScore.completedRoundCount > 0) {
            gameScoreParts.push(createNumberRange(gameScore.min, gameScore.max));
            totalMin += gameScore.min;
            totalMax += gameScore.max;
            gameCount++;
        }
    }

    const classes = {
        'is-finalist': isFinalist,
    }

    return html`<tr class=${classMap(classes)}>
            <td>${index + 1}</td>
            <td>${robotScore.robot.name}</td>
            <td>${totalMin === totalMax ? roundToTwoDecimalPlaces(robotScore.score) : createNumberRange(totalMin / gameCount, totalMax / gameCount)}</td>
            <td>${roundToTwoDecimalPlaces(robotScore.tieBreakScore)}</td>
            <td>${gameScoreParts.join(' + ')}</td>
            <td>${totalMin === totalMax ? roundToTwoDecimalPlaces(totalMin) : createNumberRange(totalMin, totalMax)}</td>
            <td>${finishedGamesCount === gameCount ? finishedGamesCount : finishedGamesCount + ' + 1'}</td>
        </tr>`;
}