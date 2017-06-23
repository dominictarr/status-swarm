var pull = require('pull-stream')

var Swarm = require('../')
var ssbKeys = require('ssb-keys')

var tape = require('tape')

var ak = ssbKeys.generate()
var bk = ssbKeys.generate()
var ck = ssbKeys.generate()
var dk = ssbKeys.generate()

var alice = Swarm(ak)
var bob = Swarm(bk)
var carol = Swarm(ck)
var dan = Swarm(dk)

//because everything in this module is sync,
//testing is quite straightforward.

tape('simple', function (t) {

  var start = Date.now()

  alice.update({foo: true, address: 'here'})

  bob.update({bar: true, address: 'there'})

  console.log(alice.get(ak.id))

  var ary = []
  pull(alice.send(0), pull.drain(function (data) {
    ary.push(data)
  }))

  var ts = ary.pop()
  t.deepEqual(ary, [alice.get(ak.id)])
  t.ok(ts >= start)
  t.end()

})

tape('replicate', function (t) {


  pull(bob.send(0), alice.recv(bk.id))

  t.deepEqual(alice.get(bk.id), bob.get(bk.id))

  bob.update({bar: false, address: 'yonder'})

  t.deepEqual(alice.get(bk.id), bob.get(bk.id))

  t.equal(alice.last(bk.id), bob.last(bk.id))

  //connect bob -> alice -> carol
  pull(alice.send(Date.now()), carol.recv(bk.id))

  t.deepEqual(carol.get(bk.id), undefined)

  bob.update({bar: 1, address: 'thar'})

  t.deepEqual(carol.get(bk.id), bob.get(bk.id))
  t.deepEqual(alice.get(bk.id), bob.get(bk.id))


  t.end()

})

tape('invalid send', function (t) {
  pull(bob.send(-1), pull.collect(function (err) {
    t.ok(err)
    t.end()
  }))
})

tape('invalid recv', function (t) {
  dan.changes(function () {
    t.fail()
  })
  pull(
    pull.values([
      false,
      true,
      [],
      {},
      NaN,
      null,
      -1,
      new Buffer(10),
      'hello',
      'string'

    ]),
    dan.recv(ak.id)
  )
  t.end()
})

