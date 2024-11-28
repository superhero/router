# Router

A flexible router (NodeJS module) for dispatching events based on defined routes and middleware chains. Built to handle wildcard routing logic, with support for middleware, dispatchers, and error management.

## Features

- **Routing**: Define routes with criteria, middleware, and dispatchers.
- **Middleware Chain**: Supports upstream, dispatcher, and downstream middleware.
- **Event Dispatching**: Dispatch events with route matching and parameter extraction.
- **Abort Signal Handling**: Gracefully abort dispatch chains using `AbortController`.
- **Error Management**: Custom error codes and handling for common routing issues.

---

## Installation

```bash
npm install @superhero/router
```

---

## Usage

### Basic Setup

```javascript
import Router     from '@superhero/router'
import { Locate } from '@superhero/locator'

const locator = new Locate()
const router  = new Router(locator)

// Define a route
router.set('exampleRoute', {
  criteria   : '/example/:id',
  dispatcher : 'exampleDispatcher',
})

// Add a dispatcher
locator.set('exampleDispatcher', {
  dispatch: (event) => console.log(`Event dispatched with ID: ${event.param.id}`),
})

// Dispatch an event
router.dispatch({ criteria: '/example/123' })
```

---

## API

### `Router(locator)`
Creates a new router instance.

- `locator`: An instance of `Locate`, or any callable function, for resolving middleware and dispatchers (service locator).

### `set(id, route, separators?)`
Adds a single route.

- `id`: Unique identifier for the route.
- `route`: Object containing route configuration (`criteria`, `middleware`, `dispatcher`).
- `separators`: Optional custom separators for the route.

### `setRoutes(routesMap, separators?)`
Adds multiple routes.

- `routesMap`: Object mapping route IDs to route configurations.
- `separators`: Optional custom separators.

### `dispatch(event, meta?)`
Dispatches an event to the matching route.

- `event`: Object with a `criteria` property to match against route criteria.
- `meta`: Optional metadata object for contextual dispatch.

---

## Route Configuration

Each route can have the following properties:

- `criteria` (String): The route's matching pattern (e.g., `/example/:id`).
- `middleware` (Array/String): Middleware chain for the route.
- `dispatcher` (String): The final handler for the route.

---

## Middleware Example

```javascript
// Middleware example
locator.set('logMiddleware', {
  dispatch: (event, meta) => {
    console.log('Logging event:', event.criteria)
    meta.timestamp = Date.now()
  },
})

// Dispatcher example
locator.set('exampleDispatcher', {
  dispatch: (event, meta) => {
    console.log(`Handled event for ID: ${event.param.id}`)
    console.log(`Dispatched at: ${new Date(meta.timestamp).toISOString()}`)
  },
})

// Route with middleware
router.set('exampleRoute', {
  criteria: '/example/:id',
  middleware: ['logMiddleware'],
  dispatcher: 'exampleDispatcher',
})
```

---

## Abortion Example

You can abort the dispatch chain using an `AbortController`.

```javascript
const meta = {}
meta.abortion = new AbortController()

// Abort the dispatch
meta.abortion.abort('Aborted intentionally')

// Dispatching
await router.dispatch({ criteria: '/example/123' }, meta).catch((err) => {
  console.error('Dispatch aborted:', err.message)
})
```

---

## Error Handling

Errors are handled using custom error codes. Examples:

- `E_ROUTER_INVALID_ROUTE`: Invalid route configuration.
- `E_ROUTER_DISPATCH_EVENT_FAILED`: Event dispatch failure.
- `E_ROUTER_INVALID_ROUTES_TYPE`: Routes map must be an object.

You can also handle dispatcher-specific errors with `onError`.

```javascript
locator.set('errorHandlingDispatcher', {
  dispatch: () => {
    throw new Error('An error occurred')
  },
  onError: (error, event, meta) => {
    console.error('Error handled gracefully:', error.message)
  },
})
```

---

## Dispatching

### Middleware Chain Dispatch
Routes can define middleware chains that run sequentially before reaching the dispatcher.

```javascript
router.set('advancedRoute', {
  criteria: '/advanced/:id',
  middleware: ['authMiddleware', 'logMiddleware'],
  dispatcher: 'exampleDispatcher',
})
```

### Dynamic Parameters
Extract path parameters from route criteria.

```javascript
router.set('dynamicRoute', {
  criteria: '/user/:userId',
  dispatcher: 'userDispatcher',
})

locator.set('userDispatcher', {
  dispatch: (event) => {
    console.log(`User ID: ${event.param.userId}`)
  },
})

router.dispatch({ criteria: '/user/42' })
```

---

## Tests

The library includes a test suite using `node:test`. Run tests using:

```bash
npm test
```

### Test Coverage

```
▶ @superhero/router
  ✔ Can set valid routes (2.480133ms)
  ✔ Can dispatch events using a matching route (1.676816ms)
  ✔ Can set a valid route (0.218964ms)
  ✔ Can manage error in the dispatcher (0.853868ms)

  ▶ Can dispatch events using a dispatcher chain of middlewares
    ✔ Can dispatch chain of middlewares defined in a single route (0.988484ms)
    ✔ Can dispatch the chain defined in different routes (2.944546ms)
  ✔ Can dispatch events using a dispatcher chain of middlewares (4.180505ms)

  ▶ Can abort dispatch correctly
    ✔ Aborts dispatch when meta.abortion.signal.aborted is true (0.583486ms)
    ✔ Does not abort dispatch when meta.abortion.signal.aborted is false (0.512581ms)
    ✔ Lazy loads meta.abortion when not set (0.386175ms)
  ✔ Can abort dispatch correctly (2.257295ms)

  ✔ Will not set false routes (0.20775ms)
  ✔ Will delete routes defined by false (0.214544ms)
  ✔ Throw an error if invalid routes map type is attempted to be set (0.613467ms)
  ✔ Throw an error when setting a duplicate route id (1.207039ms)
  ✔ Throw an error when an invalid route type set (0.21369ms)
  ✔ Throw an error when setting a route with a missing criteria (0.151642ms)
  ✔ Throw an error when dispatching an event with no matching routes (0.541608ms)
  ✔ Rejects when dispatching a dispatcher that throws (0.526658ms)
✔ @superhero/router (17.88466ms)

tests 18
suites 2
pass 18

--------------------------------------------------------------------------------
file            | line % | branch % | funcs % | uncovered lines
--------------------------------------------------------------------------------
index.js        |  92.11 |    89.66 |   93.33 | 232-237 244-251 264-268 276-281
index.test.js   | 100.00 |   100.00 |  100.00 | 
--------------------------------------------------------------------------------
all files       |  96.28 |    93.94 |   98.18 | 
--------------------------------------------------------------------------------
```

---

## License
This project is licensed under the MIT License.

---

## Contributing
Feel free to submit issues or pull requests for improvements or additional features.
