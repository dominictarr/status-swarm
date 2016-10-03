# status-swarm

A very simple (secure) replication protocol.

`status-swarm` replicates a single value per node,
where the node's public key is the id, and the value
may be updated, but new values always win.
`status-swarm` is intended for relatively long lived connections.

When reconnecting to a node, overhead is small,
you only send the last time stamp from that peer.

However, you may receive the same message multiple times if connected to
more than one peer, and upon connecting to a new peer for the first time,
you may re-receive messages you have already seen.

``` js


```


## API

### swarm = Swarm(keys)

create a new instance with a given ssb-keys keypair.

### swarm.update(value)

update your status. the value will be wrapped and signed:

``` js
{
  id: <your_id>,
  ts: <localtimestamp>,
  data: <value>,
  signature: <sig>
}
```

### swarm.get(id)

return the current value for this `id` (or `undefined`)

### swarm.last(id)

get the timestamp that you last received something from a given node.
This is _their_ local time, which may be skewed from yours,
but you need to know their time, because you will use this to
request they have received since this time.

### swarm.send(since), swarm.recv(id)

Set up replication between two peers. note that it's _not_ implemented as a duplex stream,
but as a separate source and a sink. This method makes for a more symmetrical protocol.
on connecting, each peer requests the remote's `swarm.send(ts||0)` over [rpc](https://github.com/ssbc/muxrpc)

`send` can be exposed over muxrpc, but `recv` can be a private api.
your code might look something like this:

``` js
//this code should exist on both ends.
sbot.on('rpc:connect', function (rpc) {
  var id = rpc.id
  pull(rpc.send(swarm.last(id)), swarm.recv(id))
})

//advertise your network location, for example.
rpc.update({host: HOST, port: PORT})
```

## TODO

To stop the replication data growing too large, implement filtering (say, filter ids you don't care about)
expire messages that are too old (say, to represent only peers that are online, say within the last few hours)

## License

MIT

