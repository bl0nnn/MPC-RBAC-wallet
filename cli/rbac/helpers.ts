import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { getSuiClient } from '../config/clients.ts';
import { extract, expand } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { 
  Curve, 
  SignatureAlgorithm, 
  Hash 
} from '@ika.xyz/sdk';

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

export function get_curve_id(curve: Curve) {
  /*
    //ika's supported curves
    const CURVE_SECP256K1: u32 = 0;
    const CURVE_SECP256R1: u32 = 1;
    const CURVE_ED25519: u32 = 2;
    const CURVE_RISTRETTO: u32 = 3;
    */

  if (curve == Curve.SECP256K1) {
    return 0;
  } else if (curve == Curve.SECP256R1) {
    return 1;
  } else if (curve == Curve.ED25519) {
    return 2;
  } else if (curve == Curve.RISTRETTO) {
    return 3;
  } else {
    throw new Error("Curve not supported");
  }
}

export function get_signature_algorithm_id(chain_config: any) {
  if (
    chain_config.curve == Curve.SECP256K1 &&
    chain_config.signature_algorithm == SignatureAlgorithm.ECDSASecp256k1
  ) {
    return 0;
  } else if (
    chain_config.curve == Curve.SECP256K1 &&
    chain_config.signature_algorithm == SignatureAlgorithm.Taproot
  ) {
    return 1;
  } else if (chain_config.curve == Curve.SECP256R1) {
    return 0;
  } else if (chain_config.curve == Curve.ED25519) {
    return 0;
  } else if (chain_config.curve == Curve.RISTRETTO) {
    return 0;
  } else {
    throw new Error("Signature algorithm not recognized");
  }
}


export function get_hash_scheme_id(chain_config: any) {
  if (
    chain_config.curve == Curve.SECP256K1 &&
    chain_config.signature_algorithm == SignatureAlgorithm.ECDSASecp256k1 &&
    chain_config.hash_scheme == Hash.KECCAK256
  ) {
    return 0;
  } else if (
    chain_config.curve == Curve.SECP256K1 &&
    chain_config.signature_algorithm == SignatureAlgorithm.ECDSASecp256k1 &&
    chain_config.hash_scheme == Hash.SHA256
  ) {
    return 1;
  } else if (
    chain_config.curve == Curve.SECP256K1 &&
    chain_config.signature_algorithm == SignatureAlgorithm.ECDSASecp256k1 &&
    chain_config.hash_scheme == Hash.DoubleSHA256
  ) {
    return 2;
  } else if (
    chain_config.curve == Curve.SECP256K1 &&
    chain_config.signature_algorithm == SignatureAlgorithm.Taproot
  ) {
    return 2;
  } else if (chain_config.curve == Curve.SECP256R1) {
    return 0;
  } else if (chain_config.curve == Curve.ED25519) {
    return 0;
  } else if (chain_config.curve == Curve.RISTRETTO) {
    return 0;
  } else {
    throw new Error("Hash scheme not recognized");
  }
}

export function seedGenrator(hkdfKey: string, context: string) {
  const inputKey = Uint8Array.from(hkdfKey);
  const prk = extract(sha256, inputKey, undefined);
  const info = new TextEncoder().encode(context);

  return expand(sha256, prk, info, 32);
}