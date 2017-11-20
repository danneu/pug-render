# pug-render

    npm install pug-render

A wrapper around [Pug](https://pugjs.org/) with some improvements and a better API.

## Improvements

- **Asynchronous filesystem reads**. Pug's `renderFile()` synchronously reads the template source from the filesystem.

    Because this is suboptimal, this library insteads reads from the filesystem asynchronously. Parallel requests for the same template only trigger a single filesystem read.
- **Pass in template locals and rendering options separately**. `pug.renderFile('hello.pug', { debug: true })` passes `debug` into
the `hello.pug` template. But the `debug` key is also one of Pug's
[options](https://pugjs.org/api/reference.html#options), so it also
turns debug output on for this render.

    This means it's possible to accidentally/silently override Pug
    options with keys that were only intended for the template.

    This library protects against this by throwing an error if you try to
    use one of Pug's "reserved" options keys in your template locals.
- **Additional rendering options**. e.g. root template directory, global locals, implicit extensions.
- **Absolute includes**. Any absolute includes like `include /master.pug` (i.e. starts with "/") will be looked up from the configured root directory.

## Usage

Here are the default options.

```javascript
const makeRender = require('pug')

const templateRoot = require('path').join(__dirname, 'views')

const render = makeRender(templateRoot, {
    cache: process.env.NODE_ENV === 'production',
    // Use this extension if template path doesn't specify one.
    ext: '.pug',
    // Expose locals to all templates.
    // Template locals are merged into these.
    locals: {},
})

// will expect template at './views/homepage.pug'
render('homepage', { title: 'Homepage' })
    .then(html => console.log('html:', html))
    .catch(console.error)
```

## Koa example

Here's a middleware function that extends the koa context
with a `ctx.render()` function which renders a pug
template and updates the response.

```javascript
const pugRender = require('pug-render')

const middleware = (root, opts) => {
    const render = pugRender(root, opts)

    return async (ctx, next) => {
        ctx.render = async (templatePath, locals) => {
            ctx.type = 'html'
            ctx.body = await render(templatePath, locals)
        }
        return next()
    }
}

app.use(middleware(require('path').join(__dirname, 'views'), {
    locals: {
        env: process.env
    }
}))

app.get('/', async ctx => {
    // Remember to `await` the promise.
    await ctx.render('homepage', { title: 'Homepage' })
})
```

## Debug

This library uses [debug](https://www.npmjs.com/package/debug) for debug output under the "pug-render" namespace.

To see this output, launch node with:

    DEBUG=pug-render node file.js

It will print out the full path of the template files as it looks them up.