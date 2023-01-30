import { unified } from 'unified'
import parse from 'remark-parse'
import gfm from 'remark-gfm'
import codeAttributes from './mdhast-code-attributes.mjs'
import rehype from 'remark-rehype'
import html from 'rehype-stringify'
import sanitize, { defaultSchema } from 'rehype-sanitize'

/**
 * Pre-configured unified instance that can be further extended at run-time,
 * e.g. to register extra plugins.
 */
export let processor = unified()
  .use(parse)
  .use(gfm)
  .use(codeAttributes, { include: 'title' })
  .use(rehype)
  .use(html)
  // TODO: fix and re-enable sanitization (removes language-* class for hljs)
  //.use(sanitize, {
  //  ...defaultSchema,
  //  attributes: {
  //    ...defaultSchema.attributes,
  //    code: [
  //      ...(defaultSchema.attributes.code || []),
  //      ['data-language'],
  //      ['data-title'],
  //    ]
  //  }
  //})

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
