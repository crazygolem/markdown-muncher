import { unified } from 'unified'
import toMdast from 'remark-parse'
import gfm from 'remark-gfm'
import code from './handler-code-meta.mjs'
import toHast from 'remark-rehype'
import toHtml from 'rehype-stringify'
import sanitize, { defaultSchema } from 'rehype-sanitize'

/**
 * Pre-configured unified instance that can be further extended at run-time,
 * e.g. to register extra plugins.
 */
export let processor = unified()
  .use(toMdast)
  .use(gfm)
  .use(toHast, { handlers: { code: code({ include: 'caption' }) }})
  .use(toHtml)
  .use(sanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [
        ...(defaultSchema.attributes.code || []),
        ['className', /^lang(uage)?-\w+/],
        'data*',
      ]
    }
  })

/**
 * Convert markdown to HTML.
 *
 * @param {String} md The markdown string to process
 * @returns {Promise<String>} A promise resolving to the HTML string generated
 * from the markdown input.
 */
export default function process(md) {
    return new Promise((res, rej) => processor.process(md, function(err, file) {
        if (err) { rej(err) }
        else { res(String(file)) }
    }))
}

import { inspectNoColor } from 'unist-util-inspect'
export function ast(md) {
  let tree = unified()
    .use(parse)
    .use(gfm)
    .parse(md)

  return inspectNoColor(tree)
}
