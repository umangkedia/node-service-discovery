Service Discovery module for nodejs

A Service Discovery framework built on Zookeeper. This is an extension to the nicely built [Zoologist](https://github.com/ph0bos/zoologist) module.
This also enables dynamic service registration and de-registration with ZK while also guarding for other services' registration and de-registration.

## Installation

    npm install ranger-node --save

## Examples

### Service Registration

```javascript

'use strict';

var Ranger                  = require('ranger-node').Ranger;
var ServiceInstanceBuilder  = require("ranger-node").ServiceInstanceBuilder;
var ServiceDiscoveryBuilder = require('ranger-node').ServiceDiscoveryBuilder;

//Create a Ranger Client
var rangerClient = Ranger.newClient(process.env.ZK_CONNECTION_STRING || '127.0.0.1:2181');
rangerClient.start();

/**
 * Register a Service
 *
 * process.env.environment is whatever is the environment you are using
 * Additionally, you can also bind the health-checks with the service instance
 */
var serviceInstance = ServiceInstanceBuilder
        .builder()
        .host(process.env.HOST)
        .port(process.env.PORT_8080)
        .environment(process.env.environment || 'development')
        .healthChecks([healthCheck])
        .name('my-service')
        .build();
```

### Service Discovery

```javascript
'use strict';

var Ranger                  = require('ranger-node').Ranger;
var ServiceInstanceBuilder  = require("ranger-node").ServiceInstanceBuilder;
var ServiceDiscoveryBuilder = require('ranger-node').ServiceDiscoveryBuilder;

//Create a Ranger Client
var rangerClient = Ranger.newClient(process.env.ZK_CONNECTION_STRING || '127.0.0.1:2181');
rangerClient.start();

/**
 * Create the Service Discovery Instance
 *
 * process.env.refreshInterval is the interval to check for the updation of nodes in ZK.
 */
var serviceDiscovery = ServiceDiscoveryBuilder
        .builder()
        .client(rangerClient)
        .serviceInstance(serviceInstance)
        .basePath('services')
        .refreshInterval(process.env.refreshInterval || 10000)
        .build();

// Create the instance provider (selectionStrategy: 'RoundRobin' or 'Random')
var instanceProvider = serviceDiscovery
            .instanceProviderBuilder()
            .serviceName('dependent-service')
            .selectionStrategy('RoundRobin')
            .build()

// Discover available Services and provide an instance
instanceProvider.getInstance();




