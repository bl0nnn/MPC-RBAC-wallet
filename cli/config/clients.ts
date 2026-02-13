import { SuiClient } from "@mysten/sui/client";
import { IkaClient, getNetworkConfig } from "@ika.xyz/sdk";
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { createPublicClient, http} from "viem";
import { baseSepolia } from 'viem/chains'
import { SUI_RPC_NODE } from './constants.ts'

export async function getSuiClient(){
    const suiClient = new SuiClient({ 
      url: SUI_RPC_NODE
    });
    
    return suiClient
}

export async function getIkaClient(){

    const ikaClient = new IkaClient({
	    suiClient: await getSuiClient(),
	    config: getNetworkConfig('testnet'),
	});

	await ikaClient.initialize();

	return ikaClient;

}

export async function getAlgorandClient(){
    return AlgorandClient.testNet();
}

export async function getEthereumClient(){

    const ethClient = createPublicClient({
        chain: baseSepolia,
        transport: http("https://sepolia.base.org")
    })

    return ethClient
}

