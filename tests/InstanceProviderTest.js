/**
 * Created by umang on 29/10/16.
 */

var should = require('chai').should();
var assert = require('chai').assert;
var expect = require('chai').expect;
var Ranger = require('../lib/Ranger');
var ServiceDiscoveryBuilder = require("../lib/ServiceDiscoveryBuilder");
var ServiceInstance = require("../lib/ServiceInstance");
var InstanceProvider = require("../lib/InstanceProvider");

describe("InstanceProvider Test", function () {
    var serviceDiscovery1;
    var serviceDiscovery2;
    var instanceProvider;

    var healthCheck = function () {
        return {
            isHealthy: function () {
                return true;
            }
        }
    };

    var serviceInstanceHost1 = new ServiceInstance("test/v1", "localhost", "8080", "staging", [healthCheck()]);
    var serviceInstanceHost2 = new ServiceInstance("test/v1", "localhost", "8081", "staging", [healthCheck()]);
    before(function (done) {
        //start client
        var rangerClient = Ranger.newClient('localhost:2181');
        rangerClient.start();

        rangerClient.on('connected', function () {

            serviceDiscovery1 = ServiceDiscoveryBuilder.builder()
                .basePath('basePath')
                .client(rangerClient)
                .serviceInstance(serviceInstanceHost1)
                .build();

            serviceDiscovery2 = ServiceDiscoveryBuilder.builder()
                .basePath('basePath')
                .client(rangerClient)
                .serviceInstance(serviceInstanceHost2)
                .build();

            //register both the services. /basePath/test/v1 will have two children, localhost:8080 and localhost:8081
            serviceDiscovery1.registerService(function (error, result) {
                if (!error) {
                    serviceDiscovery2.registerService(function (error, result) {
                        if (!error)
                            done();
                    });
                }
                else
                    done(error)
            });
        });
    });

    /*
    after(function (done) {
        serviceDiscovery1.unRegisterService("/basePath/test/v1/localhost:8080", function (error, result) {
            if (!error) {
                serviceDiscovery2.unRegisterService("/basePath/test/v1/localhost:8081", function (error, result) {
                    done(error);
                });
            }
        });
    });
    */

    it("should return a random node", function (done) {
        instanceProvider = new InstanceProvider(serviceDiscovery1, "test/v1", "Random");

        instanceProvider.init(function (error) {
            if (!error) {
                var randomData = {};
                randomData["localhost:8080"] = 0;
                randomData["localhost:8081"] = 0;

                for (var i = 0; i < 100; i++) {
                    var serviceData = instanceProvider.getInstance();
                    serviceData.host.should.be.a('string');
                    serviceData.port.should.be.a('string');
                    randomData[serviceData.host + ":" + serviceData.port] += 1;
                }

                if (randomData["localhost:8080"] > 10 && randomData["localhost:8081"] > 10
                    && randomData["localhost:8080"] + randomData["localhost:8081"] == 100) {
                    done();
                }
            }
        })
    });

    it("should return node in roundrobin order", function (done) {
        instanceProvider = new InstanceProvider(serviceDiscovery1, "test/v1", "RoundRobin");

        instanceProvider.init(function (error) {
            if (!error) {
                var randomData = {};
                randomData["localhost:8080"] = 0;
                randomData["localhost:8081"] = 0;

                for (var i = 0; i < 50; i++) {
                    var serviceData = instanceProvider.getInstance();
                    serviceData.host.should.be.a('string');
                    serviceData.port.should.be.a('string');
                    randomData[serviceData.host + ":" + serviceData.port] += 1;
                }

                if (randomData["localhost:8080"] == randomData["localhost:8081"]) {
                    done();
                }
            }
        })
    })


});
