const WebsocketManager = require('./websocket-manager');
const wsManager = new WebsocketManager('localhost:8112');
const {Buffer} = require('node:buffer');

wsManager.on('open', () => {
    let color = 0;
    const data = Buffer.alloc(3);

    setInterval(() => {
        data.writeUint8(color, 0);
        data.writeUint16LE(3500 + Math.round(Math.random() * 700), 1);

        wsManager.sendRaw(data);

        color = color ^ 1;
    }, 2000);
});