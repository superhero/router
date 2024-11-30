import Locate from '@superhero/locator'
import Router from '@superhero/router'
import assert from 'node:assert'
import { suite, test, beforeEach } from 'node:test'

suite('@superhero/router', () => 
{
  let router, locate

  beforeEach(() => 
  {
    locate = new Locate()
    router = new Router(locate)
  })

  test('Can set valid routes', () => 
  {
    const routesMap = 
    {
      route1: { criteria: '/test/123', dispatcher: 'foo' },
      route2: { criteria: '/sample/*', dispatcher: 'bar' },
    }

    router.setRoutes(routesMap)

    assert.strictEqual(router.size, 2)
    assert(router.has('route1'))
    assert(router.has('route2'))
  })

  test('Can dispatch events using a matching route', async () => 
  {
    router.set('testRoute', 
    {
      criteria   : '/test/:id',
      dispatcher : 'testDispatcher',
    })

    let dispatched = false
    locate.set('testDispatcher', 
    {
      dispatch: (event) => 
      {
        dispatched = true
        assert.strictEqual(event.param.id, '123')
      }
    })

    await router.dispatch({ criteria: '/test/123' })
    assert(dispatched, 'Event was not dispatched')
  })

  test('Can set a valid route', () => 
  {
    const route = { criteria: '/test/123', dispatcher: 'foobar' }
    router.set('testRoute', route)
    assert.ok(router.has('testRoute'), 'Route was set')
  })

  test('Can manage error in the dispatcher', async (sub) => 
  {
    locate.set('testDispatcher', 
    {
      dispatch: () => { throw new Error('test error') },
      onError : (reason, _, meta) => meta.error = reason
    })

    router.set('testRoute', 
    {
      criteria   : '/test/123',
      dispatcher : 'testDispatcher',
    })

    const meta = {}
    await assert.doesNotReject(router.dispatch({ criteria: '/test/123' }, meta))
    assert.strictEqual(meta.error.message, 'test error', 'Error should have benn caught')
  })

  suite('Can dispatch events using a dispatcher chain of middlewares', () =>
  {
    test('Can dispatch chain of middlewares defined in a single route', async () => 
    {
      locate.set('testDispatcher', 
      {
        dispatch: (_, meta) => 
        {
          assert.equal(meta.dispatcherVar,  undefined)
          assert.equal(meta.upstreamVar,    'bar')
          assert.equal(meta.downstreamVar,  undefined)

          meta.dispatcherVar = 'foo'
        }
      })
      
      locate.set('testMiddlewareUpstream',
      {
        dispatch: (_, meta) => 
        {
          assert.equal(meta.dispatcherVar,  undefined)
          assert.equal(meta.upstreamVar,    undefined)
          assert.equal(meta.downstreamVar,  undefined)

          meta.upstreamVar = 'bar'
        }
      })
      
      locate.set('testMiddlewareDownstream',
      {
        dispatch: async (_, meta) => 
        {
          assert.equal(meta.dispatcherVar,  undefined)
          assert.equal(meta.upstreamVar,    undefined)
          assert.equal(meta.downstreamVar,  undefined)

          await meta.chain.next()

          assert.equal(meta.dispatcherVar,  'foo')
          assert.equal(meta.upstreamVar,    'bar')
          assert.equal(meta.downstreamVar,  undefined)

          meta.downstreamVar = 'baz'
        }
      })

      router.set('testRoute', 
      {
        middleware : ['testMiddlewareDownstream', 'testMiddlewareUpstream'],
        criteria   : '/test/123',
        dispatcher : 'testDispatcher',
      })

      const meta = await router.dispatch({ criteria: '/test/123' })
      assert.equal(meta.dispatcherVar,  'foo')
      assert.equal(meta.upstreamVar,    'bar')
      assert.equal(meta.downstreamVar,  'baz')
      // assert.deepEqual(meta.route.trace, ['testMiddlewareDownstream', 'testMiddlewareUpstream', 'testDispatcher'])
    })

    test('Can dispatch the chain defined in different routes', async () => 
    {
      locate.set('middleware1',
        { dispatch: (_, meta) => meta.foo = 1 })

      locate.set('middleware2',
        { dispatch: (_, meta) => meta.bar = 2 })

      locate.set('middleware3',
        { dispatch: (_, meta) => meta.baz = 3 })

      locate.set('middleware4',
        { dispatch: (_, meta) => meta.qux = 4 })

      locate.set('dispatcher1',
        { dispatch: (_, meta) => meta.qux++ })

      router.set('middleware1route', 
        { middleware : 'middleware1',
          criteria   : '/*/*' })
      
      router.set('middleware2route', 
        { middleware : 'middleware2',
          criteria   : '/test/*' })

      router.set('middleware3route', 
        { middleware : 'middleware3',
          criteria   : '/test/:num' })

      router.set('middleware4route', 
        { middleware : 'middleware4',
          criteria   : '/:tier/:id' })

      router.set('dispatcher1route', 
        { dispatcher : 'dispatcher1',
          criteria   : '/test/123' })

      const
        event = { criteria: '/test/123' },
        meta  = await router.dispatch(event)

      assert.equal(meta.foo, 1, 'Middleware 1 should set foo')
      assert.equal(meta.bar, 2, 'Middleware 2 should set bar')
      assert.equal(meta.baz, 3, 'Middleware 3 should set baz')
      assert.equal(meta.qux, 5, 'Middleware 4 and dispatcher should set qux')

      assert.strictEqual(event.param.num,   '123',  'Middleware 3 should extract the param num')
      assert.strictEqual(event.param.id,    '123',  'Middleware 4 should extract the param id')
      assert.strictEqual(event.param.tier,  'test', 'Middleware 4 should extract the param tier')

      assert.deepEqual(meta.route.trace,
      [ 'middleware1route',
        'middleware2route',
        'middleware3route',
        'middleware4route',
        'dispatcher1route', ], 'The route trace is expected to show the order of the matched routes')
    })
  })

  test('Can abort dispatch correctly', async (sub) => 
  {
    sub.beforeEach(() =>
    {
      locate.set('testDispatcher', 
      {
        dispatch: (event, meta) => meta.dispatched = event.param.id
      })
  
      router.set('testRoute', 
      {
        criteria   : '/test/:id',
        dispatcher : 'testDispatcher',
      })
    })

    await sub.test('Aborts dispatch when meta.abortion.signal.aborted is true', async () =>
    {
      const fooMeta = {}
      fooMeta.abortion = new AbortController()
      fooMeta.abortion.abort('Aborted intentionally')
  
      await assert.doesNotReject(router.dispatch({ criteria: '/test/foo' }, fooMeta))
      assert.strictEqual(fooMeta.abortion.signal.aborted, true)
      assert.strictEqual(fooMeta.abortion.signal.reason, 'Aborted intentionally')
      assert.strictEqual(fooMeta.dispatched, undefined)
    })

    await sub.test('Does not abort dispatch when meta.abortion.signal.aborted is false', async () =>
    {
      const barMeta = {}
      barMeta.abortion = new AbortController()

      await assert.doesNotReject(router.dispatch({ criteria: '/test/bar' }, barMeta))
      assert.strictEqual(barMeta.abortion.signal.aborted, false)
      assert.strictEqual(barMeta.abortion.signal.reason, undefined)
      assert.strictEqual(barMeta.dispatched, 'bar')
    })

    await sub.test('Lazy loads meta.abortion when not set', async () =>
    {
      const bazMeta = {}
      await assert.doesNotReject(router.dispatch({ criteria: '/test/baz' }, bazMeta))
    
      assert.strictEqual(bazMeta.abortion.signal.aborted, false)
      assert.strictEqual(bazMeta.abortion.signal.reason, undefined)
      assert.strictEqual(bazMeta.dispatched, 'baz')
    })
  })

  test('Will not set false routes', () => 
  {
    const routesMap = 
    {
      route1: { criteria: '/test/123', dispatcher: 'foo' },
      route2: false,
      route3: { criteria: '/sample/*', dispatcher: 'bar' },
      route4: false,
    }

    router.setRoutes(routesMap)

    assert.strictEqual(router.size, 2)
    assert(router.has('route1'))
    assert(false === router.has('route2'))
    assert(router.has('route3'))
    assert(false === router.has('route4'))
  })

  test('Will delete routes defined by false', () => 
  {
    const routesMap = 
    {
      route1: { criteria: '/test/123', dispatcher: 'foo' },
      route2: { criteria: '/sample/*', dispatcher: 'bar' },
    }

    router.setRoutes(routesMap)
    assert.strictEqual(router.size, 2)
    assert(router.has('route1'))
    assert(router.has('route2'))
    assert(false === router.has('route3'))

    router.setRoutes({ route1: false })
    assert.strictEqual(router.size, 1)
    assert(false === router.has('route1'))

    router.set('route2', false)
    assert.strictEqual(router.size, 0)
    assert(false === router.has('route2'))
  })

  test('Throw an error if invalid routes map type is attempted to be set', () => 
  {
    assert.throws(
      () => router.setRoutes([]), 
      { code: 'E_ROUTER_INVALID_ROUTE' },
      'Should throw due to invalid routes type')
  })

  test('Throw an error when setting a duplicate route id', () => 
  {
    const route = { criteria: '/test/123', dispatcher: 'barbaz' }
    router.set('testRoute', route)
    assert.throws(
      () => router.set('testRoute', route), 
      { code: 'E_ROUTER_INVALID_ROUTE' },
      'Should throw due to duplicate route id')
  })

  test('Throw an error when an invalid route type set', () => 
  {
    assert.throws(
      () => router.set('invalidRoute', 'a string is an invalid type'), 
      { code: 'E_ROUTER_INVALID_ROUTE'}, 
      'Should throw due to invalid route type')
  })

  test('Throw an error when setting a route with a missing criteria', () => 
  {
    assert.throws(
      () => router.set('invalidRoute', { dispatcher: 'bazqux' }), 
      { code: 'E_ROUTER_INVALID_ROUTE' }, 
      'Should throw due to missing route criteria')
  })

  test('Throw an error when dispatching an event with no matching routes', async () => 
  {
    const
      routeEvent = { criteria: '/nonexistent' },
      routeMeta  = {}

    await assert.rejects(
      router.dispatch(routeEvent, routeMeta), 
      { code: 'E_ROUTER_DISPATCH_FAILED' },
      'Should reject due to no matching route found')
  })

  test('Rejects when dispatching a dispatcher that throws', async (sub) => 
  {
    locate.set('testDispatcher', { dispatch: () => { throw new Error('test error') }})

    router.set('testRoute', 
    {
      criteria   : '/test/123',
      dispatcher : 'testDispatcher',
    })

    const meta = {}
    await assert.rejects(
      router.dispatch({ criteria: '/test/123' }, meta),
      (error) => 'E_ROUTER_DISPATCH_FAILED' === error.code 
              && 'test error' === error.cause.message,
      'Error should have been caught')
  })
})
