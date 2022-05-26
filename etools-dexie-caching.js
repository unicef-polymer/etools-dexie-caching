/* eslint-disable linebreak-style */
import {logWarn, logError} from '@unicef-polymer/etools-behaviors/etools-logging';

const etoolsAjaxCacheDefaultTableName = 'ajaxDefaultDataTable';
const etoolsAjaxCacheListsExpireMapTable = 'listsExpireMapTable';
const sharedDbTableName = 'collections';

const CacheLocations = {
  EtoolsRequestCacheDb: {
    defaultDataTable: etoolsAjaxCacheDefaultTableName,
    specifiedTable: 'specifiedTable'
  },
  EtoolsSharedDb: 'EtoolsSharedDb'
};

/**
 * Get caching info for the current request
 */
function getCachingInfo(endpoint) {
  return {
    url: endpoint.url,
    exp: parseInt(endpoint.exp, 10), // ensure this value is integer
    cacheKey: _getEndpointCacheKey(endpoint),
    cacheTableName: _getCacheTableName(endpoint),
    sharedDbCachingKey: endpoint.sharedDbCachingKey
  };
}

function _getCacheTableName(endpoint) {
  if (endpoint.cacheTableName) {
    return endpoint.cacheTableName;
  }

  if (endpoint.cachingKey) {
    return etoolsAjaxCacheDefaultTableName;
  }

  if (endpoint.sharedDbCachingKey) {
    return sharedDbTableName;
  }

  return '';
}

/**
 *
 * @param {string} method
 * @param {
 *  url: string,
 *  exp?: number,
 *  cacheTableName?: string,
 *  sharedDbCachingKey?: string,
 *  cachingKey?: string,
 * } endpoint
 */
export function requestIsCacheable(method, endpoint) {
  if (window.EtoolsRequestCacheDisabled) {
    return false;
  }
  return (method || 'GET') === 'GET' && _expireTimeWasProvided(endpoint) && dexieDbIsConfigured(endpoint);
}

function _expireTimeWasProvided(endpoint) {
  return endpoint && Object.prototype.hasOwnProperty.call(endpoint, 'exp') && endpoint.exp > 0;
}

function _getEndpointCacheKey(endpoint) {
  let cacheKey = endpoint.url;
  if (_isNonEmptyString(endpoint.cachingKey)) {
    cacheKey = endpoint.cachingKey;
  }
  if (_isNonEmptyObject(endpoint.params)) {
    cacheKey += '_' + JSON.stringify(endpoint.params);
  }
  return cacheKey;
}

function _isNonEmptyString(str) {
  return typeof str === 'string' && str !== '';
}

function _isNonEmptyObject(obj) {
  return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
}

/**
 * window.EtoolsRequestCacheDb should be instance of Dexie
 * cacheTableName and listsExpireMapTable tables should be defined
 */
function dexieDbIsConfigured(endpoint) {
  if (endpoint.sharedDbCachingKey && window.EtoolsSharedDb) {
    return true;
  }
  const cacheTableName = endpoint.cacheTableName || etoolsAjaxCacheDefaultTableName;
  return (!!window.EtoolsRequestCacheDb && // eslint-disable-line
    window.EtoolsRequestCacheDb[etoolsAjaxCacheListsExpireMapTable] &&
    window.EtoolsRequestCacheDb[cacheTableName]
  );
}

/**
 *
 * @returns `ajaxDefaultDataTable` or `EtoolsSharedDb` or `specifiedTable`
 */
function _getCacheLocation(cachingInfo) {
  if (cachingInfo.cacheTableName === etoolsAjaxCacheDefaultTableName) {
    return CacheLocations.EtoolsRequestCacheDb.defaultDataTable;
  } else {
    if (cachingInfo.sharedDbCachingKey) {
      return CacheLocations.EtoolsSharedDb;
    }
    return CacheLocations.EtoolsRequestCacheDb.specifiedTable;
  }
}

function _cacheEndpointDataInSharedDb(dataToCache) {
  return window.EtoolsSharedDb[sharedDbTableName]
    .put(dataToCache)
    .then((result) => {
      return dataToCache.data;
    })
    .catch((error) => {
      logWarn('Failed to add data in EtoolsSharedDb. Data not cached.', 'etools-dexie-caching', error);
      return dataToCache.data;
    });
}

/**
 * Cache data into dexie db default table (etoolsAjaxCacheDefaultTableName)
 */
function _cacheEndpointDataUsingDefaultTable(dataToCache) {
  return window.EtoolsRequestCacheDb[etoolsAjaxCacheDefaultTableName]
    .put(dataToCache)
    .then((result) => {
      // data added in dexie db in default table, return existing data
      return dataToCache.data;
    })
    .catch((error) => {
      // something happened and inserting data in dexie table failed;
      // just log the error and return the existing data(received from server)
      logWarn('Failed to add data in etools-ajax dexie db. Data not cached.', 'etools-dexie-caching', error);
      return dataToCache.data;
    });
}

/**
 * Cache date into specified dexie db table (reqConfig.endpoint.cacheTableName)
 */
function _cacheEndpointDataUsingSpecifiedTable(responseData, cachingInfo) {
  const listsExpireMapTable = window.EtoolsRequestCacheDb[etoolsAjaxCacheListsExpireMapTable];
  const specifiedTable = window.EtoolsRequestCacheDb[cachingInfo.cacheTableName];
  return window.EtoolsRequestCacheDb.transaction('rw', listsExpireMapTable, specifiedTable, () => {
    if (responseData instanceof Array === false) {
      throw new Error('Response data should be array or objects to be ' + 'able to cache it into specified table.');
    }
    // make all add actions using transaction
    // specifiedTable name and expire time for it must be added into listsExpireMapTable
    const listExpireDetails = {
      name: cachingInfo.cacheTableName,
      expire: cachingInfo.exp + Date.now()
    };
    // add list expire mapping details
    listsExpireMapTable.put(listExpireDetails);
    // save bulk data
    specifiedTable.clear().then(() => {
      specifiedTable.bulkAdd(responseData);
    });
  })
    .then((result) => {
      // request response saved into specified table
      // transaction succeeded
      return responseData;
    })
    .catch((error) => {
      // transaction failed
      // just log the error and return the existing data(received from server)
      logWarn(
        'Failed to add data in etools-ajax dexie specified table: ' + cachingInfo.cacheTableName + '. Data not cached.',
        'etools-dexie-caching',
        error
      );
      return responseData;
    });
}

/**
 *
 * @param {any} responseData Data received fromm http request
 * @param {
 *  url: string,
 *  exp?: number,
 *  cacheTableName?: string,
 *  cachingKey?: string,
 *  sharedDbCachingKey?: string
 * } endpoint
 */
export function cacheEndpointResponse(responseData, endpoint) {
  const cachingInfo = getCachingInfo(endpoint);

  switch (_getCacheLocation(cachingInfo)) {
    case CacheLocations.EtoolsRequestCacheDb.defaultDataTable: {
      const dataToCache = {
        cacheKey: cachingInfo.cacheKey,
        data: responseData,
        expire: cachingInfo.exp + Date.now()
      };
      // single object added into default dexie db table
      return _cacheEndpointDataUsingDefaultTable(dataToCache);
    }
    case CacheLocations.EtoolsRequestCacheDb.specifiedTable: {
      // array of objects bulk added into a specified table
      return _cacheEndpointDataUsingSpecifiedTable(responseData, cachingInfo);
    }
    case CacheLocations.EtoolsSharedDb: {
      const dataToCache = {
        cacheKey: cachingInfo.sharedDbCachingKey,
        data: responseData,
        expire: cachingInfo.exp + Date.now()
      };
      return _cacheEndpointDataInSharedDb(dataToCache, cachingInfo);
    }
  }
}

function _isExpiredCachedData(dataExp) {
  // check if we have cached data
  const now = Date.now();
  if (dataExp && dataExp - now > 0) {
    // data did not expired
    return false;
  }
  // data expired
  return true;
}

function _getDataFromDefaultCacheTable(cacheKey) {
  return window.EtoolsRequestCacheDb[etoolsAjaxCacheDefaultTableName]
    .where('cacheKey')
    .equals(cacheKey)
    .toArray()
    .then((result) => {
      if (result.length > 0) {
        // check expired data
        if (!_isExpiredCachedData(result[0].expire)) {
          return result[0].data;
        } else {
          return Promise.reject('Expired data.');
        }
      }
      return Promise.reject('Empty collection');
    })
    .catch((error) => {
      logWarn('Failed to get data from etools-ajax dexie db default caching table.', 'etools-dexie-caching', error);
      return Promise.reject(null);
    });
}

function _getFromSharedDb(cachingKey) {
  return window.EtoolsSharedDb[sharedDbTableName]
    .where('cacheKey')
    .equals(cachingKey)
    .toArray()
    .then((result) => {
      if (result.length > 0) {
        if (!_isExpiredCachedData(result[0].expire)) {
          return result[0].data;
        } else {
          return Promise.reject('Expired data.');
        }
      }
      return Promise.reject('Empty collection');
    })
    .catch((error) => {
      logWarn(
        'Failed to get data from EtoolsSharedDb, table ' + sharedDbTableName + '.',
        'etools-dexie-caching',
        error
      );
      return Promise.reject(null);
    });
}

function _getDataFromSpecifiedCacheTable(cacheTableName) {
  const listsExpireMapTable = window.EtoolsRequestCacheDb[etoolsAjaxCacheListsExpireMapTable];
  const specifiedTable = window.EtoolsRequestCacheDb[cacheTableName];

  return listsExpireMapTable
    .where('name')
    .equals(cacheTableName)
    .toArray()
    .then((result) => {
      if (result.length > 0) {
        if (!_isExpiredCachedData(result[0].expire)) {
          // return table content as array
          return specifiedTable.toArray();
        } else {
          return Promise.reject('Expired data.');
        }
      }
      
      return Promise.reject('Empty collection.');
    })
    .catch((error) => {
      // table not found in list expire map, data read error, other errors
      logWarn(
        'Failed to get data from etools-ajax dexie db specified table: ' + cacheTableName + '.',
        'etools-dexie-caching',
        error
      );
      return Promise.reject(null);
    });
}
/**
 * Retrives cached data from IndexeDb based on the information found on the endpoint parameter
 * @param {
 *  url: string,
 *  exp?: number,
 *  cacheTableName?: string,
 *  cachingKey?: string
 * } endpoint
 */
export function getFromCache(endpoint) {
  const cachingInfo = getCachingInfo(endpoint);

  switch (_getCacheLocation(cachingInfo)) {
    case CacheLocations.EtoolsRequestCacheDb.defaultDataTable: {
      return _getDataFromDefaultCacheTable(cachingInfo.cacheKey);
    }
    case CacheLocations.EtoolsRequestCacheDb.specifiedTable: {
      return _getDataFromSpecifiedCacheTable(cachingInfo.cacheTableName);
    }
    case CacheLocations.EtoolsSharedDb: {
      return _getFromSharedDb(cachingInfo.sharedDbCachingKey);
    }
    default: {
      logError('Could not determine cache location, in order to retrieve cached data.', 'etools-dexie-caching');
    }
  }
}
