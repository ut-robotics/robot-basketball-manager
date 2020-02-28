const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const util = require('util');
const fs = require('fs');

const Game = require('./game');
const {Basket} = require('./constants');
const RobotsApi = require('./robots-api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({server});
const wssBaskets = new WebSocket.Server({port: 8112}, () => {
    log('Opened baskets websocket');
});

const robots = require('./robots');
const robotsMap = robots.reduce((object, robot) => {
    object[robot.id] = robot;
    return object;
}, {});

console.log('robotsMap', robotsMap);

function time() {
    const date = new Date();

    return `${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}.${('00' + date.getMilliseconds()).slice(-3)}`;
}

function log(...parts) {
    console.log.apply(console, [time(), ...parts]);
}

function logError(...parts) {
    console.error.apply(console, [time(), ...parts]);
}

app.use(express.static('../web'));

app.get('/api/robots', (req, res) => {
    res.send(robots);
});

const robotsApi = new RobotsApi(8111, (method, params) => {
    if (method === 'get_active_game_state') {
        if (!activeGame) {
            return null;
        }

        const robotsIds = activeGame.getRobotIds();

        return {
            is_running: activeGame.isRunning(),
            targets: robotsIds,
            baskets: activeGame.getBasketsForRobots(robotsIds),
        }
    }
});

wss.on('connection', function connection(ws, req) {
    log('websocket connection', req.connection.remoteAddress, req.connection.remotePort);

    ws.on('message', function incoming(message) {
        log('received:', message);
        try {
            handleWsMessage(JSON.parse(message));
        } catch (error) {
            logError(error);
        }
    });

    ws.send(getActiveGameStateJSON());
});

wssBaskets.on('connection', function connection(ws, req) {
    log('basket websocket connection', req.connection.remoteAddress, req.connection.remotePort);

    ws.on('message', function incoming(message) {
        log('basket sent:', message);

        if (message === 'blue') {
            incrementScore(Basket.blue);
        } else if (message === 'magenta') {
            incrementScore(Basket.magenta);
        }
    });
});

function wsServerBroadcast(wss, data) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

server.listen(8110, function listening() {
    log('Listening on', server.address().port);
    log('http://localhost:' + server.address().port);
});

let activeGame = null;
let activeGameFileName = null;

loadActiveGame();

function broadcastGameState() {
    log('broadcastGameState');
    wsServerBroadcast(wss, getActiveGameStateJSON());
}

function handleChangeType(changeType) {
    log('handleChangeType', changeType);

    if (changeType === 'roundStarted' || changeType === 'freeThrowAttemptStarted') {
        const targets = activeGame.getInGameRobotIds();

        robotsApi.start(targets, activeGame.getBasketsForRobots(targets));
    } else if (changeType === 'roundStopped' || changeType === 'freeThrowAttemptEnded') {
        robotsApi.stop(activeGame.getRobotIds());
    }
}

let isSaving = false;
let saveAgain = false;

function saveActiveGame() {
    log('saveActiveGame');

    if (isSaving) {
        log('is already saving');
        saveAgain = true;
    }

    isSaving = true;

    const data = JSON.stringify(activeGame.getState(), null, 2);

    fs.writeFile('games/' + activeGameFileName, data, 'utf8', (error) => {
        if (error) {
            logError('Failed to save active game', error);
        } else {
            log('Active game saved');
        }

        isSaving = false;

        if (saveAgain) {
            saveAgain = false;

            setImmediate(() => {
                saveActiveGame();
            });
        }
    });
}

function loadActiveGame() {
    fs.readdir('games', (err, files) => {
        if (err) {
            console.error(err);
        } else {
            console.log(files);

            const lastFile = files.sort()[files.length - 1];

            if (!lastFile) {
                return;
            }

            fs.readFile('games/' + lastFile, 'utf8', (error, stateJSON) => {
                if (error) {
                    logError('Failed to read game state file', error);
                } else {
                    log('Active game state loaded');

                    try {
                        const state = JSON.parse(stateJSON);
                        activeGame = Game.fromState(state);
                        activeGameFileName = lastFile;

                        activeGame.on('changed', (changeType) => {
                            handleChangeType(changeType);
                            broadcastGameState();
                            saveActiveGame();
                        });
                    } catch (e) {
                        log('Failed to parse game state from file', e);
                    }
                }
            });
        }
    });
}

function getActiveGameStateJSON() {
    return JSON.stringify({event: 'game_state', params: activeGame && activeGame.getInfo()})
}

function handleWsMessage(message) {
    log('handleWsMessage', message);

    switch (message.method) {
        case 'create_game':
            createNewGame(message.params && message.params.robotIDs);
            break;
        case 'start_game':
            startGame();
            break;
        case 'stop_game':
            stopGame();
            break;
        case 'end_round':
            endRound();
            break;
        case 'increment_blue':
            incrementScore(Basket.blue);
            break;
        case 'increment_magenta':
            incrementScore(Basket.magenta);
            break;
        case 'increment_fouls_left':
            incrementFouls(0);
            break;
        case 'increment_fouls_right':
            incrementFouls(1);
            break;
        case 'confirm_game':
            confirmGame();
            break;
        case 'set_score_validity':
            const {sideIndex, scoreIndex, isValid} = message.params;
            setScoreValidity(sideIndex, scoreIndex, isValid);
            break;
    }
}

async function wait(duration) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, duration);
    });
}

async function createNewGame(robotIDs) {
    if (activeGame && !activeGame.hasEnded) {
        return;
    }

    if (!Array.isArray(robotIDs) || robotIDs.length !== 2) {
        return;
    }

    await new Promise((resolve, reject) => {
        fs.mkdir('games', (err) => {
            if (err) {
                console.error(err);
            }

            if (err && err.code !== 'EEXIST') {
                reject(err);
            } else {
                resolve();
            }
        });
    });

    const newGameRobots = [];

    for (const id of robotIDs) {
        if (!robotsMap[id]) {
            return;
        }

        newGameRobots.push(robotsMap[id]);
    }

    const baskets = Math.random() < 0.5 ? [Basket.blue, Basket.magenta] : [Basket.magenta, Basket.blue];

    activeGame = new Game(newGameRobots, baskets, false);
    activeGameFileName = `game_${Date.now()}.json`;

    activeGame.on('changed', (changeType) => {
        handleChangeType(changeType);
        broadcastGameState();
        saveActiveGame();
    });

    broadcastGameState();
    saveActiveGame();
}

function startGame() {
    if (!activeGame || activeGame.hasEnded) {
        return;
    }

    activeGame.start();
}

function stopGame() {
    if (!activeGame || activeGame.hasEnded) {
        return;
    }

    activeGame.stop();
}

function endRound() {
    if (!activeGame || activeGame.hasEnded) {
        return;
    }

    activeGame.endRound();
}

function incrementScore(basket) {
    if (!activeGame || activeGame.hasEnded) {
        return;
    }

    activeGame.incrementScore(basket);
}

function incrementFouls(robotIndex) {
    if (!activeGame || activeGame.hasEnded) {
        return;
    }

    activeGame.incrementFouls(robotIndex);
}

function confirmGame() {
    if (!activeGame || activeGame.hasEnded) {
        return;
    }

    activeGame.confirm();
}

function setScoreValidity(sideIndex, scoreIndex, isValid) {
    if (!activeGame || activeGame.hasEnded) {
        return;
    }

    activeGame.setScoreValidity(sideIndex, scoreIndex, isValid);
}