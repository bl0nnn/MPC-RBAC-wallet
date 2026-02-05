import {
    Curve, 
    UserShareEncryptionKeys, 
    createRandomSessionIdentifier, 
    prepareDKGAsync, 
    createUserSignMessageWithPublicOutput, 
    SignatureAlgorithm, 
    Hash, 
    type DWalletWithState} from '@ika.xyz/sdk'
import { 
    Transaction, 
    coinWithBalance } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { extract, expand } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';

import { ENV } from '../config/env.ts';
import { getSuiClient, getIkaClient } from '../config/clients.ts'
import { CHAIN_CONFIG, IKA_COIN_TYPE } from '../config/constants.ts';
import { prepareEthSigning, sendTxToEthereumBaseSepolia } from '../chains/ethereum.ts';
import { prepareAlgorandSigning, sendTxToAlgorandTestnet } from '../chains/algorand.ts';


export async function createRbacWallet(
    chain: string, 
    role_ids: number[], 
    roles_sign_ability: boolean[], 
    roles_spending_limit: number[], 
    roles_recovery_time: number[],
    new_users: string[],
    new_users_roles: number[]
){
    
    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const curve = Curve.SECP256K1;

    const seedKey = seedGenrator(ENV.HKDF_KEY_HEX, chain);


    const userShareEncryptionKeys = await UserShareEncryptionKeys.fromRootSeedKey(
        seedKey,		
	    curve,
    );




    const identifier = createRandomSessionIdentifier();


    const dkgRequestInput = await prepareDKGAsync(
        ikaClient,
        curve,
        userShareEncryptionKeys,
        identifier,
        signerAddress,
    );


    const transaction = new Transaction();

    const initialIkaCoinForBalance = transaction.add(
        coinWithBalance({
            type: IKA_COIN_TYPE,
            balance: 1_000_000_000,
        })
    );
    
    const initialSuiCoinForBalance = transaction.splitCoins(
        transaction.gas, 
        [1_000_000_000]
    );

    const userPublicOutput = new Uint8Array(dkgRequestInput?.userPublicOutput ?? []);
    const publicUserSecretKeyShare = new Uint8Array(dkgRequestInput?.userSecretKeyShare ?? []);
    const centralizedPublicKeyShareAndProof = new Uint8Array(dkgRequestInput?.userDKGMessage ?? []);


    const dwallet_network_encryption_key_id = await ikaClient.getLatestNetworkEncryptionKey();

    const curve_id = get_curve_id(curve);

    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
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
        transaction.pure(bcs.vector(bcs.Bool).serialize(roles_sign_ability)),
        transaction.pure(bcs.vector(bcs.U64).serialize(roles_spending_limit)),
        transaction.pure(bcs.vector(bcs.U64).serialize(roles_recovery_time)),
        transaction.pure(bcs.vector(bcs.Address).serialize(new_users)),
        transaction.pure(bcs.vector(bcs.U8).serialize(new_users_roles))
        ]
    });

    const tx_result = await suiClient.signAndExecuteTransaction({
	    signer: signerKeypair,
	    transaction: transaction,
        options: {
            showEvents: true,
        }
    });

    console.log(tx_result.events);

}


export async function addPresignature(chain: string){

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const transaction = new Transaction();

    const curve_id =  get_curve_id(CHAIN_CONFIG[chain].curve);
    const signature_algorithm_id = get_signature_algorithm_id(CHAIN_CONFIG[chain]);
    
    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'add_presignature_to_pool',
        
        arguments: [
        transaction.object(ENV.WALLET_ADDRESS),
        transaction.object('0x4d157b7415a298c56ec2cb1dcab449525fa74aec17ddba376a83a7600f2062fc'),   
        transaction.pure.u32(curve_id),
        transaction.pure.u32(signature_algorithm_id)
        ]
    });

    const tx_result = await suiClient.signAndExecuteTransaction({
	    signer: signerKeypair,
	    transaction: transaction,
        options: {
            showEvents: true,
        }
    });

    console.log(tx_result.events)

}

export async function addDwallet(chain: string){

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const curve = CHAIN_CONFIG[chain].curve;

    const userShareEncryptionKeys = await UserShareEncryptionKeys.fromRootSeedKey(
        seedGenrator(ENV.HKDF_KEY_HEX, chain),		
	    curve,
    );

    const identifier = createRandomSessionIdentifier();

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
    
    const curve_id = get_curve_id(CHAIN_CONFIG[chain].curve)

    const dwallet_network_encryption_key_id = await ikaClient.getLatestNetworkEncryptionKey();  


    const transaction = new Transaction();

    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
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
            showEvents: true,
        }
    });
    
    await suiClient.waitForTransaction({
        digest: tx_result.digest
    });
    
    
    console.log(tx_result.events);

}

export async function addUsers(new_users: string[], new_users_roles: number[]) {

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const transaction = new Transaction; 

    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'add_account',
        
        arguments: [
            transaction.object(ENV.WALLET_ADDRESS),
            transaction.pure(bcs.vector(bcs.Address).serialize(new_users)),
            transaction.pure(bcs.vector(bcs.U8).serialize(new_users_roles))
        ]
    });
    
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
    
    
    console.log(tx_result.events);

}


export async function removeUsers(users_to_remove: string[]){

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const transaction = new Transaction;

    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'remove_account',
        
        arguments: [
        transaction.object(ENV.WALLET_ADDRESS),
        transaction.pure(bcs.vector(bcs.Address).serialize(users_to_remove)),
        ]
    });
    
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
    
    
    console.log(tx_result.events);

}


export async function initRecovery(new_admin: string){

    const {suiClient, ikaClient} = await getClients();
    //const {signerKeypair, signerAddress} = getSignerKeyPair();
    const userKeypair = Ed25519Keypair.fromSecretKey(ENV.TEST_RECOVERY_ACC)
    const userAddr = userKeypair.toSuiAddress();

    const transaction = new Transaction;

    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'init_recovery',
        
        arguments: [
            transaction.object(ENV.WALLET_ADDRESS),
            transaction.pure.address(new_admin),
            transaction.object(SUI_CLOCK_OBJECT_ID)
        ]
    });
    
    const tx_result = await suiClient.signAndExecuteTransaction({
        signer: userKeypair,
        transaction: transaction,
        options: {
            showEvents: true,
        }
    });
    
    await suiClient.waitForTransaction({
        digest: tx_result.digest
    });
    
    
    console.log(tx_result.events);

}


export async function finalizeRecovery(){       //check on rec time status-

    const {suiClient, ikaClient} = await getClients();
    const userKeypair = Ed25519Keypair.fromSecretKey(ENV.TEST_RECOVERY_ACC)
    const userAddr = userKeypair.toSuiAddress();

    const transaction = new Transaction;

    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'finalize_recovery',
        
        arguments: [
            transaction.object(ENV.WALLET_ADDRESS),
            transaction.object(SUI_CLOCK_OBJECT_ID)
        ]
    });
    
    const tx_result = await suiClient.signAndExecuteTransaction({
        signer: userKeypair ,
        transaction: transaction,
        options: {
            showEvents: true,
        }
    });
    
    await suiClient.waitForTransaction({
        digest: tx_result.digest
    });
    
    
    console.log(tx_result.events);

}

export async function cancelRecovery(){       

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const transaction = new Transaction;

    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'cancel_recovery',
        
        arguments: [
            transaction.object(ENV.WALLET_ADDRESS),
        ]
    });
    
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
    
    
    console.log(tx_result.events);

}

export async function updateUsersRole(users_to_modify: string[], new_roles_assigned: number[]){

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const transaction = new Transaction;

    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'update_accounts_role',
        
        arguments: [
            transaction.object(ENV.WALLET_ADDRESS),
            transaction.pure(bcs.vector(bcs.Address).serialize(users_to_modify)),
            transaction.pure(bcs.vector(bcs.U8).serialize(new_roles_assigned))

        ]
    });
    
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
    
    
    console.log(tx_result.events);

}

export async function addRoles(new_roles: number[], new_roles_sign_abilities: boolean[], new_roles_recovery_times: number[], new_roles_spending_limits: number[]){

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const transaction = new Transaction;
    transaction.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'add_roles',
        
        arguments: [
            transaction.object(ENV.WALLET_ADDRESS),
            transaction.pure(bcs.vector(bcs.U8).serialize(new_roles)),
            transaction.pure(bcs.vector(bcs.Bool).serialize(new_roles_sign_abilities)),
            transaction.pure(bcs.vector(bcs.U64).serialize(new_roles_recovery_times)),
            transaction.pure(bcs.vector(bcs.U64).serialize(new_roles_spending_limits))
        ]
    });
    
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
    
    
    console.log(tx_result.events);
}

export async function deposit(suis: number, ikas: number){

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    const transaction = new Transaction();
    
    const ikaAmountToDeposit = transaction.add(
    
        coinWithBalance({
            type: `0x1f26bb2f711ff82dcda4d02c77d5123089cb7f8418751474b9fb744ce031526a::ika::IKA`,
            balance: ikas,
        })
    );
    
    const suiAmountToDeposit = transaction.splitCoins(transaction.gas, [suis]);
    
    
    const packageAddress = ENV.PACKAGE_ADDRESS;     
    
    transaction.moveCall({
        package: packageAddress,
    
        module: 'rbac',
        
        function: 'deposit',
        
        arguments: [
            transaction.object(ENV.WALLET_ADDRESS),
            transaction.object(ikaAmountToDeposit),
            transaction.object(suiAmountToDeposit),
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

}


export async function signMessage(chain: string, amount: number, recipient: string){

    const {suiClient, ikaClient} = await getClients();
    const {signerKeypair, signerAddress} = getSignerKeyPair();

    let messageBytes: Uint8Array<ArrayBuffer>;
    let dWallet: DWalletWithState<"Active">; 
    let presign: any;

    const curve_id = get_curve_id(CHAIN_CONFIG[chain].curve);
    const signature_algorithm_id = get_signature_algorithm_id(CHAIN_CONFIG[chain]);
    const hash_scheme_id = get_hash_scheme_id(CHAIN_CONFIG[chain]);

    if(chain == "ethereum-base-sepolia"){
        const signignData = await prepareEthSigning(String(amount), recipient);
        messageBytes = signignData[0] as Uint8Array<ArrayBuffer>;
        dWallet = signignData[1] as DWalletWithState<"Active">;
        presign = signignData[2];
    }else if (chain == "algorand-testnet"){
        const signignData = await prepareAlgorandSigning(amount, recipient);
        messageBytes = signignData[0] as Uint8Array<ArrayBuffer>;
        dWallet = signignData[1] as DWalletWithState<"Active">;
        presign = signignData[2];
        console.log(presign)
    }else{
        throw new Error('Chain not yet supported!')
    }

    

    const ikaParams = new Uint8Array(Array.from(await ikaClient.getProtocolPublicParameters()));

    console.log("--- DEBUG LUNGHEZZE BUFFER ---");
console.log("ikaParams:", ikaParams.length); // Scommetto che questo è 112
console.log("public_output:", dWallet.state.Active.public_output.length);
console.log("user_secret_key_share:", (dWallet.public_user_secret_key_share ?? []).length);
console.log("presign:", presign.state.Completed.presign.length);
console.log("messageBytes:", messageBytes.length); // Sappiamo che è 172 per Algo
console.log("------------------------------");

        
    const messageCentralizedSignature = await createUserSignMessageWithPublicOutput(
        ikaParams,
        new Uint8Array(dWallet.state.Active.public_output),
        new Uint8Array(dWallet.public_user_secret_key_share ?? []),
        new Uint8Array(presign.state.Completed.presign),
        messageBytes,
        CHAIN_CONFIG[chain].hash_scheme,
        CHAIN_CONFIG[chain].signature_algorithm,
        CHAIN_CONFIG[chain].curve,
    );
    
    const tx = new Transaction();
     
    tx.moveCall({
        package: ENV.PACKAGE_ADDRESS,
    
        module: 'rbac',
        
        function: 'sign_messagge',
    
        arguments: [
            tx.object(ENV.WALLET_ADDRESS),
            tx.object('0x4d157b7415a298c56ec2cb1dcab449525fa74aec17ddba376a83a7600f2062fc'),
            tx.pure.vector('u8', Array.from(messageBytes)),
            tx.pure.vector('u8', Array.from(messageCentralizedSignature)),
            tx.pure.u32(curve_id),
            tx.pure.u32(signature_algorithm_id),
             tx.pure.u32(hash_scheme_id)
        ],
    });
     
    const result = await suiClient.signAndExecuteTransaction({
        transaction: tx,
        signer: signerKeypair,
        options: {
            showEvents: true,
        }
    });
     
    await suiClient.waitForTransaction({
        digest: result.digest
    });
    
    
    const sign_id = result.events[2].parsedJson.sign_id;

    if(chain == "ethereum-base-sepolia"){
        sendTxToEthereumBaseSepolia(sign_id, dWallet, String(amount), recipient);
    }else if(chain == "algorand-testnet"){
        sendTxToAlgorandTestnet(sign_id, messageBytes);
    }else{
        throw new Error('still to implement')
    }
}
//a signMessage passiamo walletID

//---------- helpers ----------------

async function getClients() {
    const suiClient = await getSuiClient();
    const ikaClient = await getIkaClient();
    return { suiClient, ikaClient };
}

function getSignerKeyPair(){
    const signerKeypair = Ed25519Keypair.fromSecretKey(ENV.SIGNER_KEY);
    const signerAddress = signerKeypair.toSuiAddress();

    return {signerKeypair, signerAddress}


}


function seedGenrator(hkdfKey: string, context: string){

    const inputKey = Uint8Array.from(hkdfKey);
    const prk = extract(sha256, inputKey, undefined);
    const info = new TextEncoder().encode(context);

    return expand(sha256, prk, info, 32);
}

function get_curve_id(curve: Curve){

    /*
    //ika's supported curves
    const CURVE_SECP256K1: u32 = 0;
    const CURVE_SECP256R1: u32 = 1;
    const CURVE_ED25519: u32 = 2;
    const CURVE_RISTRETTO: u32 = 3;
    */

    if(curve == Curve.SECP256K1){
        return 0
    }else if(curve == Curve.SECP256R1){
        return 1
    }else if(curve == Curve.ED25519){
        return 2
    }else if(curve == Curve.RISTRETTO){
        return 3
    }else{
        throw new Error('Curve not supported')
    }

}

function get_signature_algorithm_id(chain_config: any){

    if(chain_config.curve == Curve.SECP256K1 && chain_config.signature_algorithm == SignatureAlgorithm.ECDSASecp256k1){
        return 0
    } else if (chain_config.curve == Curve.SECP256K1 && chain_config.signature_algorithm == SignatureAlgorithm.Taproot){
        return 1
    }else if (chain_config.curve == Curve.SECP256R1) {
        return 0
    }else if (chain_config.curve == Curve.ED25519){
        return 0
    }else if (chain_config.curve == Curve.RISTRETTO){
        return 0
    }else{
        throw new Error("Signature algorithm not recognized")
    }

}


function get_hash_scheme_id(chain_config: any){

    if(chain_config.curve == Curve.SECP256K1 && chain_config.signature_algorithm == SignatureAlgorithm.ECDSASecp256k1 && chain_config.hash_scheme == Hash.KECCAK256){
        return 0
    } else if (chain_config.curve == Curve.SECP256K1 && chain_config.signature_algorithm == SignatureAlgorithm.ECDSASecp256k1 && chain_config.hash_scheme == Hash.SHA256){
        return 1
    }else if (chain_config.curve == Curve.SECP256K1 && chain_config.signature_algorithm == SignatureAlgorithm.ECDSASecp256k1 && chain_config.hash_scheme == Hash.DoubleSHA256) {
        return 2
    }else if (chain_config.curve == Curve.SECP256K1 && chain_config.signature_algorithm == SignatureAlgorithm.Taproot){
        return 2
    }else if (chain_config.curve == Curve.SECP256R1){
        return 0
    }else if (chain_config.curve == Curve.ED25519){
        return 0
    }else if (chain_config.curve == Curve.RISTRETTO){
        return 0
    }else{
        throw new Error("Hash scheme not recognized")
    }

}