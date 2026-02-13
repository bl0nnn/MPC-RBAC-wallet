module rbac_wallet::events;

use sui::{
        event,
    };
use std::string::{String};

// === Event Structs ===

public struct WalletCreated has copy, drop {

    wallet_id: ID,

    admin: address,

    initial_users: vector<address>,

    created_by: address

}

public struct PresignatureAdded has copy, drop{
    
    wallet_id: ID,

    added_by: address,

    curve_signature_algorithm_combination: String,

    signatures_count_for_specified_curve: u64

}

public struct DwalletAdded has copy, drop {

    wallet_id: ID,

    added_by: address,

    curve: String,


}

public struct UsersAdded has copy, drop{

    wallet_id: ID,

    added_by: address,

    users_added: vector<address>,

    number_of_users_added: u64

}

public struct UserRemoved has copy, drop {

    wallet_id: ID,

    removed_by: address,

    users_removed: vector<address>,

    number_of_users_removed: u64
}

public struct RecoveryInitiated has copy, drop {

    wallet_id: ID,

    initiated_by: address,
    
    proposed_new_admin: address,
  
    finalization_time: u64
}

public struct RecoveryFinalized has copy, drop {
    
    wallet_id: ID,

    finalized_by: address,
    
    new_admin: address
}

public struct RolesUpdated has copy, drop {
  wallet_id: ID,

  updated_by: address,
  
  updated_users: vector<address>

}

public struct RolesAdded has copy, drop {
  
  wallet_id: ID,

  added_by: address,

  roles_added: vector<u8>

}

public struct RecoveryCanceled has copy, drop {

  wallet_id: ID,

  canceled_by: address,

}

public struct DepositedCoins has copy, drop {

  wallet_id: ID,

  deposited_by: address,

  ika_amount_deposited: u64,

  sui_amount_deposited: u64

}

public struct MessageSigned has copy, drop {

  sign_id : ID

}

public(package) fun wallet_created(
    wallet_id: ID,
    admin: address,
    initial_users: vector<address>,
    created_by: address
) {
  event::emit(WalletCreated {
    wallet_id,
    admin,
    initial_users,
    created_by
  });
}


public(package) fun presignature_added(
    wallet_id: ID,
    added_by: address,
    curve_signature_algorithm_combination: String,
    signatures_count_for_specified_curve: u64
) {
  event::emit(PresignatureAdded {
    wallet_id,
    added_by,
    curve_signature_algorithm_combination,
    signatures_count_for_specified_curve
  });
}


public(package) fun wallet_added(
    wallet_id: ID,
    added_by: address,
    curve: String,
) {
  event::emit(DwalletAdded {
    wallet_id,
    added_by,
    curve
  });
}


public(package) fun users_added(
    wallet_id: ID,
    added_by: address,
    users_added: vector<address>,
    number_of_users_added: u64

) {
  event::emit(UsersAdded {
    wallet_id,
    added_by,
    users_added,
    number_of_users_added
  });
}


public(package) fun users_removed(
    wallet_id: ID,
    removed_by: address,
    users_removed: vector<address>,
    number_of_users_removed: u64

) {
  event::emit(UserRemoved {
    wallet_id,
    removed_by,
    users_removed,
    number_of_users_removed
  });
}


public(package) fun recovery_initiated(
    wallet_id: ID,
    initiated_by: address,
    proposed_new_admin: address,
    finalization_time: u64

) {
  event::emit(RecoveryInitiated {
    wallet_id,
    initiated_by,
    proposed_new_admin,
    finalization_time
  });
}

public(package) fun recovery_finalized(
    wallet_id: ID,
    finalized_by: address,
    new_admin: address
) {
  event::emit(RecoveryFinalized {
    wallet_id,
    finalized_by,
    new_admin
  });
}

public(package) fun users_roles_updated(
    wallet_id: ID,
    updated_by: address,
    updated_users: vector<address>
) {
  event::emit(RolesUpdated {
    wallet_id,
    updated_by,
    updated_users
  });
}

public(package) fun roles_added(
    wallet_id: ID,
    added_by: address,
    roles_added: vector<u8>
) {
  event::emit(RolesAdded {
    wallet_id,
    added_by,
    roles_added
  });
}

public(package) fun recovery_canceled(
  wallet_id: ID,
  canceled_by: address
) {
  event::emit(RecoveryCanceled {
    wallet_id,
    canceled_by
  });
}

public(package) fun coins_deposited(
    wallet_id: ID,
    deposited_by: address,
    ika_amount_deposited: u64,
    sui_amount_deposited: u64
) {
  event::emit(DepositedCoins {
    wallet_id,
    deposited_by,
    ika_amount_deposited,
    sui_amount_deposited
  });
}

public(package) fun message_signed(
  sign_id: ID
) {
  event::emit(MessageSigned {
    sign_id
  });
}
