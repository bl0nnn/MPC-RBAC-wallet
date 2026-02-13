import {
  Curve,
  SignatureAlgorithm, 
  publicKeyFromDWalletOutput, 
  type DWalletWithState} from '@ika.xyz/sdk';
import type { SuiObjectResponse } from '@mysten/sui/client';
import { bytesToHex } from "@noble/hashes/utils.js";
import { computeAddress } from "ethers";
import {
  type TransactionSerializableEIP1559, 
  type Hex, parseEther, 
  serializeTransaction, 
  recoverTransactionAddress,
  type PublicClient } from "viem";
import { getSuiClient, getIkaClient, getEthereumClient } from '../config/clients.ts'
import { ENV } from '../config/env.ts';
import { BASE_SEPOLIA_ID } from '../config/constants.ts';


const suiClient = await getSuiClient();
const ikaClient = await getIkaClient();
const ethClient = await getEthereumClient();

export async function prepareEthSigning(ethAmount: string, ethRecipientAddr: string){

    const rbacwallet = await suiClient.getObject({
        id: ENV.WALLET_ADDRESS,
        options: {
            showContent: true,
        },
    });

    const dWallet = await getDwalletInActiveState(rbacwallet);
    const presign = await getPresignCompleted(rbacwallet);

    const dWalletPubKey = await getDwalletPubKey(dWallet, Curve.SECP256K1);
    const ethereumAddr = deriveEthereumAddress(dWalletPubKey);

    const txParams = await getTxParams(ethereumAddr, ethClient as PublicClient);
    
    const unsignedTx: TransactionSerializableEIP1559 = {
        type: "eip1559",
        chainId: BASE_SEPOLIA_ID, 
        nonce: txParams.nonce,
        to: ethRecipientAddr as `0x${string}`,
        value: parseEther(ethAmount),
        maxFeePerGas: BigInt(txParams.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(txParams.maxPriorityFeePerGas),
        gas: BigInt(txParams.gasLimit),
    };
    
    const serializedUnsigned = serializeTransaction(unsignedTx);
    
    const messageBytes = new Uint8Array(
        Buffer.from(serializedUnsigned.replace(/^0x/, ""), "hex")
    );

    return [messageBytes, dWallet, presign]

}

export async function sendTxToEthereumBaseSepolia(sign_id: string, dWallet: DWalletWithState<"Active">, ethAmount: string, ethAddr: string){

    const dWalletPubKey = await getDwalletPubKey(dWallet, Curve.SECP256K1);
    const ethereumAddr = deriveEthereumAddress(dWalletPubKey);

    const txParams = await getTxParams(ethereumAddr, ethClient as PublicClient);
    
    const unsignedTx: TransactionSerializableEIP1559 = {
            type: "eip1559",
            chainId: BASE_SEPOLIA_ID,
            nonce: txParams.nonce,
            to: ethAddr as `0x${string}`,
            value: parseEther(ethAmount),
            maxFeePerGas: BigInt(txParams.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(txParams.maxPriorityFeePerGas),
            gas: BigInt(txParams.gasLimit),
        };
    
    
    const signature = await ikaClient.getSignInParticularState(
        sign_id,
        Curve.SECP256K1,
        SignatureAlgorithm.ECDSASecp256k1,
        'Completed',
    );
     
    const rawSignature = Uint8Array.from(signature.state.Completed.signature);
     
    const ethTxHash = await broadcastTransaction(unsignedTx, new Uint8Array(rawSignature), ethereumAddr, ethClient as PublicClient);

    console.log(`Transaction corretly broadcasted to base sepolia with Tx ID: ${ethTxHash}`);

}








//helpers

async function getDwalletInActiveState(rbacwallet: SuiObjectResponse){
    
    const dWallets = rbacwallet.data?.content?.fields.dWallets.fields.id.id ?? [];

    const dWalletsList = await suiClient.getDynamicFields({
        parentId: dWallets,
    });

    let dwalletCapID;
    for (const item of dWalletsList.data) {
        
        const curve = item.name.value
        const tableValue = await suiClient.getDynamicFieldObject({
            parentId: dWallets,
            name: {
                type: item.name.type,
                value: item.name.value
            }
        });

        if (curve == "secp256k1"){
           dwalletCapID = tableValue.data?.content?.fields.value.fields.dwallet_id;
           break
        }
    }

    const dWalletActive = await ikaClient.getDWalletInParticularState(
        dwalletCapID as unknown as string,
        'Active'
    );

    return dWalletActive

}

async function getPresignCompleted(rbacwallet: SuiObjectResponse){

    const presignatures = rbacwallet.data?.content?.fields.presignatures.fields.id.id


    const presignaturesList = await suiClient.getDynamicFields({
        parentId: presignatures,
    });




    let presignID;
    for (const item of presignaturesList.data) {

        const pairId = item.name.value; 
        
        const tableValue = await suiClient.getDynamicFieldObject({
            parentId: presignatures,
            name: {
                type: item.name.type, 
                value: item.name.value
            }
        });

        
        if (pairId == 1){
            const presignList = tableValue.data?.content?.fields.value;

            presignID = presignList[0].fields.presign_id

            const completedPresign = await ikaClient.getPresignInParticularState(
                presignID,
                'Completed',
            );

            return completedPresign

        }
    }
}



async function getDwalletPubKey(dwallet: DWalletWithState<"Active">, curve: Curve){
    const publicKey = await publicKeyFromDWalletOutput(
        curve,
        new Uint8Array(dwallet.state.Active.public_output),
    );

    return publicKey
}


function deriveEthereumAddress(publicKeyBytes: Uint8Array): string {    
    
    return computeAddress(("0x" + bytesToHex(publicKeyBytes)) as `0x${string}`);

}


async function getTxParams(address: string, ethClient: PublicClient) {
    const [nonce, feeData] = await Promise.all([
      ethClient.getTransactionCount({ address: address as Hex }),
      ethClient.estimateFeesPerGas(),
    ]);

    return {
      nonce,
      maxFeePerGas: (feeData.maxFeePerGas || BigInt("50000000000")).toString(),
      maxPriorityFeePerGas: (
        feeData.maxPriorityFeePerGas || BigInt("2000000000")
      ).toString(),
      gasLimit: "21000",
    };
}



async function broadcastTransaction(unsignedTx: TransactionSerializableEIP1559, signature: Uint8Array, ethAddr: string, ethClient: PublicClient) {

    const r = `0x${Buffer.from(signature.slice(0, 32)).toString(
      "hex"
    )}` as Hex;

    const s = `0x${Buffer.from(signature.slice(32, 64)).toString(
      "hex"
    )}` as Hex;
    
    let signedTx: Hex | null = null;
    for (const yParity of [0, 1] as const) {
      const reconstructedTransaction = serializeTransaction(unsignedTx, { r, s, yParity });
      try {
        const recoveredTxAddress = await recoverTransactionAddress({
          serializedTransaction: reconstructedTransaction
        });
        if (recoveredTxAddress.toLowerCase() === ethAddr.toLowerCase()) {
          signedTx = reconstructedTransaction;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!signedTx) {
      throw new Error(
        "error with v signature"
      );
    }


    const txHash = await ethClient.sendRawTransaction({
        serializedTransaction: signedTx

    });

    const txResult = await ethClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

    return txHash

}