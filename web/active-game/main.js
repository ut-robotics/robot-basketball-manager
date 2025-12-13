import WebsocketManager from "../js/util/websocket-manager.js";
import getRoundRuntime from "../js/util/get-round-runtime.js";
import getValidScoreOrFoulCounts from "../js/util/get-valid-score-counts.js";

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
const leftRobotImageElement = document.getElementById('left-robot-image');
const rightRobotImageElement = document.getElementById('right-robot-image');

let activeGameState = null;

function renderState(state) {
    if (!state) {
        return;
    }

    const {rounds, robots} = state;
    const lastRound = rounds[rounds.length - 1];

    if (!lastRound) {
        return;
    }

    if (!state.freeThrows) {
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
        const validScoreCounts = getValidScoreOrFoulCounts(lastRound.scores);
        const validFoulCounts = getValidScoreOrFoulCounts(lastRound.fouls);
        leftScoreElement.innerText = validScoreCounts[0];
        rightScoreElement.innerText = validScoreCounts[1];

        for (const [index, element] of [leftFoulsElement, rightFoulsElement].entries()) {
            const foulCount = validFoulCounts[index];

            element.innerText = foulCount > 0 ? `Fouls: ${foulCount}` : '';
        }
    }

    leftNameElement.innerText = robots[0].name;
    rightNameElement.innerText = robots[1].name;

    leftRobotImageElement.style.backgroundImage = `url(images/${robots[0].id}_left.png)`;
    rightRobotImageElement.style.backgroundImage = `url(images/${robots[1].id}_right.png)`;

    const gameRoundElements = document.querySelectorAll('.game-round');

    for (let i = 0; i < gameRoundElements.length; i++) {
        const element = gameRoundElements[i];

        if (rounds[i]) {
            element.classList.add('active');

            if (rounds[i] !== lastRound || state.freeThrows) {
                const validScoreCounts = getValidScoreOrFoulCounts(rounds[i].scores);
                element.innerText = `${validScoreCounts[0]}-${validScoreCounts[1]}`;
            } else {
                element.innerText = `${i + 1}.`;
            }
        } else {
            element.classList.remove('active');
        }
    }

    if (state.status.result === 'won') {
        messageElement.innerText = `${state.status.winner.name} won`;
        return;
    } else if (state.status.result === 'tied') {
        messageElement.innerText = `Tie`;
        return;
    }

    if (state.freeThrows) {
        const rounds = state.freeThrows.rounds;
        const robots = state.freeThrows.robots;
        const baskets = state.freeThrows.baskets;
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

        const scoreElements = [leftScoreElement, rightScoreElement];
        const opposingRobotIndex = 1 - robotIndex;

        setBasketClass(scoreElements[robotIndex], baskets[robotIndex]);
        setBasketClass(scoreElements[opposingRobotIndex]);
    } else {
        messageElement.innerText = '';
    }
}

function setBasketClass(element, color) {
    element.classList.remove('blue-basket');
    element.classList.remove('magenta-basket');

    if (color) {
        element.classList.add(color + '-basket');
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
            const time = (Math.max(activeGameState.freeThrows.timeLimit - runTime, 0) / 1000).toFixed(1);

            timeElement.innerText = time.length > 3 ? time.slice(0, -2) : time;
        }
    } else {
        const lastRound = activeGameState.rounds[activeGameState.rounds.length - 1];

        if (lastRound) {
            const runtime = getRoundRuntime(lastRound.runs);
            const time = (Math.max(lastRound.timeLimit - runtime, 0) / 1000).toFixed(1);

            timeElement.innerText = time.length > 3 ? time.slice(0, -2) : time;
        } else {
            timeElement.innerText = '';
        }
    }
}