
/**
* Create a Blob containing JSON-serialized data.
* Useful for easily creating JSON fetch request bodies.
*
* @param body The object to be serialized to JSON.
* @returns A Blob containing the JSON serialized body.
*/
export function json(body: any): Blob {
  return new Blob([JSON.stringify((body !== undefined ? body : {}))], { type: 'application/json' });
}

/* eslint-disable */

/**
* Interceptors can process requests before they are sent, and responses
* before they are returned to callers.
*/
interface Interceptor {
  /**
  * Called with the request before it is sent. Request interceptors can modify and
  * return the request, or return a new one to be sent. If desired, the interceptor
  * may return a Response in order to short-circuit the HTTP request itself.
  *
  * @param request The request to be sent.
  * @returns The existing request, a new request or a response; or a Promise for any of these.
  */
  request?: (request: Request) => Request|Response|Promise<Request|Response>;

  /**
  * Handles errors generated by previous request interceptors. This function acts
  * as a Promise rejection handler. It may rethrow the error to propagate the
  * failure, or return a new Request or Response to recover.
  *
  * @param error The rejection value from the previous interceptor.
  * @returns The existing request, a new request or a response; or a Promise for any of these.
  */
  requestError?: (error: any) => Request|Response|Promise<Request|Response>;

  /**
  * Called with the response after it is received. Response interceptors can modify
  * and return the Response, or create a new one to be returned to the caller.
  *
  * @param response The response.
  * @returns The response; or a Promise for one.
  */
  response?: (response: Response, request?: Request) => Response|Promise<Response>;

  /**
   * Handles fetch errors and errors generated by previous interceptors. This
   * function acts as a Promise rejection handler. It may rethrow the error
   * to propagate the failure, or return a new Response to recover.
   *
   * @param error The rejection value from the fetch request or from a
   * previous interceptor.
   * @returns The response; or a Promise for one.
   */
  responseError?: (error: any, request?: Request) => Response|Promise<Response>;
}

/**
* The init object used to initialize a fetch Request.
* See https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
*/
interface RequestInit {
  /**
  * The request method, e.g., GET, POST.
  */
  method?: string;

  /**
  * Any headers you want to add to your request, contained within a Headers object or an object literal with ByteString values.
  */
  headers?: Headers|Object;

  /**
  * Any body that you want to add to your request: this can be a Blob, BufferSource, FormData, URLSearchParams, or USVString object. Note that a request using the GET or HEAD method cannot have a body.
  */
  body?: Blob|BufferSource|FormData|URLSearchParams|string;

  /**
  * The mode you want to use for the request, e.g., cors, no-cors, same-origin, or navigate. The default is cors. In Chrome the default is no-cors before Chrome 47 and same-origin starting with Chrome 47.
  */
  mode?: string;

  /**
  * The request credentials you want to use for the request: omit, same-origin, or include. The default is omit. In Chrome the default is same-origin before Chrome 47 and include starting with Chrome 47.
  */
  credentials?: string;

  /**
  * The cache mode you want to use for the request: default, no-store, reload, no-cache, or force-cache.
  */
  cache?: string;

  /**
  * The redirect mode to use: follow, error, or manual. In Chrome the default is follow before Chrome 47 and manual starting with Chrome 47.
  */
  redirect?: string;

  /**
  * A USVString specifying no-referrer, client, or a URL. The default is client.
  */
  referrer?: string;

  /**
  * Contains the subresource integrity value of the request (e.g., sha256-BpfBw7ivV8q2jLiT13fxDYAe2tJllusRSZ273h2nFSE=).
  */
  integrity?: string;
}

/**
* A class for configuring HttpClients.
*/
export class HttpClientConfiguration {
  /**
  * The base URL to be prepended to each Request's url before sending.
  */
  baseUrl: string = '';

  /**
  * Default values to apply to init objects when creating Requests. Note that
  * defaults cannot be applied when Request objects are manually created because
  * Request provides its own defaults and discards the original init object.
  * See also https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
  */
  defaults: RequestInit = {};

  /**
  * Interceptors to be added to the HttpClient.
  */
  interceptors: Interceptor[] = [];

  /**
  * Sets the baseUrl.
  *
  * @param baseUrl The base URL.
  * @returns The chainable instance of this configuration object.
  * @chainable
  */
  withBaseUrl(baseUrl: string): HttpClientConfiguration {
    this.baseUrl = baseUrl;
    return this;
  }

  /**
  * Sets the defaults.
  *
  * @param defaults The defaults.
  * @returns The chainable instance of this configuration object.
  * @chainable
  */
  withDefaults(defaults: RequestInit): HttpClientConfiguration {
    this.defaults = defaults;
    return this;
  }

  /**
  * Adds an interceptor to be run on all requests or responses.
  *
  * @param interceptor An object with request, requestError,
  * response, or responseError methods. request and requestError act as
  * resolve and reject handlers for the Request before it is sent.
  * response and responseError act as resolve and reject handlers for
  * the Response after it has been received.
  * @returns The chainable instance of this configuration object.
  * @chainable
  */
  withInterceptor(interceptor: Interceptor): HttpClientConfiguration {
    this.interceptors.push(interceptor);
    return this;
  }

  /**
  * Applies a configuration that addresses common application needs, including
  * configuring same-origin credentials, and using rejectErrorResponses.
  * @returns The chainable instance of this configuration object.
  * @chainable
  */
  useStandardConfiguration(): HttpClientConfiguration {
    let standardConfig = { credentials: 'same-origin' };
    Object.assign(this.defaults, standardConfig, this.defaults);
    return this.rejectErrorResponses();
  }

  /**
  * Causes Responses whose status codes fall outside the range 200-299 to reject.
  * The fetch API only rejects on network errors or other conditions that prevent
  * the request from completing, meaning consumers must inspect Response.ok in the
  * Promise continuation to determine if the server responded with a success code.
  * This method adds a response interceptor that causes Responses with error codes
  * to be rejected, which is common behavior in HTTP client libraries.
  * @returns The chainable instance of this configuration object.
  * @chainable
  */
  rejectErrorResponses(): HttpClientConfiguration {
    return this.withInterceptor({ response: rejectOnError });
  }
}

function rejectOnError(response) {
  if (!response.ok) {
    throw response;
  }

  return response;
}

/**
* An HTTP client based on the Fetch API.
*/
export class HttpClient {
  /**
  * The current number of active requests.
  * Requests being processed by interceptors are considered active.
  */
  activeRequestCount: number = 0;

  /**
  * Indicates whether or not the client is currently making one or more requests.
  */
  isRequesting: boolean = false;

  /**
  * Indicates whether or not the client has been configured.
  */
  isConfigured: boolean = false;

  /**
  * The base URL set by the config.
  */
  baseUrl: string = '';

  /**
  * The default request init to merge with values specified at request time.
  */
  defaults: RequestInit = null;

  /**
  * The interceptors to be run during requests.
  */
  interceptors: Interceptor[] = [];

  /**
  * Creates an instance of HttpClient.
  */
  constructor() {
    if (typeof fetch === 'undefined') {
      throw new Error('HttpClient requires a Fetch API implementation, but the current environment doesn\'t support it. You may need to load a polyfill such as https://github.com/github/fetch.');
    }
  }

  /**
  * Configure this client with default settings to be used by all requests.
  *
  * @param config A configuration object, or a function that takes a config
  * object and configures it.
  * @returns The chainable instance of this HttpClient.
  * @chainable
  */
  configure(config: RequestInit|(config: HttpClientConfiguration) => void|HttpClientConfiguration): HttpClient {
    let normalizedConfig;

    if (typeof config === 'object') {
      normalizedConfig = { defaults: config };
    } else if (typeof config === 'function') {
      normalizedConfig = new HttpClientConfiguration();
      normalizedConfig.baseUrl = this.baseUrl;
      normalizedConfig.defaults = Object.assign({}, this.defaults);
      normalizedConfig.interceptors = this.interceptors;

      let c = config(normalizedConfig);
      if (HttpClientConfiguration.prototype.isPrototypeOf(c)) {
        normalizedConfig = c;
      }
    } else {
      throw new Error('invalid config');
    }

    let defaults = normalizedConfig.defaults;
    if (defaults && Headers.prototype.isPrototypeOf(defaults.headers)) {
      // Headers instances are not iterable in all browsers. Require a plain
      // object here to allow default headers to be merged into request headers.
      throw new Error('Default headers must be a plain object.');
    }

    this.baseUrl = normalizedConfig.baseUrl;
    this.defaults = defaults;
    this.interceptors = normalizedConfig.interceptors || [];
    this.isConfigured = true;

    return this;
  }

  /**
  * Starts the process of fetching a resource. Default configuration parameters
  * will be applied to the Request. The constructed Request will be passed to
  * registered request interceptors before being sent. The Response will be passed
  * to registered Response interceptors before it is returned.
  *
  * See also https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
  *
  * @param input The resource that you wish to fetch. Either a
  * Request object, or a string containing the URL of the resource.
  * @param init An options object containing settings to be applied to
  * the Request.
  * @returns A Promise for the Response from the fetch request.
  */
  fetch(input: Request|string, init?: RequestInit): Promise<Response> {
    this::trackRequestStart();

    let request = Promise.resolve().then(() => this::buildRequest(input, init, this.defaults));
    let promise = processRequest(request, this.interceptors)
      .then(result => {
        let response = null;

        if (Response.prototype.isPrototypeOf(result)) {
          response = result;
        } else if (Request.prototype.isPrototypeOf(result)) {
          request = Promise.resolve(result);
          response = fetch(result);
        } else {
          throw new Error(`An invalid result was returned by the interceptor chain. Expected a Request or Response instance, but got [${result}]`);
        }

        return request.then(_request => processResponse(response, this.interceptors, _request));
      });

    return this::trackRequestEndWith(promise);
  }
}

const absoluteUrlRegexp = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

function trackRequestStart() {
  this.isRequesting = !!(++this.activeRequestCount);
}

function trackRequestEnd() {
  this.isRequesting = !!(--this.activeRequestCount);
}

function trackRequestEndWith(promise) {
  let handle = this::trackRequestEnd;
  promise.then(handle, handle);
  return promise;
}

function parseHeaderValues(headers) {
  let parsedHeaders = {};
  for (let name in headers || {}) {
    if (headers.hasOwnProperty(name)) {
      parsedHeaders[name] = (typeof headers[name] === 'function') ? headers[name]() : headers[name];
    }
  }
  return parsedHeaders;
}

function buildRequest(input, init) {
  let defaults = this.defaults || {};
  let request;
  let body;
  let requestContentType;

  let parsedDefaultHeaders = parseHeaderValues(defaults.headers);
  if (Request.prototype.isPrototypeOf(input)) {
    request = input;
    requestContentType = new Headers(request.headers).get('Content-Type');
  } else {
    init || (init = {});
    body = init.body;
    let bodyObj = body ? { body } : null;
    let requestInit = Object.assign({}, defaults, { headers: {} }, init, bodyObj);
    requestContentType = new Headers(requestInit.headers).get('Content-Type');
    request = new Request(getRequestUrl(this.baseUrl, input), requestInit);
  }
  if (!requestContentType && new Headers(parsedDefaultHeaders).has('content-type')) {
    request.headers.set('Content-Type', new Headers(parsedDefaultHeaders).get('content-type'));
  }
  setDefaultHeaders(request.headers, parsedDefaultHeaders);
  if (body && Blob.prototype.isPrototypeOf(body) && body.type) {
    // work around bug in IE & Edge where the Blob type is ignored in the request
    // https://connect.microsoft.com/IE/feedback/details/2136163
    request.headers.set('Content-Type', body.type);
  }
  return request;
}

function getRequestUrl(baseUrl, url) {
  if (absoluteUrlRegexp.test(url)) {
    return url;
  }

  return (baseUrl || '') + url;
}

function setDefaultHeaders(headers, defaultHeaders) {
  for (let name in defaultHeaders || {}) {
    if (defaultHeaders.hasOwnProperty(name) && !headers.has(name)) {
      headers.set(name, defaultHeaders[name]);
    }
  }
}

function processRequest(request, interceptors) {
  return applyInterceptors(request, interceptors, 'request', 'requestError');
}

function processResponse(response, interceptors, request) {
  return applyInterceptors(response, interceptors, 'response', 'responseError', request);
}

function applyInterceptors(input, interceptors, successName, errorName, ...interceptorArgs) {
  return (interceptors || [])
    .reduce((chain, interceptor) => {
      let successHandler = interceptor[successName];
      let errorHandler = interceptor[errorName];

      return chain.then(
        successHandler && (value => interceptor::successHandler(value, ...interceptorArgs)) || identity,
        errorHandler && (reason => interceptor::errorHandler(reason, ...interceptorArgs)) || thrower);
    }, Promise.resolve(input));
}

function identity(x) {
  return x;
}

function thrower(x) {
  throw x;
}
