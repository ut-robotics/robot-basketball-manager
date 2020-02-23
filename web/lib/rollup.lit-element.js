import resolve from 'rollup-plugin-node-resolve';
import includePaths from 'rollup-plugin-includepaths';
//import { terser } from 'rollup-plugin-terser';

export default {
    input: './node_modules/lit-element/lit-element.js',
    plugins: [
        includePaths({
            include: {},
        }),
        resolve({mainFields: ['module']}),
        //terser()
    ],
    context: 'null',
    moduleContext: 'null',
    output: {
        file: 'lit-element.mjs',
        format: 'esm',
        name: 'lit-element'
    }
};