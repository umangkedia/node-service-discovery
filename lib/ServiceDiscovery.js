/**
 * Created by umang on 27/10/16.
 */

var log4js          = require('log4js');
var logger          = log4js.getLogger('ServiceDiscovery.js');
var async           = require('async');
var util            = require('util');
var CreateMode      = require('node-zookeeper-client').CreateMode;
var customErr       = require('custom-error-generator');
var EventEmitter    = require('events').EventEmitter;

var InstanceProviderBuilder = require('./InstanceProviderBuilder');

var NotFoundError   = customErr('NotFoundError', Error);

//Inherit from EventEmitter.
util.inherits(ServiceDiscovery, EventEmitter);

/**
 * ServiceDiscovery constructor
 *
 * @param       client          {Ranger}    A Ranger instance
 * @param       basePath        {String}    Service Base Path on ZK
 * @param       serviceInstance {String}    Concerned Service Instance
 * @param       refreshInterval {number} interval at which data will be fetched from ZK
 * @param       staleNodeTimeDiff {number} time diff b/w last updated timestamp for a node and current time diff
 * @public
 * @constructor ServiceDiscovery
 */
function ServiceDiscovery(client, basePath, serviceInstance, refreshInterval, staleNodeTimeDiff) {
    this.client = client;
    this.basePath = basePath;
    this.serviceInstance = serviceInstance;
    this.refreshInterval = refreshInterval || 5000;
    this.staleNodeTimeDiff = staleNodeTimeDiff || 5000;
}

/**
 * Register the service with zookeeper
 *
 * @public
 * @method registerService
 *
 * @param   callback    {Function}  Optional Callback function
 */
ServiceDiscovery.prototype.registerService = function (callback) {
    var self = this;

    async.waterfall([
        createServiceBasePath,
        registerService
    ], completed);

    //1. Create the base service path
    function createServiceBasePath(callback) {
        var servicePath = [self.basePath, self.serviceInstance.name].join('/');

        self.client
            .getZkClient()
            .mkdirp(servicePath, callback);
    }

    //2. Register the service and create an ephemeral node
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

    //3. If a callback is bound, relay the error/response via the callback and listen for 'healthCheckChange' event
    function completed(err, res) {
        if (err) {
            return callback(err);
        }

        self.healthCheckEvent(self);

        /* Event to update service instance data in Zookeeper, checks healthcheck and updates to latest timestamp */
        setInterval(function () {
            self.updateServiceInstanceData(function (error) {
                if (error)
                    logger.error("error while updating instance data in zookeeper: ", error);
            })
        }, self.refreshInterval);

        logger.info("Registered service on zookeeper:", JSON.stringify(self.data));
        callback(err, res);
    }
};

/**
 * Event emitted by clients when health check changes
 * @param self
 */
ServiceDiscovery.prototype.healthCheckEvent = function (self) {

    self.on('healthCheckChange', function () {
        self.updateServiceInstanceData(function (error, result) {
            if (error)
                logger.info("Error updating service instance data on zookeeper", error);
        })
    });
};

/**
 * Update service instance data at later point of time. Eg: in case of healthcheck changes
 *
 * @public
 * @param callback
 */
ServiceDiscovery.prototype.updateServiceInstanceData = function (callback) {
    var self = this;

    async.waterfall([
        function (callback) {
            var path = [self.basePath, self.serviceInstance.name].join('/');
            var data = self.serviceInstance.getData();
            self.data = data;
            var servicePath = [path, data.host + ":" + data.port].join('/');

            self.client
                .getZkClient()
                .transaction()
                .setData(servicePath, new Buffer(JSON.stringify(data)))
                .commit(callback);

        }
    ], function (error, result) {
        if (error) {
            return callback(error);
        }

        logger.debug("Updated service instance data on Zookeeper:", JSON.stringify(self.data));
        callback(error, result);
    });
};

/**
 * @desc Unregister a service with zookeeper
 *
 * @public
 * @method unRegisterService
 *
 * @param servicePath       {String}    The service path that has to be unregistered
 * @param callback          {Function}  An optional callback to be called upon un-register
 */
ServiceDiscovery.prototype.unRegisterService = function (servicePath, callback) {
    this.client
        .getZkClient()
        .transaction()
        .remove(servicePath)
        .commit(callback);
};

/**
 * Get data for a service.
 *
 * @public
 * @method getData
 */
ServiceDiscovery.prototype.getData = function () {
    return this.data;
};

/**
 * Build a service provider.
 *
 * @public
 * @method instanceProviderBuilder
 */
ServiceDiscovery.prototype.instanceProviderBuilder = function () {
    var builder = InstanceProviderBuilder.builder();
    builder.serviceDiscovery(this);
    return builder;
};

/**
 * Get all instances of a particular service
 *
 * @public
 * @method getInstances
 *
 * @param serviceName       {String}    Service to get instances for
 * @param callback          {Function}  An optional callback function
 */
ServiceDiscovery.prototype.getInstances = function (serviceName, callback) {
    var servicePath = [this.basePath, serviceName].join('/');
    this.client.getZkClient().getChildren(servicePath, null, callback);
};

module.exports = ServiceDiscovery;
