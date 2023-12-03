import {WebSocketServer} from 'ws';

import {log} from './util.mjs';

export default class RobotsApi {
    #port;
    #methodHandler;
    #wss;

    constructor(port, methodHandler) {
        this.#port = port;
        this.#methodHandler = methodHandler;
        this.#wss = new WebSocketServer({port}, () => {
            log('Opened robots websocket');
        });

        this.#wss.on('connection', (ws, req) => {
            log('robot connection', req.connection.remoteAddress, req.connection.remotePort);

            ws.on('message', (data, isBinary) => {
                const message = isBinary ? data : data.toString();

                log('received', message);

                this.#handleMessage(message, ws);
            });
        });
    }

    start(targets, baskets, delay = 0) {
        console.log(Date.now(), 'RobotsApi start requested');

        setTimeout(() => {
            this.#send('start', targets, baskets);
            console.log(Date.now(), 'RobotsApi start sent');
        }, delay);
    }

    stop(targets, delay = 0) {
        console.log(Date.now(), 'RobotsApi stop requested');

        setTimeout(() => {
            this.#send('stop', targets);
            console.log(Date.now(), 'RobotsApi stop sent');
        }, delay);
    }

    #send = (signal, targets, baskets) => {
        log('send', signal, targets, baskets);
        const message = JSON.stringify({signal, targets, baskets});

        for (const client of this.#wss.clients) {
            client.send(message);
        }
    };

    #sendJSON = (info, socket) => {
        socket.send(JSON.stringify(info));
    };

    #handleMessage = (message, socket) => {
        try {
            let info = JSON.parse(message);

            if (info.id === undefined || info.id === null) {
                this.#sendJSON({error: {code: -32600, message: 'Invalid id'}, id: null}, socket);
                return;
            }

            const result = this.#methodHandler(info.method, info.params);
            this.#sendJSON({result: result, 'id': info.id}, socket);
        } catch (e) {
            console.error(e);
        }
    }
}