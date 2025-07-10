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
      error.cause = `Invalid routes type "${routesType}"`
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
      error.cause = `Invalid route type "${routeType}"`
      throw error
    }

    const routeConditionType = Object.prototype.toString.call(route.condition)

    if(routeConditionType !== '[object String]')
    {
      const error = new TypeError(`Expecting route "${id}" to have a "condition" property of type [object String]`)
      error.code  = 'E_ROUTER_INVALID_ROUTE'
      error.cause = `Invalid route condition type "${routeConditionType}"`
      throw error
    }

    const { dispatcher, middleware, middlewares, ...details } = route
    route = deepclone(details)
    route.conditions  = this.#normalizeConditions(route.conditions)
    route.middlewares = this.#normalizeMiddlewares({ middleware, middlewares })
    route.dispatcher  = dispatcher && this.#normalizeDispatcher(dispatcher)

    const regexp = this.#composeRouteRegExp(route.condition, route.separators ?? route.separator ?? separators)
    super.set(id, { route, regexp })
  }

  /**
   * @param {Object} event The event to dispatch.
   * @param {string} event.condition The event condition to match against routes.
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
          const match = event.condition.match(regexp)
    
          if(match && route.conditions.every(condition => condition.isValid(event, route)))
          {
            const param = match.groups ?? {}
            deepassign(event, { param })
            deepassign(meta,  { route }, { route:{ trace:[id] } })

            if(route.dispatcher)
            {
              break
            }
          }
        }

        await this.#dispatchChain(event, meta, resolve)
      }
      catch(reason)
      {
        const error = new Error(`Failed to dispatch ${event.condition}`)
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
      const error = new Error(`No dispatcher found for ${event.condition}`)
      error.code  = 'E_ROUTER_DISPATCH_NO_DISPATCHER'
      error.cause = meta.route.trace
                  ? `No dispatcher found in any of the matched routers: ${meta.route.trace.join(' → ')}`
                  : `No router matched the condition`

      throw error
    }

    const
      chain       = { index:0 },
      dispatchers = meta.route.middlewares.concat(meta.route.dispatcher),
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
      try
      {
        meta.chain.index++
        dispatcher = this.#normalizeDispatcher(dispatcher)
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

    meta.route.middlewares = this.#normalizeMiddlewares(meta.route)

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
      error.cause = `Invalid meta.abortion type "${metaAbortionType}"`
      throw error
    }
  }

  #normalizeMiddlewares(route)
  {
    const middlewares = [ route.middlewares, route.middleware ].flat().filter(Boolean)
    return middlewares.map(middleware => this.#normalizeDispatcher(middleware))
  }

  #normalizeList(item)
  {
    const itemType = Object.prototype.toString.call(item)

    switch(itemType)
    {
      case '[object Undefined]' : return []
      case '[object String]'    : return this.#normalizeList([ item ])
      case '[object Array]'     : return item.flat()
      default:
      {
        const error = new TypeError(`Expected item property to be an array of strings`)
        error.code  = 'E_ROUTER_NORMALIZE_LIST'
        error.cause = `Invalid item type "${itemType}"`
        throw error
      }
    }
  }

  #normalizeDispatcher(dispatcher)
  {
    let dispatcherName = ''

    if('string' === typeof dispatcher)
    {
      dispatcherName = ` "${dispatcher}"`
      dispatcher = this.locate(dispatcher)
    }

    if('object' !== typeof dispatcher)
    {
      const error = new TypeError(`Expected dispatcher to be an object`)
      error.code  = 'E_ROUTER_NORMALIZE_DISPATCHER_INVALID_TYPE'
      error.cause = `Invalid dispatcher${dispatcherName} type "${Object.prototype.toString.call(dispatcher)}"`
      throw error
    }

    if('function' !== typeof dispatcher.dispatch)
    {
      const error = new TypeError(`Contract expectation failed`)
      error.code  = 'E_ROUTER_NORMALIZE_DISPATCHER_INVALID_CONTRACT'
      error.cause = `Method "dispatch" on dispatcher${dispatcherName} is not a function`
      throw error
    }

    return dispatcher
  }

  #normalizeConditions(conditions)
  {
    conditions = this.#normalizeList(conditions)

    if(conditions.some(condition => 'string' !== typeof condition))
    {
      const error = new TypeError(`Expected conditions to be an array of strings`)
      error.code  = 'E_ROUTER_INVALID_ITEM_TYPE'
      error.cause = `Every item in the conditions must be a string`
      throw error
    }

    return conditions.map(condition => this.#normalizeConditionService(condition))
  }

  #normalizeConditionService(condition)
  {
    let conditionName

    if('string' === typeof condition)
    {
      conditionName = condition
      condition = this.locate(condition)
    }

    if('object' !== typeof condition)
    {
      const error = new TypeError(`Expected condition to be an object`)
      error.code  = 'E_ROUTER_NORMALIZE_CONDITION_INVALID_TYPE'
      error.cause = `Invalid condition type "${Object.prototype.toString.call(condition)}"`
      throw error
    }

    if('function' !== typeof condition.isValid)
    {
      const error = new TypeError(`Contract expectation failed`)
      error.code  = 'E_ROUTER_NORMALIZE_CONDITION_INVALID_CONTRACT'
      error.cause = `Method "isValid" on condition${conditionName ? ` "${conditionName}"` : ''} is not a function`
      throw error
    }

    return condition
  }

  #composeRouteRegExp(condition, separators)
  {
    separators = separators ?? '/'

    const
      segments        = condition.split(new RegExp(`[${separators}]+`)),
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