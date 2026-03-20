/**
 * Async Handler Wrapper
 * Eliminates repetitive try/catch blocks in async route handlers
 */

/**
 * Wrap async route handlers to automatically catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getUsers();
 *   res.json(success('Users fetched', { users }));
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wrap multiple async handlers at once
 * @param {...Function} fns - Async functions to wrap
 * @returns {Array<Function>} Array of Express middlewares
 * 
 * @example
 * router.get('/users', ...asyncHandlers(
 *   authenticate,
 *   (req, res) => userService.getUsers()
 * ));
 */
const asyncHandlers = (...fns) => {
  return fns.map(fn => asyncHandler(fn));
};

/**
 * Wrap all methods in a controller object
 * @param {Object} controller - Controller with async methods
 * @returns {Object} Controller with wrapped methods
 * 
 * @example
 * const userController = wrapController({
 *   async getUsers(req, res) { ... },
 *   async createUser(req, res) { ... }
 * });
 */
const wrapController = (controller) => {
  const wrapped = {};
  
  for (const [key, fn] of Object.entries(controller)) {
    if (typeof fn === 'function') {
      wrapped[key] = asyncHandler(fn.bind(controller));
    } else {
      wrapped[key] = fn;
    }
  }
  
  return wrapped;
};

/**
 * Wrap all route handlers in a router
 * @param {express.Router} router - Express router
 * @returns {express.Router} Router with wrapped handlers
 */
const wrapRouter = (router) => {
  const originalRoute = router.route.bind(router);
  
  router.route = function(path) {
    const route = originalRoute(path);
    
    // Wrap HTTP method handlers
    ['get', 'post', 'put', 'patch', 'delete'].forEach(method => {
      const original = route[method].bind(route);
      
      route[method] = function(...handlers) {
        const wrapped = handlers.map(h => 
          typeof h === 'function' && h.constructor.name === 'AsyncFunction'
            ? asyncHandler(h)
            : h
        );
        return original(...wrapped);
      };
    });
    
    return route;
  };
  
  return router;
};

module.exports = {
  asyncHandler,
  asyncHandlers,
  wrapController,
  wrapRouter
};
