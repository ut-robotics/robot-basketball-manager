import {opt as maximumCardinalityMatching} from './maximum-matching/src/cardinality/index.js';

console.time('matching');

const scoreBoard = [
    [0, 0, 1],
    [1, 0, 2],
    [2, 0, 3],
    [3, 0, 4],
    [4, 0, 5],
    [5, 0, 6],
    [6, 0, 7],
    [7, 0, 8],
    [8, 0, 9],
    [9, 0, 10],
    [10, 0, 11],
    [11, 0, 12],
    [12, 0, 13],
    [13, 0, 14],
    [14, 0, 15],
    [15, 0, 16],
    [16, 0, 17],
    [17, 0, 18],
    [18, 0, 19],
    [19, 0, 20],
];

const roundCount = scoreBoard.length - 1;

const playedGames = [];

function updateScoreBoardOrder(scoreBoard) {
    scoreBoard.sort((a, b) => b[1] - a[1]);

    // Update ranks
    for (let i = 0; i < scoreBoard.length; i++) {
        scoreBoard[i][2] = i + 1;
    }
}

function increaseScore(robotId, gameScore) {
    for (let i = 0; i < scoreBoard.length; i++) {
        if (scoreBoard[i][0] === robotId) {
            scoreBoard[i][1] += gameScore;
            break;
        }
    }
}

function isMatchPlayed(firstId, secondId) {
    for (const playedGame of playedGames) {
        if (
            playedGame[0] === firstId && playedGame[1] === secondId ||
            playedGame[0] === secondId && playedGame[1] === firstId
        ) {
            return true;
        }
    }

    return false;
}

function getRank(robotId) {
    for (const robotInfo of scoreBoard) {
        if (robotInfo[0] === robotId) {
            return robotInfo[2];
        }
    }
}

function getMaxScoreDifference(scoreBoard) {
    let minScore = Infinity;
    let maxScore = -Infinity;

    for (const robotInfo of scoreBoard) {
         const score = robotInfo[1];

         if (score > maxScore) {
             maxScore = score;
         }

        if (score < minScore) {
            minScore = score;
        }
    }

    return maxScore - minScore;
}

function createEdgesOfPotentialMatches(scoreBoard) {
    const edgesOfPotentialMatches = [];

    /*const simpleMatches = [];
    const isMatchedMap = {};

    for (let firstIndex = 0; firstIndex < scoreBoard.length; firstIndex++) {
        const [firstId, firstScore, firstRank] = scoreBoard[firstIndex];

        if (isMatchedMap[firstId]) {
            continue;
        }

        for (let secondIndex = firstIndex + 1; secondIndex < scoreBoard.length; secondIndex++) {
            const [secondId, secondScore, secondRank] = scoreBoard[secondIndex];

            if (isMatchPlayed(firstId, secondId)) {
                continue;
            }

            simpleMatches.push([firstId, secondId]);
            isMatchedMap[firstId] = true;
            isMatchedMap[secondId] = true;

            break;
        }
    }

    console.log('simpleMatches');
    console.log(simpleMatches);

    function isSimpleMatch(id1, id2) {
        for (const match of simpleMatches) {
            if (match[0] === id1 && match[1] === id2 || match[0] === id2 && match[1] === id1) {
                return true;
            }
        }

        return false;
    }*/

    // const maxScoreDifference = getMaxScoreDifference(scoreBoard);
    const maxRankDifference = scoreBoard.length;
    //const weightDivider = 1.5;
    const weightDivider = 2;

    for (let firstIndex = 0; firstIndex < scoreBoard.length; firstIndex++) {
        const [firstId, firstScore, firstRank] = scoreBoard[firstIndex];

        //let currentWeight = Math.pow(weightDivider, scoreBoard.length);
        let currentWeight = Math.pow(2, scoreBoard.length - firstRank);

        for (let secondIndex = firstIndex + 1; secondIndex < scoreBoard.length; secondIndex++) {

            const [secondId, secondScore, secondRank] = scoreBoard[secondIndex];
            //const scoreDifference = Math.abs(firstScore - secondScore);
            const rankDifference = Math.abs(secondRank - firstRank);

            //const simpleMatchWeight = isSimpleMatch(firstId, secondId) ? scoreBoard.length * 10 : 1;

            if (isMatchPlayed(firstId, secondId)) {
                continue;
            }

            // const edgeWeight = Math.max(firstIndex, secondScore) * (maxScoreDifference - scoreDifference);
            // const edgeWeight = Math.max(firstIndex, secondScore) * (maxRankDifference - rankDifference);
            // const edgeWeight = Math.pow(scoreBoard.length + 1 - Math.min(firstRank, secondRank), 2) * (maxRankDifference - rankDifference);

            //const edgeWeight = currentWeight - firstRank);
            //const edgeWeight = Math.round(currentWeight) - Math.pow(firstRank, 2);
            const edgeWeight = Math.pow(2, scoreBoard.length - firstRank)
                + Math.round(currentWeight);

            //const edgeWeight = simpleMatchWeight + (scoreBoard.length - firstRank) - rankDifference;

            edgesOfPotentialMatches.push([firstId, secondId, edgeWeight]);

            currentWeight /= weightDivider;
        }
    }

    /*let currentEdgeWeight = edgesOfPotentialMatches.length;
    let isFirst = true;

    for (const edge of edgesOfPotentialMatches) {
        edge[2] = currentEdgeWeight + (isFirst ? 19 : 0);
        isFirst = false;
    }*/

    console.log('edgesOfPotentialMatches');
    console.log(edgesOfPotentialMatches);

    return edgesOfPotentialMatches;
}

function matchingToMatches(matching) {
    const matches = [];

    let i = 0;

    for (const j of matching) {
        // This takes care of j === -1
        if (i < j) {
            matches.push([i, j]);
        }

        ++i;
    }

    return matches;
}

function createMatches(scoreBoard) {
    const edgesOfPotentialMatches = createEdgesOfPotentialMatches(scoreBoard);

    const matching = maximumCardinalityMatching(edgesOfPotentialMatches);
    const matches = matchingToMatches(matching);

    return matches;
}

for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    console.log('--- ROUND', roundIndex + 1);
/*
    const matches = [];

    const scoreBoardCopy = scoreBoard.slice();
    const [firstId] = scoreBoardCopy[0];

    let secondIndex = 1;

    // Always match the highest rank with next available rank
    for (; secondIndex < scoreBoardCopy.length; secondIndex++) {
        const [secondId] = scoreBoardCopy[secondIndex];

        if (isPlayed(firstId, secondId)) {
            continue;
        }

        matches.push([firstId, secondId]);
        break;
    }

    scoreBoardCopy.splice(secondIndex, 1); // Remove robot matched with the highest ranked robot
    scoreBoardCopy.splice(0, 1); // Remove the highest ranked robot

    const edgesOfPotentialMatches = createEdgesOfPotentialMatches(scoreBoardCopy);
*/
    //const edgesOfPotentialMatches = createEdgesOfPotentialMatches(scoreBoard);

    const matches = createMatches(scoreBoard);

    if (matches.length !== (Math.floor(scoreBoard.length / 2))) {
        console.log('All robots not matched');
        break;
    }

    // Sort by highest ranked robot last
    matches.sort((a, b) => Math.min(getRank(b[0]), getRank(b[1])) - Math.min(getRank(a[0]), getRank(a[1])));

    for (const match of matches) {
        console.log('match', match);
        playedGames.push(match.slice());

        const winnerIndex = Math.round(Math.random());
        const winnerScore = Math.round(Math.random() * 10);
        increaseScore(match[winnerIndex], winnerScore);
        increaseScore(match[1 - winnerIndex], 10 - winnerScore);
    }

    updateScoreBoardOrder(scoreBoard);

    console.log('scoreBoard');

    for (const robotInfo of scoreBoard) {
        console.log(`${robotInfo[2]}. ${robotInfo[0]} ${robotInfo[1]}`)
    }
}

// [-1, 4, 3, 2, 1, 14, 8, 9, 6, 7, -1, 13, -1, 11, 5]
// Islands of 1 4 12 13 11 7 9 and 2 6 8 10 5 14 3
/*
const debugEdges = [
    [ 13, 11, 291 ], [ 13, 12, 194 ],
    [ 8, 6, 288 ],   [ 8, 10, 191 ],
    [ 3, 2, 283 ],   [ 3, 14, 186 ],
    [ 7, 11, 276 ],  [ 7, 9, 179 ],
    [ 5, 14, 267 ],  [ 5, 10, 170 ],
    [ 4, 1, 256 ],   [ 4, 12, 159 ],
    [ 6, 2, 243 ],   [ 1, 9, 211 ]
];

const matching = maximumCardinalityMatching(debugEdges);
const matches = matchingToMatches(matching);

console.log('debug matching', matching);

for (const edge of matches) {
    console.log('debug match', edge);
}
*/
console.timeEnd('matching');

