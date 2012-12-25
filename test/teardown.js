var should = require("should")
  , dynamo = require("../")
  , region = "us-east-1"
  , db     = dynamo.createClient(region)
  , name   = "jed_dynamo-client_test"

describe("dynamo", function() {
  describe("'DeleteTable'", function() {
    it("should delete the table", function(done) {
      db.request("DeleteTable", {TableName: name}, done)
    })
  })
})
