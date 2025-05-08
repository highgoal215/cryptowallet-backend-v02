// import Wallet from '../models/wallet';
// import { generateWallet, generateBitcoinWallet } from '../utils/wallet.utils.js';
const crypto = require("crypto");
const { transferEth, transferBtc, transferTron } = require("../utils/wallet.utils");
const Wallet = require("../models/wallet");
const {
    generatEthereWallet,
    generateBitcoinWallet,
    generateTronWallet,
} = require("../utils/wallet.utils");
const ethers = require("ethers");
const { TronWeb } = require("tronweb");

// Encryption key (store this securely in environment variables)
const ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || "12345678901234567890123456789asd"; // Must be 32 bytes
const IV_LENGTH = 16; // Initialization vector length
// Function to encrypt data
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(ENCRYPTION_KEY || "12345678901234567890123456789asd"),
        iv
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}

// Function to decrypt data
function decrypt(text) {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        Buffer.from(ENCRYPTION_KEY || "12345678901234567890123456789asd"),
        iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

exports.createWallet = async(req, res) => {
    const { addressType, accountName } = req.body;
    try {
        // Check if account name already exists for this user
        const existingAccountName = await Wallet.findOne({
            user: req.userId,
            accountName: accountName
        });
        
        if (existingAccountName) {
            return res.status(400).json({
                success: false,
                message: "Account name already exists, use other name",
            });
        }

        let walletData;

        if (addressType === "ethereum") {
            walletData = await generatEthereWallet();
        } else if (addressType === "bitcoin") {
            walletData = await generateBitcoinWallet();
        } else if (addressType == "tron") {
            walletData = await generateTronWallet();
        } else {
            return res.status(400).json({ msg: "Unsupported wallet type" });
        }
        // Encrypt the private key before saving
        const encryptedPrivateKey = encrypt(walletData.privateKey);
        console.log("--------->encryptedPrivateKey", encryptedPrivateKey);
        const wallet = await Wallet.create({
            user: req.userId,
            addressType,
            accountName,
            address: walletData.address,
            privateKey: encryptedPrivateKey,
            balance: 0,
            createdAt: new Date(),
        });

        res.status(201).json(wallet);
    } catch (err) {
        res.status(500).json({ msg: "Wallet creation failed", error: err.message });
    }
};

// Add this function to your existing Wallet controller

/// transfer part
exports.universalEthTransfer = async(req, res) => {
    try {
        // console.log("--------->Request header:", req.headers);
        const { fromAddress, toAddress, amount } = req.body;

        // Validate inputs
        if (!fromAddress || !toAddress || !amount) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters: toAddress, or amount",
            });
        }

        // Validate Ethereum address format
        if (!ethers.isAddress(fromAddress) || !ethers.isAddress(toAddress)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Ethereum address format",
            });
        }
        // Validate amount is a positive number
        const amountNum = parseFloat(amount);
        console.log("++++++++++++>:", amountNum);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a positive number",
            });
        }
        const senderwallet = await Wallet.findOne({ address: fromAddress });
        if (!senderwallet) {
            return res.status(400).json({
                success: false,
                message: "Sender wallet not found",
            });
        }
        const SendPrivateKey = decrypt(senderwallet.privateKey);
        console.log("++++++++++++>===========>SendPrivateKey:", SendPrivateKey);
        const result = await transferEth(SendPrivateKey, toAddress, amountNum);
        console.log("++++++++++++>===========>result:", result);
        if (result.success == true) {
            try {
                // const Infura_API_Key = process.env.Infura_API_key;
                const provider = new ethers.JsonRpcProvider(
                    `https://eth-sepolia.g.alchemy.com/v2/fDVyRKUELxC6pGpxxG2M7eVc7ErbTI4t`
                );

                // Update source wallet balance
                const senderWallet = await Wallet.findOne({
                    address: result.fromAddress,
                    addressType: "ethereum",
                });
                console.log("++++++++++++>===========>result+++++++++++++>:");

                if (senderWallet) {
                    const currentBalance = await provider.getBalance(result.fromAddress);
                    console.log(
                        "++++++++++++>===========>currentBalance:",
                        currentBalance
                    );
                    senderWallet.balance = parseFloat(ethers.formatEther(currentBalance));
                    senderWallet.lastUpdated = new Date(); // Update the balance update time
                    await senderWallet.save();
                }

                // Update receiver wallet
                const receiverWallet = await Wallet.findOne({
                    address: result.toAddress,
                    addressType: "ethereum",
                });

                if (receiverWallet) {
                    const currentBalance = await provider.getBalance(result.toAddress);
                    receiverWallet.balance = parseFloat(
                        ethers.formatEther(currentBalance)
                    );
                    receiverWallet.lastUpdated = new Date(); // Update the balance update time
                    await receiverWallet.save();
                }
            } catch (dbError) {
                console.error("Database update error (non-critical):", dbError);
            }

            return res.status(200).json({
                success: true,
                message: "ETH transferred successfully",
                transaction: {
                    hash: result.transactionHash,
                    blockNumber: result.blockNumber,
                    fromAddress: result.fromAddress,
                    toAddress: result.toAddress,
                    amount: result.amount,
                    gasUsed: result.gasUsed,
                    gasCost: result.gasCost,
                    totalCost: result.totalCost,
                },
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Failed to transfer ETH",
                error: result.error,
                details: result.details,
            });
        }
    } catch (error) {
        console.error("Error transferring ETH:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.universalBtcTransfer = async(req, res) => {
    try {
        const { fromAddress, toAddress, amount } = req.body;
        console.log("++++++++++++>===========>fromAddress:", fromAddress);
        console.log("++++++++++++>===========>toAddress:", toAddress);
        console.log("++++++++++++>===========>amount:", amount);
        // Validate inputs
        if (!fromAddress || !toAddress || !amount) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters: fromAddress, toAddress, or amount"
            });
        }

        // Validate amount is a positive number
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a positive number"
            });
        }

        // Find sender's wallet
        const senderWallet = await Wallet.findOne({ address: fromAddress });
        if (!senderWallet) {
            return res.status(400).json({
                success: false,
                message: "Sender wallet not found"
            });
        }
        console.log("++++++++++++>===========>senderWallet:", senderWallet.privateKey);
        // Decrypt private key
        const senderPrivateKey = decrypt(senderWallet.privateKey);

        // Perform the transfer
        const result = await transferBtc(senderPrivateKey, toAddress, amountNum);

        if (result.success) {
            // Update sender's wallet balance
            const senderWallet = await Wallet.findOne({
                address: result.fromAddress,
                addressType: "bitcoin"
            });

            if (senderWallet) {
                // In a real implementation, you would fetch the actual balance from a Bitcoin node
                // For now, we'll just subtract the sent amount
                senderWallet.balance -= (result.amount + result.fee);
                senderWallet.lastUpdated = new Date();
                await senderWallet.save();
            }

            // Update receiver's wallet balance if it exists in our system
            const receiverWallet = await Wallet.findOne({
                address: result.toAddress,
                addressType: "bitcoin"
            });

            if (receiverWallet) {
                // In a real implementation, you would fetch the actual balance from a Bitcoin node
                receiverWallet.balance += result.amount;
                receiverWallet.lastUpdated = new Date();
                await receiverWallet.save();
            }

            return res.status(200).json({
                success: true,
                message: "BTC transferred successfully",
                transaction: {
                    hash: result.transactionHash,
                    fromAddress: result.fromAddress,
                    toAddress: result.toAddress,
                    amount: result.amount,
                    fee: result.fee,
                    rawTransaction: result.rawTransaction
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Failed to transfer BTC",
                error: result.error,
                details: result.details
            });
        }
    } catch (error) {
        console.error("Error transferring BTC:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.universalTronTransfer = async(req, res) => {
    console.log("++++++++++++>===========>universalTronTransfer:", req.body);
    try {
        const { fromAddress, toAddress, amount } = req.body;

        // Validate inputs
        if (!fromAddress || !toAddress || !amount) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters: fromAddress, toAddress, or amount"
            });
        }

        // Validate amount is a positive number
        const amountNum = parseFloat(amount);
        console.log("++++++++++++>===========>amountNum:", amountNum);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a positive number"
            });
        }

        // Find sender's wallet
        const senderWallet = await Wallet.findOne({ address: fromAddress });
        console.log("++++++++++++>===========>senderWallet:", senderWallet);
        if (!senderWallet) {
            return res.status(400).json({
                success: false,
                message: "Sender wallet not found"
            });
        }
        console.log("++++++++++++>===========>senderWallet:", senderWallet.privateKey);
        // Decrypt private key
        const senderPrivateKey = decrypt(senderWallet.privateKey);

        // Perform the transfer
        const result = await transferTron(senderPrivateKey, toAddress, amountNum);
        console.log("++++++++++++>===========>result:", result);
        if (result.success) {
            // Update sender's wallet balance
            const senderWallet = await Wallet.findOne({
                address: result.fromAddress,
                addressType: "tron"
            });

            if (senderWallet) {
                // Initialize TronWeb to get updated balance
                const fullNode = "https://api.shasta.trongrid.io";
                const eventServer = "https://api.shasta.trongrid.io";
                const tronWeb = new TronWeb({
                    fullHost: fullNode,
                    eventServer: eventServer
                });

                const currentBalance = await tronWeb.trx.getBalance(result.fromAddress);
                senderWallet.balance = currentBalance / 1e6; // Convert from SUN to TRX
                senderWallet.lastUpdated = new Date();
                await senderWallet.save();
            }

            // Update receiver's wallet balance if it exists in our system
            const receiverWallet = await Wallet.findOne({
                address: result.toAddress,
                addressType: "tron"
            });

            if (receiverWallet) {
                // Initialize TronWeb to get updated balance
                const fullNode = "https://api.shasta.trongrid.io";
                const eventServer = "https://api.shasta.trongrid.io";
                const tronWeb = new TronWeb({
                    fullHost: fullNode,
                    eventServer: eventServer
                });

                const currentBalance = await tronWeb.trx.getBalance(result.toAddress);
                receiverWallet.balance = currentBalance / 1e6; // Convert from SUN to TRX
                receiverWallet.lastUpdated = new Date();
                await receiverWallet.save();
            }

            return res.status(200).json({
                success: true,
                message: "TRX transferred successfully",
                transaction: {
                    hash: result.transactionHash,
                    fromAddress: result.fromAddress,
                    toAddress: result.toAddress,
                    amount: result.amount,
                    fee: result.fee,
                    totalCost: result.totalCost
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Failed to transfer TRX",
                error: result.error,
                details: result.details
            });
        }
    } catch (error) {
        console.error("Error transferring TRX:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.importWalletFromPrivateKey = async(req, res) => {
    try {
        const { privateKey, accountName, addressType } = req.body;
        // Validate inputs
        if (!privateKey || !accountName || !addressType) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameters: privateKey, accountName, or addressType",
            });
        }

        // Check if account name already exists for this user
        const existingAccountName = await Wallet.findOne({
            user: req.userId,
            accountName: accountName
        });
        
        if (existingAccountName) {
            return res.status(400).json({
                success: false,
                message: "Account name already exists, use other name",
            });
        }

        let walletAddress;
        let balance = 0;

        if (addressType === "ethereum") {
            // Handle Ethereum wallet
            const wallet = new ethers.Wallet(privateKey);
            walletAddress = wallet.address;

            // Create a provider to fetch the balance
            const provider = new ethers.JsonRpcProvider(
                `https://eth-sepolia.g.alchemy.com/v2/fDVyRKUELxC6pGpxxG2M7eVc7ErbTI4t`
            );
            // Fetch the wallet balance
            const balanceInWei = await provider.getBalance(walletAddress);
            balance = parseFloat(ethers.formatEther(balanceInWei));
        } else if (addressType === "tron") {
            // Handle Tron wallet
            const fullNode = "https://api.shasta.trongrid.io"; // Shasta testnet
            const solidityNode = "https://api.shasta.trongrid.io";
            const eventServer = "https://api.shasta.trongrid.io";
            
            const tronWeb = new TronWeb({
                fullHost: fullNode,
                eventServer: eventServer,
                privateKey: privateKey
            });

            // Get the Tron address from private key
            const account = await tronWeb.createAccount();
            walletAddress = account.address.base58;

            // Get Tron balance
            const balanceInSun = await tronWeb.trx.getBalance(walletAddress);
            balance = balanceInSun / 1e6; // Convert from SUN to TRX (1 TRX = 1,000,000 SUN)
        } else {
            return res.status(400).json({
                success: false,
                message: "Unsupported wallet type. Only 'ethereum' and 'tron' are supported.",
            });
        }

        // Check if wallet already exists
        const existingWallet = await Wallet.findOne({
            address: walletAddress,
            addressType,
        });
        if (existingWallet) {
            return res.status(400).json({
                success: false,
                message: "Wallet already exists in the database",
            });
        }

        const encryptedPrivateKey = encrypt(privateKey);
        
        // Save the wallet in the database
        const newWallet = await Wallet.create({
            user: req.userId,
            addressType,
            accountName,
            address: walletAddress,
            privateKey: encryptedPrivateKey,
            balance: balance,
            createdAt: new Date(),
        });

        return res.status(201).json({
            success: true,
            message: "Wallet imported successfully",
            wallet: {
                id: newWallet._id,
                address: newWallet.address,
                accountName: newWallet.accountName,
                addressType: newWallet.addressType,
                balance: newWallet.balance,
            },
        });
    } catch (error) {
        console.error("Error importing wallet:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

exports.getAllWallets = async(req, res) => {
    try {
        const wallets = await Wallet.find(); // Fetch all wallets from the database
        res.status(200).json({
            success: true,
            wallets,
        });
    } catch (error) {
        console.error("Error fetching wallets:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch wallets",
            error: error.message,
        });
    }
};