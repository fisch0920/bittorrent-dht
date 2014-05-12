// TODO:
// - Use the same DHT object for looking up multiple torrents
// - Persist the routing table for later bootstrapping
// - Use actual DHT data structure with "buckets" (follow spec)
// - Add the method that allows us to list ourselves in the DHT
// - https://github.com/czzarr/node-bitwise-xor

module.exports = DHT

var dht = require('dht.js')
var hat = require('hat')
var debug = require('debug')('bittorrent-dht')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var portfinder = require('portfinder')

// Use random port above 1024
portfinder.basePort = Math.floor(Math.random() * 60000) + 1025

var BOOTSTRAP_NODES = [
  {
    id: new Buffer('896742165b213ac19f938b55d2cbd0884f05ffef', 'hex'), 
    address: 'dht.transmissionbt.com', 
    port: 6881
  }, 
  {
    id: new Buffer('1dbcec23c6697351ff4aec29cdbaabf2fbe34667', 'hex'), 
    address: 'router.bittorrent.com', 
    port: 6881
  }
  //'router.utorrent.com:6881'
]

inherits(DHT, EventEmitter)

/**
 * Create a new DHT
 * @param {string|Buffer} infoHash
 */
function DHT (opts) {
  if (!(this instanceof DHT)) return new DHT(opts)
  EventEmitter.call(this)

  if (!opts) opts = {}
  if (!opts.nodeId) opts.nodeId = hat(160)

  this.nodeId = typeof opts.nodeId === 'string'
    ? new Buffer(opts.nodeId, 'hex')
    : opts.nodeId
  
  this.listening = false
  this.node = null
}

DHT.prototype.close = function () {
  this.listening = false
  this.node.close()
}

/**
 * Advertises and starts retrieving peers for a new torrent
 * @param {string|Buffer} infoHash
 */
DHT.prototype.addInfoHash = function (infoHash) {
  var infoHash = typeof infoHash === 'string'
    ? new Buffer(infoHash, 'hex')
    : infoHash
  
  if (this.listening) {
    this.node.advertise(infoHash, this.port)
  } else {
    this.once('listening', function () {
      this.node.advertise(infoHash, this.port)
    }.bind(this))
  }
}

DHT.prototype.listen = function (port, onlistening) {
  if (typeof port === 'function') {
    onlistening = port
    port = undefined
  }

  if (onlistening)
    this.once('listening', onlistening)

  var onPort = function (err, port) {
    if (err)
      return this.emit('error', err)
    this.port = port
    
    console.log('PORT:', port)
    this.node = dht.node.create({
      id: this.nodeId, 
      nodes: BOOTSTRAP_NODES, 
      port: port
    })
    
    this.node.on('listening', function () {
      console.log('LISTENING')
      this.listening = true
      this.emit('listening', this.port)
    }.bind(this))
    
    this.node.on('peer:new', function (infoHash, addr) {
      console.log('PEER:NEW')
      this.emit('peer', addr, infoHash.toString('hex'))
    }.bind(this))
  }.bind(this)

  if (port)
    onPort(null, port)
  else
    portfinder.getPort(onPort)
}

