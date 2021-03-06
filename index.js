import unified from 'unified'
import parse from 'remark-parse'
import footnotes from 'remark-footnotes'
import rehype from 'remark-rehype'
import html from 'rehype-stringify'
import sanitize from 'rehype-sanitize'

/**
 * Pre-configured unified instance that can be further extended at run-time,
 * e.g. to register extra plugins.
 */
export let processor = unified()
  .use(parse, { commonmark: true, gfm: true })
  .use(footnotes, { inlineNotes: true })
  .use(rehype)
  .use(html)
  .use(sanitize)

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