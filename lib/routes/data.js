var debug = require('debug')('liftie:data');
var checkNames = require('../checker');
var database = require('./database');
var plugins = require('../plugins');
var loaders = require('../loaders');
var tags = require('./tags');
var stats = require('../lifts/stats');

module.exports = data;

/*global setInterval */


// data structure
function data() {

  var cache = {}, // meta and data for each resort
    db = database(cache),
    my = {};

  function fetchStatus(plugin, fetch, meta, data) {
    debug('Fetch: %s for %s', plugin, meta.id);
    meta.fetchInProgress[plugin] = true;
    fetch(meta, function(err, response) {
      meta.fetchInProgress[plugin] = false;
      meta.counter = 0;
      if (err) {
        // don't update data on error
        console.error('Errors when fetching %s status for:', plugin, data.id, err);
        return;
      }
      data.timestamp[plugin] = Date.now();
      data[plugin] = response;
      db.write(meta.id);
    });
  }

  function fetchStatusAll() {
    var now = Date.now();
    Object.keys(cache).forEach(function(id) {
      var resort = cache[id],
        data = resort.data,
        meta = resort.meta;
      plugins.forEach(function(plugin, fetch) {
        var sinceLastFetch = now - data.timestamp[plugin],
          fetchNow = false;
        if (meta.no && meta.no[plugin]) {
          // debug('Skip fetch: plugin disabled %s - %s', plugin, id);
          return;
        }
        if (meta.fetchInProgress[plugin]) {
          debug('Skip fetch: already in progress %s - %s', plugin, id);
          return;
        }
        if (!resort.meta.counter && !fetch.interval.inactive) {
          // debug('Skip fetch: no inactive timeout configured %s - %s', plugin, id);
          return;
        }
        if (!resort.meta.counter && sinceLastFetch > fetch.interval.inactive) {
          debug('Inactive timeout elapsed: %s - %s', plugin, id);
          // fetch only if it's been really long time
          fetchNow = true;
        } else if (resort.meta.counter && sinceLastFetch > fetch.interval.active) {
          debug('Active timeout elapsed: %s - %s', plugin, id);
          // fetch if it was sufficienly long time and someone is interested in the latest status
          fetchNow = true;
        }
        if (fetchNow) {
          fetchStatus(plugin, fetch, meta, data);
        }
      });
    });
  }

  function initCache(resorts) {
    Object.keys(resorts).forEach(function(id) {
      var info, resort;
      resort = resorts[id];
      info = {
        meta: resort,
        data: {
          id: id,
          name: resort.name,
          href: resort.url.host + resort.url.pathname,
          ll: resort.ll
        }
      };

      info.meta.counter = 0;
      info.meta.id = id;
      info.meta.fetchInProgress = {};
      info.data.timestamp = {};
      plugins.forEach(function(plugin) {
        info.meta.fetchInProgress[plugin] = false;
        info.data.timestamp[plugin] = 0;
      });
      cache[id] = info;
    });
  }

  function prefetch(fn) {
    db.onload(function(count) {
      debug('Found %d resorts in cache', count);
      Object.keys(cache).forEach(db.read);
      fetchStatusAll();
      setInterval(fetchStatusAll, 10 * 1000); // wake 6 times per minute
      fn();
    });
  }

  function getData(requestedNames, fn) {
    var names, result;
    names = checkNames(requestedNames, cache, my.names);
    result = names.map(function(id) {
      var resort = cache[id];
      if (requestedNames) {
        // only increment counter if resort specifically requested
        resort.meta.counter += 1;
      }
      return resort.data;
    });
    process.nextTick(function() {
      fn(null, result);
    });
  }

  function getMeta(fn) {
    var result = my.names.map(function(id) {
      var meta = cache[id].meta;
      return {
        id: meta.id,
        name: meta.name,
        ll: meta.ll
      };
    });
    process.nextTick(function() {
      fn(null, result);
    });
  }

  function getTags() {
    return my.tags;
  }

  function getAll(nofilter) {
    return nofilter ? my.all : my.names;
  }

  function getFiltered(fn) {
    return my.names.filter(function(id) {
      return fn(cache[id].data);
    });
  }

  function getStats(requestedNames) {
    var names = checkNames(requestedNames, cache, my.names);
    return stats.summary(names.map(function(id) {
      var lifts = cache[id].data.lifts;
      return lifts && lifts.stats;
    }));
  }

  function init(fn) {
    // all loaders
    loaders.load(function(err, data) {
      initCache(data);
      my.tags = tags(data);
      my.all = Object.keys(cache);
      my.names = my.all.filter(function(id) {
        return !(data[id].no && data[id].no.lifts);
      });
      prefetch(fn);
    });

  }

  return {
    init: init,
    all: getAll,
    tags: getTags,
    get: getData,
    meta: getMeta,
    filtered: getFiltered,
    stats: getStats
  };
}