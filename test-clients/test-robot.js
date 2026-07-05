const {argv} = require('node:process');
const WebsocketManager = require('./websocket-manager');
let robotID = 'robot1';

if (argv[2]) {
    robotID = argv[2];
}

console.log('robotID', robotID);

const wsManager = new WebsocketManager(robotID + ':@localhost:8111');

wsManager.on('open', () => {
    wsManager.send({method: 'get_active_game_state', id: 1});
});

wsManager.on('message', onMessage);

function onMessage(data, isBinary) {
    const message = isBinary ? data : data.toString();

    console.log('received', message)

    try {
        const info = JSON.parse(message);
        const {signal, targets} = info;

        if (Array.isArray(targets) && (targets.includes(robotID) || targets.includes('*'))) {
            if (signal === 'stop') {
                console.log('STOP');
            } else if (signal === 'start') {
                console.log('START');
            }

            wsManager.send({type: 'ack', data: info});
        }
    } catch (e) {
        console.error(e);
    }
}