// secure env vars not available in pull requests
if (process.env.TRAVIS_SECURE_ENV_VARS == 'false') return

var should  = require("should")
  , dynamo  = require("../")
  , options = {region: "us-east-1", version: "20111205"}
  , name    = "jed_dynamo-client_test"

describe("dynamo", function() {
  it("starting tests at " + JSON.stringify(new Date))

  describe("'DescribeTable'", function() {
    it("should ensure the table is not being deleted", function describe(done) {
      var db = dynamo.createClient(options)
      db.request("DescribeTable", {TableName: name}, function(err, data) {
        if (err && err.name == "ResourceNotFoundException") done()

        else if (err) done(err)

        else if (data.Table.TableStatus == "DELETING") setTimeout(describe, 5000, done)

        else done()
      })
    })
  })

  describe("'CreateTable'", function() {
    it("should create a table", function(done) {
      var db = dynamo.createClient(options)
      db.request("CreateTable", {
        TableName: name,
        KeySchema: {
          HashKeyElement: {
            AttributeName: "id",
            AttributeType: "N"
          }
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 3,
          WriteCapacityUnits: 5
        }
      }, function(err, data) {
        if (err && err.name == "ResourceInUseException") err = null

        done(err)
      })
    })
  })

  describe("'DescribeTable'", function() {
    it("should return table information", function describe(done) {
      var db = dynamo.createClient(options)
      db.request("DescribeTable", {TableName: name}, function(err, data) {
        if (err) done(err)

        else if (data.Table.TableStatus.slice(-3) != "ING") done()

        else setTimeout(describe, 5000, done)
      })
    })
  })
})
