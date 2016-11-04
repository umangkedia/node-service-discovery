/**
 * Created by umang on 29/10/16.
 */

var should  = require('chai').should();
var assert  = require('chai').assert;
var expect = require('chai').expect;
var Ranger = require('../lib/Ranger');
var ServiceDiscoveryBuilder = require("../lib/ServiceDiscoveryBuilder");
var ServiceInstance = require("../lib/ServiceInstance");

describe("ServiceDiscovery Test", function () {
    var serviceDiscovery;
    beforeEach(function (done) {
        //start client
        var rangerClient = Ranger.newClient('localhost:2181');
        rangerClient.start();

        rangerClient.on('connected', function () {

            var healthCheck = function () {
                return {
                    isHealthy: function () {
                        return true;
                    }
                }
            };

            //create service instance
            var serviceInstance = new ServiceInstance("test", "localhost", "2181", "staging", [healthCheck()]);

            serviceDiscovery = ServiceDiscoveryBuilder.builder()
                .basePath('basePath')
                .client(rangerClient)
                .serviceInstance(serviceInstance)
                .refreshInterval(6000)
                .build();
            done();
        });
    });

    afterEach(function (done) {
        serviceDiscovery.unRegisterService("/basePath/test/localhost:2181", function (error, result) {
            if (!error)
                done();
        });
    });

    it("should register service in zookeeper", function (done) {
        serviceDiscovery.registerService(function (error, result) {
            assert.isNull(error, "error is null");
            assert.equal(result[0].path, "/basePath/test/localhost:2181");
            done();
        })
    });

    it("should get instance list", function (done) {
        serviceDiscovery.registerService(function (error, result) {
            serviceDiscovery.getInstances("test", function (error, result) {
                assert.equal(result[0], "localhost:2181");
                done();
            })
        })
    });
});
