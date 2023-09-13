/// Build configurations ///////////////////////////////////////////////////////

const common = {
    entrypoints: [ './markdown-muncher.js' ],
    target: 'browser',
    format: 'esm',
    splitting: false,
    sourcemap: 'external',
    outdir: './dist/',
}

await build([
    config('Standard build', { ...common, minify: false, naming: '[name].mjs' }),
    config('Minified build', { ...common, minify: true, naming: '[name].min.mjs'}),
])


////////////////////////////////////////////////////////////////////////////////

import fmtDuration from 'humanize-duration'
import path from 'path'
import { statSync as stat } from 'fs'
import fmtBytes from 'pretty-bytes'

function config(name, config) {
    const start = performance.now()
    const decorate = (res) => {
        res.name = name,
        res.duration = performance.now() - start
        return res
    }

    return Bun.build(config).then(decorate, decorate)
}

async function build(configs) {
    const result = await Promise.all(configs)

    result.forEach(r => {
        const duration = fmtDuration(r.duration, {
            units: [ 'm', 's', 'ms' ],
            maxDecimalPoints: 1,
        })

        if (r.success) {
            const outputs = r.outputs
                .map(o => o.path)
                .map(p => `  ./${path.relative('.', p)} (${fmtBytes(stat(p).size)})`)
                .join('\n')

            console.log(`${r.name} (${duration}):\n${ outputs }`)
        } else {
            console.error(`${r.name} failed (${duration})`)
        }
    });

    if (!result.every(r => r.success)) {
        throw new AggregateError(
            result.find(r => !r.success).logs,
            "Build failed"
        );
    }
}
