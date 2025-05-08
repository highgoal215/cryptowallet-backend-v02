/// creating and submitting a user to KYC
const synapseUtils = require("../../utils/bankconnection/synapse.util");

exports.createSynapseUser = async(req, res) => {
    console.log("createSynapseUser", req.body);
    try {
        const oauthKey = await synapseUtils.getOAuthToken();
        const user = await synapseUtils.createUser(
            oauthKey,
            req.body.email,
            req.body.name,
            req.body.phone
        );
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.response?.data || err.message });
    }
};

exports.submitUserKyc = async(req, res) => {
    try {
        const { userId, fingerprint, kycData } = req.body;
        const oauthKey = await synapseUtils.getOAuthToken();
        const result = await synapseUtils.submitKyc(
            userId,
            fingerprint,
            oauthKey,
            kycData
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.response?.data || err.message });
    }
};