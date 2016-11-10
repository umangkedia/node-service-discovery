/**
 * Created by umang on 29/10/16.
 */

var should  = require('chai').should();
var assert  = require('chai').assert;
var expect = require('chai').expect;
var Ranger = require('../lib/Ranger');
var ServiceDiscoveryBuilder = require("../lib/ServiceDiscoveryBuilder");
var ServiceInstance = require("../lib/ServiceInstance");
var events = require('events');
var sinon = require('sinon');
var eventEmitter = new events.EventEmitter();

describe("ServiceDiscovery Test", function () {
    var serviceDiscovery;

    var healthCheck = function () {
        var isHealthy = true;
        return {
            isHealthy: function () {
                return isHealthy;
            },
            setStatus: function (status) {
                isHealthy = status;
            }
        }
    };

    var instanceHealthCheck;
    beforeEach(function (done) {
        //start client
        var rangerClient = Ranger.newClient('localhost:2181');
        rangerClient.start();

        rangerClient.on('connected', function () {

            healthCheck = function () {
                var isHealthy = true;
                return {
                    isHealthy: function () {
                        return isHealthy;
                    },
                    setStatus: function (status) {
                        isHealthy = status;
                    }
                }
            };

            instanceHealthCheck = healthCheck();
            //create service instance
            var serviceInstance = new ServiceInstance("test", "localhost", "2181", "staging", [instanceHealthCheck]);

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

    it("should update instance data on health check change. healthy -> unhealthy", function (done) {
        serviceDiscovery.registerService(function (error, result) {
            if (error)
                done(error);

            else {
                instanceHealthCheck.setStatus(false);
                serviceDiscovery.emit('healthCheckChange');
                serviceDiscovery.client.getZkClient().getData("/basePath/test/localhost:2181", null, function (error, data, stat) {
                    if (error)
                        return done(error);

                    assert.equal("unhealthy", JSON.parse(data).healthcheckStatus);
                    done();
                });
            }
        })
    });
});
