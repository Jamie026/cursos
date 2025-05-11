const express = require('express');
const session = require('express-session');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(session({
    secret: "privete_key",
    resave: false,
    saveUninitialized: true
}));

const users = require("./routes/users.js")
const search = require("./routes/search.js")

app.use("/users", users);
app.use("/performance", search)

app.listen(PORT, () => console.log("Servidor ejecutado en el puerto", PORT));

module.exports = app;