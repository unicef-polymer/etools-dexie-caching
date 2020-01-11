# \<etools-dexie-caching\>

* Handles caching in IndexedDb.
* To use you have to define your Dexie db(s) and endpoints in your app.
* Ability to cache in your app's specific db: `window.EtoolsRequestCacheDb`
* Ability to cache in a db that is shared between etools apps and holds the data that is common to all these apps: `window.EtoolsSharedDb`.

## Data caching requirement

Example of defining the `window.EtoolsRequestCacheDb`:

```javascript
  var appDexieDb = new Dexie('[insert name]');
  appDexieDb.version(1).stores({
    countries: "id, name"
    listsExpireMapTable: "&name, expire",
    ajaxDefaultDataTable: "&cacheKey, data, expire"
  });

  window.EtoolsRequestCacheDb = appDexieDb;
```

Example of defining the `window.EtoolsSharedDb`:
```javascript
  var sharedDexieDb = new Dexie('EtoolsSharedDb');
  sharedDexieDb.version(1).stores({
    collections: "&cacheKey, data, expire"
  });

  window.EtoolsSharedDb = sharedDexieDb;
```


In your app you will configure your cacheable endpoints:
```javascript
const endpoints = {
  {
    url: 'your/api/route',
    exp: 300000, // if exp = 0 no caching will be made
    cachingKey: 'stringIdentifier'
  },
   {
    url: 'your/api/route',
    exp: 300000, // if exp is missing no caching will be made
    sharedDbCachingKey: 'stringIdentifier'
  },
   {
    url: 'your/api/route',
    exp: 300000, // milliseconds expected
    cacheTableName: 'stringIdentifier'
  }
};
```

To mark a request as cacheable you have to set the `exp` property and one of `cachingKey`, `cacheTableName` or `sharedDbCachingKey`.

 Set the `cachingKey` property if you want to cache the endpoint response in the default table `ajaxDefaultDataTable` and 'cachingKey' will be the row identifier used to retrieve the data.
The cached data will have the following format:
```javascript
{
  // cacheKey can have request params stringified in the end if params were provided in sendRequest options
  cacheKey: '[provided cachingKey value]',
  // Date.now() + endpoint.exp
  expire: 1491306589975,
  // request response data
  data: [endpoint response]
}
```
Set the `cacheTableName` property if you do not want to cache in the `ajaxDefaultDataTable` table, but in a separate table with the provided name.
This is recommended if you need to do queries on this table later, like showing a list with pagination and filtering only on frontend side.
The expiration of the data in these tables is stored in the `listsExpireMapTable` table, under the following format, with `name` column being the row identifier:
```javascript
{
  name: '[provided cacheTableName value]',
  // Date.now() + endpoint.exp
  expire: 1491306589975
}
```

Set the  `sharedDbCachingKey` if you want to cache the data in the EtoolsSharedDb, in the default table called `collections` and 'sharedDbCachingKey' will be the row identifier used to retrieve the data.


For info about Dexie.js databases check the [documentation](http://dexie.org/).

### Disable caching

Just set this in your app: `window.EtoolsRequestCacheDisabled = true`


## Install

```bash
$ npm i --save @unicef-polymer/etools-dexie-caching
```

## Usage example
```javascript
if (requestIsCacheable(method, endpoint)) {
    return getFromCache(endpoint)
      .catch(() => {
        return `do http request...`
          .then(response => cacheEndpointResponse(response, endpoint));
      });
  }

  return `do http request...`;
```

## Demo

```
See etools-ajax component (https://github.com/unicef-polymer/etools-ajax) for an example.
```


