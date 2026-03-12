import algosdk from 'algosdk';

export interface AlgorandWalletConfig {
  ika_public_key: Uint8Array<ArrayBufferLike>;
  ika_address: string;
  fallback_address: algosdk.Address;
}

export interface WalletConfig {
  wallet_chain: string;
  config: AlgorandWalletConfig;
}