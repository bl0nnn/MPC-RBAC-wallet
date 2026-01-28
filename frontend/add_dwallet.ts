import {Curve, UserShareEncryptionKeys, IkaClient, getNetworkConfig, createRandomSessionIdentifier, prepareDKGAsync} from '@ika.xyz/sdk'
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { bcs } from '@mysten/sui/bcs';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { ENV } from './env'


const signerKeypair = Ed25519Keypair.fromSecretKey(ENV.SIGNER_KEY);
const signerAddress = signerKeypair.toSuiAddress();

const suiClient = new SuiClient({
    url: getFullnodeUrl("testnet")
});


const ikaClient = new IkaClient({
	suiClient: suiClient,
	config: getNetworkConfig('testnet'),
});

await ikaClient.initialize();


const curve = Curve.ED25519; // or Curve.SECP256K1, Curve.ED25519, Curve.RISTRETTO

const userShareEncryptionKeys = await UserShareEncryptionKeys.fromRootSeedKey(
	new TextEncoder().encode('rbacTestbho'),
	curve,
)


const transaction = new Transaction();
transaction.setGasBudget(100000000);

const identifier = createRandomSessionIdentifier();

// Prepare DKG - this generates the necessary cryptographic materials
const dkgRequestInput = await prepareDKGAsync(
	ikaClient,
	curve,
	userShareEncryptionKeys,
	identifier,
	signerAddress,
);

const userPublicOutput = new Uint8Array(dkgRequestInput?.userPublicOutput ?? []);
const publicUserSecretKeyShare = new Uint8Array(dkgRequestInput?.userSecretKeyShare ?? []);
const centralizedPublicKeyShareAndProof = new Uint8Array(dkgRequestInput?.userDKGMessage ?? []);
const dwallet_network_encryption_key_id = await ikaClient.getLatestNetworkEncryptionKey();


let curve_id = 0;
let signature_algorithm = 0;
if(curve == 'ED25519'){
    curve_id = 2;
    signature_algorithm = 0;
}else if( curve == 'SECP256R1'){
    curve_id = 1;
    signature_algorithm = 0;            //change to 1 for ecdsa
}else if(curve == 'SECP256K1'){
    curve_id = 0;
    
}else if(curve == 'RISTRETTO'){
    curve_id = 3;
}else{
    throw new Error("crazy");
    
}


const packageAddress = ENV.PACKAGE_ADDRESS;     

transaction.moveCall({
    package: packageAddress,

    module: 'rbac',
    
    function: 'add_dWallet',
    
    arguments: [
    transaction.object('0x4d157b7415a298c56ec2cb1dcab449525fa74aec17ddba376a83a7600f2062fc'),
    transaction.pure(bcs.vector(bcs.U8).serialize(identifier)),
    transaction.pure.id(dwallet_network_encryption_key_id.id),
    transaction.pure(bcs.vector(bcs.U8).serialize(centralizedPublicKeyShareAndProof)),
    transaction.pure(bcs.vector(bcs.U8).serialize(userPublicOutput)),
    transaction.pure(bcs.vector(bcs.U8).serialize(publicUserSecretKeyShare)),
    transaction.pure.u32(curve_id),
    transaction.object(ENV.WALLET_ADDRESS)
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