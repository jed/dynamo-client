dynamo-client
-------------

[![Build Status](https://secure.travis-ci.org/jed/dynamo-client.png?branch=master)](http://travis-ci.org/jed/dynamo-client)

This is a low-level client for accessing DynamoDB from node.js. It offers a simpler and more node-friendly API than [Amazon's SDK](http://aws.amazon.com/sdkfornodejs/), in the style of [@mikeal](https://github.com/mikeal)'s popular [request](https://github.com/mikeal/request) library.

Example
-------

```javascript
// assuming AWS credentials are available from process.ENV
var dynamo = require("dynamo-client")
  , region = "us-east-1"
  , db     = dynamo.createClient(region)

db.request("ListTables", null, function(err, data) {
  console.log(data.TableNames.length + " tables found.")
})
```

API
---

### db = dynamo.createClient(region, [credentials])

This creates a database instance for the given DynamoDB region, which can be one of the following:

- `us-east-1` (Northern Virginia)
- `us-west-1` (Northern California)
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `ap-northeast-1` (Tokyo)
- `ap-southeast-1` (Singapore)
- `ap-southeast-2` (Sydney)
- `sa-east-1` (Sao Paulo)

The official region list can be found in the [AWS documentation](http://docs.amazonwebservices.com/general/latest/gr/rande.html#ddb_region).

You can also pass an object in here with `host`, `port`, `region`, `version`, and/or
`credentials` parameters:

```javascript
var db = dynamo.createClient({host: "localhost", port: 4567, version: "20111205"})
```

This is especially useful if you want to connect to a mock DynamoDB
instance (such as [FakeDynamo](https://github.com/ananthakumaran/fake_dynamo) or
[ddbmock](https://bitbucket.org/Ludia/dynamodb-mock)).

For backwards compatibility with versions &lt;= 0.2.4, you can also pass
the full host in here too (should detect most hostnames unless they're
incredibly similar to an AWS region name):

```javascript
var db = dynamo.createClient("dynamodb.eu-west-1.amazonaws.com")
```

Your AWS credentials (which can be found in your [AWS console](https://portal.aws.amazon.com/gp/aws/securityCredentials)) can be specified in one of two ways:

- As the second argument, like this:

```javascript
dynamo.createClient("us-east-1", {
  secretAccessKey: "<your-secret-access-key>",
  accessKeyId: "<your-access-key-id>"
})
```

- From `process.env`, such as like this:

```
export AWS_SECRET_ACCESS_KEY="<your-secret-access-key>"
export AWS_ACCESS_KEY_ID="<your-access-key-id>"
```

### db.request(targetName, data, callback)

Database instances have only one method, `request`, which takes a target name, data object, and callback.

The target name can be any of the [operations available for DynamoDB](http://docs.amazonwebservices.com/amazondynamodb/latest/developerguide/operationlist.html
), which currently include the following:

- `BatchGetItem`
- `BatchWriteItem`
- `CreateTable`
- `DeleteItem`
- `DeleteTable`
- `DescribeTable`
- `GetItem`
- `ListTables`
- `PutItem`
- `Query`
- `Scan`
- `UpdateItem`
- `UpdateTable`

The data object needs to serialize into the [DynamoDB JSON format](http://docs.amazonwebservices.com/amazondynamodb/latest/developerguide/DataFormat.html).

The callback is called with the usual `(err, data)` signature, in which data is an object parsed from the JSON returned by DynamoDB.

To match [AWS expectations](http://docs.amazonwebservices.com/amazondynamodb/latest/developerguide/ErrorHandling.html#APIRetries), the following requests are automatically retried with exponential backoff (50ms, 100ms, 200ms, 400ms, etc) upon failure:

- 5xx errors
- 400 ThrottlingException errors
- 400 ProvisionedThroughputExceededException errors

Retries are attempted up to 10 times by default, but this amount can be changed by setting `dynamo.Request.prototype.maxRetries` to the desired number.
