'use strict';

/**
 * Created by umang on 27/10/16.
 */


function ServiceInstance(name, host, port, environment, healthChecks, secure) {
    this.name = name;
    this.host = host;
    this.port = port;
    this.secure = secure || false;
    this.nodeData = {environment: environment};
    this.healthChecks = healthChecks;
}

ServiceInstance.prototype.getData = function () {
    if (this.data) {
        return this.data;
    }

    var isHealthy = true;
    if (this.healthChecks) {
        for (var i = 0; i < this.healthChecks.length; i++) {
            isHealthy = this.healthChecks[i].isHealthy();
            if (!isHealthy) {
                break;
            }
        }
    }

    return {
        host: this.host,
        port: this.port,
        nodeData: this.nodeData,
        healthcheckStatus: isHealthy ? "healthy" : "unhealthy",
        lastUpdatedTimeStamp: new Date().getTime()
    };
};

module.exports = ServiceInstance;
