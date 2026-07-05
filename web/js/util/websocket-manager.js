import BackOffDelay from "./backoff-delay.js";

export default class WebsocketManager {
    constructor(onMessage, onOpened, port) {
        this.onMessage = onMessage;
        this.onOpened = onOpened;
        this.socketReconnectDelay = new BackOffDelay();
        this.port = port;
        this.socket = this.createWebsocket();
    }

    onSocketOpened() {
        this.socketReconnectDelay.reset();
        this.onOpened?.();
    }

    onSocketClosed() {
        setTimeout(() => {
            this.socket = this.createWebsocket();
        }, this.socketReconnectDelay.get());
    }

    createWebsocket() {
        const url = !!this.port
            ? 'ws://' + location.hostname + ':' + this.port
            : 'ws://' + location.host
        const socket = new WebSocket(url);

        socket.addEventListener('message', (event) => {
            this.onMessage(event.data);
        });

        socket.addEventListener('close', (event) => {
            console.log('socket closed', event.code, event.reason);
            this.onSocketClosed();
        });

        socket.addEventListener('error', () => {
            console.log('socket error');
        });

        socket.addEventListener('open', () => {
            console.log('socket opened');
            this.onSocketOpened();
        });

        return socket;
    }

    send(info) {
        this.socket.send(JSON.stringify(info));
    }
}