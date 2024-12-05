import deepassign from '@superhero/deep/assign'
import deepclone  from '@superhero/deep/clone'

export default class Router extends Map
{
  constructor(locator)
  {
    super()
    this.locate = locator
  }

  /**
   * @param {Object[]} routesMap The routes to add.
   * @param {Object} [separators] Optional route separators.
   */
  setRoutes(routesMap, separators)
  {
    const routesType = Object.prototype.toString.call(routesMap)

    if(routesType !== '[object Object]')
    {
      const error = new TypeError('Routes must be type [object Object]')
      error.code  = 'E_ROUTER_INVALID_ROUTE'
      error.cause = new TypeError(`Invalid routes type "${routesType}"`)
      throw error
    }

    for(const id in routesMap)
    {
      this.set(id, routesMap[id], separators)
    }
  }

  /**
   * @param {string} id The id of the route.
   * @param {string} route The route.
   * @param {Object} [separators] Optional route separators.
   */
  set(id, route, separators)
  {
    if(route === false)
    {
      this.delete(id)
      return
    }

    if(this.has(id))
    {
      const error = new Error(`Route "${id}" already exists`)
      error.code = 'E_ROUTER_INVALID_ROUTE'
      throw error
    }

    const routeType = Object.prototype.toString.call(route)

    if(routeType !== '[object Object]')
    {
      const error = new TypeError(`Expecting route "${id}" to be type [object Object]`)
      error.code  = 'E_ROUTER_INVALID_ROUTE'
      error.cause = new TypeError(`Invalid route type "${routeType}"`)
      throw error
    }

    const routeCriteriaType = Object.prototype.toString.call(route.criteria)

    if(routeCriteriaType !== '[object String]')
    {
      const error = new TypeError(`Expecting route "${id}" to have a "criteria" property of type [object String]`)
      error.code  = 'E_ROUTER_INVALID_ROUTE'
      error.cause = new TypeError(`Invalid route criteria type "${routeCriteriaType}"`)
      throw error
    }

    route = deepclone(route)
    route.middleware = this.#normalizeMiddleware(route.middleware)
    const regexp = this.#composeRouteRegExp(route.criteria, route.separators ?? separators)
    super.set(id, { route, regexp })
  }

  /**
   * @param {Object} event The event to dispatch.
   * @param {string} event.criteria The event criteria to match against routes.
   * @param {Object} [meta] Optional contextual space.
   * 
   * @returns {Promise} A promise that resolves when the event has been dispatched.
   */
  dispatch(event, meta)
  {
    return new Promise(async(resolve, reject) =>
    {
      meta = this.#normalizeMeta(meta)

      try
      {
        for(const [id, { route, regexp }] of this.entries())
        {
          const match = event.criteria.match(regexp)
    
          if(match)
          {
            const param = match.groups ?? {}
            deepassign(event, { param })
            deepassign(meta,  { route }, { route:{ trace:[id] } })

            if('dispatcher' in route)
            {
              break
            }
          }
        }

        await this.#dispatchChain(event, meta, resolve)
      }
      catch(reason)
      {
        const error = new Error(`Failed to dispatch ${event.criteria}`)
        error.code  = 'E_ROUTER_DISPATCH_FAILED'
        error.cause = reason
        reject(error)
      }
    })
  }

  async #dispatchChain(event, meta, resolve)
  {
    if(false === !!meta.route.dispatcher)
    {
      const error = new Error(`No dispatcher found for ${event.criteria}`)
      error.code  = 'E_ROUTER_DISPATCH_NO_DISPATCHER'
      error.cause = meta.route.trace
                  ? `No dispatcher found in any of the matched routers: ${meta.route.trace.join(' → ')}`
                  : `No router matched the criteria`

      throw error
    }

    const
      chain       = { index:0 },
      dispatchers = meta.route.dispatcher
                  ? meta.route.middleware.concat(meta.route.dispatcher)
                  : meta.route.middleware,
      iterator    = dispatchers[Symbol.iterator](),
      next        = this.#dispatchChainNext.bind(this, event, meta)

    // Define the meta chain as non-enumerable and non-configurable to prevent unexpected behaviour.
    Object.defineProperty(meta,  'chain',       { value:chain })
    Object.defineProperty(chain, 'next',        { value:next })
    Object.defineProperty(chain, 'dispatchers', { value:dispatchers })
    Object.defineProperty(chain, 'iterator',    { value:iterator })

    // Will dispatch the dispatcher chain.
    await this.#dispatchChainNext(event, meta)

    resolve(meta)
  }

  async #dispatchChainNext(event, meta)
  {
    const iteration = meta.chain.iterator.next()

    if(false === !!iteration.done)
    {
      // Will dispatch the dispatcher chain: middleware dispatcher(s) + endpoint dispatcher.
      // This loop ensures the full chain is dispatched, when a middleware is calling the 
      // next dispatcher to be dispatched, or when they do not...
      do
      {
        if(meta.abortion.signal.aborted)
        {
          break
        }
        else
        {
          await this.#dispatchDispatcher(iteration.value, event, meta)
        }
      }
      while(await this.#dispatchChainNext(event, meta))
    }
  }

  async #dispatchDispatcher(dispatcher, event, meta)
  {
    if(false === meta.abortion.signal.aborted)
    {
      dispatcher = this.locate(dispatcher)

      try
      {
        meta.chain.index++
        await dispatcher.dispatch(event, meta)
      }
      catch(reason)
      {
        if('onError' in dispatcher)
        {
          await dispatcher.onError(reason, event, meta)
        }
        else
        {
          throw reason
        }
      }
    }
  }

  /**
   * Normalises and validates the expected meta object, with expected properties.
   * @param {Object|undefined} meta 
   * @returns {Object} the input meta argument or a new created meta object, if
   * the input argument was not defined.
   */
  #normalizeMeta(meta)
  {
    if('object' !== typeof meta)
    {
      meta = {}
    }

    if('object' !== typeof meta.route)
    {
      meta.route = {}
    }

    meta.route.middleware = this.#normalizeMiddleware(meta.route.middleware)

    if('undefined' === typeof meta.abortion)
    {
      meta.abortion = new AbortController
      meta.abortion.signal.onabort = () => 
      {
        const error = new Error('Unable to dispatch')
        error.code  = 'E_ROUTER_DISPATCH_ERROR'
        error.cause = meta.abortion.signal.reason
        console.error(error)
      }
    }

    if(meta.abortion instanceof AbortController)
    {
      return meta
    }
    else
    {
      const metaAbortionType = Object.prototype.toString.call(meta.abortion)
      const error = new TypeError('Expecting meta.abortion to be an instance of AbortController')
      error.code  = 'E_ROUTER_INVALID_META_ABORTION_TYPE'
      error.cause = new TypeError(`Invalid meta.abortion type "${metaAbortionType}"`)
      throw error
    }
  }

  #normalizeMiddleware(middleware)
  {
    const middlewareType = Object.prototype.toString.call(middleware)

    switch(middlewareType)
    {
      case '[object Array]': 
      {
        if(middleware.some((dispatcher) => 'string' !== typeof dispatcher))
        {
          const error = new TypeError(`Expected middleware property to be an array of strings`)
          error.code  = 'E_ROUTER_INVALID_MIDDLEWARE_TYPE'
          error.cause = new TypeError(`Every middleware dispatcher in the route must be a string`)
          throw error
        }

        return middleware
      }
      case '[object Undefined]' : return this.#normalizeMiddleware([])
      case '[object String]'    : return this.#normalizeMiddleware([ middleware ])
      case '[object Object]'    : return Object.values(middleware).filter(Boolean)
      default:
      {
        const error = new TypeError(`Expected middleware property to be an array of strings`)
        error.code  = 'E_ROUTER_INVALID_MIDDLEWARE_TYPE'
        error.cause = new TypeError(`Invalid middleware type "${middlewareType}"`)
        throw error
      }
    }
  }

  #composeRouteRegExp(criteria, separators)
  {
    separators = separators ?? '/'

    const
      segments        = criteria.split(new RegExp(`[${separators}]+`)),
      mappedSegments  = segments.map(this.#mapRouteRegExpArgs.bind(this, separators)),
      regexpString    = mappedSegments.join(`[${separators}]+`),
      regexp          = new RegExp(`^${regexpString}$`)

    return regexp
  }

  #mapRouteRegExpArgs(separators, segment)
  {
    if(segment.startsWith(':'))
    {
      // convert ":key" to a named capture group 
      // ... that matches any characters except separators
      return `(?<${segment.slice(1)}>[^${separators}]+)`
    }
    else if(segment.includes('*')) 
    {
      // wildcard matches any characters except separators
      return segment.replaceAll('*', `[^${separators}]+`)
    }
    else
    {
      // else match the static segment literally
      return segment.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    }
  }
}