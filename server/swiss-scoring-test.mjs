import {loadCompetition} from "./util.mjs";
import jsonStringifyCompact from "json-stringify-pretty-compact";

const competitionStateDirectoryPath = process.argv[2];

const competition = await loadCompetition(competitionStateDirectoryPath);
const summary = competition.getInfo();

console.log(jsonStringifyCompact(summary.swissSystemTournament.robotScores, {maxLength: 200}));