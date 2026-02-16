import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

import {
  createRbacWallet,
  addPresignature,
  addDwallet,
  addUsers,
  removeUsers,
  initRecovery,
  finalizeRecovery,
  cancelRecovery,
  updateUsersRole,
  addRoles,
  deposit,
  signMessage,
} from "./rbac/rbac.ts";
import { bcs } from "@mysten/sui/bcs";
import { fromBase64, isValidSuiAddress } from "@mysten/sui/utils";
import { getSuiClient } from "./config/clients.ts";
import { ENV } from "./config/env.ts";

const suiClient = await getSuiClient();

const rl = readline.createInterface({ input, output });

const UID = bcs.Address;
const ID = bcs.Address;
const walletId = ENV.WALLET_ADDRESS;

const Table = bcs.struct("Table", {
  id: bcs.Address,
  size: bcs.u64(),
});

function VecMap(keyType: any, valueType: any) {
  return bcs.vector(
    bcs.struct("VecMapEntry", {
      key: keyType,
      value: valueType,
    })
  );
}

const RoleConfig = bcs.struct("RoleConfig", {
  sign_ability: bcs.bool(),
  spending_limit: bcs.u64(),
  recovery_time: bcs.u64(),
});

const RecoveryRequest = bcs.struct("RecoveryRequest", {
  new_admin: bcs.Address,
  execute_after: bcs.u64(),
});

const WalletBCS = bcs.struct("Wallet", {
  id: UID,

  current_admin: bcs.Address,

  dWallets: Table,

  users: Table,

  roles_config: VecMap(
    bcs.u8(),
    RoleConfig
  ),

  active_recovery: bcs.option(RecoveryRequest),

  dwallet_network_encryption_key_id: ID,

  presignatures: Table,

  ikas: bcs.u64(),

  suis: bcs.u64(),
});

async function getWallet() {
  const object = await suiClient.getObject({
    id: walletId,
    options: { showBcs: true },
  });

  const bytes = object.data?.bcs?.bcsBytes;
  if (!bytes) throw new Error("No BCS");

  return WalletBCS.parse(fromBase64(bytes));
}

async function getCurrentUsers(currentUsersId: string){
  const currentUsersList = await suiClient.getDynamicFields({
    parentId: currentUsersId,
  });

  const userAddrs: string[] = [];
  for (const item of currentUsersList.data) {

    const tableValue = await suiClient.getDynamicFieldObject({
      parentId: currentUsersId,
      name: {
        type: item.name.type,
        value: item.name.value
      }
    });
    const useraddr = tableValue.data?.content?.fields.name
    userAddrs.push(useraddr);
  }

  return userAddrs
}

async function ask(q: string): Promise<string> {
  return (await rl.question(q)).trim();
}

function parseNumberArray(v: string): number[] {
  return v.split(",").map(x => Number(x.trim()));
}

function parseBoolArray(v: string): boolean[] {
  return v.split(",").map(x => x.trim().toLowerCase() === "true");
}
function parseStringArray(v: string): string[] {
  return v.split(",").map(x => x.trim());
}

async function askChain(): Promise<string> {
  while (true) {
    const c = (await ask("Chain (ethereum | algorand): ")).toLowerCase();
    if (c === "ethereum") return "ethereum-base-sepolia";
    if (c === "algorand") return "algorand-testnet";
    console.log("chain not yet implemented");
  }
}

function menu() {
  console.log(`
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
`);
}

async function main() {
  while (true) {
    menu();
    const choice = await ask("Select option: ");

    try {
      switch (choice) {
        case "1": {
          const chain = await askChain();

          let role_ids: number[] = [];
          while(true){
            role_ids = parseNumberArray(await ask("role_ids (comma separated, no space): "));
            
            let flag = 0;

            for(let i = 0; i < role_ids.length; i++){

              if(role_ids[i] <= 0 || isNaN(role_ids[i])){
                flag = 1;
                break
              }

              for(let j = i+1; j < role_ids.length; j++){
                if(role_ids[i] == role_ids[j]){
                  flag = 1;
                  break
                }
              }

              if (flag === 1) break;
              
            }

            if (flag === 1){
              console.log("Role IDs must be numbers > 0 and not duplicated. Try again.")
              continue
            }else{
              break
            }
          }

          const sign: boolean[] = [];
          const spending: number[] = [];

          for (let i = 0; i < role_ids.length; i++) {
            const canSign = (await ask(`Role ${role_ids[i]} sign ability (true/false): `)).toLowerCase() === "true";

            sign.push(canSign);

            if (canSign) {
              const limit = Number(await ask(`Role ${role_ids[i]} spending limit: `));
              spending.push(limit);
            } else {
              spending.push(0);
              console.log(`Role ${role_ids[i]} cannot sign: spending limit set to 0`);
            }
          }

          const recovery = parseNumberArray(await ask("recovery_time: "));
          const users = parseStringArray(await ask("new_users: "));
          const roles = parseNumberArray(await ask("new_users_roles: "));

          await createRbacWallet(
            chain,
            role_ids,
            sign,
            spending,
            recovery,
            users,
            roles
          );

          break;
        }
        

        case "2": {
          const chain = await askChain();
          await addPresignature(chain);
          break;
        }

        case "3": {
          const chain = await askChain();
          await addDwallet(chain);
          break;
        }

        case "4": {
          const currentUsersId = (await getWallet()).users.id;
          const currentRolesId = (await getWallet()).roles_config;
          
          const current_roles: number[] = [];
          for(const role of currentRolesId as any[]){
            current_roles.push(role.key);
          }
          
          const currentUsers = await getCurrentUsers(currentUsersId);

          let users: string[] = [];
          while(true){

            let flag = 0;
            users = parseStringArray(await ask("Users: "));  

            for(const user of users){
              if(currentUsers.includes(user) || !isValidSuiAddress(user)){
                flag = 1;
                break;
              }
            }

            if(flag === 1){
              console.log("Inserted address is not valid. Retry!")
              continue
            }else{
              break
            }
          }

          const roles: number[] = [];
          for(let i = 0; i < users.length; i++){
            while(true){
              const role = Number(await ask(`User ${users[i]} role id: `));

              if(!current_roles.includes(role)){
                console.log("Inserted role is not valid. Retry!")
                continue
              }else{
                roles.push(role)
                break
              }
            }
          }

          await addUsers(users, roles);
          break;
        }

        case "5": {
          const currentUsersId = (await getWallet()).users.id;
          const currentUsers = await getCurrentUsers(currentUsersId);


          let users: string[] = [];
          while(true){
            let flag = 0
            users = parseStringArray(await ask("Users to remove: "));

            for(const user of users){
              if(!currentUsers.includes(user) || !isValidSuiAddress(user)){
                flag = 1
                break
              }
            }

            if(flag === 1){
              console.log("Address is not part of the current wallet! Retry.");
              continue
            }else{
              break
            }
          } 
          await removeUsers(users);
          break;
        }

        case "6": {         //in questo momento la init recovery la inzia sempre 0x3cb64fc943a8af6915d682a552a90a6332f27f1fa1962603816edd8a13a101e0 in .env

          const activeRecovery = (await getWallet()).active_recovery;

          if(activeRecovery != null){
            console.log("There is already an active recoovery for the current wallet!");
            break;
          }


          
          const current_admin = (await getWallet()).current_admin;
          
          const currentUsersId = (await getWallet()).users.id;
          const currentUsers = await getCurrentUsers(currentUsersId);

          let new_admin: string; 
          while (true){
            new_admin = await ask("New admin address: ");

            if(!currentUsers.includes(new_admin) || !isValidSuiAddress(new_admin) || new_admin == current_admin){
              console.log("New admin is not in the users list or its address is not valid (new admin cant be the admin itself). Retry!")
              continue
            }else{
              break
            }

          }

          await initRecovery(new_admin);
          break;
        }

        case "7": {

          const activeRecovery = (await getWallet()).active_recovery;

          if(activeRecovery == null){
            console.log("No active recoovery found for the current wallet!");
            break;
          }

          await finalizeRecovery();
          break;
        }

        case "8": {

          const activeRecovery = (await getWallet()).active_recovery;

          if(activeRecovery == null){
            console.log("No active recoovery found for the current wallet!");
            break;
          }

          await cancelRecovery();
          break;
        }
        case "9": {

          const currentUsersId = (await getWallet()).users.id;
          const currentRolesId = (await getWallet()).roles_config;
          
          const current_roles: number[] = [];
          for(const role of currentRolesId as any[]){
            current_roles.push(role.key);
          }
          
          const currentUsers = await getCurrentUsers(currentUsersId);


          let users: string[] = [];
          const roles: number[] = [];
          while(true){

            let flag = 0;
            users = parseStringArray(await ask("Users to modify: "));

            for(const user of users){
              if(!currentUsers.includes(user) || !isValidSuiAddress(user)){
                flag = 1
                break
              }
            }

            if(flag == 1){
              console.log("Users inserted not valid! Retry!")
              continue
            }else{
              break
            }
          }

          for(let i = 0; i < users.length; i++){
            let role: number;
            while(true){
              role = Number(await ask(`User ${users[i]} new role id: `));

              if(!current_roles.includes(role) || isNaN(role)){
                console.log("Role ID not in the current wallet config or is invalid! Retry!")
                continue
              }else{
                roles.push(role)
                break
              }
            }
          }

          await updateUsersRole(users, roles);
          break;
        }

        case "10": {


          const currentRolesId = (await getWallet()).roles_config;
          
          const current_roles: number[] = [];
          for(const role of currentRolesId as any[]){
            current_roles.push(role.key);
          }

          let roles: number[] = [];
          while(true){

            let flag = 0;

            roles = parseNumberArray(await ask("Role ids: "));
            for(const role of roles){
              if(current_roles.includes(role) || isNaN(role) || role <= 0){
                console.log("Role already in the config or not valid! Retry!");
                flag = 1;
                break
              }
            }

            if(flag == 1){
              continue
            }else{
              break
            }

          }

          const sign: boolean[] = [];
          const recovery: number[] = [];
          const spending: number[] = [];

          for (const role of roles) {

            console.log(`\nConfiguring role ${role}`);
            let canSign: boolean;
            while (true) {
              const input = (await ask("Sign ability (true/false): ")).toLowerCase();

              if (input !== "true" && input !== "false") {
                console.log("Insert true or false");
                continue;
              }

              canSign = input === "true";
              break;
            }

            sign.push(canSign);

    
            if (canSign) {

              while (true) {

                const limit = Number(await ask("Spending limit: "));

                if (isNaN(limit) || limit < 0) {
                  console.log("Invalid spending limit!");
                  continue;
                }

                spending.push(limit);
                break;
              }

            } else {

              spending.push(0);
              console.log("Spending limit automatically set to 0");
            }


            while (true) {

              const rec = Number(await ask("Recovery time: "));

              if (isNaN(rec) || rec < 0) {
                console.log("Invalid recovery time!");
                continue;
              } 

              recovery.push(rec);
              break;
            }

          }

          await addRoles(roles, sign, recovery, spending);
          break;
        }

        case "11": {
          const sui = Number(await ask("SUI amount: "));
          const ika = Number(await ask("IKA amount: "));
          await deposit(sui, ika);
          break;
        }

        case "12": {
          const chain = await askChain();
          const amount = Number(await ask("Amount: "));
          const recipient = await ask("Recipient address: ");
          await signMessage(chain, amount, recipient);
          break;
        }

        case "0":
          console.log("adioss");
          rl.close();
          process.exit(0);

        default:
          console.log("invalid choice");
      }
    } catch (err) {
      console.error("smth wrong happened", err);
    }
  }
}


main();
