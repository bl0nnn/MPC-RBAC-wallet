import { IkaClient, getNetworkConfig } from '@ika.xyz/sdk'
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import { ENV } from './env'

const signerKeypair = Ed25519Keypair.fromSecretKey(ENV.SIGNER_KEY);

const userToAddKey = Ed25519Keypair.fromSecretKey(ENV.ACCOUNT_TEST_THREE_KEY);
const userToAddAddr = userToAddKey.toSuiAddress(); 

const suiClient = new SuiClient({
    url: getFullnodeUrl("testnet")
});


const ikaClient = new IkaClient({
    suiClient: suiClient,
    config: getNetworkConfig('testnet'),
});

await ikaClient.initialize();

const transaction = new Transaction();
transaction.setGasBudget(100000000);

const input_accounts = [userToAddAddr];
const input_accounts_levels = [2];
const packageAddress = ENV.PACKAGE_ADDRESS;

transaction.moveCall({
    package: packageAddress,

    module: 'rbac',
    
    function: 'add_account',
    
    arguments: [
    transaction.object(ENV.WALLET_ADDRESS),
    transaction.pure(bcs.vector(bcs.Address).serialize(input_accounts)),
    transaction.pure(bcs.vector(bcs.U8).serialize(input_accounts_levels))
    ]
});

const tx_result = await suiClient.signAndExecuteTransaction({
    signer: signerKeypair,
    transaction: transaction,
    options: {
        showEffects: true,
        showEvents: true,
    }
});

await suiClient.waitForTransaction({
    digest: tx_result.digest
});


console.log(tx_result.events);