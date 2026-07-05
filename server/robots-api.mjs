import {WebSocketServer} from 'ws';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import fsPromises from 'node:fs/promises';
import fs from 'node:fs';
import {log} from './util.mjs';

export const RobotsApiEventName = {
    connectionsChange: 'connectionsChange',
    sentMessagesChange: 'sentMessagesChange',
};

export default class RobotsApi extends EventEmitter {
    #server;
    #port;
    #methodHandler;
    #wss;
    #messageIdCounter = 1;
    #connectionIdCounter = 1;
    #sentMessagesMap = new Map();
    #ackWaitTime = 60000;

    constructor(port, methodHandler) {
        super();

        this.#server = http.createServer();
        this.#port = port;
        this.#methodHandler = methodHandler;

        this.#wss = new WebSocketServer({noServer: true}, () => {
            log('Opened robots websocket');
        });

        this.#wss.on('connection', (ws, req, clientInfo) => {
            ws.connectionInfo = {
                connectionId: this.#connectionIdCounter++,
                remoteAddress: req.connection.remoteAddress,
                remotePort: req.connection.remotePort,
                robotId: clientInfo.robotId,
            };

            ws.on('message', (data, isBinary) => {
                const message = isBinary ? data : data.toString();

                log('received', ws.connectionInfo.robotId, message);

                this.#handleMessage(message, ws);
            });

            ws.on('close', (code, reason) => {
                log('robot socket closed', ws.connectionInfo.robotId, code, reason.toString('utf8'));
                this.emit(RobotsApiEventName.connectionsChange);
            });

            this.emit(RobotsApiEventName.connectionsChange);
        });

        this.#server.on('upgrade', (req, socket, head) => {
            log('robot connection', req.connection.remoteAddress, req.connection.remotePort);
            // log(req.headers);

            let robotId = undefined

            if (req.headers.authorization) {
                const [type, encodedCredentials] = req.headers.authorization.split(' ');

                if (type === 'Basic') {
                    const credentials = Buffer.from(encodedCredentials, 'base64').toString();
                    const [username, password] = credentials.split(':');
                    log('credentials', username, password);

                    robotId = username;
                }
            }

            if (!robotId) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            this.#wss.handleUpgrade(req, socket, head, (ws) => {
                this.#wss.emit('connection', ws, req, {robotId});
            });
        });

        this.sentMessageCheckerIntervalId = null;
        this.sentMessageCheckerIntervalDelay = 10000;
        this.lastSentMessageCheckTime = Date.now();
        this.messageLogDirectory = 'robots-api-message-logs'
        this.messageLogFilePath = `${this.messageLogDirectory}/robots-api-message-log_${Date.now()}.txt`;

        fs.mkdirSync(this.messageLogDirectory, {recursive: true});

        this.#server.listen(port);

        this.startSentMessageChecker();
    }

    async logToFile(logLine) {
        try {
            const prefix = `${Date.now()}\t`
            await fsPromises.writeFile(this.messageLogFilePath, prefix + logLine + '\n', {flag: 'a'});
        } catch (err) {
            console.error(err);
        }
    }

    startSentMessageChecker() {
        this.sentMessageCheckerIntervalId = setInterval(() => {
            if (this.lastSentMessageCheckTime > this.sentMessageCheckerIntervalDelay) {
                const removeCount = this.#removeExpiredSentMessages();

                if (removeCount > 0) {
                    this.handleSentMessagesChange();
                }
            }
        }, 10000)
    }

    stopSentMessageChecker() {
        clearInterval(this.sentMessageCheckerIntervalId);
    }

    handleSentMessagesChange() {
        // this.#logSentMassages();
        this.emit(RobotsApiEventName.sentMessagesChange);
    }

    sendSignal(signal, targets = undefined, connectionIds = undefined, baskets = undefined, delay = 0) {
        log(`RobotsApi ${signal} requested`);

        setTimeout(() => {
            this.#send(signal, targets, connectionIds, baskets);
        }, delay);
    }

    start(targets, baskets, delay = 0) {
        this.sendSignal('start', targets, undefined, baskets, delay);
    }

    stop(targets, delay = 0) {
        this.sendSignal('stop', targets, undefined, undefined, delay);
    }

    ping(targets) {
        this.#send('ping', targets);
    }

    #addSentMessage(messageId, message, connectionId) {
        this.#sentMessagesMap.set(messageId, {time: Date.now(), message, connectionId});
        this.#removeExpiredSentMessages();
        this.handleSentMessagesChange();
    }

    #ackSentMessage(messageId) {
        const messageInfo = this.#sentMessagesMap.get(messageId);

        if (messageInfo) {
            // log('ACK', messageId, messageInfo);
            messageInfo.ackTime = Date.now()
            this.#removeExpiredSentMessages();
            this.handleSentMessagesChange();
        }
    }

    #removeExpiredSentMessages() {
        const timeNow = Date.now();
        let removeCount = 0;

        this.lastSentMessageCheckTime = timeNow;

        for (const [messageId, info] of this.#sentMessagesMap.entries()) {
            const age = timeNow - info.time

            if (age > this.#ackWaitTime) {
                // console.log('expired sent message', messageId, info.message);
                this.#sentMessagesMap.delete(messageId);
                removeCount++;
            } else {
                break;
            }
        }

        return removeCount;
    }

    #logSentMassages() {
        console.log('>> sentMessages');

        let counter = 1;
        const timeNow = Date.now();

        for (const [messageId, info] of this.#sentMessagesMap.entries()) {
            console.log(counter++, messageId, timeNow - info.time, info.ackTime, info.message);
        }

        console.log('<<');
    }

    #send = (signal, targets, connectionIds, baskets) => {
        log('send', signal, targets, connectionIds, baskets);

        for (const client of this.#wss.clients) {
            const robotId = client.connectionInfo.robotId;
            const connectionId = client.connectionInfo.connectionId;
            const isInConnectionIds = Array.isArray(connectionIds) && connectionIds.includes(connectionId);

            if (!isInConnectionIds && !targets.includes(robotId) && !targets.includes('*')) {
                continue;
            }

            const message = JSON.stringify({messageId: this.#messageIdCounter, signal, targets, baskets});
            log('client send', robotId, connectionId, message);
            this.#addSentMessage(this.#messageIdCounter, message, connectionId);
            this.#messageIdCounter++;
            client.send(message);
            this.logToFile(`SENT\t${message}\t${JSON.stringify(client.connectionInfo)}`);
        }
    };

    #sendJSON = (info, client) => {
        const message = JSON.stringify(info);
        client.send(JSON.stringify(info));
        this.logToFile(`SENT\t${message}\t${JSON.stringify(client.connectionInfo)}`);
    };

    #handleMessage = (message, socket) => {
        try {
            this.logToFile(`RCVD\t${message}\t${JSON.stringify(socket.connectionInfo)}`);

            let info = JSON.parse(message);

            if (info.method !== undefined && info.method !== null) {
                if (info.id === undefined || info.id === null) {
                    this.#sendJSON({error: {code: -32600, message: 'Invalid id'}, id: null}, socket);
                    return;
                }

                const result = this.#methodHandler(info.method, info.params);
                this.#sendJSON({result: result, 'id': info.id}, socket);
            } else if (info.type === 'ack') {
                this.#ackSentMessage(info.data.messageId);
            }
        } catch (e) {
            console.error(e);
        }
    }

    getClientsInfo() {
        const clientsInfo = [];

        for (const client of this.#wss.clients) {
            clientsInfo.push(client.connectionInfo);
        }

        return clientsInfo;
    }

    getSentMessagesInfo() {
        const sentMessagesInfo = [];

        for (const [messageId, info] of this.#sentMessagesMap.entries()) {
            sentMessagesInfo.push(info);
        }

        return sentMessagesInfo;
    }
}