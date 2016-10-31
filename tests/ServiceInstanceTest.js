/**
 * Created by umang on 29/10/16.
 */

var should  = require('chai').should();
var assert  = require('chai').assert;
var expect = require('chai').expect;
var ServiceInstance = require("../lib/ServiceInstance");

describe("testing service instance", function () {
    var serviceInstanceObj;
    var healthCheck = function () {
        return {
            isHealthy : function () {
                return true;
            }
        }
    };

    beforeEach(function () {
        serviceInstanceObj = new ServiceInstance("test", "localhost", "2181", "staging", [healthCheck()]);
    });

    it("should return data including healthcheck", function () {
        var data = serviceInstanceObj.getData();
        assert.propertyVal(data, 'healthCheckStatus', 'healthy');
        assert.propertyVal(data, 'host', 'localhost');
        assert.propertyVal(data.nodeData, 'environment', 'staging');
        assert.propertyVal(data, 'port', '2181');
    })
});