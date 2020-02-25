const WebSocket = require('ws');

class RobotsApi {
    #port;
    #methodHandler;
    #wss;

    constructor(port, methodHandler) {
        this.#port = port;
        this.#methodHandler = methodHandler;
        this.#wss = new WebSocket.Server({port}, () => {
            console.log('Opened robots websocket');
        });

        this.#wss.on('connection', (ws) => {
            ws.on('message', (message) => {
                console.log('received', message);

                this.#handleMessage(message, ws);
            });
        });
    }

    start(targets, baskets) {
        this.#send('start', targets, baskets);
    }

    stop(targets) {
        this.#send('stop', targets);
    }

    #send = (signal, targets, baskets) => {
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

module.exports = RobotsApi;