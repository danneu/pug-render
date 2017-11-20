const path = require('path')
const debug = require('debug')('pug-render')
const { promisify } = require('util')
const pug = require('pug')

const readFile = promisify(require('fs').readFile)

const defaultOptions = {
    locals: {},
    ext: '.pug',
    meta: false, // for testing
    // Pug
    cache: process.env.NODE_ENV === 'production',
    compileDebug: process.env.NODE_ENV !== 'production',
}

// These are keys reserved by pug. If users passes them to
// a template via locals, we consider it an accident.
const reserved = new Set([
    'basedir',
    'cache',
    'compileDebug',
    'debug',
    'doctype',
    'filename',
    'filters',
    'globals',
    'inlineRuntimeFunctions',
    'name',
    'pretty',
    'self',
])

module.exports = (root, _options = {}) => {
    let { locals: globalLocals, ...options } = {
        ...defaultOptions,
        ..._options,
    }

    if (!root) {
        throw new Error('must provide template root')
    }

    // Fail fast on init
    for (const k of Object.keys(globalLocals)) {
        if (reserved.has(k)) {
            throw new Error(`locals contained reserved key "${k}"`)
        }
    }

    // fullpath -> pug source string
    const cache = new Map()

    // fullpath -> Promise<pug source string>
    const inflights = new Map()

    const render = async (templatePath, locals) => {
        locals = { ...globalLocals, ...locals }

        for (const k of Object.keys(locals)) {
            if (reserved.has(k)) {
                throw new Error(`locals contained reserved key "${k}"`)
            }
        }

        // only append ext if template path doesn't have an extension
        templatePath = path.extname(templatePath)
            ? templatePath
            : templatePath + options.ext

        const fullPath = path.join(root, templatePath)

        debug('fullPath=%j', fullPath)

        let source
        let meta // for testing. CACHE | INFLIGHT | FILESYSTEM

        if (options.cache && cache.has(fullPath)) {
            // template source is already cached
            if (options.meta) meta = 'CACHE'
            source = cache.get(fullPath)
        } else if (inflights.has(fullPath)) {
            // filesystem read already in flight
            if (options.meta) meta = 'INFLIGHT'
            source = await inflights.get(fullPath)
        } else {
            // read template from filesystem
            const promise = readFile(fullPath, {
                encoding: 'utf8',
            }).then(source => {
                if (options.cache) {
                    cache.set(fullPath, source)
                }
                inflights.delete(fullPath)
                return source
            })
            inflights.set(fullPath, promise)
            if (options.meta) meta = 'FILESYSTEM'
            source = await promise
        }

        const html = pug.render(source, {
            // pug uses filename as cache key, so we do as well.
            // note: pug seems to base relative extends off this path,
            // so absolute filename seems to work much better.
            filename: fullPath,
            basedir: root,
            ...options,
            ...locals,
        })

        return options.meta ? { html, meta } : html
    }

    render.fork = overrides => {
        return module.exports(root, { ..._options, ...overrides })
    }

    return render
}
