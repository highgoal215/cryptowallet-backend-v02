const express = require("express");
const cors = require("cors");
const app = express();

require("dotenv").config();

const PORT = process.env.PORT || 5000;

const DB = require("./config/database");
DB();

app.use(express.json());

const cookieParser = require("cookie-parser");
app.use(cookieParser());

app.use(
    cors({
        origin: "http://localhost:8080",
        credentials: true,
    })
);

const userRouter = require("./routes/user");
const walletRouter = require("./routes/wallet");
const synapseRoutes = require("./routes/bankconnection/synapse");
const cron = require('node-cron');
const { updateWalletBalances, setupBlockchainListeners } = require('./utils/wallet.utils');
const ethers = require('ethers');
const { TronWeb } = require('tronweb');
// const transferRouter = require("./routes/transfer");
// Schedule balance updates every 2 minutes instead of 15
cron.schedule('*/2 * * * *', async () => {
    console.log('Running scheduled wallet balance update...');
    try {
        await updateWalletBalances();
        console.log('Wallet balance update completed successfully');
    } catch (error) {
        console.error('Error in scheduled wallet balance update:', error);
    }
});
// // Setup blockchain event listeners
setupBlockchainListeners().catch(error => {
    console.error('Error setting up blockchain listeners:', error);
});

app.use("/api/", userRouter);
app.use("/api/", walletRouter);
// app.use("/api/", transferRouter);
//synapse
app.use("/api/synapse", synapseRoutes);

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
