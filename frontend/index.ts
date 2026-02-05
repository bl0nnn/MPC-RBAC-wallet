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

const rl = readline.createInterface({ input, output });

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
          const role_ids = parseNumberArray(await ask("role_ids: "));
          const sign = parseBoolArray(await ask("roles_sign_ability: "));
          const spending = parseNumberArray(await ask("spending_limit: "));
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
          const users = parseStringArray(await ask("Users: "));
          const roles = parseNumberArray(await ask("Roles: "));
          await addUsers(users, roles);
          break;
        }

        case "5": {
          const users = parseStringArray(await ask("Users to remove: "));
          await removeUsers(users);
          break;
        }

        case "6": {         //in questo momento la init recovery la inzia sempre 0x3cb64fc943a8af6915d682a552a90a6332f27f1fa1962603816edd8a13a101e0 in .env
          const admin = await ask("New admin address: ");
          await initRecovery(admin);
          break;
        }

        case "7":
          await finalizeRecovery();
          break;

        case "8":
          await cancelRecovery();
          break;

        case "9": {
          const users = parseStringArray(await ask("Users: "));
          const roles = parseNumberArray(await ask("New roles: "));
          await updateUsersRole(users, roles);
          break;
        }

        case "10": {
          const roles = parseNumberArray(await ask("Role ids: "));
          const sign = parseBoolArray(await ask("Sign abilities: "));
          const recovery = parseNumberArray(await ask("Recovery times: "));
          const spending = parseNumberArray(await ask("Spending limits: "));

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
