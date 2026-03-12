import {
  Curve,
  SignatureAlgorithm,
  publicKeyFromDWalletOutput,
  type DWalletWithState,
} from "@ika.xyz/sdk";
import type { SuiObjectResponse } from "@mysten/sui/client";
import algosdk from "algosdk";
import fs from 'fs';

import {
  getSuiClient,
  getIkaClient,
  getAlgorandClient,
} from "../config/clients.ts";
import { ENV } from "../config/env.ts";
import { type WalletConfig } from "../config/types.ts";

const suiClient = await getSuiClient();
const ikaClient = await getIkaClient();
const algoClient = await getAlgorandClient();
const algod = algoClient.client.algod;

export async function prepareAlgorandSigning(
  algoAmount: number,
  algorandRecipientAddr: string,
) {

  const walletsFilePath: string = 'wallets.json';

  const rbacwallet = await suiClient.getObject({
    id: ENV.WALLET_ADDRESS,
    options: {
      showContent: true,
    },
  });

  if(!fs.existsSync(walletsFilePath)){

        const dWallet = await getDwalletInActiveState(rbacwallet);
        const dWalletPubKey = await getDwalletPubKey(dWallet, Curve.ED25519);
        const algorandAddr = new algosdk.Address(dWalletPubKey).toString();

        const fallbackAccount = algosdk.mnemonicToSecretKey(
            ENV.FALLBACK_ADDR
        );
        const config: WalletConfig = {
            wallet_chain: "algorand",
            config: {
                ika_public_key: dWalletPubKey,
                ika_address: algorandAddr,
                fallback_address: fallbackAccount.addr
            }
        }

       fs.writeFileSync(walletsFilePath, JSON.stringify(config, null, 2));
    }

    const rawFile = fs.readFileSync(walletsFilePath, 'utf-8');
    const config: WalletConfig = JSON.parse(rawFile);


    const fallbackState = await getFallbackState(rbacwallet);
    const ikaAddr = config.config.ika_address;

    if(fallbackState){
        await signwithfallback(algoAmount, algorandRecipientAddr, ikaAddr);
        throw new Error("Fallback signing executed");
    }else{
        const fallbackAccount = algosdk.mnemonicToSecretKey(
            ENV.FALLBACK_ADDR
        );
        const msigParams = {
            version: 1,
            threshold: 1,
            addrs: [
                ikaAddr,
                fallbackAccount.addr
            ],
        };

        const sender = algosdk.multisigAddress(msigParams);
        const txParams = await algoClient.getSuggestedParams();

        const algorandTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender,
            receiver: algorandRecipientAddr,
            amount: algoAmount,
            suggestedParams: txParams,
        });

        const messageBytes = algorandTx.bytesToSign();
        const txBytes = algorandTx.toByte();

        const dWallet = await getDwalletInActiveState(rbacwallet);
        const presign = await getPresignCompleted(rbacwallet);

        return [messageBytes, dWallet, presign, txBytes, ikaAddr]
    }
}



async function signwithfallback(algoAmount: number, recipientAddr: string, ikaAddr: string){

    const fallbackAccount = algosdk.mnemonicToSecretKey(
        ENV.FALLBACK_ADDR
    );

    const msigParams = {
        version: 1,
        threshold: 1,
        addrs: [
            ikaAddr,
            fallbackAccount.addr
        ],
    };

    const multisigAddress = algosdk.multisigAddress(msigParams);

    const params = await algod.getTransactionParams().do();

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: multisigAddress,
        receiver: recipientAddr,
        amount: algoAmount,
        suggestedParams: params,
    });


    const { blob } = algosdk.signMultisigTransaction(
        txn,
        msigParams,
        fallbackAccount.sk
    );

    const tx = await algod.sendRawTransaction(blob).do();

    console.log("TXID:", tx.txid);
    
    await algosdk.waitForConfirmation(algod, tx.txid, 4);
    
    console.log("Transaction confirmed");

}




export async function sendTxToAlgorandTestnet(
  sign_id: string,
  algoTx: Uint8Array<ArrayBuffer>,
  ikaAddr: string
) {

  const fallbackAccount = algosdk.mnemonicToSecretKey(
            ENV.FALLBACK_ADDR
  );

  const txnPlainObject = algosdk.decodeObj(algoTx);

  const signature = await ikaClient.getSignInParticularState(
    sign_id,
    Curve.ED25519,
    SignatureAlgorithm.EdDSA,
    "Completed",
  );
  const rawSignature = Uint8Array.from(signature.state.Completed.signature);

  const signedTxn = {
        txn: txnPlainObject,
        msig: {
            v: 1,
            thr: 1,
            subsig: [
                {
                    pk: algosdk.decodeAddress(ikaAddr).publicKey,
                    s: rawSignature
                },
                {
                    pk: algosdk.decodeAddress(fallbackAccount.addr.toString()).publicKey
                }
            ]
        }
    };

  const rawSignedTxn = algosdk.encodeObj(signedTxn);

  try {
    const { txid } = await algod.sendRawTransaction(rawSignedTxn).do();

    await algosdk.waitForConfirmation(algod, txid, 4);
    console.log(`Confirmed transaction with id: ${txid} `);
  } catch (e: any) {
    if (e.response && e.response.text) {
      console.error("Errore Nodo:", JSON.parse(e.response.text).message);
    } else {
      console.error("Errore:", e);
    }
  }
}



//helpers

async function getDwalletInActiveState(rbacwallet: SuiObjectResponse) {
  if (
    !rbacwallet.data?.content ||
    rbacwallet.data.content.dataType !== "moveObject"
  ) {
    throw new Error("Invalid wallet object: not a move object");
  }

  const dWallets =
    (rbacwallet.data.content.fields as any).dWallets.fields.id.id ?? [];

  const dWalletsList = await suiClient.getDynamicFields({
    parentId: dWallets,
  });

  let dwalletCapID;
  for (const item of dWalletsList.data) {
    const curve = item.name.value;

    const tableValue = await suiClient.getDynamicFieldObject({
      parentId: dWallets,
      name: {
        type: item.name.type,
        value: item.name.value,
      },
    });

    if (
      !tableValue.data?.content ||
      tableValue.data.content.dataType !== "moveObject"
    ) {
      continue;
    }

    if (curve == "ed25519") {
      dwalletCapID = (tableValue.data.content.fields as any).value.fields
        .dwallet_id;
      break;
    }
  }

  const dWalletActive = await ikaClient.getDWalletInParticularState(
    dwalletCapID as unknown as string,
    "Active",
  );

  return dWalletActive;
}



async function getPresignCompleted(rbacwallet: SuiObjectResponse) {
  if (
    !rbacwallet.data?.content ||
    rbacwallet.data.content.dataType !== "moveObject"
  ) {
    throw new Error("Invalid wallet object: not a move object");
  }

  const presignatures = (rbacwallet.data.content.fields as any).presignatures
    .fields.id.id;

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
        value: item.name.value,
      },
    });

    if (pairId == 2) {
      if (
        !tableValue.data?.content ||
        tableValue.data.content.dataType !== "moveObject"
      ) {
        continue;
      }
      const presignList = (tableValue.data.content.fields as any).value;

      presignID = (presignList[0] as any).fields.presign_id;
      const completedPresign = await ikaClient.getPresignInParticularState(
        presignID,
        "Completed",
      );

      return completedPresign;
    }
  }
}



function getDwalletPubKey(dwallet: DWalletWithState<"Active">, curve: Curve) {
  const publicKey = publicKeyFromDWalletOutput(
    curve,
    new Uint8Array(dwallet.state.Active.public_output),
  );

  return publicKey;
}


async function getFallbackState(rbacwallet: SuiObjectResponse){
    return rbacwallet.data?.content?.fields.fallback
}