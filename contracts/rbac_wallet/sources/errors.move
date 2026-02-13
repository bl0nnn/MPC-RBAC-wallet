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

public(package) macro fun no_user_at_creationl(): u64 {
    3
}

public(package) macro fun users_roles_not_matching(): u64 {
    4
}

public(package) macro fun invalid_level_for_user(): u64 {
    5
}

public(package) macro fun no_user_found(): u64 {
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

public(package) macro fun cant_remove_all_users(): u64 {
    12
}

public(package) macro fun min_users_limit_exceeded(): u64 {
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

public(package) macro fun role_doesnt_exist(): u64 {
    20
}

public(package) macro fun no_presignature_found(): u64 {
    20
}

public(package) macro fun double_adding_admin(): u64 {
    21
}