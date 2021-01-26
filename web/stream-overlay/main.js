import WebsocketManager from "../js/util/websocket-manager.js";
import getRoundRuntime from "../js/util/get-round-runtime.js";
import getValidScoreCounts from "../js/util/get-valid-score-counts.js";

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

const timeElement = document.getElementById('time');
const titleRowElement = document.getElementById('title-row');
const titleElement = document.getElementById('title');
const messageElement = document.getElementById('message');
const leftFoulsElement = document.getElementById('left-fouls');
const rightFoulsElement = document.getElementById('right-fouls');

let activeGameState = null;

function renderState(state) {
    if (!state) {
        titleRowElement.classList.remove('active');
        timeElement.classList.remove('active');
        return;
    }

    const {rounds, robots} = state;
    const lastRound = rounds[rounds.length - 1];

    if (!lastRound) {
        return;
    }

    titleRowElement.classList.add('active');
    timeElement.classList.add('active');

    titleElement.innerText = `${robots[0].name} vs ${robots[1].name}`;

    leftFoulsElement.classList.remove('first');
    leftFoulsElement.classList.remove('second');
    rightFoulsElement.classList.remove('first');
    rightFoulsElement.classList.remove('second');

    if (state.freeThrows) {
        leftFoulsElement.classList.remove('active');
        leftFoulsElement.classList.remove('active');
    } else {
        for (const [index, element] of [leftFoulsElement, rightFoulsElement].entries()) {
            const foulCount = lastRound.fouls[index].length;

            if (foulCount > 0) {
                if (foulCount === 2) {
                    element.classList.add('second');
                } else {
                    element.classList.add('first');
                }

                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        }
    }

    const gameRoundElements = document.querySelectorAll('.game-round');

    for (let i = 0; i < gameRoundElements.length; i++) {
        const element = gameRoundElements[i];

        if (rounds[i]) {
            element.classList.add('active');

            const validScoreCounts = getValidScoreCounts(rounds[i].scores);

            if (rounds[i] !== lastRound || state.freeThrows) {
                element.innerText = `${validScoreCounts[0]}-${validScoreCounts[1]}`;
            } else {
                const leftClass = rounds[i].baskets[0] === 'blue' ? 'blue-basket' : 'magenta-basket';
                const rightClass = rounds[i].baskets[1] === 'blue' ? 'blue-basket' : 'magenta-basket';
                element.innerHTML = `<span class="${leftClass}">${validScoreCounts[0]}</span>-<span class="${rightClass}">${validScoreCounts[1]}</span>`;
            }
        } else {
            element.classList.remove('active');
        }
    }

    if (state.status.result === 'won') {
        messageElement.innerText = `${state.status.winner.name} won`;
        messageElement.classList.add('active');
        return;
    } else if (state.status.result === 'tied') {
        messageElement.innerText = `Tie`;
        messageElement.classList.add('active');
        return;
    } else {
        messageElement.classList.remove('active');
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