import { Curve, Hash, SignatureAlgorithm } from "@ika.xyz/sdk"

interface ChainSettings {
    curve: Curve;
    signature_algorithm: SignatureAlgorithm; 
    hash_scheme: Hash;
}


export const CHAIN_CONFIG: Record<string, ChainSettings> = {
    'algorand-testnet': {
        curve: Curve.ED25519,
        signature_algorithm: SignatureAlgorithm.EdDSA,     //EDdsa
        hash_scheme: Hash.SHA512          //SHA512
    },
    'ethereum-base-sepolia': {
        curve: Curve.SECP256K1,
        signature_algorithm: SignatureAlgorithm.ECDSASecp256k1,     //ECDSASecp256k1
        hash_scheme: Hash.KECCAK256          //KECCAK256
    },
};

//RPC node
export const SUI_RPC_NODE = "https://sui-testnet-rpc.publicnode.com"


//coins for fees
export const IKA_COIN_TYPE= "0x1f26bb2f711ff82dcda4d02c77d5123089cb7f8418751474b9fb744ce031526a::ika::IKA";
export const SUI_COIN_TYPE= "0x2::sui::SUI";

//for Ethereum
export const BASE_SEPOLIA_ID = 84532;
