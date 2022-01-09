import WebsocketManager from "../js/util/websocket-manager.js";
import getRoundRuntime from "../js/util/get-round-runtime.js";
import getValidScoreCounts from "../js/util/get-valid-score-counts.js";
import zip from "../js/util/zip.js";

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

const infoBoxElement = document.getElementById('info-box');
const robotsElement = document.getElementById('robots');
const mainRoundsElement = document.getElementById('main-rounds');
const freethrowsRoundElement = document.getElementById('freethrows-round');
const timeElement = document.getElementById('time');
const gameResultsElement = document.getElementById('game-results');
const messageElement = document.getElementById('message');

const robotElements = robotsElement.getElementsByClassName('robot');
const robotNameElements = robotsElement.getElementsByClassName('robot-name');
const robotFoulsElements = robotsElement.getElementsByClassName('robot-fouls');
const mainRoundElements = mainRoundsElement.getElementsByClassName('main-round');

let activeGameState = null;

function renderState(state) {
    if (!infoBoxElement) {
        infoBoxElement.classList.remove('active');
        return;
    }

    const {rounds, robots} = state;
    const lastRound = rounds[rounds.length - 1];

    if (!lastRound) {
        return;
    }

    infoBoxElement.classList.add('active');

    const robotsData = zip(robots, robotNameElements, robotFoulsElements, lastRound.fouls);

    for (const [robot, robotNameElement, robotFoulsElement, robotFouls] of robotsData) {
        robotNameElement.innerText = robot.name;

        robotFoulsElement.classList.remove('first');
        robotFoulsElement.classList.remove('second');

        if (state.freeThrows || state.hasEnded) {
            robotFoulsElement.classList.remove('active');
        } else {
            const foulCount = robotFouls.length;

            if (foulCount > 0) {
                if (foulCount === 2) {
                    robotFoulsElement.classList.add('second');
                } else {
                    robotFoulsElement.classList.add('first');
                }

                robotFoulsElement.classList.add('active');
            } else {
                robotFoulsElement.classList.remove('active');
            }
        }

        if (state.status.result === 'won') {
            if (robot.id === state.status.winner.id) {
                robotNameElement.classList.add('won');
            } else {
                robotNameElement.classList.add('lost');
            }
        } else if (state.status.result === 'tied') {
            robotNameElement.classList.remove('tied');
        } else {
            robotNameElement.classList.remove('won');
            robotNameElement.classList.remove('lost');
            robotNameElement.classList.remove('tied');
        }
    }

    for (const [element, round] of zip(mainRoundElements, rounds)) {
        if (!round) {
            element.classList.remove('active');
            continue;
        }

        element.classList.add('active');

        const validScoreCounts = getValidScoreCounts(round.scores);

        if (round.hasEnded && round.isConfirmed) {
            const robot1Class = round.winnerIndex === 0 ? 'won' : (round.winnerIndex === -1 ? 'tied' : 'lost');
            const robot2Class = round.winnerIndex === 1 ? 'won' : (round.winnerIndex === -1 ? 'tied' : 'lost');

            element.innerHTML = `<div class="${robot1Class}">${validScoreCounts[0]}</div><div class="${robot2Class}">${validScoreCounts[1]}</div>`;
        } else if (round === lastRound && !state.freeThrows) {
            const robot1Class = round.baskets[0] === 'blue' ? 'blue-basket' : 'magenta-basket';
            const robot2Class = round.baskets[1] === 'blue' ? 'blue-basket' : 'magenta-basket';

            element.innerHTML = `<div class="${robot1Class}">${validScoreCounts[0]}</div><div class="${robot2Class}">${validScoreCounts[1]}</div>`;
        } else {
            element.innerHTML = `<div>${validScoreCounts[0]}</div><div>${validScoreCounts[1]}</div>`;
        }
    }

    if (state.hasEnded) {
        gameResultsElement.classList.add('active');
        timeElement.classList.remove('active');

        let robot1Content = '';
        let robot2Content = '';

        if (state.status.result === 'won') {
            if (state.robots[0].id === state.status.winner.id) {
                robot1Content = '&#9734;'
            } else {
                robot2Content = '&#9734;'
            }
        } else if (state.status.result === 'tied') {
            robot1Content = '='
            robot2Content = '='
        }

        gameResultsElement.innerHTML = `<div>${robot1Content}</div><div>${robot2Content}</div>`;
    } else {
        gameResultsElement.classList.remove('active');
        timeElement.classList.add('active');
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
        const scoreCounts = [0, 0];

        for (const round of rounds) {
            scoreCounts[0] += round[0].didScore ? 1 : 0;
            scoreCounts[1] += round[1].didScore ? 1 : 0;
        }

        freethrowsRoundElement.innerHTML = `<div>${scoreCounts[0]}</div><div>${scoreCounts[1]}</div>`;
        freethrowsRoundElement.classList.add('active');
    } else {
        freethrowsRoundElement.classList.remove('active');
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

    if (!activeGameState || activeGameState.hasEnded) {
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