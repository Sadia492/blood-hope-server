const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 9000;
const app = express();

app.get("/", async (req, res) => {
  res.send("my bloodHope server is running");
});

app.listen(port, () => {
  console.log("my port is running");
});
