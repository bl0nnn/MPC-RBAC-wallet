import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { getSuiClient } from '../config/clients.ts'

const suiClient = await getSuiClient();

export async function transactionExecutor(transaction: Transaction, signerKeypair: Ed25519Keypair) {

    const tx_result = await suiClient.signAndExecuteTransaction({
	    signer: signerKeypair,
	    transaction: transaction,
        options: {
            showEvents: true,
        }
    });

    await suiClient.waitForTransaction({
        digest: tx_result.digest
    });

    return tx_result
    
}


export function getSignerData(user_key: string){
    const signerKeypair = Ed25519Keypair.fromSecretKey(user_key);
    const signerAddress = signerKeypair.toSuiAddress();

    return {signerKeypair, signerAddress}


}