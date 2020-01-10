
type EtoolsEndpoint = {
  url: string,
  exp?: number,
  cacheTableName?: string,
  cachingKey?: string,
  sharedDbCachingKey?: string
}

declare function requestIsCacheable(method: string, endpoint: EtoolsEndpoint): boolean;
declare function cacheEndpointResponse(responseData: any, endpoint: EtoolsEndpoint): Promise<any>;
declare function getFromCache(endpoint: EtoolsEndpoint): Promise<any>;

export {
  requestIsCacheable,
  cacheEndpointResponse,
  getFromCache
}
