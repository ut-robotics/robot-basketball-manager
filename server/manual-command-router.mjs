import {log} from "./util.mjs";
import express from "express";
import {competitionManager} from "./data.mjs";

const router = express.Router();

router.get('/start/:targets/:baskets', (req, res) => {
    log(req.params);

    const targets = req.params.targets.split(',');
    const baskets = req.params.baskets.split(',');

    competitionManager.manualStart(targets, baskets);

    res.sendStatus(200);
});

router.get('/stop/:targets', (req, res) => {
    log(req.params);

    const targets = req.params.targets.split(',');

    competitionManager.manualStop(targets);

    res.sendStatus(200);
});

export default router;