import {
  UserShareEncryptionKeys,
  createRandomSessionIdentifier,
  prepareDKGAsync,
  createUserSignMessageWithPublicOutput,
  type DWalletWithState,
} from "@ika.xyz/sdk";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { ENV } from "../config/env.ts";
import { CHAIN_CONFIG, IKA_COIN_TYPE } from "../config/constants.ts";
import {
  prepareEthSigning,
  sendTxToEthereumBaseSepolia,
} from "../chains/ethereum.ts";
import {
  prepareAlgorandSigning,
  sendTxToAlgorandTestnet,
} from "../chains/algorand.ts";
import { 
  transactionExecutor, 
  getSignerData, 
  get_hash_scheme_id, 
  get_signature_algorithm_id, 
  get_curve_id, 
  seedGenrator,
  getClients
} from './helpers.ts';

export async function createRbacWallet(
  chain: string,
  role_ids: number[],
  roles_sign_ability: boolean[],
  roles_spending_limit: number[],
  roles_recovery_time: number[],
  new_users: string[],
  new_users_roles: number[],
) {
  const { ikaClient } = await getClients();
  const { signerKeypair, signerAddress } = getSignerData(ENV.SIGNER_KEY);

  const curve = CHAIN_CONFIG[chain].curve;

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
    }),
  );

  const initialSuiCoinForBalance = transaction.splitCoins(
    transaction.gas,
    [1_000_000_000],
  );

  const userPublicOutput = new Uint8Array(
    dkgRequestInput?.userPublicOutput ?? [],
  );
  const publicUserSecretKeyShare = new Uint8Array(
    dkgRequestInput?.userSecretKeyShare ?? [],
  );
  const centralizedPublicKeyShareAndProof = new Uint8Array(
    dkgRequestInput?.userDKGMessage ?? [],
  );

  const dwallet_network_encryption_key_id =
    await ikaClient.getLatestNetworkEncryptionKey();

  const curve_id = get_curve_id(curve);

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "create_wallet",

    arguments: [
      transaction.object(ikaClient.ikaConfig.objects.ikaDWalletCoordinator.objectID),
      transaction.pure(bcs.vector(bcs.U8).serialize(identifier)),
      transaction.pure.id(dwallet_network_encryption_key_id.id),
      transaction.pure(
        bcs.vector(bcs.U8).serialize(centralizedPublicKeyShareAndProof),
      ),
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
      transaction.pure(bcs.vector(bcs.U8).serialize(new_users_roles)),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events)
}

export async function addPresignature(chain: string) {
  
  const { ikaClient } = await getClients();
  console.log(ikaClient.ikaConfig.objects.ikaDWalletCoordinator.objectID)
  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  const transaction = new Transaction();
  transaction.setGasBudget(100000000);

  const curve_id = get_curve_id(CHAIN_CONFIG[chain].curve);
  const signature_algorithm_id = get_signature_algorithm_id(
    CHAIN_CONFIG[chain],
  );

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "add_presignature_to_pool",

    arguments: [
      transaction.object(ENV.WALLET_ADDRESS),
      transaction.object(ikaClient.ikaConfig.objects.ikaDWalletCoordinator.objectID),
      transaction.pure.u32(curve_id),
      transaction.pure.u32(signature_algorithm_id),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events)
}

export async function addDwallet(chain: string) {

  const { ikaClient } = await getClients();
  const { signerKeypair, signerAddress } = getSignerData(ENV.SIGNER_KEY);

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

  const userPublicOutput = new Uint8Array(
    dkgRequestInput?.userPublicOutput ?? [],
  );
  const publicUserSecretKeyShare = new Uint8Array(
    dkgRequestInput?.userSecretKeyShare ?? [],
  );
  const centralizedPublicKeyShareAndProof = new Uint8Array(
    dkgRequestInput?.userDKGMessage ?? [],
  );

  const curve_id = get_curve_id(CHAIN_CONFIG[chain].curve);

  const dwallet_network_encryption_key_id =
    await ikaClient.getLatestNetworkEncryptionKey();

  const transaction = new Transaction();

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "add_dWallet",

    arguments: [
      transaction.object(ikaClient.ikaConfig.objects.ikaDWalletCoordinator.objectID),
      transaction.pure(bcs.vector(bcs.U8).serialize(identifier)),
      transaction.pure.id(dwallet_network_encryption_key_id.id),
      transaction.pure(
        bcs.vector(bcs.U8).serialize(centralizedPublicKeyShareAndProof),
      ),
      transaction.pure(bcs.vector(bcs.U8).serialize(userPublicOutput)),
      transaction.pure(bcs.vector(bcs.U8).serialize(publicUserSecretKeyShare)),
      transaction.pure.u32(curve_id),
      transaction.object(ENV.WALLET_ADDRESS),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events)
}

export async function addUsers(new_users: string[], new_users_roles: number[]) {

  console.log(ENV.WALLET_ADDRESS)

  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  const transaction = new Transaction();
  transaction.setGasBudget(100000000);

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "add_users",

    arguments: [
      transaction.object(ENV.WALLET_ADDRESS),
      transaction.pure(bcs.vector(bcs.Address).serialize(new_users)),
      transaction.pure(bcs.vector(bcs.U8).serialize(new_users_roles)),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events);
}

export async function removeUsers(users_to_remove: string[]) {

  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  const transaction = new Transaction();

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "remove_users",

    arguments: [
      transaction.object(ENV.WALLET_ADDRESS),
      transaction.pure(bcs.vector(bcs.Address).serialize(users_to_remove)),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events)
}

export async function initRecovery(new_admin: string) {
  
  const { signerKeypair } = getSignerData(ENV.TEST_RECOVERY_ACC);

  const transaction = new Transaction();
  transaction.setGasBudget(5_000_000);

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "init_recovery",

    arguments: [
      transaction.object(ENV.WALLET_ADDRESS),
      transaction.pure.address(new_admin),
      transaction.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events)
}

export async function finalizeRecovery() {
  //check on rec time status-
  const { signerKeypair } = getSignerData(ENV.TEST_RECOVERY_ACC);

  const transaction = new Transaction();

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "finalize_recovery",

    arguments: [
      transaction.object(ENV.WALLET_ADDRESS),
      transaction.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events)
}

export async function cancelRecovery() {
  
  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  const transaction = new Transaction();

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "cancel_recovery",

    arguments: [transaction.object(ENV.WALLET_ADDRESS)],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events)
}

export async function updateUsersRole(
  users_to_modify: string[],
  new_roles_assigned: number[],
) {
  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  const transaction = new Transaction();

  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "update_users_role",

    arguments: [
      transaction.object(ENV.WALLET_ADDRESS),
      transaction.pure(bcs.vector(bcs.Address).serialize(users_to_modify)),
      transaction.pure(bcs.vector(bcs.U8).serialize(new_roles_assigned)),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events);
}

export async function addRoles(
  new_roles: number[],
  new_roles_sign_abilities: boolean[],
  new_roles_recovery_times: number[],
  new_roles_spending_limits: number[],
) {
  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  const transaction = new Transaction();
  transaction.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "add_roles",

    arguments: [
      transaction.object(ENV.WALLET_ADDRESS),
      transaction.pure(bcs.vector(bcs.U8).serialize(new_roles)),
      transaction.pure(
        bcs.vector(bcs.Bool).serialize(new_roles_sign_abilities),
      ),
      transaction.pure(bcs.vector(bcs.U64).serialize(new_roles_recovery_times)),
      transaction.pure(
        bcs.vector(bcs.U64).serialize(new_roles_spending_limits),
      ),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events);
}

export async function deposit(suis: number, ikas: number) {

  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  const transaction = new Transaction();

  const ikaAmountToDeposit = transaction.add(
    coinWithBalance({
      type: IKA_COIN_TYPE,
      balance: ikas,
    }),
  );

  const suiAmountToDeposit = transaction.splitCoins(transaction.gas, [suis]);

  const packageAddress = ENV.PACKAGE_ADDRESS;

  transaction.moveCall({
    package: packageAddress,

    module: "rbac",

    function: "deposit",

    arguments: [
      transaction.object(ENV.WALLET_ADDRESS),
      transaction.object(ikaAmountToDeposit),
      transaction.object(suiAmountToDeposit),
    ],
  });

  const txResult = await transactionExecutor(transaction, signerKeypair);

  console.log(txResult.events)
}

export async function signMessage(
  chain: string,
  amount: number,
  recipient: string,
) {
  const { ikaClient } = await getClients();
  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  let messageBytes: Uint8Array<ArrayBuffer>;
  let dWallet: DWalletWithState<"Active">;
  let presign: any;
  let algoTx: Uint8Array<ArrayBuffer> | undefined;
  let ikaAddr: string = "";

  const curve_id = get_curve_id(CHAIN_CONFIG[chain].curve);
  const signature_algorithm_id = get_signature_algorithm_id(
    CHAIN_CONFIG[chain],
  );
  const hash_scheme_id = get_hash_scheme_id(CHAIN_CONFIG[chain]);

  if (chain == "ethereum-base-sepolia") {
    const signignData = await prepareEthSigning(String(amount), recipient);
    messageBytes = signignData[0] as Uint8Array<ArrayBuffer>;
    dWallet = signignData[1] as DWalletWithState<"Active">;
    presign = signignData[2];
  } else if (chain == "algorand-testnet") {
    const signignData = await prepareAlgorandSigning(amount, recipient);
    messageBytes = signignData[0] as Uint8Array<ArrayBuffer>;
    dWallet = signignData[1] as DWalletWithState<"Active">;
    presign = signignData[2];
    algoTx = signignData[3] as Uint8Array<ArrayBuffer>;
    ikaAddr = signignData[4] as string;
  } else {
    throw new Error("Chain not yet supported!");
  }

  const ikaParams = new Uint8Array(
    Array.from(await ikaClient.getProtocolPublicParameters(dWallet)),
  );

  const messageCentralizedSignature =
    await createUserSignMessageWithPublicOutput(
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

    module: "rbac",

    function: "sign_messagge",

    arguments: [
      tx.object(ENV.WALLET_ADDRESS),
      tx.object(ikaClient.ikaConfig.objects.ikaDWalletCoordinator.objectID),
      tx.pure.vector("u8", Array.from(messageBytes)),
      tx.pure.vector("u8", Array.from(messageCentralizedSignature)),
      tx.pure.u32(curve_id),
      tx.pure.u32(signature_algorithm_id),
      tx.pure.u32(hash_scheme_id),
    ],
  });

  const txResult = await transactionExecutor(tx, signerKeypair);

  const sign_id = txResult.events[2].parsedJson.sign_id;
  console.log(sign_id)

  if (chain == "ethereum-base-sepolia") {
    sendTxToEthereumBaseSepolia(sign_id, dWallet, String(amount), recipient);
  } else if (chain == "algorand-testnet") {
    if (!algoTx) {
      throw new Error("algoTx not initialized");
    }

    await sendTxToAlgorandTestnet(sign_id, algoTx, ikaAddr);
  } else {
    throw new Error("still to implement");
  }
}

export async function emergency_fallback(new_state: boolean) {
  
  const { signerKeypair } = getSignerData(ENV.SIGNER_KEY);

  const tx = new Transaction();

  tx.moveCall({
    package: ENV.PACKAGE_ADDRESS,

    module: "rbac",

    function: "set_fallback_state",

    arguments: [tx.object(ENV.WALLET_ADDRESS), tx.pure.bool(new_state)],
  });

  const txResult = await transactionExecutor(tx, signerKeypair);

  console.log(txResult.events);
}