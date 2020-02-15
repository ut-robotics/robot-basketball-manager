const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8111');

ws.on('open', function open() {
    ws.send(JSON.stringify({event: 'get_active_game_state', id: 1}));
});

ws.on('message', function incoming(data) {
    console.log(data);
});