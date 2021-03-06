var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var mongoose = require("mongoose");
var md5 = require('md5');
var ObjectID = mongodb.ObjectID;

var moment = require('moment');

var jwt = require("jsonwebtoken");
var config = require("./config.js");
var User = require("./app/models/user.js");



var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:8080");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, x-access-token");
  next();
});

app.options('*', function(req, res) {
    res.send(200);
});

var db = mongoose.connection;
// Website you wish to allow to connect

db.on('error', console.error);

console.log("ENV: " + process.env.NODE_ENV);

var mongodbURI = process.env.ENV_MONGO_URI;

mongoose.connect(mongodbURI, {useMongoClient: true});
console.log("Database connection ready.");

db.on('error', function(error) {
  console.error('Error in MongoDb connection: ' + error);
  mongoose.disconnect();
});

db.on('disconnected', function() {
  console.log('MongoDB disconnected!');
  setTimeout(() => {
    mongoose.connect(mongodbURI,  {useMongoClient: true});
  }, 3000)

});

var server = app.listen(process.env.ENV_PORT || 8888, function() {
  var port = server.address().port;
  console.log("Server now running on port: ", port);
});
module.exports = server;

// Contacts API Routes

function handleError(res, reason, message, code) {
  console.log("Error: " + reason);
  res.status(code || 500).json({"error" : message});
}

// User Authentication

app.post('/api/authenticate', function(req, res){
  User.findOne({
    name: req.body.name
  }, function(err, user){
    if (err){
      handleError(res, err.message, err);
    }

    if(!user){
      res.json({success: false, message: "Authentication failed, no user with this name available"});
    } else {
      if(user.password != md5(req.body.password)){
        res.json({success: false, message: "Authentication failed, password is incorrect."});
      } else {

        // Create Json Web Token

        var userData = {'name' : user.name, 'admin': user.admin};

        var token = jwt.sign(userData, config.jwtsecret, {
          expiresIn: "1 day"  // 24 hours
        });

        res.json({
          success: true,
          message: "Authentication succesfull",
          token: token
        });
      }
    }
  });

});

var cronJob = require("./app/functions/festivalBooking.js");
cronJob.startCron();
// Router to verify user identity

function checkToken(req, res, next){


  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode the token

  if (token) {

    jwt.verify(token, config.jwtsecret, function(err, decoded) {
      if(err) {
        handleError(res, err.message, "Your token is not valid.", 403);
      } else {
        req.decoded = decoded;
        next();
      }
    });
  } else {
    handleError(res, "no token provided", "You have not provided a token, please add a Bearer Token", 403)
  }

};


var festivals = require("./app/endpoints/festivals.js");
var emails = require("./app/endpoints/emails.js");
var emailsLog = require("./app/endpoints/emailsLog.js");


app.use('/api', checkToken, festivals);
app.use('/api', checkToken, emails);
app.use('/api', checkToken, emailsLog);


// Angular Routes

app.get('*', function(req, res) {
    res.sendfile('./public/index.html'); // load our public/index.html file
});
