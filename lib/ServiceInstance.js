'use strict';

/**
 * Created by umang on 27/10/16.
 */


function ServiceInstance(name, host, port, environment, healthChecks) {
    this.name = name;
    this.host = host;
    this.port = port;
    this.nodeData = {environment: environment};
    this.healthChecks = healthChecks;
}

ServiceInstance.prototype.getData = function () {
    if (this.data) {
        return this.data;
    }

    var healthcheckStatus = false;
    for (var i = 0; i < this.healthChecks.length; i++) {
        healthcheckStatus = this.healthChecks[i].isHealthy();
        if (!healthcheckStatus) {
            break;
        }
    }

    return {
        host: this.host,
        port: this.port,
        nodeData: this.nodeData,
        healthcheckStatus: healthcheckStatus ? "healthy" : "unhealthy",
        lastUpdatedTimeStamp: new Date().getTime()
    };
};

module.exports = ServiceInstance;
