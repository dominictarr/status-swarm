var pull = require('pull-stream')
var Notify = require('pull-notify')
var ssbKeys = require('ssb-keys')
var Cat = require('pull-cat')
var timestamp = require('monotonic-timestamp')
var ref = require('ssb-ref')
function isObject (o) {
  return o && 'object' == typeof o && !Array.isArray(o) && !Buffer.isBuffer(o)
}

function isPositive(n) {
  return 'number' === typeof n && n >= 0
}

var cap = new Buffer(ssbKeys.hash('A very simple, secure, eventually consistent, replication protocol'), 'base64')

module.exports = function (keys, CAP) {
  CAP = CAP || cap

  var notify = Notify()
  var data = {}  //key->value
  var local = {} //our local time we received a given message.
  var remote = {}  //each remote's localtime
  var listeners = []

  function broadcast(val, localtime) {
    notify(val)
    notify(localtime)
    listeners.forEach(function (l) {
      l(val, localtime)
    })
  }

  function _update (value, id) {
    if('number' === typeof value) {
      remote[id] = Math.max(remote[id] || 0, value)
      return
    }

    if(isObject(value)) {
      if(!isPositive(value.ts) || !ref.isFeed(value.id)) return 'invalid'
      if(data[value.id]) {
        if(data[value.id].ts >= value.ts) return 'seen'//no change
      }

      if(!ssbKeys.verifyObj({public: value.id}, CAP, value))
        return 'unauthorized' //signature invalid

      data[value.id] = value
      var ts = local[value.id] = timestamp()

      broadcast(value, ts)
    }
  }

  return {
    get: function (id) {
      return data[id]
    },
    last: function (id) {
      return (id === keys.id ? local[id] : remote[id]) || 0
    },
    data: function () {
      return data
    },
    update: function (value) {
      var localtime = timestamp()
      var val = data[keys.id] = ssbKeys.signObj(keys, CAP, {
          id: keys.id,
          //statuses for same id with smaller timestamps are ignored.
          ts: localtime,
          data: value
        })
      //special case, for us
      local[keys.id] = localtime
      broadcast(val, localtime)
      return val
    },
    send: function (since) {
      if(isObject(since))
        since = since.since

      if(!isPositive(since)) return pull.error('since: out of bounds')

      var d = []
      for(var k in data) if(local[k] > since) d.push(data[k])
      if(d.length)
        d.push(timestamp()) //also send the localtime.
      return Cat([pull.values(d), notify.listen()])
    },
    recv: function (id) {
      return pull.drain(function (value) {
        _update(value, id)
      })
    },
    changes: function (onChange) {
      listeners.push(onChange)
      return function () {
        var i = listeners.indexOf(onChange)
        if(~i) listeners.splice(i, 1)
      }
    }
  }
}

