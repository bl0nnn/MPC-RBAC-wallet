# Dryrun testing
This simple cli shows the capabilities of MPC-RBAC-wallet, a multi-chain (currently supporting Ethereum base sepolia and Algorand testnet) wallet for cross-chain interoperability, built upon a rbac-like governance system and IKA MPC.

## Getting started
### Prerequisites
- node.js
- npm
- sui account
### Installation
1. **Clone and go to cli dir:**

   ```bash
   cd cli
   npm install
   ```
### Config
1. **Configure .env file**

   ```bash
   touch .env
   ```

   ```bash
   SIGNER_KEY = "suipriv..." #your sui account private key

   PACKAGE_ADDRESS = "0x..." # The package ID returned after contract deployment (immediatly insert after deployment)
   WALLET_ADDRESS = "0x..."  # the wallet object id returned after calling wallet create (this will be given to you after creating a wallet through index.ts)

   HKDF_KEY="32 bytes random string " #generate it locally in anyway you want, it is needed for user share encryotion keys gen   

   ETH_RECIPIENT_ADDR = "0x..."  #not used in the code, its just to rapidly copy-paste a recipient addr to test sending tokens on base spolia
   ALG_RECIPIENT_ADDR = "7B...." #not used in the code, its just to rapidly copy-paste a recipient addr to test sending tokens on algorand testnet

   TEST_RECOVERY_ACC = "suipriv..." #this will be set as recovery addr by default. Recovery is always initiated by this address. Generate another sui address for this
   ```

## How to use
### 1. Create your wallet
- After configuring your .env file, run index.ts that will prompt out an options menu
  ```bash
  node index.ts

  === RBAC WALLET CLI ===
  1) Create wallet
  2) Add presignature
  3) Add dWallet
  4) Add users
  5) Remove users
  6) Init recovery        
  7) Finalize recovery
  8) Cancel recovery
  9) Update users role
  10) Add roles
  11) Deposit
  12) Sign message
  0) Exit

  Select option:
  ```
  In the menu bar select option 1) and follow instructions.
  - Select on wich chain the wallet will sign transactions (don't worry too much about this choice, you can add other chains later!)
  - configure the roles that will be given to users
  - insert the users (at least 1)
  - assign him one of the roles you have just created
    
- Once you created a wallet the script will return you the event with the wallet object id you have just created. Stop the script with Ctrl+c and just paste that wallet_id inside .env as `WALLET_ADDRESS`. Now you're all set and ready to sign with your brand new wallet!

### 2. Add a presignature
- adding presignatures to the wallet pool is foundamental for signing operations. Pools make sure that presigns will always be avaiable before signing to speed up the process.

  Just select option 2) (Add preignature) and select the chain for which the presignature will be consumed to sign (at the momement onnly avaiable for Algorand and Ethereum).
  Presignatures are specific to a curve-signature Algorithm pair.

  ```bash
  ├── Presignatures pools
  │ └── Ethereum (SECP256K1_ECDSA)
  │ └── Algorand (ED25519_EDDSA)
  ...
  ```
  
>[!WARNING]
>Always make sure presigning pool for a certain chain is not empty before signing
>and remeber that the number of presignatures for each pool is limited to 10 to avoid spams 
 
### 3. Add a dWallet
- By selecting option 3) you can add a new dWallet capability to the Wallet to sign on other chains.
 
### 4. Add one or more users
- By selecting option 4) you can add multiple users to the current wallet members. Remember that the role assigned to the user must be in the roles config of the wallet (the one you defined at creation or modified later) and that you can't assign 0 as role (0 is ADMIN!)

### 5. Remove one or more users
- By selecting option 5 you can remove multiple users from the wallet members. Remeber, at least one account shall remain (for recovery purposes). This condition btw is checked by the contract

### 6. Init a Recovery
- By selecting option 6 you're initializing a recovery to change the wallet's admin. After selecting option 6, insert the address of the new admin you want.

- This operation is always started by the users you set in your .env file as `TEST_RECOVERY_ACC` because given the current testing scenario, the recovery acc is hardcoded through the .env config.
  - This option will start a timer based on the user role. When that timer is over, recovery will actually be finalized by some other user 

### 7. Finalize a Recovery
- By selecting option 7) you're actually finalizing the recovery (be sure the  recovery time has endend, otherwise this will fail)
>[!WARNING]
>This operation will change the wallet admin. If you want to keep using this wallet from this script you should be changing `SIGNER_KEY` in the .env file or create a new wallet to test the other wallet functionalities. Or just test the finalize recovery as last operation. Your choice. 

### 8. Cancel a Recovery
- By selecting option 8) current admin can cancel a requested recovery (this actually makes the admin a single point of failure, multisig should be implemented)

### 9. Update one or more users role
- By selecting option 9) You can update users role (e.g User A has role 3 -> calls update user role -> selecting user A and role 2 -> user A has now role 2).
  - selcet the users you want to modify the role of
  - select the new role for each user 

### 10. Deposit some coins
- By selecting option 10) you can deposit a certain amount of IKAs and SUIs on the contract internal balance for contract transactions. The contract will always pay transaction fees using its internal balance.
  - if you want to pass some ikas and zero suis just pass a 0 coin.

### 11. Sign a transaction
- By selecting option 11) you can sign cross chain transactions on the chain you prefer
  - selcet the destination chain
  - the amount you want to send
  - and the receiver address on the destination chain
  - wait for the transaction digest to be prompted and navigate to the trasnaction through the explorer 
