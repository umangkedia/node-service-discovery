'use strict';

/**
 * Created by umang on 27/10/16.
 */


var InstanceProvider = require('./InstanceProvider');

var DEFAULT_SELECTION_STRATEGY = 'RoundRobin';

function InstanceProviderBuilder() {
    this.instanceProvider = {};
    this.strategy = DEFAULT_SELECTION_STRATEGY;
};

function builder() {
    return new InstanceProviderBuilder();
};

InstanceProviderBuilder.prototype.serviceDiscovery = function (serviceDiscovery) {
    this.instanceProvider.serviceDiscovery = serviceDiscovery;
    return this;
};

InstanceProviderBuilder.prototype.serviceName = function (serviceName) {
    this.instanceProvider.serviceName = serviceName;
    return this;
};

InstanceProviderBuilder.prototype.selectionStrategy = function (strategy) {
    this.strategy = strategy;
    return this;
};

InstanceProviderBuilder.prototype.build = function () {
    return new InstanceProvider(
        this.instanceProvider.serviceDiscovery,
        this.instanceProvider.serviceName,
        this.strategy);
};

module.exports.builder = builder;
