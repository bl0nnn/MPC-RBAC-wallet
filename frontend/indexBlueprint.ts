import { N } from "ethers";
import { addDwallet, addPresignature, addRoles, addUsers, createRbacWallet, deposit, finalizeRecovery, initRecovery, removeUsers, signMessage, updateUsersRole } from "./rbac/rbac.ts";
import { finalization } from "node:process";
import { ENV } from "./config/env.ts";

async function main(){
    


    const chain = "algorand-testnet";
    //const chain = "ethereum-base-sepolia"


    /*
    const role_ids = [1, 2]
    const roles_sign_ability = [true, true]
    const spending_limit = [1000000, 10]
    const recovery_time = [10, 100]
    const new_user = ["0x1458edf169407aff52987a902b59ad755f6624bc09d682aad72b052ce55c98d6", "0x3cb64fc943a8af6915d682a552a90a6332f27f1fa1962603816edd8a13a101e0"]
    const new_user_role = [1, 2]

    await createRbacWallet(chain, role_ids, roles_sign_ability, spending_limit, recovery_time, new_user, new_user_role);
    */

    //await addPresignature(chain);     

    //await addDwallet(chain);


    /*
    const new_users = ["0x3cb64fc943a8af6915d682a552a90a6332f27f1fa1962603816edd8a13a101e0"];
    const new_roles = [1]
    await addUsers(new_users, new_roles);
    */

    /*
    const users_to_remove = ["0x3cb64fc943a8af6915d682a552a90a6332f27f1fa1962603816edd8a13a101e0"]
    await removeUsers(users_to_remove);
    process.exit(0);
    */

    /*
    const new_admin = "0x1458edf169407aff52987a902b59ad755f6624bc09d682aad72b052ce55c98d6"
    await initRecovery(new_admin);
    */

    //await finalizeRecovery();


    /*
    const user = ["0x3cb64fc943a8af6915d682a552a90a6332f27f1fa1962603816edd8a13a101e0"]
    const new_role = [1]

    await updateUsersRole(user, new_role)
    */


    /*
    const new_role = [3];
    const sign_ability = [false]
    const recovery_time = [1000000000]
    const spending_limit = [1000]

    await addRoles(new_role, sign_ability, recovery_time, spending_limit);
    */


    /*
    const ikaAmount = 1000000000;
    const suiAmount = 0;

    deposit(suiAmount, ikaAmount)
    */

    /*
    const ethRecipientAddr = ENV.ETH_RECIPIENT_ADDR            //user passes it, just for demonstration         
    const ethAmount = 0.001;
    console.log(ethAmount as unknown as string)
    

    await signMessage(chain, ethAmount,  ethRecipientAddr);
        */

    
    
    const algorandRecipient = ENV.ALG_RECIPIENT_ADDR
    const algo_amount = 1000;

    await signMessage(chain, algo_amount, algorandRecipient)
    
    }


main();

