var should = require("should")
  , dynamo = require("../")
  , host   = "dynamodb.us-east-1.amazonaws.com"
  , db     = dynamo.createClient(host)
  , name   = "jed_dynamo-client_test"

describe("dynamo", function() {
  describe("'DeleteTable'", function() {
    it("should delete the table", function(done) {
      db.request("DeleteTable", {TableName: name}, done)
    })
  })
})
