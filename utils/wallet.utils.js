/// ether.js
const { ethers, Wallet } = require("ethers");
/// bitcoinjs-lib
const bitcoin = require("bitcoinjs-lib");
const ECPairFactory = require("ecpair").default;
const ecc = require("tiny-secp256k1");
const fs = require("fs");
const {TronWeb} = require("tronweb");
const crypto = require("crypto");

const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet; // Otherwise, bitcoin = mainnet and regnet = local
/// tronweb
// const TronWeb = require("tronweb");
///ether wallet
exports.generatEthereWallet = async() => {
    // const Infura_API_Key = process.env.Infura_API_key;
    const provider = new ethers.JsonRpcProvider(
        `https://eth-sepolia.g.alchemy.com/v2/fDVyRKUELxC6pGpxxG2M7eVc7ErbTI4t`
    );
    console.log("--------->", provider);
    const wallet = Wallet.createRandom(provider);
    console.log("wallet privateKey", wallet.privateKey);
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
    };
};

///bitcoin wallet
exports.generateBitcoinWallet = async() => {

    try {
        const keyPair = ECPair.makeRandom({ network: network });
        const { address } = bitcoin.payments.p2pkh({
            pubkey: keyPair.publicKey,
            network: network,
        });
        const privateKey = keyPair.toWIF();

        console.log(`| Public Address | ${address} |`);
        console.log(`| Private Key | ${privateKey} |`);

        const wallet = {
            address: address,
            privateKey: privateKey,
        };
        // const walletJSON = JSON.stringify(wallet, null, 4);
        // fs.writeFileSync("wallet.json", walletJSON);

        console.log(`Wallet created and saved to wallet.json`);
        return wallet;
    } catch (error) {
        console.log(error);
    }
};

///TronWallet
exports.generateTronWallet = async() => {
    try {
        const privateKey = crypto.randomBytes(32).toString("hex");
        console.log("privateKey", privateKey);
        const fullNode = "https://api.shasta.trongrid.io"; ///shasta testnet
        const solidityNode = "https://api.shasta.trongrid.io"; ///shasta testnet
        const eventServer = "https://api.shasta.trongrid.io"; ///shasta testnet
        
        const tronWeb = new TronWeb({
            fullHost: fullNode,
            eventServer: eventServer,
            privateKey: privateKey
          }
        )

        const newWallet = await tronWeb.createAccount();
        return {
            address: newWallet.address.base58,
            privateKey: newWallet.privateKey,
        };
    } catch (error) {
        console.error("Error generating Tron wallet:", error);
        throw new Error("Failed to generate Tron wallet: " + error.message);
    }
};
///TronWallet
// exports.generateTronWallet = async() => {
//     // Import TronWeb directly in the function
//     const TronWeb = require("tronweb");

//     // Check what's available in TronWeb
//     console.log("TronWeb type:", typeof TronWeb);
//     console.log("TronWeb properties:", Object.keys(TronWeb));

//     // Try different ways to instantiate TronWeb
//     let tronWeb;
//     if (typeof TronWeb === 'function') {
//         tronWeb = new TronWeb({
//             fullHost: 'https://api.trongrid.io'
//         });
//     } else if (TronWeb.default && typeof TronWeb.default === 'function') {
//         tronWeb = new TronWeb.default({
//             fullHost: 'https://api.trongrid.io'
//         });
//     } else {
//         throw new Error('Unable to instantiate TronWeb correctly');
//     }

//     // Generate a new account
//     const account = await tronWeb.createAccount();

//     console.log("---------->", account);
//     return {
//         address: account.address.base58,
//         privateKey: account.privateKey,
//     };
// }

///TronWallet

// Add this function to your existing utils/wallet.utils.js file

exports.transferEth = async(SendPrivateKey, toAddress, amountInEther) => {
    try {
        console.log("Input values:", {
            SendPrivateKey,
            toAddress,
            amountInEther,
            amountType: typeof amountInEther,
        });

        // Create provider with explicit network and timeout settings
        const provider = new ethers.JsonRpcProvider(
            `https://eth-sepolia.g.alchemy.com/v2/fDVyRKUELxC6pGpxxG2M7eVc7ErbTI4t`, {
                name: "sepolia",
                chainId: 11155111,
                ensAddress: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e0e",
            }
        );

        // Test the connection
        try {
            await provider.getNetwork();
            console.log("Successfully connected to Sepolia network");
        } catch (error) {
            console.error("Failed to connect to Sepolia network:", error);
            throw new Error(
                "Failed to connect to Ethereum network. Please check your internet connection and try again."
            );
        }

        // Create wallet instance from private key
        const Getwallet = new Wallet(SendPrivateKey, provider);
        const fromAddress = Getwallet.address;
        console.log("Wallet address:", fromAddress);

        // Get sender's current balance
        const senderBalance = await provider.getBalance(fromAddress);

        console.log("Sender balance in wei:", senderBalance.toString());

        // Convert amount to wei
        const amountInWei = ethers.parseEther(amountInEther.toString());

        // Get current gas price
        const feeData = await provider.getFeeData();

        console.log("Amount in wei:", amountInWei);
        console.log("Gas price:", feeData.gasPrice.toString());

        // Estimate gas limit for this transaction
        const gasLimit = 21000; // Standard ETH transfer gas limit

        // Calculate total transaction cost (amount + gas)
        const gasCost = feeData.gasPrice * BigInt(gasLimit);

        console.log("BigInt(gasLimit)--->:", BigInt(gasLimit));
        const totalCost = amountInWei + gasCost;
        console.log("Type======?:", {
            Type: typeof totalCost,
        });
        console.log("TypeSender======?:", {
            Type: typeof senderBalance,
        });
        console.log("Totalcost-->:", totalCost);
        console.log("Calculated values:", {
            gasCost: gasCost.toString(),
            totalCost: totalCost.toString(),
            senderBalance: senderBalance.toString(),
        });

        // Check if sender has enough balance including gas
        if (senderBalance < totalCost) {
            const errorDetails = {
                fromAddress: fromAddress,
                balance: ethers.formatEther(senderBalance),
                amountToSend: ethers.formatEther(amountInWei),
                estimatedGasCost: ethers.formatEther(gasCost),
                totalRequired: ethers.formatEther(totalCost),
            };
            console.log("Insufficient balance error details:", errorDetails);
            return {
                success: false,
                error: "Insufficient balance to cover amount plus gas fees",
                details: errorDetails,
            };
        }

        // Create transaction with explicit gas parameters
        const tx = {
            to: toAddress,
            value: ethers.parseEther(amountInEther.toString()),
            // gasLimit: ethers.toBigInt(gasLimit.toString()),
            // gasPrice: feeData.gasPrice,
        };

        console.log("tx-------------->", tx);

        // Retry logic for sending the transaction
        // const sendTransactionWithRetry = async(wallet, tx, retries = 3) => {
        //     for (let i = 0; i < retries; i++) {
        //         try {
        //             return await wallet.sendTransaction(tx);
        //         } catch (error) {
        //             if (i === retries - 1) throw error;
        //             console.log(`Retrying transaction... (${i + 1}/${retries})`);
        //             await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        //         }
        //     }
        // };

        // Send transaction
        // const transaction = await sendTransactionWithRetry(wallet, tx);
        const transaction = await Getwallet.sendTransaction(tx);
        console.log(`Transaction hash: ${transaction.hash}`);

        // Wait for transaction to be mined
        const receipt = await transaction.wait();

        console.log("reepit-------------->", receipt);
        console.log("here-------->");

        // Calculate actual gas used and cost
        const gasUsed = receipt.gasUsed;
        console.log("heasdfasdfre-------->");
        // const effectiveGasPrice = receipt.effectiveGasPrice;
        const gasPrice = feeData.gasPrice;
        if (!gasPrice) {
            throw new Error("Gas price is missing from the transaction receipt.");
        }
        console.log("here-----asdfasdf--->");
        const actualGasCost = gasUsed * gasPrice;
        console.log("here-----asdfasdfasdfasdfdsafds--->");

        return {
            success: true,
            transactionHash: transaction.hash,
            blockNumber: receipt.blockNumber.toString(),
            fromAddress: fromAddress,
            toAddress: toAddress,
            amount: ethers.formatEther(amountInWei),
            gasUsed: gasUsed.toString(),
            gasCost: ethers.formatEther(actualGasCost),
            totalCost: ethers.formatEther(amountInWei + actualGasCost),
        };
    } catch (error) {
        console.error("Error transferring ETH:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};

// exports.transferBtc = async (fromPrivateKey, toAddress, amountInBtc) => {
//     try {
//         // Create key pair from private key
//         const keyPair = ECPair.fromWIF(fromPrivateKey, network);
//         const fromAddress = bitcoin.payments.p2pkh({
//             pubkey: keyPair.publicKey,
//             network: network
//         }).address;

//         // Convert amount to satoshis (1 BTC = 100,000,000 satoshis)
//         const amountInSatoshis = Math.floor(amountInBtc * 100000000);

//         // Get UTXOs for the sender's address
//         const utxos = await getUtxos(fromAddress);

//         // Calculate total available balance
//         let totalBalance = 0;
//         utxos.forEach(utxo => {
//             totalBalance += utxo.value;
//         });

//         // Check if sender has enough balance
//         if (totalBalance < amountInSatoshis) {
//             return {
//                 success: false,
//                 error: "Insufficient balance",
//                 details: {
//                     fromAddress,
//                     balance: totalBalance / 100000000, // Convert back to BTC
//                     amountToSend: amountInBtc
//                 }
//             };
//         }

//         // Create a new transaction
//         const psbt = new bitcoin.Psbt({ network });

//         // Add inputs
//         let inputAmount = 0;
//         for (const utxo of utxos) {
//             psbt.addInput({
//                 hash: utxo.txid,
//                 index: utxo.vout,
//                 witnessUtxo: {
//                     script: bitcoin.address.toOutputScript(fromAddress, network),
//                     value: utxo.value
//                 }
//             });
//             inputAmount += utxo.value;
//             if (inputAmount >= amountInSatoshis) break;
//         }

//         // Add output for recipient
//         psbt.addOutput({
//             address: toAddress,
//             value: amountInSatoshis
//         });

//         // Add change output if needed
//         const fee = 1000; // Example fee in satoshis
//         const change = inputAmount - amountInSatoshis - fee;
//         if (change > 0) {
//             psbt.addOutput({
//                 address: fromAddress,
//                 value: change
//             });
//         }

//         // Sign the transaction
//         psbt.signAllInputs(keyPair);

//         // Finalize the transaction
//         psbt.finalizeAllInputs();

//         // Extract the transaction
//         const tx = psbt.extractTransaction();

//         // Get the raw transaction hex
//         const rawTx = tx.toHex();

//         return {
//             success: true,
//             transactionHash: tx.getId(),
//             fromAddress,
//             toAddress,
//             amount: amountInBtc,
//             fee: fee / 100000000, // Convert fee to BTC
//             rawTransaction: rawTx
//         };
//     } catch (error) {
//         console.error("Error transferring BTC:", error);
//         return {
//             success: false,
//             error: error.message
//         };
//     }
// };

// // Helper function to get UTXOs (Unspent Transaction Outputs)
// async function getUtxos(address) {
//     try {
//         // For testing, you can use BlockCypher's API
//         const response = await fetch(`https://api.blockcypher.com/v1/btc/test3/addrs/${address}?unspentOnly=true`);
//         const data = await response.json();

//         if (!data.txrefs) {
//             return [];
//         }

//         return data.txrefs.map(utxo => ({
//             txid: utxo.tx_hash,
//             vout: utxo.tx_output_n,
//             value: utxo.value
//         }));
//     } catch (error) {
//         console.error("Error fetching UTXOs:", error);
//         throw new Error("Failed to fetch UTXOs");
//     }
// }