import CompetitionManager from "./competition-manager.mjs";

export let competitionManager;

export function initCompetitionManager(competitionDirectory, server, robotsPort, basketsPort, refereePort) {
    if (!competitionManager) {
        competitionManager = new CompetitionManager(competitionDirectory, server, robotsPort, basketsPort, refereePort);
    }
}