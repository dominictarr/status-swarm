var pull = require('pull-stream')
var Notify = require('pull-notify')
var ssbKeys = require('ssb-keys')
var Cat = require('pull-cat')
var timestamp = require('monotonic-timestamp')

module.exports = function (keys) {

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

    if(data[value.id]) {
      if(data[value.id].ts >= value.ts) return 'seen'//no change
    }

    if(!ssbKeys.verifyObj({public: value.id}, value))
      return 'invalid' //signature invalid

    data[value.id] = value
    var ts = local[value.id] = timestamp()

    broadcast(value, ts)
  }

  return {
    get: function (id) {
      return data[id]
    },
    last: function (id) {
      return (id === keys.id ? local[id] : remote[id]) || 0
    },
    update: function (value) {
      var localtime = timestamp()
      var val = data[keys.id] = ssbKeys.signObj(keys, {
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


