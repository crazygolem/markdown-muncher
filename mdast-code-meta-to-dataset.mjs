import { visit } from 'unist-util-visit'

/**
 * @typedef {import('unified').Transformer} Transformer
 *
 * @typedef {{ attrs: [{ key: string, val: string }], rest: string | undefined }} ParseResult
 *
 * @callback ParseFunction
 * @param {string} meta
 *   The metadata of the code block, i.e. the info string without the language.
 * @returns {ParseResult}
 *   An object containing the parsed elements as a key-value pair in an array
 *   under the `attrs` key, and the remainder of the input that could not get
 *   parsed under the `rest` key.
 *
 * @callback AttributePredicate
 * @param {string} key
 * @param {string} value
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
 *   - When `true`, always passes.
 *   - When `array`, checks if one of the sub-predicate is true.
 *
 *   The default configuration does not match any attribute.
 * @property {string | null | false} [langAttr=language]
 *   Determines the HTML `data-*` attribute's name for the code block's
 *   language. If defined and falsy, disables this behavior.
 *
 *   This attribute is not affected by the `include` configuration, and will
 *   still be set even if no other attribute is included. However, if the name
 *   is allowed by `include`, it can be overridden by a parsed attribute with
 *   the same name.
 *
 *   The default value is 'language'.
 * @property {ParseFunction} [parseFn]
 *   A custom metadata parsing function.
 *
 *   The default function parses the metadata string from the start and stops
 *   when tokens don't match the expected key-value format. The remainder of the
 *   line is left untouched in the node's metadata property.
 */

/**
 * Parses the metadata of a code block, extracting key-value pairs appearing in
 * various forms:
 * - Unquoted: The value cannot contain whitespace.
 *   Example: `hello=world`
 * - Quoted: The value is quoted with single or double quotes, can contain any
 *   character except for the quote mark unless it is escaped with a backslash.
 *   Example: `foo="bar baz" quote="And he said \"lorem ipsum\"."`
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
 * @type {ParseFunction}
 */
export function parse(meta) {
    // Notice the 'y' (sticky) flag
    let re = /\s*(?<key>(?!xml)[a-z_][a-z0-9_.-]*)=(?:(?<q>["'])(?<qval>(?:(?<=\\)\k<q>|(?!\k<q>).)*)\k<q>|(?<uval>\S*))\s*/y

    let attrs = []
    let lidx = 0
    let match
    while (match = re.exec(meta)) {
        // When a sticky regexp doesn't find a match, it resets its lastIndex to
        // 0, so we have to keep track of it separately.
        lidx = re.lastIndex
        attrs.push({
            key: match.groups.key,
            val: match.groups.qval ?? match.groups.uval,
        })
    }

    return {
        attrs: attrs,
        rest: lidx < meta.length ? meta.slice(lidx) : undefined,
    }
}

/**
 * Parses a code block's info string as key-value pairs, and put the result into
 * the node's properties such that they get transformed into HTML `data-*`
 * attributes by `remark-rehype` in the corresponding HAST nodes.
 *
 * # Security
 *
 * This plugin can be used to inject potentially dangerous user-provided data
 * into HTML `data-*` attributes.
 *
 * @param {Options} [options]
 *  The options for this plugin. (optional)
 * @returns {Transformer}
 *  An MDAST transformer.
 */
export default function metaToDataset(options) {
    const {
        include = false,
        langAttr = 'language',
        parseFn = parse,
    } = options ?? {}

    return (tree, vfile) => visit(tree, 'code', node => {
        if (!node.meta)
            return

        const { attrs, rest } = parseFn(node.meta)

        // Documented in [mdast-util-to-hast]:
        //
        // > `node.data.hProperties` is mixed into the element’s properties
        //
        //
        // [mdast-util-to-hast]: https://github.com/syntax-tree/mdast-util-to-hast#fields-on-nodes
        node.data ??= {}
        node.data.hProperties ??= {}

        // Set first, so it can be overridden if allowed by `include`
        if (langAttr && node.lang) {
            node.data.hProperties[`data-${langAttr}`] = node.lang
        }

        Object.assign(node.data.hProperties, Object.fromEntries(
            attrs
            .filter(({ key, val }) => applyFilter(include, key, val))
            .map(({ key, val }) => [`data-${key}`, val])
        ))

        // We don't want duplicated data in the AST
        if (rest) {
            node.meta = rest
        } else {
            delete node.meta
        }
    })
}

/**
 * Applies the attribute filter.
 */
function applyFilter(flt, key, val) {
    if (typeof flt === 'boolean' || flt instanceof Boolean) {
        return !!flt
    }
    if (typeof flt === 'string' || flt instanceof String) {
        return flt == key
    }
    if (flt instanceof RegExp) {
        return flt.test(key)
    }
    if (flt instanceof Function) {
        return !!flt(key, val)
    }
    if (flt instanceof Array) {
        return flt.some(flt => filter(flt, key, val))
    }
}
