import fs from 'fs/promises'

const pad = (number) => number.toString().padStart(2, '0');

// Example arguments:
// ..\..\robot-basketball-test-competition-2021-12-02\competition-summary.json 1638468721000
const competitionSummaryFilePath = process.argv[2];
const startUnixTimestamp_ms = process.argv[3];

const competitionSummary = JSON.parse(await fs.readFile(competitionSummaryFilePath, 'utf8'));

const swissGames = competitionSummary?.swissSystemTournament?.games ?? [];
const doubleEliminationGames = competitionSummary?.doubleEliminationTournament?.games ?? [];

const swissChapters = gamesToChapters(swissGames, startUnixTimestamp_ms, 'SS-');
const doubleEliminationChapters = gamesToChapters(doubleEliminationGames, startUnixTimestamp_ms, 'DE-');

console.log(`${msToVideoTime(0)} Start of competition`);
printChapters(swissChapters);
printChapters(doubleEliminationChapters);


function gamesToChapters(games, startTimestamp, prefix) {
    const chapters = [];

    for (const [gameIndex, game] of games.entries()) {
        if (!game.hasEnded) {
            continue;
        }

        const robot1 = game.robots[0].name;
        const robot2 = game.robots[1].name;

        for (const [gameRoundIndex, gameRound] of game.rounds.entries()) {
            const timeString = msToVideoTime(gameRound.runs[0].startTime - startTimestamp);

            chapters.push(`${timeString} ${prefix}G${pad(gameIndex + 1)}-R${gameRoundIndex + 1} ${robot1} - ${robot2}`)
        }
    }

    return chapters;
}

function printChapters(chapters) {
    for (const chapter of chapters) {
        console.log(chapter);
    }
}

function msToVideoTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}