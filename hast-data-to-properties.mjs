import { visit } from 'unist-util-visit'


/**
 * Returns the argument as a `data-*` property name if it already follows the
 * naming rules and is just missing the prefix.
 *
 * The rules are a bit weird and depending on where you look not entirely
 * consistent.
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
 * @param {string} attr an attribute name
 * @returns A `data-*` attribute name if the argument is already a valid
 * attribute name, otherwise `undefined`.
 */
function asDataAttr(attr) {
    if (/^[a-z_]/.test(attr) && !/[^a-z0-9_.-]/.test(attr) && !/^xml/.test(attr)) {
        return 'data-' + attr
    }
}

/**
 * Returns the argument as a HAST element property name if it already follows
 * the naming rules for javascript variable names, adding the `data` prefix.
 *
 * Note that some property names that could in principle be turned into a valid
 * `data-*` attribute name (cf. [mdn]) are not accepted.
 *
 *
 * [mdn]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset#name_conversion
 *
 * @param {string} prop a property name
 * @returns A property name with the extra `data` prefix if the argument is
 * already well-formed, otherwise `undefined`.
 */
function asDataProp(prop) {
    if (/^[A-Za-z_]/.test(prop) && !/[^\w]/.test(prop)) {
        return 'data' + prop.charAt(0).toUpperCase() + prop.slice(1)
    }
}

/**
 * Converts a well-formed attribute name to the corresponding property name.
 *
 * The general algorithm is described on [mdn], except that for this method, the
 * `data` prefix is not removed (as it is needed on the HAST node).
 *
 *
 * [mdn]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset#name_conversion
 *
 * @param {string|undefined} attr a well-formed attribute name
 * @returns the corresponding property name, or `undefined` if the argument is
 * nullish.
 */
function toProp(attr) {
    return attr?.toLowerCase().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
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
 * @param {*} options
 * @returns A HAST transformer
 */
export default function dataToProperties(options) {
    return (tree, file) => {
        visit(tree, options?.filter?.element ?? 'element', (node) => {
            if (!node.data)
                return

            for (const [key, val] of Object.entries(node.data)) {
                // By default no attribute is moved over, they have to be
                // explicitly allowed in the configuration.
                if (!(options?.filter?.data?.(key, val) ?? false))
                    continue

                let prop = asDataProp(key) ?? toProp(asDataAttr(key))

                if (!prop) {
                    console.debug('Cannot be made into a data attribute:', key)
                    continue
                }

                node.properties[prop] = val

                // Remove the consumed data attribute: we don't want duplicated
                // data in the AST
                delete node.data[prop]
            }

            if (Object.keys(node.data).length == 0) {
                delete node.data
            }
        })
    }
}
