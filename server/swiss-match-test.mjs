function consecutiveSum(num) {
    return (num * (num + 1)) / 2;
}

const robotCount = 6;
const indexSum = consecutiveSum(robotCount - 1);

console.log(indexSum);

const sets = [];

const combinationCount = Math.pow(robotCount, robotCount - 1);


const pairs = [];
const groups = [];

for (let i = 0; i < robotCount - 1; i++) {
    for (let j = i + 1; j < robotCount; j++) {
        const pair = [i, j];
        pairs.push(pair);
        //console.log(i, j, j - i);

        if (i === 0) {
            groups.push([pair]);
        } else {
            groups[j - i - 1].push(pair);
        }
    }
}

console.log('pair count', pairs.length);

/*for (let groupIndexLimit = 0; groupIndexLimit < groups.length; groupIndexLimit++) {

}*/

pairs.sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]));

for (let i = 0; i < pairs.length; i++) {

}

/*for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]
    const diffWithinPair = pair[1] - pair[0];

    if (!groups[diffWithinPair]) {
        groups[diffWithinPair] = [pair];
    } else {
        groups[diffWithinPair].push(pair);
    }
}*/

//console.log(pairs);
//console.log(groups);

for (const group of groups) {
    console.log(group);
}


for (let combinationIndex = 0; combinationIndex < combinationCount; combinationIndex++) {
    //console.log(combinationIndex.toString(robotCount).padStart(robotCount, '0'));

    const list = combinationIndex
        .toString(robotCount)
        .padStart(robotCount, '0')
        .split('')
        .map(v => parseInt(v, 10));

    let isBadList = false;

    // Numbers within pair must be in ascending order
    for (let i = 0; i < list.length; i += 2) {
        if (list[i] >= list [i + 1]) {
            isBadList = true;
            break;
        }
    }

    if (isBadList) {
        continue;
    }

    // Pairs must be in ascending order
    for (let i = 2; i < list.length; i += 2) {
        if (list[i] >= list [i + 2]) {
            isBadList = true;
            break;
        }
    }

    if (isBadList) {
        continue;
    }

    const set = new Set(list);

    if (set.size !== robotCount) {
        continue;
    }

    //console.log(set);

    sets.push(set);
}

//console.log(sets);
console.log(sets.length);



for (const set of sets) {
    //if (set.size === robotCount) {
        console.log(set);
    //}
}
