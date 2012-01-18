// Remote part of `remote-loader-proxy` module
// This module is loaded by the remote/addon Loader

const { messageManager } = require("chrome");
const { channel } = require("api-utils/channel");

let proxyChannel = channel(messageManager, messageManager, "loader-proxy");

let objects = new WeakMap();
let keys = new WeakMap();
let hackKeys = {};

function encode(v) {
  if (["object", "function"].indexOf(typeof v) != -1) {
    let id = null;
    if (!keys.has(v)) {
      let key = {};
      hackKeys.push(key);
      id = hackKeys.length - 1;
      keys.set(v, id);
      objects.set(key, v);
    }
    return {
      type: "remote",
      kind: typeof v,
      id: keys.get(v)
    };
  }
  else {
    // We got a primitive type that we can serialize:
    return {
      type: "primitive",
      val: v
    };
  }
}

function decode(v) {
  if (v.type == "primitive") {
    return v.val;
  }
  else if (v.type == "remote") {
    return objects[v.id];
  }
}

function processCall({ method, id, attribute, val, args }) {
  // Get the target object from the given id
  let key = hackKeys[id];
  if (!key)
    return null;
  let obj = objects.get(key);
  if (!obj)
    return null;

  if (method == "GET") {
    return encode(obj[attribute]);
  }
  else if (method == "SET") {
    obj[attribute] = decode(val);
    return null;
  }
  else if (method == "DELETE") {
    delete obj[attribute];
    return null;
  }
  else if (method == "HAS") {
    return attribute in obj;
  }
  else if (method == "KEYS") {
    return Object.keys(obj);
  }
  else if (method == "ENUMERATE") {
    let l = [];
    for(let i in obj)
      l.push(i)
    return l;
  }
  else if (method == "CALL") {
    console.log(">>args= "+typeof args+" / "+args.push+" -- "+args.map(decode));
    return encode(obj.apply(null, args.map(decode)));
  }
  return null;
}

proxyChannel.input(function(message) {
  let rv = null;
  try {
    rv = processCall(message);
  }
  catch(e) {
    console.exception(e);
  }
  proxyChannel.output({msgid: message.msgid, rv: rv});
});

exports.setLoader = function (loader) {
  let key = {};
  hackKeys = [key];
  let id = hackKeys.length - 1;
  keys.set(loader, id);
  objects.set(key, loader);
}
