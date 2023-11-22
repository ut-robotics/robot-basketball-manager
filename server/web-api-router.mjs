import express from "express";
import {readJSONFile, log, logError, generateBallPlacement} from "./util.mjs";
import {competitionManager} from "./data.mjs";

const router = express.Router();

router.use(express.json());

router.get('/competition', async (req, res) => {
    if (competitionManager.competition) {
        res.send(competitionManager.competition.getInfo());
        return;
    }

    res.sendStatus(404);
});

router.post('/competition', async (req, res) => {
    log(req.body);

    try {
        const {id, name} = req.body;

        await competitionManager.createCompetition(id, name);
    } catch (error) {
        logError(error);

        res.sendStatus(400);

        return;
    }

    res.sendStatus(200);
});

router.post('/robot', async (req, res) => {
    log(req.body);

    try {
        const {id, name} = req.body;

        competitionManager.competition.addRobot(id, name);

        await competitionManager.saveCompetition();
    } catch (error) {
        logError(error);

        res.sendStatus(400);

        return;
    }

    res.sendStatus(200);
});

router.post('/tournament', async (req, res) => {
    log(req.body);

    try {
        const {swissEnabled, numberOfSwissRounds, doubleEliminationEnabled} = req.body;

        competitionManager.competition.startTournament(swissEnabled, numberOfSwissRounds, doubleEliminationEnabled);

        await competitionManager.saveCompetition();
    } catch (error) {
        logError(error);

        res.sendStatus(400);

        return;
    }

    res.sendStatus(200);
});

router.get('/game/:id', async (req, res) => {
    try {
        const {id} = req.params

        const game = competitionManager.competition.getGame(id);

        res.send(game.getInfo());
    } catch (error) {
        logError(error);

        res.sendStatus(400);
    }
});

router.get('/random-balls', async (req, res) => {
    res.send(generateBallPlacement());
});

/*
async function getCompetitions() {
    try {
        const dirEntities = await fs.readdir(competitionsDirectory, {withFileTypes: true});

        const competitionsInfo = [];

        for (const dirEntity of dirEntities) {
            if (dirEntity.isDirectory()) {
                const info = await readJSONFile(
                    path.join(competitionsDirectory, dirEntity.name, competitionInfoFileName)
                );

                if (info) {
                    competitionsInfo.push(info);
                }
            }
        }

        return competitionsInfo;
    } catch (error) {
        logError(error);
    }

    return [];
}
*/
export default router;
