/**
 * Created by umang on 27/10/16.
 */


function DataStore() {
    this.instancesData = [];
}

DataStore.prototype.updateInstancesData = function (data) {
    this.instancesData = data;
};

DataStore.prototype.getInstancesData = function () {
    return this.instancesData;
};

module.exports = DataStore;

