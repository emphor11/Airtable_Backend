const express = require("express")
const mongoose = require("mongoose")
const cookieParser = require("cookie-parser")
const cors = require("cors")
require("dotenv").config()

const airTableAuthRoute = require("./src/routes/airtableAuth")
const formRoutes = require("./src/routes/formRoutes")
const webhookRoutes = require("./src/routes/webhooks")

const app = express()

app.use(express.json());
app.use(cookieParser());
app.use(cors())

app.get('/', (req, res) => {
    res.send('Backend running...');
});

app.use("/auth/airtable", airTableAuthRoute)
app.use("/api/forms", formRoutes);
app.use("/webhooks", webhookRoutes);

mongoose.connect(process.env.MONGO_URI, {})
  .then(() => console.log("Mongo connected"))
  .catch((err) => console.log("Mongo connection error:", err))

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
  