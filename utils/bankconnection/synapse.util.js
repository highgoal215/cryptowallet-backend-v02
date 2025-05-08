const axios = require("axios");
const config = require("../../config/bankconnection/synapse");

async function getOAuthToken() {
    console.log("---------> oauth")
    const response = await axios.post(
        `${config.base_url}/oauth/${config.client_id}`, {
            client_secret: config.client_secret,
        }
    );
    console.log("------||------", response.data.oauthKey)
    return response.data.oauth_key;
}

async function createUser(oauthKey, email, name, phone) {
    const response = await axios.post(
        `${config.base_url}/users`, {
            logins: [{ email }],
            phone_numbers: [phone],
            legal_names: [name],
        }, {
            headers: {
                "X-SP-GATEWAY": `${config.client_id}|${config.client_secret}`,
                "X-SP-USER-IP": "45.126.3.252",
                "X-SP-USER": `|${oauthKey}`,
            },

        }
    );
    return response.data;
}

async function submitKyc(userId, fingerprint, oauthKey, kycData) {
    const response = await axios.post(
        `${config.base_url}/users/${userId}/documents`, { documents: [kycData] }, {
            headers: {
                "X-SP-GATEWAY": `${config.client_id}|${config.client_secret}`,
                "X-SP-USER-IP": "127.0.0.1",
                "X-SP-USER": `${fingerprint}|${oauthKey}`,
            },
        }
    );
    return response.data;
}

module.exports = { getOAuthToken, createUser, submitKyc };