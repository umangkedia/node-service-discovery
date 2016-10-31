'use strict';

/**
 * Created by umang on 27/10/16.
 */

var ServiceInstance = require('./ServiceInstance');

function ServiceInstanceBuilder() {
    this.serviceInstance = {};
}

function builder() {
    return new ServiceInstanceBuilder();
}

ServiceInstanceBuilder.prototype.host = function (host) {
    this.serviceInstance.host = host;
    return this;
};

ServiceInstanceBuilder.prototype.name = function (name) {
    this.serviceInstance.name = name;
    return this;
};

ServiceInstanceBuilder.prototype.port = function (port) {
    this.serviceInstance.port = port;
    return this;
};

ServiceInstanceBuilder.prototype.environment = function (environment) {
    this.serviceInstance.environment = environment;
    return this;
};

ServiceInstanceBuilder.prototype.healthChecks = function (healtChecks) {
    this.serviceInstance.healtChecks = healtChecks;
    return this;
};

ServiceInstanceBuilder.prototype.build = function () {
    return new ServiceInstance(
        this.serviceInstance.name,
        this.serviceInstance.host,
        this.serviceInstance.port,
        this.serviceInstance.environment,
        this.serviceInstance.healtChecks);
};

module.exports.builder = builder;
