import {selectRandom, shuffleArray} from "./util.mjs";
import Competition from "./competition.mjs";
import {GameResult} from "./constants.mjs";

const robotsInfo = [
    {id: 'a', name: 'A', accuracy: 0.9, accuracyStdDev: 0.1, speed: 5, speedStdDev: 1},
    {id: 'b', name: 'B', accuracy: 0.8, accuracyStdDev: 0.1, speed: 5, speedStdDev: 1},
    {id: 'c', name: 'C', accuracy: 0.7, accuracyStdDev: 0.2, speed: 6, speedStdDev: 2},
    {id: 'd', name: 'D', accuracy: 0.6, accuracyStdDev: 0.2, speed: 7, speedStdDev: 2},
    {id: 'e', name: 'E', accuracy: 0.5, accuracyStdDev: 0.2, speed: 8, speedStdDev: 2},
    {id: 'f', name: 'F', accuracy: 0.4, accuracyStdDev: 0.2, speed: 9, speedStdDev: 2},
    {id: 'g', name: 'G', accuracy: 0.4, accuracyStdDev: 0.3, speed: 10, speedStdDev: 2},
    {id: 'h', name: 'H', accuracy: 0.4, accuracyStdDev: 0.3, speed: 11, speedStdDev: 3},
    {id: 'i', name: 'I', accuracy: 0.3, accuracyStdDev: 0.3, speed: 12, speedStdDev: 4},
    {id: 'j', name: 'J', accuracy: 0.3, accuracyStdDev: 0.2, speed: 13, speedStdDev: 5},
    {id: 'k', name: 'K', accuracy: 0.3, accuracyStdDev: 0.4, speed: 14, speedStdDev: 6},
    {id: 'l', name: 'L', accuracy: 0.2, accuracyStdDev: 0.3, speed: 15, speedStdDev: 7},
    {id: 'm', name: 'M', accuracy: 0.2, accuracyStdDev: 0.2, speed: 16, speedStdDev: 8},
    {id: 'n', name: 'N', accuracy: 0.1, accuracyStdDev: 0.2, speed: 17, speedStdDev: 9},
    {id: 'o', name: 'O', accuracy: 0.1, accuracyStdDev: 0.1, speed: 18, speedStdDev: 10},
];

shuffleArray(robotsInfo);

const competition = new Competition('test', 'Test');

for (const robotInfo of robotsInfo) {
    competition.addRobot(robotInfo.id, robotInfo.name);
}

const numberOfSwissRounds = robotsInfo.length - 1;

competition.startTournament(true, numberOfSwissRounds, false);

for (let swissRoundIndex = 0; swissRoundIndex < numberOfSwissRounds; swissRoundIndex++) {
    console.log('SWISS ROUND', swissRoundIndex + 1);

    const games = competition.getGames();
    const unfinishedGames = games.filter(g => !g.hasEnded);

    playGames(unfinishedGames);
    //logGames(unfinishedGames);
    logRobotScores(competition);

    competition.proceed();
}

process.exit(0);

/**
 *
 * @param {Game[]} games
 */
function logGames(games) {
    for (const game of games) {
        //const comparisonSymbol = game.isTied ? '=' : (game.winner.id === game.robots[0].id ? '>' : '<');
        //console.log(game.robots[0].id, comparisonSymbol, game.robots[1].id, game.rounds);
        console.log(game.getStatus());
    }
}

function logRobotScores(competition) {
    const competitionInfo = competition.getInfo();

    //console.log(competitionInfo.swissSystemTournament.robotScores);

    for (const robotScore of competitionInfo.swissSystemTournament.robotScores) {
        const {robot, score, tieBreakScore} = robotScore;
        console.log(robot.id, 'score', score.toFixed(1), 'tieBreakScore', tieBreakScore.toFixed(1));
    }
}

/**
 *
 * @param {Game[]} games
 */
function playGames(games) {
    for (const game of games) {
        playGame(game);
    }
}

/**
 *
 * @param {Game} game
 */
function playGame(game) {
    const robots = game.robots;
    const gameRobotsInfo = robots.map(r => robotsInfo.find(ri => r.id === ri.id));

    for (let i = 0; i < 3; i++) {
        game.start();
        playRound(game, gameRobotsInfo, 60, 11);
        game.endRound();
        game.confirm();

        if (i > 0) {
            const status = game.getStatus();

            if (status.result !== GameResult.unknown) {
                break;
            }
        }
    }
}

/**
 *
 * @param {Game} game
 * @param gameRobotsInfo
 * @param {number} duration
 * @param {number} numberOfBalls
 */
function playRound(game, gameRobotsInfo, duration, numberOfBalls) {
    let ballsLeft = numberOfBalls;
    const baskets = game.getBasketsForRobots(gameRobotsInfo.map(r => r.id));

    const nextThrowTimes = gameRobotsInfo.map(r => randomGaussianMinMax(r.speed, r.speedStdDev, 0, duration));
    let time = arrayMin(nextThrowTimes);

    while (time < duration && ballsLeft > 0) {
        const [minTime, minIndex] = arrayMinValueAndIndex(nextThrowTimes);
        const robot = gameRobotsInfo[minIndex];
        const throwAccuracy = randomGaussianMinMax(robot.accuracy, robot.accuracyStdDev, 0, 1);
        const didScore = throwAccuracy > Math.random();

        if (didScore) {
            game.incrementScore(baskets[minIndex]);
        }

        ballsLeft -= 1;
        time = minTime;

        //console.log(time, scores, robot.id, nextThrowTimes, ballsLeft);

        nextThrowTimes[minIndex] += randomGaussianMinMax(robot.speed, robot.speedStdDev, 0, duration);
    }
}

function randomGaussianMinMax(mean, sd, min, max) {
    return Math.min(Math.max(randomGaussian(mean, sd), min), max);
}

function randomGaussian(mean, sd = 1) {
    let y1, x1, x2, w;

    do {
        x1 = random(2) - 1;
        x2 = random(2) - 1;
        w = x1 * x1 + x2 * x2;
    } while (w >= 1);

    w = Math.sqrt(-2 * Math.log(w) / w);
    y1 = x1 * w;

    const m = mean || 0;

    return y1 * sd + m;
}

function random(min, max) {
    const rand = Math.random();

    if (typeof min === 'undefined') {
        return rand;
    } else if (typeof max === 'undefined') {
        if (min instanceof Array) {
            return min[Math.floor(rand * min.length)];
        } else {
            return rand * min;
        }
    } else {
        if (min > max) {
            const tmp = min;
            min = max;
            max = tmp;
        }

        return rand * (max - min) + min;
    }
}

function arrayMin(arr) {
    let length = arr.length
    let min = Infinity;

    while (length--) {
        if (arr[length] < min) {
            min = arr[length];
        }
    }

    return min;
}

function arrayMinValueAndIndex(arr) {
    let length = arr.length
    let min = Infinity;
    let index = 0;

    while (length--) {
        if (arr[length] < min) {
            min = arr[length];
            index = length;
        }
    }

    return [min, index];
}