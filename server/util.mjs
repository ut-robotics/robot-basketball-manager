import {promises as fs} from 'fs';
import path from "path";
import {competitionInfoFileName} from "./constants.mjs";
import Game from "./game.mjs";
import Competition from "./competition.mjs";
import jsonStringifyCompact from "json-stringify-pretty-compact";

class FileWriteManager {
    #queue = [];
    #isProcessing = false;

    async queueWrite(filePath, content) {
        return new Promise((resolve, reject) => {
            this.#queue.push({filePath, content, resolve, reject});

            this.#processQueue();
        });
    }

    #processQueue() {
        if (this.#isProcessing || this.#queue.length === 0) {
            return;
        }

        this.#isProcessing = true;

        const {filePath, content, resolve, reject} = this.#queue.shift();

        this.#write(filePath, content)
            .then(() => {
                resolve();
                this.#isProcessing = false;
                this.#processQueue();
            })
            .catch(error => {
                reject(error);
                this.#isProcessing = false;
                this.#processQueue();
            });
    }

    async #write(filePath, content) {
        return fs.writeFile(filePath, content, 'utf8');
    }
}

const fileWriteManager = new FileWriteManager();

function time() {
    const date = new Date();

    return `${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}.${('00' + date.getMilliseconds()).slice(-3)}`;
}

export function log(...parts) {
    console.log.apply(console, [time(), ...parts]);
}

export function logError(...parts) {
    console.error.apply(console, [time(), ...parts]);
}

export function selectRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function shuffledArray(array) {
    const newArray = array.slice();
    shuffleArray(newArray);
    return newArray;
}

export function chooseNextBasketColor(prevBaskets) {
    if (prevBaskets.length === 0) {
        return null;
    }

    const counts = {
        blue: 0,
        magenta: 0
    };

    for (const color of prevBaskets) {
        counts[color] += 1;
    }

    if (counts.blue === counts.magenta) {
        // Opposite to previous
        return prevBaskets[prevBaskets.length - 1] === 'blue' ? 'magenta' : 'blue';
    }

    // Less common
    return counts.blue > counts.magenta ? 'magenta' : 'blue';
}

export function decideBaskets(preferredBaskets) {
    if (!preferredBaskets[0] && !preferredBaskets[1] || preferredBaskets[0] === preferredBaskets[1]) {
        // no preference or same preference
        return shuffledArray(['blue', 'magenta']);
    }

    if (!preferredBaskets[0] && preferredBaskets[1]) {
        return [preferredBaskets[1] === 'blue' ? 'magenta' : 'blue', preferredBaskets[1]];
    }

    if (preferredBaskets[0] && !preferredBaskets[1]) {
        return [preferredBaskets[0], preferredBaskets[0] === 'blue' ? 'magenta' : 'blue'];
    }

    return preferredBaskets;
}

export function decideBasketsForRobots(robots, robotStartingBaskets) {
    return decideBaskets([
        chooseNextBasketColor(robotStartingBaskets[robots[0].id]),
        chooseNextBasketColor(robotStartingBaskets[robots[1].id]),
    ]);
}

export async function readJSONFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');

        return JSON.parse(content);
    } catch (error) {
        console.error(error);
    }

    return null;
}

export async function writeJSONFile(filePath, object) {
    const content = jsonStringifyCompact(object, null, 2);
    //return fs.writeFile(filePath, content, 'utf8');
    return fileWriteManager.queueWrite(filePath, content);
}

export async function loadCompetition(directory) {
    log('Load competition', directory);

    const state = await readJSONFile(path.join(directory, competitionInfoFileName));

    if (!state) {
        throw new Error('No saved state');
    }

    log('Competition state loaded');

    if (state.swissSystemTournament) {
        state.swissSystemTournament.games = [];

        for (const gameID of state.swissSystemTournament.gameIDs) {
            const game = Game.fromState(await loadGame(gameID, directory));
            state.swissSystemTournament.games.push(game);
        }
    }

    if (state.doubleEliminationTournament) {
        state.doubleEliminationTournament.games = [];

        for (const gameID of state.doubleEliminationTournament.gameIDs) {
            const game = Game.fromState(await loadGame(gameID, directory));
            state.doubleEliminationTournament.games.push(game);
        }
    }

    return Competition.fromState(state);
}

export async function saveCompetition(competition, directory) {
    log(`Saving competition`);

    const competitionInfo = competition.getState();

    await fs.mkdir(directory, {recursive: true});

    for (const game of competition.getGames()) {
        await saveGame(game, directory);
    }

    return writeJSONFile(path.join(directory, competitionInfoFileName), competitionInfo);
}

export async function saveGame(game, directory) {
    log(`Saving game (id = ${game.id})`);

    const gameState = game.getState();
    await writeJSONFile(path.join(directory, `game-${gameState.id}.json`), gameState);
}

export async function loadGame(id, directory) {
    log(`Loading game (id = ${id})`);

    const filePath = path.join(directory, `game-${id}.json`)

    return await readJSONFile(filePath);
}

export function cloneObject(object) {
    return JSON.parse(JSON.stringify(object));
}

export function generateCoordinate(ranges) {
    return ranges.map(range => Math.random() * (range[1] - range[0]) + range[0]);
}

export function distanceBetweenPoints(point1, point2) {
    return Math.sqrt(Math.pow(point1[0] - point2[0], 2) + Math.pow(point1[1] - point2[1], 2));
}

export function roundToTwoDecimalPlaces(number) {
    return Math.round((number + Number.EPSILON) * 100) / 100;
}

export function generateBallPlacement() {
    const ballClearance = 0.4;
    const basketClearance = 0.4;
    const robotClearance = 0.4;

    const xRange = [-2.2, 2.2];
    const yRange = [-1.45, 1.45];

    const objects = [
        {x: -2.22, y: 0, type: 'basket', clearance: basketClearance},
        {x: 2.22, y: 0, type: 'basket', clearance: basketClearance},
        {x: -2.1, y: -1.35, type: 'robot', clearance: robotClearance},
        {x: 2.1, y: 1.35, type: 'robot', clearance: robotClearance},
        {x: 0, y: 0, type: 'ball', clearance: ballClearance},
    ];

    let generatedCoordinateCount = 5;

    while (generatedCoordinateCount > 0) {
        const coords = generateCoordinate([xRange, yRange]);
        const mirroredCoords = [-coords[0], -coords[1]];

        if (objects.some(o => distanceBetweenPoints([o.x, o.y], coords) < Math.min(o.clearance, ballClearance))) {
            console.log(coords, 'too close to current objects');
            continue;
        }

        if (objects.some(o => distanceBetweenPoints([o.x, o.y], mirroredCoords) < Math.min(o.clearance, ballClearance))) {
            console.log(coords, 'too close to current objects');
            continue;
        }

        objects.push({x: coords[0], y: coords[1], type: 'ball', clearance: ballClearance});
        objects.push({x: mirroredCoords[0], y: mirroredCoords[1], type: 'ball', clearance: ballClearance});

        generatedCoordinateCount--;
    }

    return objects
        .filter(o => o.type === 'ball')
        .map(o => [roundToTwoDecimalPlaces(o.x), roundToTwoDecimalPlaces(o.y)]);
}