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

app.use(express.static('../web'));

const robotsApi = new RobotsApi(8111, (method, params) => {
    if (method === 'get_active_game_state') {
        if (!activeGame) {
            return null;
        }

        return {
            is_running: activeGame.isRunning(),
            targets: activeGame.getRobotIds(),
        }
    }
});

const participants = {
    'io': {id: 'io', name: 'Io'},
    '001trt': {id: '001trt', name: '001TRT'},
    'robot3': {id: 'robot3', name: 'Robot 3'},
    'robot4': {id: 'robot4', name: 'Robot 4'},
    'robot5': {id: 'robot5', name: 'Robot 5'},
    'robot6': {id: 'robot6', name: 'Robot 6'},
    'robot7': {id: 'robot7', name: 'Robot 7'},
};
/*
let tcpSocket;

const tcpServer = net.createServer((socket) => {
    tcpSocket = socket;

    socket.on('error', (err) => {
        console.error('TCP socket error', err);
    });

    socket.on('data', (data) => {
        console.error('TCP socket data', data.toString());

        socket.write('start');
    });
});

tcpServer.on('error', (err) => {
    console.error('TCP server error', err);
});

tcpServer.on('connection', (socket) => {
    console.error('TCP server connection', socket.remoteAddress, socket.remotePort);
});

tcpServer.listen(8111, 'localhost', () => {
    console.log('opened TCP server on', tcpServer.address());
});
*/
wss.on('connection', function connection(ws, req) {
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        try {
            handleWsMessage(JSON.parse(message));
        } catch (error) {
            console.info(error);
        }
    });

    ws.send(getActiveGameStateJSON());
});

function wsServerBroadcast(wss, data) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

server.listen(8101, function listening() {
    console.log('Listening on %d', server.address().port);
    console.log('http://localhost:' + server.address().port);
});

let activeGame = null;

loadActiveGame();

function broadcastGameState() {
    console.log('broadcastGameState');
    wsServerBroadcast(wss, getActiveGameStateJSON());
}

function saveActiveGame() {
    const state = activeGame.getState();

    fs.writeFile('active_game.json', JSON.stringify(state, null, 2), 'utf8', (error) => {
        if (error) {
            console.error('Failed to save active game', error);
        } else {
            console.log('Active game saved');
        }
    });
}

function loadActiveGame() {
    fs.readFile('active_game.json', 'utf8', (error, stateJSON) => {
        if (error) {
            console.error('Failed to read game state file', error);
        } else {
            console.log('Active game state loaded');

            try {
                const state = JSON.parse(stateJSON);
                activeGame = Game.fromState(state);

                activeGame.on('changed', () => {
                    broadcastGameState();
                    saveActiveGame();
                });
            } catch (e) {
                console.error('Failed to parse game state from file', error);
            }
        }
    });
}

function getActiveGameStateJSON() {
    return JSON.stringify({event: 'game_state', params: activeGame && activeGame.getInfo()})
}

function handleWsMessage(message) {
    console.log('handleWsMessage', message);

    switch (message.method) {
        case 'create_game':
            createNewGame();
            break;
        case 'start_game':
            startGame();
            break;
        case 'stop_game':
            stopGame();
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
    }
}

async function wait(duration) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, duration);
    });
}

function createNewGame() {
    if (activeGame && !activeGame.hasEnded) {
        return;
    }

    activeGame = new Game([participants.io, participants['001trt']], [Basket.blue, Basket.magenta], false);

    activeGame.on('changed', () => {
        broadcastGameState();
        saveActiveGame();
    });

    broadcastGameState();
    saveActiveGame();
}

function startGame() {
    if (!activeGame) {
        return;
    }

    activeGame.start();
    robotsApi.start(activeGame.getRobotIds());
}

function stopGame() {
    if (!activeGame) {
        return;
    }

    activeGame.stop();
    robotsApi.stop(activeGame.getRobotIds());
}

function incrementScore(basket) {
    if (!activeGame) {
        return;
    }

    activeGame.incrementScore(basket);
}

function incrementFouls(robotIndex) {
    if (!activeGame) {
        return;
    }

    activeGame.incrementFouls(robotIndex);
}
