export default function getValidScoreOrFoulCounts(roundScoresOrFouls) {
    const validCounts = [];

    for (const robotScoresOrFouls of roundScoresOrFouls) {
        let validCount = 0;

        for (const scoreOrFoul of robotScoresOrFouls) {
            if (scoreOrFoul.isValid) {
                validCount++;
            }
        }

        validCounts.push(validCount);
    }

    return validCounts;
}