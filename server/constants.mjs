export const Basket = {
    blue: 'blue',
    magenta: 'magenta',
};

export const GameResult = {
    unknown: 'unknown',
    tied: 'tied',
    won: 'won',
};

export const FreeThrowsResult = {
    unknown: 'unknown',
    won: 'won',
};

/**
 * @readonly
 * @enum {string}
 */
export const DoubleEliminationGameType = {
    noLoss: 'noLoss',
    oneLoss: 'oneLoss',
    firstFinal: 'firstFinal',
    secondFinal: 'secondFinal',
};

export const mainRoundLength = 60000; // milliseconds
export const extraRoundLength = 30000; // milliseconds
export const freeThrowAttemptRoundLength = 10000; // milliseconds
export const backToCornerFoulCount = 1;
export const outOfRoundFoulCount =  2;

export const doubleEliminationGameIdOffset = 1000;
export const competitionInfoFileName = 'competition-info.json';