import { IkaClient, getNetworkConfig } from '@ika.xyz/sdk'
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { ENV } from './env'

const signerKeypair = Ed25519Keypair.fromSecretKey(ENV.SIGNER_KEY);

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

const curve_id = 3;
const signature_algorithm = 0;
const packageAddress = ENV.PACKAGE_ADDRESS;

transaction.moveCall({
    package: packageAddress,

    module: 'rbac',
    
    function: 'add_presignature_to_pool',
    
    arguments: [
    transaction.object(ENV.WALLET_ADDRESS),
    transaction.object('0x4d157b7415a298c56ec2cb1dcab449525fa74aec17ddba376a83a7600f2062fc'),   
    transaction.pure.u32(curve_id),
    transaction.pure.u32(signature_algorithm)
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