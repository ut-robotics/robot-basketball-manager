import WebsocketManager from "../util/websocket-manager.js";

let socketManager = new WebsocketManager(onSocketMessage);

initUI();

function onSocketMessage(message) {
    try {
        const info = JSON.parse(message);

        switch (info.event) {
            case 'game_state':
                activeGameState = info.params;
                renderState(info.params);
                break;
        }
    } catch (error) {
        console.info(error);
    }
}

const leftScoreElement = document.getElementById('left-score');
const rightScoreElement = document.getElementById('right-score');
const timeElement = document.getElementById('time');
const leftNameElement = document.getElementById('left-name');
const rightNameElement = document.getElementById('right-name');
const titleElement = document.getElementById('title-row');
const messageElement = document.getElementById('message');
const leftFoulsElement = document.getElementById('left-fouls');
const rightFoulsElement = document.getElementById('right-fouls');

let activeGameState = null;

function renderState(state) {
    if (!state) {
        return;
    }

    const {rounds, robots} = state;
    const lastRound = rounds[rounds.length - 1];

    if (state.freeThrows) {
        leftScoreElement.classList.remove('blue-basket');
        leftScoreElement.classList.remove('magenta-basket');
        rightScoreElement.classList.remove('magenta-basket');
        rightScoreElement.classList.remove('blue-basket');
    } else {
        if (lastRound.baskets[0] === 'blue') {
            leftScoreElement.classList.add('blue-basket');
            leftScoreElement.classList.remove('magenta-basket');
            rightScoreElement.classList.add('magenta-basket');
            rightScoreElement.classList.remove('blue-basket');
        } else {
            leftScoreElement.classList.remove('blue-basket');
            leftScoreElement.classList.add('magenta-basket');
            rightScoreElement.classList.remove('magenta-basket');
            rightScoreElement.classList.add('blue-basket');
        }
    }

    if (state.freeThrows) {
        leftScoreElement.innerText = state.freeThrows.scores[0];
        rightScoreElement.innerText = state.freeThrows.scores[1];
        leftFoulsElement.innerText = '';
        rightFoulsElement.innerText = '';
    } else {
        const validScoreCounts = getValidScoreCounts(lastRound.scores);
        leftScoreElement.innerText = validScoreCounts[0];
        rightScoreElement.innerText = validScoreCounts[1];

        for (const [index, element] of [leftFoulsElement, rightFoulsElement].entries()) {
            const foulCount = lastRound.fouls[index].length;

            element.innerText = foulCount > 0 ? `Fouls: ${foulCount}` : '';
        }
    }

    leftNameElement.innerText = robots[0].name;
    rightNameElement.innerText = robots[1].name;

    const gameRoundElements = document.querySelectorAll('.game-round');

    for (let i = 0; i < gameRoundElements.length; i++) {
        const element = gameRoundElements[i];

        if (rounds[i]) {
            element.classList.add('active');

            if (rounds[i] !== lastRound || state.freeThrows) {
                const validScoreCounts = getValidScoreCounts(rounds[i].scores);
                element.innerText = `${validScoreCounts[0]}-${validScoreCounts[1]}`;
            } else {
                element.innerText = `${i + 1}.`;
            }
        } else {
            element.classList.remove('active');
        }
    }

    if (state.status.result === 'won') {
        messageElement.innerText = `${state.status.winner.name} WON`;
        return;
    } else if (state.status.result === 'tied') {
        messageElement.innerText = `TIE`;
        return;
    }

    if (state.freeThrows) {
        const rounds = state.freeThrows.rounds;
        const robots = state.freeThrows.robots;
        const lastRound = rounds[rounds.length - 1];
        let nextRoundNumber = rounds.length + 1;
        let robotIndex = 0;

        if (lastRound) {
            const firstAttempt = lastRound[0];
            const secondAttempt = lastRound[1];

            if (firstAttempt.endTime && !secondAttempt || secondAttempt && !secondAttempt.endTime) {
                robotIndex = 1;
            }

            if (lastRound.length < 2 || !secondAttempt.endTime) {
                nextRoundNumber--;
            }
        }

        messageElement.innerText = `Freethrows round ${nextRoundNumber}: ${robots[robotIndex].name}`;
    } else {
        messageElement.innerText = '';
    }
}

function initUI() {

}

requestAnimationFrame(updateTime);

function updateTime() {
    requestAnimationFrame(updateTime);

    if (!activeGameState) {
        return;
    }

    if (activeGameState.freeThrows) {
        const rounds = activeGameState.freeThrows.rounds;

        if (rounds && rounds.length > 0) {
            const lastRound = rounds[rounds.length - 1];
            const lastAttempt = lastRound[lastRound.length -1];
            const runTime = (lastAttempt.endTime || Date.now()) - lastAttempt.startTime;
            const time = Math.max(activeGameState.freeThrows.timeLimit - runTime, 0);

            timeElement.innerText = (time / 1000).toFixed(1);
        }
    } else {
        const lastRound = activeGameState.rounds[activeGameState.rounds.length - 1];
        const runtime = getRuntime(lastRound.runs);
        const time = Math.max(lastRound.timeLimit - runtime, 0);

        timeElement.innerText = (time / 1000).toFixed(1);
    }
}

function getRuntime(runs) {
    const time = Date.now();
    const lastRun = runs[runs.length - 1];
    let runtime = 0;

    for  (const run of runs) {
        const {startTime, endTime} = run;

        if (startTime && endTime) {
            runtime += endTime - startTime;
        } else if (startTime && run === lastRun) {
            runtime += time - startTime;
        }
    }

    return runtime;
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