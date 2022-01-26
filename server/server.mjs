import http from 'http';
import path from 'path';
import express from 'express';
import {log} from './util.mjs';
const app = express();
const server = http.createServer(app);
import webApiRouter from './web-api-router.mjs';
import manualCommandRouter from './manual-command-router.mjs';
import {competitionManager, initCompetitionManager} from "./data.mjs";
import {CompetitionManagerEventName} from "./competition-manager.mjs";
import {GitResultsUpdater} from "./git-results-updater.mjs";

app.use('/api', webApiRouter);
app.use('/manual-command', manualCommandRouter);

app.use(express.static('../web'));

const uiPort = 8110;
const robotsPort = 8111;
const basketsPort = 8112;
const refereePort = 8114;

const competitionRootDirectory = process.argv[2];
const gitRemote = process.argv[3];
const competitionResultsDirectory = path.join(competitionRootDirectory, 'competition-state');

const gitResultsUpdater = new GitResultsUpdater(competitionRootDirectory, gitRemote);

initCompetitionManager(competitionResultsDirectory, server, robotsPort, basketsPort, refereePort);

competitionManager.on(CompetitionManagerEventName.competitionCreated, async () => {
    await gitResultsUpdater.init();
});

competitionManager.on(CompetitionManagerEventName.competitionSummarySaved, async () => {
    if (gitResultsUpdater.isInitialized()) {
        gitResultsUpdater.update();
    }
});

server.listen(uiPort, function listening() {
    log('Listening on', server.address().port);
    log('http://localhost:' + server.address().port);
});