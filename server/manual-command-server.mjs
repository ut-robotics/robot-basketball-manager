import http from 'http';
import express from 'express';

import {log} from './util.mjs';
import RobotsApi from './robots-api.mjs';

const robotsApi = new RobotsApi(8222, (method, params) => {
    if (method === 'get_active_game_state') {
        return {
            is_running: true,
            targets: ['robot1', 'robot2'],
            baskets: ['blue', 'magenta'],
        }
    }
});

const app = express();
const server = http.createServer(app);

app.use(express.static('../web-manual-command-server'));

app.get('/start/:targets/:baskets', (req, res) => {
    log(req.params);

    const targets = req.params.targets.split(',');
    const baskets = req.params.baskets.split(',');

    robotsApi.start(targets, baskets);

    res.sendStatus(200);
});

app.get('/stop/:targets', (req, res) => {
    log(req.params);

    const targets = req.params.targets.split(',');

    robotsApi.stop(targets);

    res.sendStatus(200);
});

server.listen(8220, function listening() {
    log('Listening on', server.address().port);
    log('http://localhost:' + server.address().port);
});