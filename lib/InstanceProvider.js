'use strict';

/**
 * Created by umang on 27/10/16.
 */

var log4js          = require('log4js');
var logger          = log4js.getLogger('InstanceProvider.js');
var async           = require('async');
var util            = require('util');
var customErr       = require('custom-error-generator');
var EventEmitter    = require('events').EventEmitter;
var DataStore       = require("./DataStore");

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
 * Instance Provider Constructor
 *
 * @param serviceDiscovery      {ServiceDiscovery} Service Discovery Instance
 * @param serviceName           {String}           Name of the service
 * @param selectionStrategy     {String}           Instance selection strategy. Random or RoundRobin
 *
 * @public
 * @constructor InstanceProvider
 */
function InstanceProvider(serviceDiscovery, serviceName, selectionStrategy) {
    this.serviceDiscovery = serviceDiscovery;
    this.serviceName = serviceName;
    this.selectionStrategy = selectionStrategy || 'RoundRobin';
    this.lastInstanceIndex = 0;
    this.dataStore = new DataStore();
}

/**
 * Initialize the service provider, get initial data from zookeeper and set a timer to fetch data at regular interval
 *
 * @param callback  {Function}  Optional callback function
 *
 * @public
 * @method init
 */
InstanceProvider.prototype.init = function (callback) {
    var self = this;

    self.getServicesDataFromZK(true, function (error) {
        if (!error) {
            logger.info("Successfully fetched services data for:", self.serviceName);
            setInterval(function () {
                self.getServicesDataFromZK(false, function (error) {
                    if (error)
                        logger.error("error while getting services data from zookeeper: ", error, self.serviceName);
                    else
                        logger.info("refreshed services data from zookeeper for:", self.serviceName);
                })
            }, self.serviceDiscovery.refreshInterval);
        }
        else {
            logger.error("error while getting services data from zk", error, self.serviceName);
        }
        callback(error);
    });
};

/**
 * @desc Method to get data from zookeeper and update in registry
 *
 * @param setWatcher        {Boolean}    Variable to determine if watcher needs to be set or otherwise
 * @param callback          {Function}   Optional callback function
 *
 * @public
 * @method  getServicesDataFromZK
 */
InstanceProvider.prototype.getServicesDataFromZK = function (setWatcher, callback) {
    var self = this;
    var absPath = [self.serviceDiscovery.basePath, self.serviceName].join('/');

    async.waterfall([
        function (callback) {
            // self needs to be passed here, otherwise inside the waterfall this would refer to async's this and we'll lose the context
            callback(null, absPath, setWatcher, self);
        },
        self.getNodeList, self.getNodeData, self.saveNodeData
    ], function (error, response) {
        if (error)
            logger.error("error while updating services data", error, self.serviceName);

        callback(error);
    });
};

/**
 * @desc Watcher for getChildren event on zk. Register watcher again after receiving a watch event
 *
 * @param event         {Object}    The event response object
 * @param self          {Object}    reference of this class
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
 *
 * @public
 * @method getNodeList
 *
 * @param absPath       {String}    The absolute path of this particular service in ZK.
 * @param setWatcher    {Boolean}   Variable to determine if the watcher needs to be set or otherwise
 * @param self          {Object}    The parent reference from where ever this method is called via async
 * @param callback      {Function}  Optional callback function
 *
 */
InstanceProvider.prototype.getNodeList = function (absPath, setWatcher, self, callback) {
    var watcherCallback = !setWatcher ? null : function (event) { self.watcher(event, self) };

    self.serviceDiscovery.client.getZkClient().getChildren(
        absPath,
        watcherCallback,
        function (error, serviceList, stat) {
            if (!error && serviceList.length > 0) {
                return callback(null, absPath, serviceList, self);
            }

            logger.error("error getting children list", error, serviceList);
            return callback(error || new NotFoundError("no node data found for: " + absPath));
        });
};

/**
 * Method to get node data from zookeeper for the list of nodes available for a service
 *
 * @public
 * @method getNodeData
 *
 * @param absPath           {String}    The absolute path of this particular service in ZK.
 * @param serviceList       {Object}    The list of nodes available against this particular service
 * @param self              {Object}    The parent reference from where ever this method is called via async
 * @param callback          {Function}  Optional callback function
 *
 */
InstanceProvider.prototype.getNodeData = function (absPath, serviceList, self, callback) {
    var nodeData = [];

    async.each(serviceList, function (service, reqCallback) {
        var servicePath = [absPath, service].join('/');

        self.serviceDiscovery.client.getZkClient().getData(servicePath, null, function (error, data, stat) {
            if (error) {
                logger.error("error while getting data for: ", servicePath, self.serviceName);
            }
            else {
                nodeData.push(JSON.parse(data));
            }

            reqCallback();
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
 * Method to save node data in local registry, removes unhealthy nodes, keeps the registry uptodate
 *
 * @public
 * @method saveNodeData
 *
 * @param nodeData      {Object}    The node data available for this particular service
 * @param absPath       {String}    The absolute path of this particular service in ZK.
 * @param self          {Object}    The parent reference from where ever this method is called via async
 * @param callback      {Function}  Optional callback function
 *
 * @returns {*}
 */
InstanceProvider.prototype.saveNodeData = function (nodeData, absPath, self, callback) {

    //1. If the node data is empty, throw out a new node data error. Guard condition. Safe coding practice
    if(nodeData.length == 0){
        logger.error("no node data found for: ", absPath);
        return callback(new NotFoundError("no node data found for: " + absPath));
    }

    var updateNodeData = [];
    nodeData.forEach(function (data) {
        if (data.healthcheckStatus === "healthy") {
            updateNodeData.push(data);
        }
        else
            logger.info("node removed due to health check:", JSON.stringify(data), self.serviceName);
    });

    self.dataStore.updateInstancesData(updateNodeData);
    return callback(null);
};

/**
 * Method to return an instance depending on the strategy, this is a sync call. Returns the appropriate instance
 * from the local registry
 *
 * @public
 * @method getInstance
 */
InstanceProvider.prototype.getInstance = function () {
    var self = this;

    return self.selectionStrategy === 'Random' ? randomInstanceSelector() : roundRobinInstanceSelector();

    function randomInstanceSelector() {
        var storedServicesData = self.dataStore.getInstancesData();

        var serviceData = storedServicesData[Math.floor((Math.random() * storedServicesData.length))];
        serviceData.serviceUrl = serviceData.secure ? "https://" : "http://" + serviceData.host + ":" + serviceData.port;
        return serviceData;
    }

    function roundRobinInstanceSelector() {
        var storedServicesData = self.dataStore.getInstancesData();
        var serviceData;

        if (storedServicesData[++self.lastInstanceIndex]) {
            serviceData = storedServicesData[self.lastInstanceIndex];
        } else {
            self.lastInstanceIndex = 0;
            serviceData = storedServicesData[0];
        }

        serviceData.serviceUrl = serviceData.secure ? "https://" : "http://" + serviceData.host + ":" + serviceData.port;
        return serviceData;
    }
};

module.exports = InstanceProvider;
