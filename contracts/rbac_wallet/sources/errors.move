module rbac_wallet::errors;

// === Errors ===

public(package) macro fun empty_roles_vector(): u64 {
    0
}

public(package) macro fun config_vectors_lenghts_not_matching(): u64 {
    1
}

public(package) macro fun invalid_user_level(): u64 {
    2
}

public(package) macro fun no_recovery_account_at_creationl(): u64 {
    3
}

public(package) macro fun recovery_accs_roles_not_matching(): u64 {
    4
}

public(package) macro fun invalid_level_for_account(): u64 {
    5
}

public(package) macro fun no_member_found(): u64 {
    6
}

public(package) macro fun not_authorized(): u64 {
    7
}

public(package) macro fun presignatures_pool_full(): u64 {
    8
}

public(package) macro fun curve_already_exists(): u64 {
    9
}

public(package) macro fun active_recovery(): u64 {
    10
}

public(package) macro fun cant_remove_admin(): u64 {
    11
}

public(package) macro fun cant_remove_all_accounts(): u64 {
    12
}

public(package) macro fun min_account_limit_exceeded(): u64 {
    13
}

public(package) macro fun admin_version_expired(): u64 {
    14
}

public(package) macro fun admin_cannot_recover(): u64 {
    15
}

public(package) macro fun no_active_recovery(): u64 {
    16
}

public(package) macro fun recovery_not_ready(): u64 {
    17
}

public(package) macro fun cant_change_admin_role(): u64 {
    18
}

public(package) macro fun new_roles_lengths_not_matching(): u64 {
    19
}