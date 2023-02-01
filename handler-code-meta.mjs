import { defaultHandlers } from 'remark-rehype'

/**
 * @typedef {import('mdast-util-to-hast').Handler} Handler
 * @typedef {import('mdast-util-to-hast').H} H
 *
 * @typedef {{ attrs: [{ key: string, val: string }], rest: string | undefined }} ParseResult
 *
 * @callback InfoParser
 * @param {string} meta
 *   The metadata of the code block, i.e. the info string without the language.
 * @returns {ParseResult}
 *   An object containing the parsed elements as a key-value pair in an array
 *   under the `attrs` key, and the remainder of the input that could not get
 *   parsed under the `rest` key.
 *
 * @callback AttributePredicate
 *   A function applied on parsed attributes to determine whether they should be
 *   included in the transformed AST.
 * @param {string} name
 *   The attribute name as it appears in the markdown document.
 * @param {string | null | undefined} value
 *   The attribute value, if any.
 *
 * @typedef Options
 *   The plugin's options.
 * @property {boolean | string | RegExp | AttributePredicate | Array} [include=false]
 *   A predicate applied on each parsed attribute to determine whether it will
 *   be added to the node's HTML `data-*` attributes.
 *   - When `string`, checks if the attribute's name matches.
 *   - When `regexp`, checks if the expression matches the attribute's name.
 *   - When `function`, checks if the function passed the attribute's name and
 *     value returns true.
 *   - When `boolean`, always passes with `true`, never with `false`.
 *   - When `array`, checks if one of the sub-predicate is true.
 *
 *   The default configuration does not match any attribute.
 * @property {string | null | false} [langAttr=language]
 *   Determines the HTML `data-*` attribute's name for the code block's
 *   language. If defined and falsy, does not copy the language into an
 *   attribute.
 *
 *   This attribute is not affected by the `include` configuration, and will
 *   still be set even if no other attribute is included. However, if the name
 *   is allowed by `include`, it can be overridden by a parsed attribute with
 *   the same name.
 *
 *   The default value is 'language'.
 * @property {InfoParser} [parser]
 *   A custom metadata parsing function.
 *
 *   The default function parses the metadata string from the start and stops
 *   when tokens don't match the expected key-value format. The remainder of the
 *   line is left untouched in the node's metadata property.
 * @property {Handler} [handler]
 *   A custom `mdast-util-to-hast` handler for MDAST `code` nodes.
 *
 *   This plugin does not perform the MDAST to HAST transformation itself, but
 *   delegates that task to an actual handler after parsing the node's info
 *   string.
 *
 *   By default, `mdast-util-to-hast`'s default `code` handler is used.
 */


/**
 * Parses the metadata of a code block, extracting key-value pairs appearing in
 * various forms:
 * - Unquoted: The value cannot contain whitespace.
 *   Example: `hello=world foo=bar=baz` parses two attributes.
 * - Quoted: The value is quoted with single or double quotes, can contain any
 *   character except for the quote mark unless it is escaped with a backslash.
 *   Example: `foo="bar baz" quote="And he said \"lorem ipsum\"."`
 * - Key only: There is no value, not even an equal sign.
 *   Example: `foo bar` parses two attributes.
 *
 * The key must be a valid name suffix for an HTML `data-*` attribute. The rules
 * are a bit weird and depending on where you look they seem not entirely
 * consistent. From [whatwg]:
 *
 * 1. no namespace, i.e. cannot have a colon in the name
 * 2. name starts with "data-" (here: not applicable)
 * 3. has at least one character after the hyphen (here: at all)
 * 4. is XML-compatible, i.e. follows the `Name` production as documented in
 *    https://www.w3.org/TR/xml/#NT-Name
 * 5. contains no uppercase
 *
 * In practice this means rule 4 without colons nor uppercase.
 *
 * An additional restriction mentioned in [mdn] is that the name must not start
 * with the `xml` string.
 *
 * In addition, for this plugin, we'll limit the allowed chars to ASCII.
 *
 *
 * [whatwg]: https://html.spec.whatwg.org/multipage/dom.html#attr-data-*
 * [mdn]: https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/data-*
 *
 * @type {InfoParser}
 */
export function parse(meta) {
    // Notice the 'y' (sticky) flag
    let re = /\s*(?<key>(?!xml)[a-z_][a-z0-9_.-]*)(?:=(?:(?<q>["'])(?<qval>(?:(?<=\\)\k<q>|(?!\k<q>).)*)\k<q>|(?<uval>\S*)))?\s*/y

    let attrs = []
    let lidx = 0
    let match
    while (match = re.exec(meta)) {
        // When a sticky regexp doesn't find a match, it resets its lastIndex to
        // 0, so we have to keep track of it separately.
        lidx = re.lastIndex
        attrs.push({
            key: match.groups.key,
            val: match.groups.qval ?? match.groups.uval ?? '',
        })
    }

    return {
        attrs: attrs,
        rest: lidx < meta.length ? meta.slice(lidx) : undefined,
    }
}

/**
 * Returns a handler for `code` nodes capable of parsing the info string, and
 * turn the result into HTML `data-*` attributes.
 *
 * It is meant to be configured as a replacement of `mdast-util-to-hast`'s
 * default `code` handler.
 *
 * # Use
 *
 * When adding the `remark-rehype` plugin to your `unified` pipeline, replace
 * the default `code` handler by one returned by this method:
 *
 * ```js
 * .use(toHast, {
 *   handlers: {
 *     code: code({ include: 'source-url' })
 *   }
 * })
 * ```
 *
 * # Security
 *
 * This plugin can be used to inject potentially dangerous user-provided data
 * into HTML `data-*` attributes, which can open you up to XSS attacks by
 * exploiting scripts running on the page that read those attributes.
 *
 * @param {Options} options
 * @returns {Handler}
 *   A handler to be used with `mdast-util-to-hast`.
 */
export default function code(options) {
    const {
        include = false,
        langAttr = 'language',
        parser = parse,
        handler = defaultHandlers.code
    } = options ?? {}

    /** @type {Handler} */
    return (h, node) => {
        preHandle(node, langAttr, parser, include)
        return handler(h, node)
    }
}


/**
 * Transforms the node by parsing its info string and adding the resulting
 * attributes to the node's `data.hProperties` property, such that they get
 * processed as HTML `data-*` attributes by rehype after the AST conversion.
 *
 * This property is documented in `mdast-util-to-hast`'s [README]:
 * > `node.data.hProperties` is mixed into the element’s properties
 *
 * Note that the default code [handler] additionally copies over the `data.meta`
 * attribute (and no other), wich is not documented, but it is not used by
 * `rehype-stringify` when rendering to HTML.
 *
 *
 * [README]: https://github.com/syntax-tree/mdast-util-to-hast#fields-on-nodes
 * [handler]: https://github.com/syntax-tree/mdast-util-to-hast/blob/main/lib/handlers/code.js
 *
 * @param {any} node A `code`-like node.
 * @param {string | lang | false} langAttr
 * @param {InfoParser} parser
 * @param {AttributePredicate} include
 * @returns {void}
 */
function preHandle(node, langAttr, parser, include) {
    (node.data ??= {}).hProperties ??= {}

    // Set first, so it can be overridden if allowed by `include`
    if (node.lang && langAttr) {
        node.data.hProperties[`data-${langAttr}`] = node.lang
    }

    if (!node.meta)
        return

    const { attrs, rest } = parser(node.meta)

    Object.assign(node.data.hProperties, Object.fromEntries(
        attrs
        .filter(({ key, val }) => applyPredicate(include, key, val))
        .map(({ key, val }) => [`data-${key}`, val])
    ))

    // We don't want duplicated data in the AST
    if (rest) {
        node.meta = rest
    } else {
        delete node.meta
    }
}

/**
 * Applies the attribute filter.
 *
 * @param {AttributePredicate} pred
 * @param {string} key
 * @param {string | null | undefined} val
 */
function applyPredicate(pred, key, val) {
    if (typeof pred === 'boolean' || pred instanceof Boolean) {
        return !!pred
    }
    if (typeof pred === 'string' || pred instanceof String) {
        return pred == key
    }
    if (pred instanceof RegExp) {
        return pred.test(key)
    }
    if (pred instanceof Function) {
        return !!pred(key, val)
    }
    if (pred instanceof Array) {
        return pred.some(p => applyPredicate(p, key, val))
    }
}
