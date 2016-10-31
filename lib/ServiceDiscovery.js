/**
 * Created by umang on 27/10/16.
 */

var log4js = require('log4js');
var logger = log4js.getLogger('ServiceDiscovery.js');
var async = require('async');
var util = require('util');
var CreateMode = require('node-zookeeper-client').CreateMode;
var customErr = require('custom-error-generator');
var EventEmitter = require('events').EventEmitter;

var InstanceProviderBuilder = require('./InstanceProviderBuilder');

var NotFoundError = customErr('NotFoundError', Error);

//Inherit from EventEmitter.
util.inherits(ServiceDiscovery, EventEmitter);

/**
 * ServiceDiscovery constructor
 * @param client
 * @param basePath
 * @param serviceInstance
 * @constructor
 */
function ServiceDiscovery(client, basePath, serviceInstance) {
    this.client = client;
    this.basePath = basePath;
    this.serviceInstance = serviceInstance;
}

/**
 * Register the service in zookeeper
 * @param callback
 */
ServiceDiscovery.prototype.registerService = function (callback) {
    var self = this;

    async.waterfall([
        createServiceBasePath,
        registerService
    ], completed);

    // Create the base service path
    function createServiceBasePath(callback) {
        var servicePath = [self.basePath, self.serviceInstance.name].join('/');

        self.client
            .getZkClient()
            .mkdirp(servicePath, callback);
    }

    // Register the service and create an ephemeral node
    function registerService(path, callback) {
        var data = self.serviceInstance.getData();
        self.data = data;
        var servicePath = [path, data.host + ":" + data.port].join('/');

        self.client
            .getZkClient()
            .transaction()
            .create(servicePath, new Buffer(JSON.stringify(data)), null, CreateMode.EPHEMERAL)
            .commit(callback);
    }

    function completed(err, res) {
        if (err) {
            return callback(err);
        }

        logger.info("Registered service on zookeeper:", JSON.stringify(self.data));
        callback(err, res);
    }
};

/**
 * Unregister a service, mostly for testing as we are creating ephemeral node
 * @param absPath
 * @param callback
 */
ServiceDiscovery.prototype.unRegisterService = function (absPath, callback) {
    this.client
        .getZkClient()
        .transaction()
        .remove(absPath)
        .commit(callback);
};

/**
 * Get data for the service.
 */
ServiceDiscovery.prototype.getData = function () {
    return this.data;
};

/**
 * Build a service provider.
 */
ServiceDiscovery.prototype.instanceProviderBuilder = function () {
    var builder = InstanceProviderBuilder.builder();
    builder.serviceDiscovery(this);
    return builder;
};

/**
 * Get children list for the service
 * @param serviceName
 * @param callback
 */
ServiceDiscovery.prototype.getInstances = function (serviceName, callback) {
    var servicePath = [this.basePath, serviceName].join('/');
    this.client.getZkClient().getChildren(servicePath, null, callback);
};

module.exports = ServiceDiscovery;
