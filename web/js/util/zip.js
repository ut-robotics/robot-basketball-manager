export default function zip(...arrays) {
    const length = Math.max(...arrays.map(arr => arr.length));
    return Array.from({length}, (value, index) => arrays.map((array => array[index])));
}