import CompetitionManager from "./competition-manager.mjs";

export let competitionManager;

export function initCompetitionManager(competitionDirectory, server, manualCommandPort, robotsPort, basketsPort, refereePort) {
    if (!competitionManager) {
        competitionManager = new CompetitionManager(competitionDirectory, server, manualCommandPort, robotsPort, basketsPort, refereePort);
    }
}