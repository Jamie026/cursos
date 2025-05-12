const express = require("express");
const session = require("express-session");
const app = express();

app.use(express.json());
app.use(session({
    secret: "private_key",
    resave: false,
    saveUninitialized: true
}));

const users = require("./routes/users.js")
const search = require("./routes/search.js")
const download = require("./routes/download");

app.use("/users", users);
app.use("/performance", search);
app.use("/download", download);

module.exports = app;