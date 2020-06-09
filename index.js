var unified = require('unified')
var markdown = require('remark-parse')
var remark2rehype = require('remark-rehype')
var html = require('rehype-stringify')
var sanitize = require('rehype-sanitize')

var processor = unified()
  .use(markdown, {commonmark: true})
  .use(remark2rehype)
  .use(html)
  .use(sanitize)

module.exports = function process(md) {
    return new Promise((res, rej) => processor.process(md, function(err, file) {
        if (err) { rej(err) }
        else { res(String(file)) }
    }))
}