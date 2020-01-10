window.EtoolsSharedDb = new Dexie('EtoolsSharedDb');
window.EtoolsSharedDb.version(1).stores({
  collections: '&cacheKey, data, expire'
});
