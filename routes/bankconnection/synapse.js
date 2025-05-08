const express = require("express");
const router = express.Router();
const SynapseController = require("../../controller/bankconnection/Synapse");

router.post("/create-user", SynapseController.createSynapseUser);
router.post("/submit-kyc", SynapseController.submitUserKyc);

module.exports = router;