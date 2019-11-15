"use strict";

const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const cors = require("cors");


//////////////////////////////////////////
//
//    Database
//

// Connect
const mongoose = require("mongoose");
mongoose.connect(process.env.MLAB_URI || "mongodb://localhost/exercise-track", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Schemas
const Schema = mongoose.Schema;
const logSchema = new Schema({
  description: String,
  duration: Number,
  date: {
    type: Date,
    default: Date.now
  }
});
const userSchema = new Schema({
  username: String,
  count: {
    type: Number,
    default: 0
  },
  log: [logSchema]
});

// Models
const User = mongoose.model("User", userSchema);




app.use(cors());

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});





// Add new user
app.post("/api/exercise/new-user", (req, res) => {
  const username = req.body.username;
  User.findOne({
    username
  }, (err, user) => {
    if (user) {
      res.status(400).send("username already taken");
      return;
    }
    user = new User({
      username
    });
    user.save(err => {
      console.log(err);
    });
    res.json({
      username,
      _id: user.id
    });
  });
});

// List users
app.get("/api/exercise/users", (req, res) => {
  User.find({}, "username _id", (err, users) => {
  res.json(users);
  });
});

// Add exercises
app.post("/api/exercise/add", (req, res) => {
  const {
    userId,
    description
  } = req.body;
  const duration = parseInt(req.body.duration, 10);

  User.findOne({
    _id: userId
  }, (err, user) => {
    if (err) {
      res.status(400).send("invalid user");
      return;
    }

    // console.log(user);
    const date = req.body.date ? new Date(req.body.date) : new Date();
    user.log.push({
      description,
      duration,
      date
    });
    user.count++;
    user.save((err) => console.log(err));

    const {
      username
    } = user;
    res.json({
      username,
      description,
      duration,
      _id: userId,
      date: date.toDateString()
    });
  });
});


// Get log
app.get("/api/exercise/log", (req, res) => {

  const {
    userId,
    limit
  } = req.query;
  const from = req.query.from ? new Date(req.query.from) : new Date(0);
  const to = req.query.to ? new Date(req.query.to) : new Date();

  if (!userId) {
    res.status(400).send(`Error: Please provide a user ID`);
    return;
  }

  User.findById(userId, (err, user) => {
    if (err) {
      res.status(400).send(`Invalid user ID: ${userId}`);
      return;
    }

    let log = user.log.filter(ent => ent.date >= from && ent.date <= to)
                      .sort((a, b) => {
                        if (a.date < b.date) return -1;
                        if (a.date > b.date) return 1;
                        else return 0;
                      })
                      .slice(0, limit)
                      .map(ent => ({
                        description: ent.description,
                        duration: ent.duration,
                        date: ent.date.toDateString()
                      }));
    let unfilteredLog = user.log;
    res.json({
      _id: user.id,
      username: user.username,
      count: user.count,
      log,
    });
  });

});


// Not found middleware
app.use((req, res, next) => {
  return next({
    status: 404,
    message: "not found"
  });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});