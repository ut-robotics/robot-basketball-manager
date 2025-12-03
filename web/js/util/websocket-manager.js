import BackOffDelay from "./backoff-delay.js";

export default class WebsocketManager {
    constructor(onMessage) {
        this.onMessage = onMessage;
        this.socketReconnectDelay = new BackOffDelay();
        this.socket = this.createWebsocket(this.onMessage, this.onSocketOpened, this.onSocketClosed);
    }

    onSocketOpened() {
        this.socketReconnectDelay.reset();
    }

    onSocketClosed() {
        setTimeout(() => {
            this.socket = this.createWebsocket(this.onMessage, this.onSocketOpened, this.onSocketClosed);
        }, this.socketReconnectDelay.get());
    }

    createWebsocket() {
        const socket = new WebSocket('ws://' + location.host);

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