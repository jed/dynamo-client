// secure env vars not available in pull requests
if (process.env.TRAVIS_SECURE_ENV_VARS == 'false') return

var should  = require("should")
  , dynamo  = require("../")
  , options = {region: "us-east-1", version: "20111205"}
  , name    = "jed_dynamo-client_test"

describe("dynamo", function() {
  describe("'DeleteTable'", function() {
    it("should delete the table", function(done) {
      var db = dynamo.createClient(options)
      db.request("DeleteTable", {TableName: name}, done)
    })
  })
})
