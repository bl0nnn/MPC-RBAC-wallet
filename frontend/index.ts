import {Curve, UserShareEncryptionKeys, IkaClient, getNetworkConfig, createRandomSessionIdentifier, prepareDKGAsync} from '@ika.xyz/sdk'
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { bcs } from '@mysten/sui/bcs';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { ENV } from './env'

const signerKeypair = Ed25519Keypair.fromSecretKey(ENV.SIGNER_KEY);
const signerAddress = signerKeypair.toSuiAddress();

const recoveryUser1KeyPair = Ed25519Keypair.fromSecretKey(ENV.ACCOUNT_TEST_ONE_KEY); 
const recoveryUserAddress1 = recoveryUser1KeyPair.toSuiAddress();

const recoveryUser2KeyPair = Ed25519Keypair.fromSecretKey(ENV.ACCOUNT_TEST_TWO_KEY);
const recoveryUserAddress2 = recoveryUser2KeyPair.toSuiAddress();

const suiClient = new SuiClient({
    url: getFullnodeUrl("testnet")
});


const ikaClient = new IkaClient({
	suiClient: suiClient,
	config: getNetworkConfig('testnet'),
});

await ikaClient.initialize();


const curve = Curve.SECP256K1; // or Curve.SECP256K1, Curve.ED25519, Curve.RISTRETTO

const userShareEncryptionKeys = await UserShareEncryptionKeys.fromRootSeedKey(
	new TextEncoder().encode('rbacTest5'),
	curve,
);


const transaction = new Transaction();
transaction.setGasBudget(100000000);

const initialIkaCoinForBalance = transaction.add(

	coinWithBalance({
		type: `0x1f26bb2f711ff82dcda4d02c77d5123089cb7f8418751474b9fb744ce031526a::ika::IKA`,
		balance: 1_000_000_000,
	})
);

const initialSuiCoinForBalance = transaction.splitCoins(transaction.gas, [1_000_000_000]);


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


//usless, just to have it for later
let curve_id = 0;
if(curve == 'SECP256K1'){
    curve_id = 0;
}else if( curve == 'SECP256R1'){
    curve_id = 1;
}else if(curve == 'ED25519'){
    curve_id = 2;
}else if(curve == 'RISTRETTO'){
    curve_id = 3;
}else{
    throw new Error("crazy");
    
}


const role_ids = [1,2,3];
const input_sign_abilities = [true, true, false];
const input_spending_limits = [250000000, 1000000, 1000]
const input_recovery_times= [10000,1000000,10000000];

const input_recovery_accounts = [recoveryUserAddress1, recoveryUserAddress2];
const input_recovery_accounts_levels = [1,3];


const packageAddress = ENV.PACKAGE_ADDRESS;     //onn chain contract address

transaction.moveCall({
    package: packageAddress,

    module: 'rbac',
    
    function: 'create_wallet',
    
    arguments: [
    transaction.object('0x4d157b7415a298c56ec2cb1dcab449525fa74aec17ddba376a83a7600f2062fc'),   
    transaction.pure(bcs.vector(bcs.U8).serialize(identifier)),
    transaction.pure.id(dwallet_network_encryption_key_id.id),
    transaction.pure(bcs.vector(bcs.U8).serialize(centralizedPublicKeyShareAndProof)),
    transaction.pure(bcs.vector(bcs.U8).serialize(userPublicOutput)),
    transaction.pure(bcs.vector(bcs.U8).serialize(publicUserSecretKeyShare)),
    transaction.object(initialIkaCoinForBalance),
    transaction.object(initialSuiCoinForBalance),
    transaction.pure.u32(curve_id),
    transaction.pure(bcs.vector(bcs.U8).serialize(role_ids)),
    transaction.pure(bcs.vector(bcs.Bool).serialize(input_sign_abilities)),
    transaction.pure(bcs.vector(bcs.U64).serialize(input_spending_limits)),
    transaction.pure(bcs.vector(bcs.U64).serialize(input_recovery_times)),
    transaction.pure(bcs.vector(bcs.Address).serialize(input_recovery_accounts)),
    transaction.pure(bcs.vector(bcs.U8).serialize(input_recovery_accounts_levels))
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