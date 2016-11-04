'use strict';

/**
 * Created by umang on 27/10/16.
 */

/**
 * Ranger
 *
 * @module node-service-discovery
 */

var log4js          = require('log4js');
var logger          = log4js.getLogger('Ranger.js');
var util            = require('util');
var EventEmitter    = require('events').EventEmitter;
var async           = require('async');
var zkClient        = require('node-zookeeper-client');
var customErr       = require('custom-error-generator');

// Custom Errors
var ZooKeeperError  = customErr('ZooKeeperError', Error);

// Inherit from EventEmitter
util.inherits(Ranger, EventEmitter);

// Defaults
const DEFAULT_RETRY_COUNT = 5;
const DEFAULT_RETRY_WAIT_MS = 1000;
const DEFAULT_CONNECT_TIMEOUT_MS = 1000;
const DEFAULT_SESSION_TIMEOUT_MS = 10000;

/**
 * @desc Create a Ranger client and initialize with default values
 * https://github.com/alexguan/node-zookeeper-client#client-createclientconnectionstring-options
 *
 * @public
 * @method  newClient
 *
 * @param   connectionString    {String}    Zookeeper connection string
 * @param   retryCount          {Number}    Number of times to retry a connection
 * @param   retryWait           {Number}    Time to wait (ms) before retrying
 * @param   connectTimeout      {Number}    Time in milliseconds before the zk connection times out
 * @param   sessionTimeout      {Number}    Time in milliseconds before the zk session times out
 *
 * @return  data    {Object}    Return the Ranger object
 */
function newClient(connectionString, retryCount, retryWait, connectTimeout, sessionTimeout) {
    var options = {};

    options.retries         = retryCount || DEFAULT_RETRY_COUNT;
    options.spinDelay       = retryWait || DEFAULT_RETRY_WAIT_MS;
    options.connectTimeout  = connectTimeout || DEFAULT_CONNECT_TIMEOUT_MS;
    options.sessionTimeout  = sessionTimeout || DEFAULT_SESSION_TIMEOUT_MS;

    return new Ranger(connectionString, options);
};

/**
 * @desc Ranger constructor
 *
 * @private
 * @constructor Ranger
 *
 * @param       connectionString    {String}    Zookeeper connection string
 * @param       options             {Object}    Connection options
 *
 */
function Ranger(connectionString, options) {
    this.connectionString = connectionString;
    this.options = options;
    this.started = false;
    this.closed = false;
}

/**
 * @desc Check if zookeeper client is connected
 *
 * @public
 * @method isConnected
 */
Ranger.prototype.isConnected = function () {
    return this.client.getState() == zkClient.State.SYNC_CONNECTED;
};

/**
 * @desc Return the ZooKeeper client.
 *
 * @public
 * @method  getZkClient
 */
Ranger.prototype.getZkClient = function () {
    if (!this.isConnected()) {
        throw new ZooKeeperError('Connection Not Established');
    }

    return this.client;
};

/**
 * Start the Ranger framework.
 *
 * @public
 * @method start
 */
Ranger.prototype.start = function () {
    var self = this;

    this.client = null;
    this.client = zkClient.createClient(this.connectionString, this.options);

    this.client.connect();

    this.client.once('connected', function () {
        self.started = true;
        self.emit('connected');
        logger.info("zkclient connected");
    });

    this.client.once('disconnected', function () {

        self.started = false;
        self.emit('disconnected');
        logger.info("zkclient disconnected");

        if (!self.closed) {
            self.start();
            logger.info("zkclient started again");
        }
    });
};

/**
 * @desc Close the Ranger framework.
 *
 * @public
 * @method close
 */
Ranger.prototype.close = function () {
    this.closed = true;
    this.client.close();
    logger.info("Successfully closed zookeeper connection");
};

module.exports.newClient = newClient;
