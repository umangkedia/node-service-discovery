/**
 * Created by umang on 27/10/16.
 */


function InstanceDataRegistry() {
    this.instancesData = [];
};

InstanceDataRegistry.prototype.updateInstancesData = function (data) {
    this.instancesData = data;
};

InstanceDataRegistry.prototype.getInstancesData = function () {
    return this.instancesData;
};

module.exports = InstanceDataRegistry;

