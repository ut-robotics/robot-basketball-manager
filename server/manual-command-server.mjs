import http from 'http';
import express from 'express';
import WebSocket, {WebSocketServer} from "ws";
import {log, logError} from './util.mjs';
import RobotsApi, {RobotsApiEventName} from './robots-api.mjs';

function methodHandler(method, params) {
    if (method === 'get_active_game_state') {
        return {
            is_running: true,
            targets: ['robot1', 'robot2'],
            baskets: ['blue', 'magenta'],
        }
    }
}

const robotsApi = new RobotsApi(8111, methodHandler);

robotsApi.on(RobotsApiEventName.connectionsChange, () => {
    log('connectionsChange');

    const info = robotsApi.getClientsInfo();

    log(info);

    wsServerBroadcastClientsInfo(wss, info);
});

robotsApi.on(RobotsApiEventName.sentMessagesChange, () => {
    log('connectionsChange');

    const info = robotsApi.getSentMessagesInfo();

    log(info);

    wsServerBroadcastSentMessagesInfo(wss, info);
});

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({port: 8115});

wss.on('connection', (ws, req) => {
    log('manual command server websocket connection', req.connection.remoteAddress, req.connection.remotePort);

    ws.on('message', (data, isBinary) => {
        const message = isBinary ? data : data.toString();

        log('manual command server received:', message);

        try {
            handleWsMessage(JSON.parse(message));
        } catch (error) {
            logError(error);
        }
    });
});

function handleWsMessage(message) {
    log('handleWsMessage', message);

    switch (message.method) {
        case 'signal':
            robotsApi.sendSignal(message.signal, message.targets, message.connectionIds, message.baskets);
            break
        case 'get_clients_info':
            wsServerBroadcastClientsInfo(wss, robotsApi.getClientsInfo());
            break;
    }
}

function wsServerBroadcastClientsInfo(wsServer, data) {
    wsServerBroadcast(wss, JSON.stringify({event: 'clients', params: data}));
}

function wsServerBroadcastSentMessagesInfo(wsServer, data) {
    wsServerBroadcast(wss, JSON.stringify({event: 'sentMessages', params: data}));
}

function wsServerBroadcast(wsServer, data) {
    wsServer.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

app.use(express.static('../web/manual-command'));
app.use('/lib', express.static('../web/lib'));
app.use('/js', express.static('../web/js'));
app.use('/audio', express.static('../web/audio'));

app.get('/start/:targets/:baskets', (req, res) => {
    log(req.params);

    const targets = req.params.targets.split(',');
    const baskets = req.params.baskets.split(',');

    robotsApi.sendSignal('start', targets, baskets);

    res.sendStatus(200);
});

app.get('/stop/:targets', (req, res) => {
    log(req.params);

    const targets = req.params.targets.split(',');

    robotsApi.sendSignal('stop', targets);

    res.sendStatus(200);
});

app.get('/ping/:targets', (req, res) => {
    log(req.params);

    const targets = req.params.targets.split(',');

    robotsApi.sendSignal('ping', targets);

    res.sendStatus(200);
});

server.listen(8220, function listening() {
    log('Listening on', server.address().port);
    log('http://localhost:' + server.address().port);
});