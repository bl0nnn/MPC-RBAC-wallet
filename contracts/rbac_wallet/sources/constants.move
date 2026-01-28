module rbac_wallet::constants;

use std::string::{Self, String};

// === Constants ===

const MAX_U64: u64 = 18446744073709551615;      //max number on u64 
const ADMIN_ROLE_ID: u8 = 0;
const MAX_PRESIGNATURES: u64 = 10;

//ika's supported curves
const CURVE_SECP256K1: u32 = 0;
const CURVE_SECP256R1: u32 = 1;
const CURVE_ED25519: u32 = 2;
const CURVE_RISTRETTO: u32 = 3;


//ika's supported combinations 
const PAIR_ID_K1_TAPROOT: u8 = 0;        // Secp256k1 + Taproot (0,0) (Schnorr)   --- bitcoin
const PAIR_ID_K1_ECDSA: u8 = 1;          // Secp256k1 + ECDSA (0,1)    --- ethereum, evm based
const PAIR_ID_ED_EDDSA: u8 = 2;          // Ed25519 + EdDSA (2,0)    --- Algorand, solana, sui, aptos
const PAIR_ID_R1_ECDSA: u8 = 3;           // Secp256r1 + ECDSA (1, 0)  --- idk
const PAIR_ID_RISTRETTO_SCHNORR: u8 = 4;  // Ristretto + Schnorrkel (3,0)   --- idk


//helpers

public fun get_max_spending(): u64 {
  MAX_U64
}

public fun get_admin_role_id(): u8 {
  ADMIN_ROLE_ID
}

public fun get_max_presignatures_number(): u64 {
  MAX_PRESIGNATURES
}


public fun get_curve_name_from_id(curve_id: u32): String{
  if(curve_id == CURVE_SECP256K1){ 
    return string::utf8(b"secp256k1")
  }else if(curve_id == CURVE_SECP256R1){
    return string::utf8(b"secp256r1")
  }else if(curve_id == CURVE_ED25519){
    return string::utf8(b"ed25519")
  }else if(curve_id == CURVE_RISTRETTO){
    return string::utf8(b"ristretto")
  };

  abort

}


public fun get_pair_id(curve_id: u32, signature_algorithm_id: u32): u8{
  if (curve_id == 0 && signature_algorithm_id == 0){
    return PAIR_ID_K1_TAPROOT
  }else if(curve_id == 0 && signature_algorithm_id == 1){
    return PAIR_ID_K1_ECDSA
  }else if(curve_id == 2 && signature_algorithm_id == 0){
    return PAIR_ID_ED_EDDSA
  }else if(curve_id == 1 && signature_algorithm_id == 0){
    return PAIR_ID_R1_ECDSA
  }else if(curve_id == 3 && signature_algorithm_id == 0){
    return PAIR_ID_RISTRETTO_SCHNORR
  };

  abort

}


public fun get_pair_name_from_pair_id(pair_id: u8): String{
  if(pair_id == PAIR_ID_K1_TAPROOT){
    return string::utf8(b"secp256k1-taproot")
  }else if(pair_id == PAIR_ID_K1_ECDSA){
    return string::utf8(b"secp256k1-ecdsa")
  }else if(pair_id == PAIR_ID_ED_EDDSA){
    return string::utf8(b"ed25519-eddsa")
  }else if(pair_id == PAIR_ID_R1_ECDSA){
    return string::utf8(b"secp256r1-ecdsa")
  }else if(pair_id == PAIR_ID_RISTRETTO_SCHNORR){
    return string::utf8(b"ristretto-schnorr")
  };

  abort
}

