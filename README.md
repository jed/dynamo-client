dynamo-client
=============

[![Build Status](https://secure.travis-ci.org/jed/dynamo-client.png?branch=master)](http://travis-ci.org/jed/dynamo-client)

This is a low-level client for accessing DynamoDB. It was factored out of [dynamo](http://github.com/jed/dynamo) to separate concerns for better testability.

Example
-------

```javascript
// assuming AWS credentials are available from process.ENV
var dynamo = require("dynamo-client")
  , host   = "dynamodb.us-east-1.amazonaws.com"
  , db     = dynamo.createClient(host)

db.request("ListTables", null, function(err, data) {
  console.log(data.TableNames.length + " tables found.")
})
```

API
---

### db = dynamo.createClient(host, [credentials])

This creates a database instance for the given DynamoDB host, which can currently be one of the following:

- `dynamodb.us-east-1.amazonaws.com` (Virginia)
- `dynamodb.us-west-1.amazonaws.com` (Northern California)
- `dynamodb.us-west-2.amazonaws.com` (Oregon)
- `dynamodb.ap-northeast-1.amazonaws.com` (Tokyo)
- `dynamodb.ap-southeast-1.amazonaws.com` (Singapore)
- `dynamodb.eu-west-1.amazonaws.com` (Ireland)

Your AWS credentials (which can be found in your [AWS console](https://portal.aws.amazon.com/gp/aws/securityCredentials)) can be specified in one of two ways:

- As the second argument, like this:

```javascript
dynamo.createClient("dynamodb.us-east-1.amazonaws.com", {
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

The callback is a function with the usual node-style `(err, data)` signature, in which data is an object parsed from the JSON returned by DynamoDB.

To match [AWS expectations](http://docs.amazonwebservices.com/amazondynamodb/latest/developerguide/ErrorHandling.html#APIRetries), the following requests are automatically retried with exponential backoff (50ms, 100ms, 200ms, 400ms, etc) upon failure:

- 500 errors
- 503 errors
- 400 ProvisionedThroughputExceededException errors

Retries are attempted up to 10 times by default, but this amount can be changed by setting `dynamo.Request.prototype.maxRetries` to the desired number.
