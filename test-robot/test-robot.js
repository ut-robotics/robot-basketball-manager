const WebsocketManager = require('./websocket-manager');
const wsManager = new WebsocketManager('localhost:8111');
const robotID = '001trt';

wsManager.on('open', () => {
    wsManager.send({method: 'get_active_game_state', id: 1});
});

wsManager.on('message', onMessage);

function onMessage(message) {
    console.log(message);

    try {
        const info = JSON.parse(message);
        const {signal, targets} = info;

        if (Array.isArray(targets) && targets.includes(robotID)) {
            if (signal === 'stop') {
                console.log('STOP');
            } else if (signal === 'start') {
                console.log('START');
            }
        }
    } catch (e) {
        console.error(e);
    }
}