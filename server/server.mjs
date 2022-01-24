import http from 'http';
import express from 'express';
import {log} from './util.mjs';
const app = express();
const server = http.createServer(app);
import webApiRouter from './web-api-router.mjs';
import manualCommandRouter from './manual-command-router.mjs';
import {initCompetitionManager} from "./data.mjs";

app.use('/api', webApiRouter);
app.use('/manual-command', manualCommandRouter);

app.use(express.static('../web'));

const uiPort = 8110;
const robotsPort = 8111;
const basketsPort = 8112;
const refereePort = 8114;

initCompetitionManager(competitionResultsDirectory, server, robotsPort, basketsPort, refereePort);

server.listen(uiPort, function listening() {
    log('Listening on', server.address().port);
    log('http://localhost:' + server.address().port);
});