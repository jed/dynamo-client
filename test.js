var should = require("should")
  , dynamo = require("./")
  , host   = "dynamodb.us-east-1.amazonaws.com"
  , db     = dynamo.createClient(host)
  , name   = "jed_dynamo-client_test"

describe("dynamo", function() {
  describe("'CreateTable'", function() {
    it("should create a table", function(done) {
      db.request("CreateTable", {
        TableName: name,
        KeySchema: {
          HashKeyElement: {
            AttributeName: "id",
            AttributeType: "S"
          }
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 3,
          WriteCapacityUnits: 5
        }
      }, function(err, data) {
        var inUse = "com.amazonaws.dynamodb.v20111205#ResourceInUseException"

        if (err && err.name == inUse) err = null

        done(err)
      })
    })
  })

  describe("'DescribeTable'", function() {
    it("should return table information", function describe(done) {
      db.request("DescribeTable", {TableName: name}, function(err, data) {
        if (err) done(err)

        else if (data.Table.TableStatus.slice(-3) != "ING") done()

        else setTimeout(describe, 5000, done)
      })
    })
  })

  describe("'GetItem' x 100", function() {
    it("should not throw ProvisionedThroughputExceededException", function(done) {
      for (var i = 0, n = 100, e = null; i < n; i++) {
        db.request("GetItem", {
          TableName: name,
          Key: {HashKeyElement: {S: "404"}}
        }, function(err, data) {
          if (e) return

          if (err) return done(e = err)

          --n || done()
        })
      }
    })
  })

  describe("'DeleteTable'", function() {
    it("should delete the table", function(done) {
      db.request("DeleteTable", {TableName: name}, done)
    })
  })
})
