'use strict';

/**
 * Created by umang on 27/10/16.
 */

var ServiceDiscovery = require('./ServiceDiscovery');

function ServiceDiscoveryBuilder() {
    this.serviceDiscovery = {};
};

function builder() {
    return new ServiceDiscoveryBuilder();
};

ServiceDiscoveryBuilder.prototype.basePath = function (basePath) {
    basePath = '/' + basePath;

    this.serviceDiscovery.basePath = basePath;
    return this;
};

ServiceDiscoveryBuilder.prototype.client = function (client) {
    this.serviceDiscovery.client = client;
    return this;
};

ServiceDiscoveryBuilder.prototype.serviceInstance = function (instance) {
    this.serviceDiscovery.instance = instance;
    return this;
};

ServiceDiscoveryBuilder.prototype.refreshInterval = function (refreshInterval) {
    this.serviceDiscovery.refreshInterval = refreshInterval;
    return this;
};

ServiceDiscoveryBuilder.prototype.build = function () {
    return new ServiceDiscovery(
        this.serviceDiscovery.client,
        this.serviceDiscovery.basePath,
        this.serviceDiscovery.instance,
        this.serviceDiscovery.refreshInterval);
};

module.exports.builder = builder;
