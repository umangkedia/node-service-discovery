'use strict';
/**
 * Created by umang on 27/10/16.
 */

var log4js = require('log4js');
var logger = log4js.getLogger('InstanceProvider.js');
var async = require('async');
var util = require('util');
var customErr = require('custom-error-generator');
var EventEmitter = require('events').EventEmitter;
var Registry = require("./registry/InstanceDataRegistry");


/**
 * Custom Errors
 */
var NotFoundError = customErr('NotFoundError', Error);
var ZooKeeperError = customErr('ZooKeeperError', Error);

/**
 * Inherit from EventEmitter.
 */
util.inherits(InstanceProvider, EventEmitter);

/**
 *
 * @param serviceDiscovery
 * @param serviceName
 * @param selectionStrategy
 * @constructor
 */
function InstanceProvider(serviceDiscovery, serviceName, selectionStrategy) {
    this.serviceDiscovery = serviceDiscovery;
    this.serviceName = serviceName;
    this.selectionStrategy = selectionStrategy || 'RoundRobin';
    this.lastInstanceIndex = 0;
    this.registryInstance = new Registry();
};

/**
 * Initialize the service provider, get initial data from zookeeper and set a timer to fetch data at regular interval
 * @param callback
 */
InstanceProvider.prototype.init = function (callback) {
    var self = this;
    var setWatcher = true;
    self.getServicesDataFromZK(setWatcher, function (error) {
        if (!error) {
            logger.info("Successfully fetched services data for:", self.serviceName);
            setInterval(function () {
                self.getServicesDataFromZK(false, function (error) {
                    if (error)
                        logger.error("error while getting services data from zookeeper: ", error, self.serviceName);
                    else
                        logger.info("refreshed services data from zookeeper for:", self.serviceName);
                })
            }, 5000);
        }
        else {
            logger.error("error while getting services data from zk", error, self.serviceName);
        }
        callback(error);
    });
};

/**
 * Method to get data from zookeeper and update in registry
 * @param setWatcher
 * @param callback
 */
InstanceProvider.prototype.getServicesDataFromZK = function (setWatcher, callback) {
    var self = this;
    var absPath = [self.serviceDiscovery.basePath, self.serviceName].join('/');
    async.waterfall([
        function (callback) {
            callback(null, absPath, self);
        },
        setWatcher ? self.getNodeListAndSetWatcher : self.getNodeList,
        self.getNodeData,
        self.saveNodeData
    ], function (error, response) {
        if (error)
            logger.error("error while updating services data", error, self.serviceName);

        callback(error);
    });
};

/**
 * Watcher for getChildren event on zk. register watcher again after receiving a watch event
 * @param event
 * @param self
 */
InstanceProvider.prototype.watcher = function (event, self) {
    logger.info("received watcher event:", event.getName(), self.serviceName);
    switch (event.getName()) {
        case "NODE_CHILDREN_CHANGED":
            self.getServicesDataFromZK(true, function (error) {
                if (error)
                    logger.error("error while getting data from zk in watcher", error, self.serviceName);
            });
            break;
        case "NODE_CREATED":
        case "NODE_DELETED":
        case "NODE_DATA_CHANGED":
            break;
        default:
            break
    }
};

/**
 * Method to get list of children for a path and set watcher on it
 * @param absPath
 * @param self
 * @param callback
 */
InstanceProvider.prototype.getNodeListAndSetWatcher = function (absPath, self, callback) {
    self.serviceDiscovery.client.getZkClient().getChildren(
        absPath,
        function (event) {
            self.watcher(event, self);
        },
        function (error, serviceList, stat) {
            if (!error && serviceList.length > 0) {
                logger.info("successfully got serviceList ", absPath, self.serviceName);
                return callback(null, absPath, self, serviceList);
            }

            logger.error("error getting children list", error, serviceList);
            return callback(error);
        });
};

/**
 * Method to get list of children without setting watcher on it
 * @param absPath
 * @param self
 * @param callback
 */
InstanceProvider.prototype.getNodeList = function (absPath, self, callback) {
    self.serviceDiscovery.client.getZkClient().getChildren(
        absPath,
        null,
        function (error, serviceList, stat) {
            if (!error && serviceList.length > 0) {
                logger.info("successfully got serviceList ", absPath, self.serviceName);
                return callback(null, absPath, self, serviceList);
            }

            logger.error("error getting children list", error, serviceList, self.serviceName);
            return callback(error);
        });
};

/**
 * Method to get node data from zookeeper
 * @param absPath
 * @param self
 * @param serviceList
 * @param callback
 */
InstanceProvider.prototype.getNodeData = function (absPath, self, serviceList, callback) {
    var nodeData = [];
    async.each(serviceList, function (service, intCallback) {
        var servicePath = [absPath, service].join('/');
        self.serviceDiscovery.client.getZkClient().getData(servicePath, null, function (error, data, stat) {
            if (error) {
                logger.error("error while getting data for: ", servicePath, self.serviceName);
            }
            else {
                nodeData.push(JSON.parse(data));
            }

            intCallback();
        });
    }, function (err) {
        if (err) {
            logger.error("error in get node data", err);
            return callback(err);
        }

        callback(null, nodeData, absPath, self);
    });
};

/**
 * Method to save node data in local registry, removes unhealthy nodes
 * @param nodeData
 * @param absPath
 * @param self
 * @param callback
 * @returns {*}
 */
InstanceProvider.prototype.saveNodeData = function (nodeData, absPath, self, callback) {
    if (nodeData.length > 0) {
        var updateNodeData = [];
        nodeData.forEach(function (data) {
            if (data.healthCheckStatus === "healthy") {
                updateNodeData.push(data);
            }
            else
                logger.info("node removed due to health check:", JSON.stringify(data), self.serviceName);
        });

        self.registryInstance.updateInstancesData(updateNodeData);
        return callback(null);
    }

    logger.error("no node data found for: ", absPath);
    return callback(new NotFoundError("no node data found for: " + absPath));

};

/**
 * Method to return an instance depending on the strategy, this is sync call
 * And takes data from local registry
 */
InstanceProvider.prototype.getInstance = function () {
    var self = this;

    if (self.selectionStrategy === 'Random') {
        return randomInstanceSelector();
    }

    return roundRobinInstanceSelector();

    function randomInstanceSelector() {
        var storedServicesData = self.registryInstance.getInstancesData();

        var serviceData = storedServicesData[Math.floor((Math.random() * storedServicesData.length))];
        serviceData.serviceUrl = "http://" + serviceData.host + ":" + serviceData.port;
        return serviceData;
    }

    function roundRobinInstanceSelector() {
        var storedServicesData = self.registryInstance.getInstancesData();
        var serviceData;

        if (storedServicesData[++self.lastInstanceIndex]) {
            serviceData = storedServicesData[self.lastInstanceIndex];
        } else {
            self.lastInstanceIndex = 0;
            serviceData = storedServicesData[0];
        }

        serviceData.serviceUrl = "http://" + serviceData.host + ":" + serviceData.port;
        return serviceData;
    }
};

module.exports = InstanceProvider;
