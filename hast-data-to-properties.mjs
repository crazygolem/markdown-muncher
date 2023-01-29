import { visit } from 'unist-util-visit'

/**
 * @typedef {import('unified').Transformer} Transformer
 * @typedef {import('unist-util-visit').Test} NodeTest
 * @typedef {import('hast').Element}
 * @typedef {import('hast').Parent}
 *
 * @callback PropertyTest
 * @param {string} key
 *   The property's name as it appears in the node's `data` property.
 * @param {any} value
 *   The property's value.
 * @returns {boolean}
 *   Returns `true` iff the property should be processed.
 *
 * @callback TagTest
 *   Check for an arbitrary element, with an interface that is similar to
 *   `NodeTest` but with an extra first parameter that accepts the element's
 *   tag name for convenience.
 * @param {string} tag
 *   The element's tag name.
 * @param {Element} element
 *   The full element, which can be useful to implement complex rules.
 * @param {number?} index
 *   The element's position in its parent.
 * @param {Parent?} parent
 *   The element's parent.
 *
 * @typedef Options
 *   Configuration (optional)
 * @property {object} filter
 * @property {NodeTest} filter.node
 *   A [unist-util-is]-compatible test applied on each HAST node of the tree.
 *   By default all elements are matched.
 *   Use the exported `tag` function to create tag-based node filters.
 * @property {string | RegExp | PropertyTest | Array} filter.data
 *   A test applied on each property name of a matched node's `data` property.
 *   By default, none are matched: they have to be explicitly allowed when
 *   setting up the plugin.
 *   - When `string`, checks if the property's name matches.
 *   - When `regexp`, checks if the expression matches the property's name.
 *   - When `function`, checks if the function passed the property name and
 *     property value is true.
 *   - When `boolean`, always of never passes based on the filter's value.
 *   - When `array`, checks if one of the subtest is true.
 *
 *
 * [unist-util-is]: https://github.com/syntax-tree/unist-util-is
 */


/**
 * Returns the argument as an HTML `data-*` attribute name if it already follows
 * the naming rules and is just missing the prefix.
 *
 * The rules are a bit weird and depending on where you look they seem not
 * entirely consistent.
 *
 * From [whatwg]:
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
 * @param {string} attr An attribute name
 * @returns
 *   A `data-*` attribute name if the argument is already a valid attribute
 *   name, otherwise `undefined`.
 */
function asDataAttr(attr) {
    if (/^[a-z_]/.test(attr) && !/[^a-z0-9_.-]/.test(attr) && !/^xml/.test(attr)) {
        return 'data-' + attr
    }
}

/**
 * Returns the argument as a DOM property name if it already follows the naming
 * rules for javascript variable names, adding the `data` prefix.
 *
 * Note that some property names that could in principle be turned into a valid
 * `data-*` attribute name (cf. [mdn]) are not accepted.
 *
 *
 * [mdn]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset#name_conversion
 *
 * @param {string} prop A property name
 * @returns
 *   A property name with the extra `data` prefix if the argument is already
 *   well-formed, otherwise `undefined`.
 */
function asDataProp(prop) {
    if (/^[A-Za-z_]/.test(prop) && !/[^\w]/.test(prop)) {
        return 'data' + prop.charAt(0).toUpperCase() + prop.slice(1)
    }
}

/**
 * Applies a user-specified data filter.
 */
function shouldFilterData(filter, key, val) {
    if (typeof filter === 'boolean' || filter instanceof Boolean) {
        return Boolean(filter)
    }
    if (typeof filter === 'string' || filter instanceof String) {
        return filter == key
    }
    if (filter instanceof RegExp) {
        return filter.test(key)
    }
    if (filter instanceof Function) {
        return Boolean(filter(key, val))
    }
    if (filter instanceof Array) {
        return filter.some(flt => shouldFilterData(flt, key, val))
    }
}

/**
 * Convenience method to easily create a node filter that matches elements by
 * their tag name.
 *
 * @param {string | RegExp | TagTest | Array} filter
 *   A test applied on node of type 'element'.
 *   - When `string`, checks if the tag name is equal to the filter.
 *   - When `regexp`, checks if the expression matches the tag name.
 *   - When `function`, checks if the function passed the tag name is true.
 *     Extra arguments matching `NodeTest`'s interface are passed to allow
 *     the implementation of complex rules.
 *   - When `boolean`, always of never passes based on the filter's value.
 *   - When `array`, checks if any of the subtest passes.
 * @returns {NodeTest}
 *   An node filter that applies on elements based on their tag name.
 */
export function tag(filter) {
    const isElt = node => node.type === 'element'
    if (typeof filter === 'boolean' || filter instanceof Boolean) {
        return (n, ...rs) => isElt(n) && filter
    }
    if (typeof filter === 'string' || filter instanceof String) {
        return (n, ...rs) => isElt(n) && n.tagName === filter
    }
    if (filter instanceof RegExp) {
        return (n, ...rs) => isElt(n) && filter.test(n.tagName)
    }
    if (filter instanceof Function) {
        return (n, ...rs) => isElt(n) && Boolean(filter(n.tagName, n, ...rs))
    }
    if (filter instanceof Array) {
        return (n, ...rs) => filter.some(flt => tag(flt)(n, ...rs))
    }
}

/**
 * Copies internal `data` element attributes to element properties, such that
 * they get rendered as HTML data attributes.
 *
 * The `data` element attribute is not documented by HAST, but it seems
 * recognized as a stable *internal* attribute, cf. [source], [discussion].
 *
 * [source]: https://github.com/syntax-tree/mdast-util-to-hast/blob/main/lib/handlers/code.js
 * [discussion]: https://github.com/orgs/remarkjs/discussions/1026#discussioncomment-3370414
 *
 * @param {Options?} options The options for this plugin.
 * @returns {Transformer}
 *   A HAST transformer.
 */
export default function dataToProperties(options) {
    return (tree, file) => {
        visit(tree, options?.filter?.node ?? 'element', (node) => {
            if (!node.data)
                return

            for (const [key, val] of Object.entries(node.data)) {
                if (!shouldFilterData(options?.filter?.data, key, val))
                    continue

                let name = asDataAttr(key) ?? asDataProp(key)

                if (!name) {
                    console.debug('Cannot be made into a data attribute:', key)
                    continue
                }

                // I couldn't find a clear description in HAST's AST doc, but it
                // seems that when generating the HTML output, if the name looks
                // like an HTML attribute (i.e. it contains dashes), it is
                // serialized as-is without extra validation nor sanitation,
                // while if it looks like a property, it gets properly kebab-
                // cased first.
                //
                // There is a short description in [hastscript]'s documentation,
                // which hints to the possibility of using either for property
                // names:
                //
                // > Properties
                // > Map of properties (TypeScript type). Keys should match
                // > either the HTML attribute name, or the DOM property name,
                // > but are case-insensitive.
                //
                // In our case, the name is properly validated beforehand,
                // either as a DOM property or as an HTML `data-*` attribute, so
                // we should be safe.
                //
                //
                // [hastscript]: https://github.com/syntax-tree/hastscript#properties-1
                node.properties[name] = val

                // Remove the consumed data attribute: we don't want duplicated
                // data in the AST
                delete node.data[name]
            }

            if (Object.keys(node.data).length == 0) {
                delete node.data
            }
        })
    }
}
