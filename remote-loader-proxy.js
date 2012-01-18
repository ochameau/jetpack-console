
// Make a synchronous call to addon process in order to request'n retrieve
// a value synchronously.
let {Ci, Cc} = require("chrome");
let threadManager = Cc["@mozilla.org/thread-manager;1"].
                    getService(Ci.nsIThreadManager);
let msgcount = 0;
function sync(channel, obj) {
  let noResponse = {};
  let response = noResponse;
  let msgid = msgcount++;
  obj.msgid = msgid;
  console.log(">> "+JSON.stringify(obj));
  channel.input(function (message) {
    console.log("<< "+JSON.stringify(message));
    if (message.msgid == msgid) {
      response = message.rv;
      // return false in order to unregister this stream listener
      return false;
    }
    return true;
  });
  channel.output(obj);
  let thread = threadManager.currentThread;
  while (response === noResponse)
    thread.processNextEvent(true);
  return response;
}

// Build a proxy for a remote object
// - registry: WeakMaps used to avoid leaking proxies, and,
//                           to get matching id for a given proxy
// - id: id of the remote object
// - kind: type of object, "object" or "function"
function proxyForRemote(registry, channel, id, kind) {
  // Already created
  if (id in registry.keysHack && registry.proxies.has(registry.keysHack[id]))
    return registry.proxies.get(registry.keysHack[id]);

  function encode(v) {
    if (["object", "function"].indexOf(typeof v) != -1 &&
        registry.ids.has(v)) {
      return {
        type: "remote",
        id: registry.ids.get(v)
      };
    }
    return {
      type: "primitive",
      val: v
    };
  }
  function decode(v) {
    if (v.type == "primitive")
      return v.val;
    else if (v.type == "remote")
      return proxyForRemote(registry, channel, v.id, v.kind);
    return null;
  }

  let handler = {
    get: function(receiver, attribute) {
      return decode(sync(channel, {method: "GET", id: id, attribute: attribute}));
    },
    set: function(receiver, attribute, val) {
      let v = encode(val);
      sync(channel, {method: "SET", id: id, attribute: attribute, val: v});
      return val;
    },
    delete: function(attribute) {
      sync(channel, {method: "DELETE", id: id, attribute: attribute});
      return true;
    },
    has: function(attribute) {
      return attribute === "___proxy_id___" || 
             sync(channel, {method: "HAS", id: id, attribute: attribute});
    },
    keys: function () {
      return sync(channel, {method: "KEYS", id: id});
    },
    enumerate: function () {
      return sync(channel, {method: "ENUMERATE", id: id});
    }
  }
  
  let proxy = null;
  if (kind == "object") {
    proxy = Proxy.create(handler);
  }
  else if (kind == "function") {
    proxy = Proxy.createFunction(handler, function () {
      let args = Array.slice(arguments);
      args = args.map(encode);
      return decode(sync(channel, {method: "CALL", id: id, args: args}));
    });
  }
  
  // We can't store strings as WeakMap's keys
  // So instead of leaking all proxies, leak only a simplest object.
  // We use two weakmaps:
  //  1) proxies: store proxies indexed by empty object `key`
  //  2) ids: store ids of all proxies so that we do not have to store `id`
  //          on the proxy itself.
  let key = {};
  registry.keysHack[id] = key;
  registry.proxies.set(key, proxy);
  registry.ids.set(proxy, id);
  return proxy;
}

exports.get = function get(loader) {
  // 1) Ensure that this module is able to load the remote proxy part
  if (false)
    require("addon-proxy-part");
  // 2) Then we:
  //   - instanciate yet another Loader instance with our manifest.
  //   We can't use the existing loader instance because its manifest won't
  //   contain any reference to our `addon-proxy-part` module.
  //   - Fake a require call from this module
  //   - Pass a reference of the existing loader instance of the targeted addon
  //   in order to register it as object with id `0`
  let packaging = require("@packaging");
  let js = 
    'Loader.require.call(Loader.new(' + JSON.stringify(packaging) + '), ' +
    '                    "' + module.path + '", ' +
    '                    "addon-proxy-part").setLoader(loader);';
  loader.addon.loadScript('data:,' + encodeURI(js));
  
  let channel = loader.addon.channel("loader-proxy");
  let registry = {
    proxies: new WeakMap(),
    ids: new WeakMap(),
    keysHack: {}
  }
  return proxyForRemote(registry, channel, 0, "object");
}
