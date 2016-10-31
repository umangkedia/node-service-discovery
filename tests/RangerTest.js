/**
 * Created by umang on 29/10/16.
 */

var should  = require('chai').should();
var assert  = require('chai').assert;
var expect = require('chai').expect;
var Ranger = require('../lib/Ranger');

describe('Ranger Test', function () {
    var rangerClient;

    beforeEach(function () {
        rangerClient = Ranger.newClient('localhost:2181');
    });

    it("should connect to zookeeper when start is called", function (done) {
        rangerClient.start();

        rangerClient.on('connected', function () {
            done();
        });
    });

    it("should stop zookeeper when close is called", function (done) {
        rangerClient.start();

        rangerClient.on('connected', function () {
            rangerClient.close();

            rangerClient.on('disconnected', function () {
                done();
            })
        })
    });

    it("isConnected should return true when client is connected", function (done) {
        rangerClient.start();

        rangerClient.on('connected', function () {
            assert.isTrue(rangerClient.isConnected(), "is connected returned true");
            done();
        });
    });

    it("should return zkClient when connected to zookeeper", function (done) {
        rangerClient.start();

        rangerClient.on('connected', function () {
            assert.isObject(rangerClient.getZkClient(), "getZkClient() returned object");
            assert.isTrue(rangerClient.isConnected(), "is connected returned true");
            done();
        });
    });
});