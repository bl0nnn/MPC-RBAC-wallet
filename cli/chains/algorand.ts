import {
  Curve,
  SignatureAlgorithm, 
  publicKeyFromDWalletOutput, 
  type DWalletWithState} from '@ika.xyz/sdk';
import type { SuiObjectResponse } from '@mysten/sui/client';
import algosdk from 'algosdk';

import { getSuiClient, getIkaClient, getAlgorandClient} from '../config/clients.ts'
import { ENV } from '../config/env.ts';

const suiClient = await getSuiClient();
const ikaClient = await getIkaClient();
const algoClient = await getAlgorandClient();

const algod = algoClient.client.algod;

export async function prepareAlgorandSigning(algoAmount: number, algorandRecipientAddr: string){

    const rbacwallet = await suiClient.getObject({
        id: ENV.WALLET_ADDRESS,
        options: {
            showContent: true,
        },
    });

    const dWallet = await getDwalletInActiveState(rbacwallet);
    const presign = await getPresignCompleted(rbacwallet);

    const dWalletPubKey = await getDwalletPubKey(dWallet, Curve.ED25519);
    const algorandAddr = new algosdk.Address(dWalletPubKey).toString();
    console.log(algorandAddr)

    const txParams = await algoClient.getSuggestedParams();
    
    const algorandTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: algorandAddr,
        receiver: algorandRecipientAddr,
        amount: algoAmount,
        suggestedParams: txParams,
    });

    const messageBytes = algorandTx.bytesToSign();

    const txBytes = algorandTx.toByte();

    return [messageBytes, dWallet, presign, txBytes]

}


export async function sendTxToAlgorandTestnet(sign_id: string, algoTx: Uint8Array<ArrayBuffer>){

    const txnPlainObject = algosdk.decodeObj(algoTx);

    const signature = await ikaClient.getSignInParticularState(
            sign_id,
            Curve.ED25519,
            SignatureAlgorithm.EdDSA,
            'Completed',
        );
    const rawSignature = Uint8Array.from(signature.state.Completed.signature);

    const signedTxnObj = {
      sig: new Uint8Array(rawSignature),
      txn: txnPlainObject,
    };

    const rawSignedTxn = algosdk.encodeObj(signedTxnObj);

    try {

        const { txid } = await algod.sendRawTransaction(rawSignedTxn).do();

        await algosdk.waitForConfirmation(algod, txid, 4);
        console.log(`Transazione confermata con transaction id: ${txid} `)

    } catch (e: any) {

        if (e.response && e.response.text) {
            console.error("Errore Nodo:", JSON.parse(e.response.text).message);
        } else {
            console.error("Errore:", e);
        }
    }
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

        if (curve == "ed25519"){

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

        
        if (pairId == 2){
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

function getDwalletPubKey(dwallet: DWalletWithState<"Active">, curve: Curve){
    const publicKey = publicKeyFromDWalletOutput(
        curve,
        new Uint8Array(dwallet.state.Active.public_output),
    );

    return publicKey
}