module rbac_wallet::rbac{

    use ika::ika::IKA;
    use ika_dwallet_2pc_mpc::{
        coordinator::DWalletCoordinator,
        coordinator_inner::{DWalletCap, UnverifiedPresignCap},
        sessions_manager::SessionIdentifier
    };
    use sui::{
        balance::Balance, 
        clock::Clock, 
        coin::Coin, 
        sui::SUI, 
        table::{Self, Table},
        vec_map::{Self, VecMap}
    };
    use std::string::String;
    use rbac_wallet::{
        constants,
        errors,
        events
    };
    

    // === Structs ===

    public struct RoleConfig has store, copy, drop {

        sign_ability: bool,

        spending_limit: u64,

        recovery_time_ms: u64
    }

    public struct RecoveryRequest has store, drop {
        
        new_admin: address,
        
        finalization_time_ms: u64,      //the exact moment the recovery will be finallized. Will just be calculated from global clock and user's recovery time associated 
    }


    public struct RbacWallet has key, store {
        
        id: UID,

        current_admin: address,

        dWallets: Table<String, DWalletCap>,        

        accounts: Table<address, u8>,

        roles_config: VecMap<u8, RoleConfig>,

        active_recovery: Option<RecoveryRequest>,

        dwallet_network_encryption_key_id: ID,

        presignatures: Table<u8, vector<UnverifiedPresignCap>>,

        ikas: Balance<IKA>,
        
        suis: Balance<SUI>,

    }


    //at creation user can generate one dwallet capabillity (just one cause the dkg takes some time and we should work on timeouts on dwallet capabilities creations loop if we want to add more than one at creation + lot of gas).
    //After that he can add other dwalletCaps for preferred chain.
    
    public fun create_wallet(

        //ika parameters
        coordinator: &mut DWalletCoordinator,
        prepareDKG_session_identifier: vector<u8>,
        dwallet_network_encryption_key_id: ID,
        centralized_public_key_share_and_proof: vector<u8>,
        user_public_output: vector<u8>,
        public_user_secret_key_share: vector<u8>,
        mut ika_coin: Coin<IKA>,
        mut sui_coin: Coin<SUI>,
        curve: u32,

        //role_config parameters (parameters needed to set the roles config)
        role_ids: vector<u8>,          //ex. signer (can sign transactions), custodian (can only start recovery but can't sign), custodian-less-trust(same as custodian but with higher recvery time)
        input_sign_abilities: vector<bool>,
        input_spending_limits: vector<u64>,
        input_recovery_times: vector<u64>,

        //accounts parameters. Actual accounts passed to be members of rbac
        input_recovery_accounts: vector<address>,
        input_accounts_levels: vector<u8>,

        ctx: &mut TxContext
    ){


        let roles_len = role_ids.length();
        assert!(roles_len >= 1, errors::empty_roles_vector!());
        assert!(input_sign_abilities.length() == roles_len, errors::config_vectors_lenghts_not_matching!());
        assert!(input_spending_limits.length() == roles_len, errors::config_vectors_lenghts_not_matching!());        
        assert!(input_recovery_times.length() == roles_len, errors::config_vectors_lenghts_not_matching!());

        let recovery_accounts_len = input_recovery_accounts.length();
        assert!(recovery_accounts_len >= 1, errors::no_recovery_account_at_creationl!());
        assert!(recovery_accounts_len == input_accounts_levels.length(), errors::recovery_accs_roles_not_matching!());


        let mut roles_config = vec_map::empty<u8, RoleConfig>();

        let admin_config = RoleConfig {         //admin config is hardcoded to be unlimited 
            sign_ability: true, 
            spending_limit: constants::get_max_spending(),
            recovery_time_ms: 0
        };
        vec_map::insert(&mut roles_config, constants::get_admin_role_id(), admin_config);


        let wallet_creator = ctx.sender();
        let wallet_uid = object::new(ctx);
        let wallet_id = wallet_uid.to_inner();

        let mut i = 0;
        while (i < roles_len){
            let role_id = *role_ids.borrow(i);
            assert!(role_id != constants::get_admin_role_id(), errors::invalid_user_level!());          //roles of others can never be the same of admin's
            let role_config = RoleConfig{
                sign_ability: *input_sign_abilities.borrow(i),
                spending_limit: *input_spending_limits.borrow(i),
                recovery_time_ms: *input_recovery_times.borrow(i)
            };
            vec_map::insert(&mut roles_config, role_id, role_config);
            i = i + 1;
        };


        let mut accounts = table::new<address, u8>(ctx);

        table::add(&mut accounts, wallet_creator, constants::get_admin_role_id());

        let mut initial_accounts = vector::empty<address>();
        i = 0;
        while(i < recovery_accounts_len){
            let level = *input_accounts_levels.borrow(i);
            assert!(level != 0, errors::invalid_level_for_account!());

            let user_addr = *input_recovery_accounts.borrow(i);
            if(!accounts.contains(user_addr)){
                table::add(&mut accounts, user_addr, level);
                initial_accounts.push_back(user_addr);
            };
            i = i + 1;
        };

    

        //executing the DKG
        //got the session identifier from the frontend, the one used for prepareDKG. It must be used for requestDKG
        let requestDKG_session_identifier = coordinator.register_session_identifier(
        prepareDKG_session_identifier,
        ctx,
        );

        let (dwallet_capability, _) = coordinator.request_dwallet_dkg_with_public_user_secret_key_share(
            dwallet_network_encryption_key_id,
            curve,
            centralized_public_key_share_and_proof,
            user_public_output,
            public_user_secret_key_share,
            option::none(),
            requestDKG_session_identifier,
            &mut ika_coin,
            &mut sui_coin,
            ctx
        );

        let mut dWallets = table::new<String, DWalletCap>(ctx);
        let curve_name = constants::get_curve_name_from_id(curve);
        table::add(&mut dWallets, curve_name, dwallet_capability);


        let rbac_wallet = RbacWallet{
            id: wallet_uid,
            current_admin: wallet_creator,
            dWallets,
            accounts,
            roles_config,
            active_recovery: option::none(),
            dwallet_network_encryption_key_id,
            presignatures: table::new<u8, vector<UnverifiedPresignCap>>(ctx),
            ikas: ika_coin.into_balance(),
            suis: sui_coin.into_balance()
        };

        events::wallet_created(wallet_id,wallet_creator,  initial_accounts, wallet_creator);

        transfer::public_share_object(rbac_wallet);
    }


    public fun add_presignature_to_pool(self: &mut RbacWallet, coordinator: &mut DWalletCoordinator, curve_id: u32, signature_algorithm_id: u32, ctx: &mut TxContext){

        assert!(&self.active_recovery == option::none(), errors::active_recovery!());
        
        let sender = ctx.sender();

        let pair_id = constants::get_pair_id(curve_id, signature_algorithm_id);
        
        assert!(self.accounts.contains(sender), errors::no_member_found!());
        let role_id = *self.accounts.borrow(sender);
        let config = self.roles_config.get(&role_id);
        assert!(config.sign_ability == true, errors::not_authorized!());

        let (mut ika_coin, mut sui_coin) = self.withdraw_payment_coins(ctx);


        if (!table::contains(&self.presignatures, pair_id)) {
            table::add(&mut self.presignatures, pair_id, vector::empty());
        };
        let pool = table::borrow_mut(&mut self.presignatures, pair_id);

        assert!(pool.length() < constants::get_max_presignatures_number(), errors::presignatures_pool_full!());


        let session_identifier = coordinator.register_session_identifier(
            ctx.fresh_object_address().to_bytes(),
            ctx,
        );

        let presignature = coordinator.request_global_presign(
            self.dwallet_network_encryption_key_id,
            curve_id,
            signature_algorithm_id,
            session_identifier,
            &mut ika_coin,
            &mut sui_coin,
            ctx
        );

        pool.push_back(presignature);


        let wallet_id = self.id.to_inner();
        let pair_name = constants::get_pair_name_from_pair_id(pair_id);

        
        events::presignature_added(wallet_id, sender, pair_name, pool.length());

        self.return_payment_coins(ika_coin, sui_coin);
    }

    public fun add_dWallet(
        coordinator: &mut DWalletCoordinator,
        prepareDKG_session_identifier: vector<u8>,
        dwallet_network_encryption_key_id: ID,
        centralized_public_key_share_and_proof: vector<u8>,
        user_public_output: vector<u8>,
        public_user_secret_key_share: vector<u8>,
        curve: u32,

        self: &mut RbacWallet,
        ctx: &mut TxContext
    ){

        assert!(&self.active_recovery == option::none(), errors::active_recovery!());

        let sender = ctx.sender();
        assert!(self.accounts.contains(sender), errors::no_member_found!());
        
        assert!(sender == self.current_admin, errors::not_authorized!());

        let curve_name = constants::get_curve_name_from_id(curve);
        assert!(!self.dWallets.contains(curve_name), errors::curve_already_exists!());

        let (mut ika_coin, mut sui_coin) = self.withdraw_payment_coins(ctx);

        let session_identifier = coordinator.register_session_identifier(
        prepareDKG_session_identifier,
        ctx,
        );

        let (dwallet_capability, _) = coordinator.request_dwallet_dkg_with_public_user_secret_key_share(
            dwallet_network_encryption_key_id,
            curve,
            centralized_public_key_share_and_proof,
            user_public_output,
            public_user_secret_key_share,
            option::none(),
            session_identifier,
            &mut ika_coin,
            &mut sui_coin,
            ctx
        );

        self.dWallets.add(curve_name, dwallet_capability);

        let wallet_id = self.id.to_inner();
        events::wallet_added(wallet_id, sender, curve_name);

        self.return_payment_coins(ika_coin, sui_coin);

    }

    public fun add_account(self: &mut RbacWallet, input_accounts: vector<address>, input_accounts_levels: vector<u8>, ctx: &mut TxContext){

        assert!(&self.active_recovery == option::none(), errors::active_recovery!());
        
        let sender = ctx.sender();
        assert!(self.accounts.contains(sender), errors::no_member_found!());

        assert!(sender == self.current_admin, errors::not_authorized!());
        assert!(!input_accounts_levels.contains(&constants::get_admin_role_id()));
        

        let len = input_accounts.length();
        assert!(len == input_accounts_levels.length(), errors::recovery_accs_roles_not_matching!());

        //add check that role actually exists in configs

        let mut i = 0;
        let mut added = vector::empty<address>(); 
        while(i < len){
            let addr = *input_accounts.borrow(i);
            let role_id = *input_accounts_levels.borrow(i);
            if (!table::contains(&self.accounts, addr)) {
                table::add(&mut self.accounts, addr, role_id);
                added.push_back(addr);

            };
            i = i + 1;
        };


        let wallet_id = self.id.to_inner();
        events::users_added(wallet_id, sender, added, added.length());


    }

    //be sure at least one account remains for recovery
    public fun remove_account(self: &mut RbacWallet, accounts_to_remove: vector<address>, ctx: &mut TxContext){

        assert!(self.active_recovery.is_none(), errors::active_recovery!());
        
        let sender = ctx.sender();
        assert!(self.accounts.contains(sender), errors::no_member_found!());

        //admin cannot remove himself
        assert!(sender == self.current_admin, errors::not_authorized!());
        assert!(!accounts_to_remove.contains(&sender), errors::cant_remove_admin!());

        //at least 1 account (+ admin) shall remain
        let remove_len = accounts_to_remove.length();
        let current_len = self.accounts.length();
        assert!(current_len >= (remove_len + 2), errors::cant_remove_all_accounts!()); //+2 because we prevent the user from removing all recovery accounts (1 recovery account, the admin must remain)

        let mut i = 0;
        let mut removed = vector::empty<address>(); 
        while(i < remove_len){
            let addr = *accounts_to_remove.borrow(i);
            if(self.accounts.contains(addr)){
                table::remove(&mut self.accounts, addr);
                removed.push_back(addr);
            };
            i = i + 1;
        };

        let wallet_id = self.id.to_inner();

        events::users_removed(wallet_id, sender, removed, removed.length());     

    }


    public fun init_recovery(self: &mut RbacWallet, new_admin: address, clock: &Clock, ctx: &mut TxContext){
        
        let sender = ctx.sender();
        let role_id = *self.accounts.borrow(sender);
        assert!(self.active_recovery.is_none(), errors::active_recovery!());
        assert!(self.accounts.contains(sender), errors::no_member_found!());
        assert!(sender != self.current_admin, errors::admin_cannot_recover!());
        assert!(self.accounts.contains(new_admin), errors::no_member_found!());

        let role_config = self.roles_config.get(&role_id);
        let role_recovery_time = role_config.recovery_time_ms;
        let current_clock = clock.timestamp_ms();

        let finalization_time = current_clock + role_recovery_time;


        let recovery_request = RecoveryRequest {
            new_admin,
            finalization_time_ms: finalization_time
        };

        self.active_recovery = option::some(recovery_request);

        let wallet_id = self.id.to_inner();
        events::recovery_initiated(wallet_id, sender, new_admin, finalization_time)
    }


    public fun finalize_recovery(self: &mut RbacWallet, clock: &Clock, ctx: &mut TxContext){

        let sender = ctx.sender();
        assert!(self.accounts.contains(sender), errors::no_member_found!());
        assert!(sender != self.current_admin, errors::admin_cannot_recover!());
        assert!(self.active_recovery.is_some(), errors::no_active_recovery!());
        
        let current_clock = clock.timestamp_ms();
        let recovery_request = self.active_recovery.extract();      //extract() already set active_recovery field to none
        let finalization_time = recovery_request.finalization_time_ms;
        assert!(current_clock >= finalization_time, errors::recovery_not_ready!());

        self.accounts.remove(self.current_admin);

        self.accounts.remove(recovery_request.new_admin);

        self.accounts.add(recovery_request.new_admin, constants::get_admin_role_id());

        self.current_admin = recovery_request.new_admin;

        let wallet_id = self.id.to_inner();
        events::recovery_finalized(wallet_id, sender, recovery_request.new_admin);
    }

    public fun cancel_recovery(self: &mut RbacWallet, ctx: &mut TxContext){


        let sender = ctx.sender();
        assert!(sender == self.current_admin, errors::admin_cannot_recover!());
        assert!(self.active_recovery.is_some(), errors::no_active_recovery!());

        let _ = self.active_recovery.extract();


    }

    public fun update_accounts_role(self: &mut RbacWallet, accounts: vector<address> , new_roles: vector<u8>, ctx: &mut TxContext){

        let sender = ctx.sender();
        assert!(sender == self.current_admin, errors::admin_cannot_recover!());

        let accounts_len = accounts.length();
        assert!(accounts_len == new_roles.length(), errors::recovery_accs_roles_not_matching!());

        let mut i = 0;
        let mut updated = vector::empty<address>(); 
        while (i < accounts_len){
            let addr = *accounts.borrow(i);
            let new_role = *new_roles.borrow(i);
            assert!(addr != self.current_admin, errors::cant_change_admin_role!());
            assert!(new_role != constants::get_admin_role_id(), errors::invalid_user_level!());
            assert!(self.accounts.contains(addr), errors::no_member_found!());
            assert!(self.roles_config.contains(&new_role));

            updated.push_back(addr);
            let current_role = table::borrow_mut(&mut self.accounts, addr);

            *current_role = new_role;

            i = i + 1;
        };

        let wallet_id = self.id.to_inner();

        events::users_roles_updated(wallet_id, sender, updated);

    }

    public fun add_roles(self: &mut RbacWallet, new_roles: vector<u8>, new_sign_abilities: vector<bool>, new_recovery_times: vector<u64>, new_spending_limits: vector<u64>, ctx: &mut TxContext){
        
        let sender = ctx.sender();
        assert!(sender == self.current_admin, errors::not_authorized!());
        let new_roles_len = new_roles.length();
        assert!(new_roles_len == new_recovery_times.length(), errors::new_roles_lengths_not_matching!());
        assert!(new_roles_len == new_spending_limits.length(), errors::new_roles_lengths_not_matching!());
        assert!(new_roles_len == new_sign_abilities.length(), errors::new_roles_lengths_not_matching!());

        let mut i = 0;
        let mut added = vector::empty<u8>(); 
        while(i < new_roles_len){
            let new_role_id = *new_roles.borrow(i);
            let sign_ability = *new_sign_abilities.borrow(i);
            let spending_limit = *new_spending_limits.borrow(i);
            let recovery_time_ms = *new_recovery_times.borrow(i);
            if(!self.roles_config.contains(&new_role_id)){
                let new_role_config = RoleConfig {
                    sign_ability,
                    spending_limit,
                    recovery_time_ms
                };
                vec_map::insert(&mut self.roles_config, new_role_id, new_role_config);
                added.push_back(new_role_id);

            };
            i = i + 1;
        };


        let wallet_id = self.id.to_inner();
        events::roles_added(wallet_id, sender, added);
    }


    //to deposit just ika or suis just pass a zero coin
    public fun deposit(self: &mut RbacWallet, ika_coin: Coin<IKA>, sui_coin: Coin<SUI>, ctx: &mut TxContext){

        let ika_amount = ika_coin.value();
        let sui_amount = sui_coin.value();
        
        self.ikas.join(ika_coin.into_balance());

        self.suis.join(sui_coin.into_balance());


        let sender = ctx.sender();
        let wallet_id = self.id.to_inner();
        events::coins_deposited(wallet_id, sender, ika_amount, sui_amount);

    }
    //idea: passing chain-name (seems stupid)
    public fun sign_messagge(self: &mut RbacWallet, coordinator: &mut DWalletCoordinator, message: vector<u8>, message_centralized_signature: vector<u8>, curve_id: u32, signature_algorithm_id: u32, hash_scheme: u32, ctx: &mut TxContext): ID {

        let sender = ctx.sender();
        assert!(self.accounts.contains(sender), errors::no_member_found!());

        let role_id = *self.accounts.borrow(sender);
        let role_config = self.roles_config.get(&role_id);
        assert!(role_config.sign_ability, errors::not_authorized!());

        //spending limit control to add
        //check bytes to sign through a backend oracle (to add) 

        let (mut ika, mut sui) = self.withdraw_payment_coins(ctx);
        
        let curve_name = constants::get_curve_name_from_id(curve_id);
        let dwallet_cap = table::borrow(&self.dWallets, curve_name);
        
        //get presignature based on curve and signature algorithm
        let pair_id = constants::get_pair_id(curve_id, signature_algorithm_id);
        let presignatures = table::borrow_mut(&mut self.presignatures, pair_id);

        let unverified_presign = presignatures.swap_remove(0);
        let verified_presign = coordinator.verify_presign_cap(unverified_presign, ctx);



        let approval = coordinator.approve_message(
        dwallet_cap,
        signature_algorithm_id,
        hash_scheme,
        message,
        );

        let session = coordinator.register_session_identifier(
        ctx.fresh_object_address().to_bytes(),
        ctx,
        );

        let sign_id = coordinator.request_sign_and_return_id(
            verified_presign,
            approval,
            message_centralized_signature,
            session,
            &mut ika,
            &mut sui,
            ctx,
        );

        //replenish presign pool if num of presignatures is below limit after signing (to add)
        
        self.return_payment_coins(ika, sui);
        sign_id

    }


    //helpers
    fun withdraw_payment_coins(self: &mut RbacWallet, ctx: &mut TxContext): (Coin<IKA>, Coin<SUI>) {
        let payment_ika = self.ikas.withdraw_all().into_coin(ctx);
        let payment_sui = self.suis.withdraw_all().into_coin(ctx);
        (payment_ika, payment_sui)
    }

    fun return_payment_coins(self: &mut RbacWallet, payment_ika: Coin<IKA>, payment_sui: Coin<SUI>) {
        self.ikas.join(payment_ika.into_balance());
        self.suis.join(payment_sui.into_balance());
    }

}
