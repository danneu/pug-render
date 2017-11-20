/* eslint-env mocha */
const { join } = require('path')
const { assert } = require('chai')
const makeRender = require('../src')

// NOTE: Pug with cache=true is stateful.
// If needed, can set pug.cache = {} to reset its cache when cache is on.

// assert.rejects(promise, /expected error message/)
// assert.rejects(() => promise, /expected error message/)
assert.rejects = async (fn, regex) => {
    const promise = fn instanceof Promise ? fn : fn()
    try {
        await promise
        assert.fail('expected promise to regex with message matching: ', regex)
    } catch (err) {
        assert.match(err.message, regex)
    }
}

const views = join(__dirname, 'views')

describe('reserved keys', () => {
    it('cannot be used in global locals', async () => {
        assert.throws(() => {
            makeRender(views, {
                locals: { cache: true },
            })
        }, /reserved key/)
    })

    it('cannot be used in local locals', async () => {
        const render = makeRender(views)
        await assert.rejects(render('master', { cache: true }), /reserved key/)
    })
})

describe('ext option', () => {
    it('is used when no template ext is given', async () => {
        const render = makeRender(views, { ext: '.foo' })
        assert.equal(await render('master'), '<h1>master.foo</h1>')
    })

    it('is ignored when template ext is given', async () => {
        const render = makeRender(views, { ext: '.foo' })
        assert.equal(await render('master.pug'), '<h1>master.pug</h1>')
    })
})

describe('inheritance', () => {
    const render = makeRender(views)

    it('supports relative extends', async () => {
        assert.equal(
            await render('nested-relative', { test: 42 }),
            '<h1>master.pug</h1><h2>42</h2>'
        )
    })

    it('supports absolute extends', async () => {
        assert.equal(
            await render('nested-absolute', { test: 42 }),
            '<h1>master.pug</h1><h2>42</h2>'
        )
    })
})

describe('parallel requests', () => {
    describe('cache=true', () => {
        it('only fetch from fs once and then read from cache', async () => {
            const render = makeRender(views, { cache: true, meta: true })

            const [a, b] = await Promise.all([
                render('master'),
                render('master'),
            ])
            const c = await render('master')

            assert.deepEqual(
                [a.meta, b.meta, c.meta],
                ['FILESYSTEM', 'INFLIGHT', 'CACHE']
            )
        })
    })

    describe('cache=false', () => {
        it('only fetch from fs once and then read from cache', async () => {
            const render = makeRender(views, { cache: false, meta: true })

            const [a, b] = await Promise.all([
                render('master'),
                render('master'),
            ])
            const c = await render('master')

            assert.deepEqual(
                [a.meta, b.meta, c.meta],
                ['FILESYSTEM', 'INFLIGHT', 'FILESYSTEM']
            )
        })
    })
})
