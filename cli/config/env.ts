import dotenv from 'dotenv';
dotenv.config();

if (!process.env.SIGNER_KEY) {
    throw new Error("Missing SIGNER_KEY in .env file");
}

if (!process.env.PACKAGE_ADDRESS) {
    throw new Error("Missing PACKAGE_ADDRESS in .env file");
}

if (!process.env.WALLET_ADDRESS) {
    throw new Error("Missing WALLET_ADDRESS in .env file");
}

if (!process.env.HKDF_KEY) {
    throw new Error("Missing HKDF_KEY in .env file");
}

if (!process.env.ETH_RECIPIENT_ADDR) {
    throw new Error("Missing ETHEREUM_RECIPIENT_ADDR in .env file");

}

if (!process.env.TEST_RECOVERY_ACC){
    throw new Error("no TEST_RECOVERY_ACC in .env file")
}

if (!process.env.ALG_RECIPIENT_ADDR){
    throw new Error("no TEST_RECOVERY_ACC in .env file")
}

export const ENV = {
    SIGNER_KEY: process.env.SIGNER_KEY,
    PACKAGE_ADDRESS: process.env.PACKAGE_ADDRESS,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    HKDF_KEY_HEX: process.env.HKDF_KEY,
    ETH_RECIPIENT_ADDR: process.env.ETH_RECIPIENT_ADDR,
    TEST_RECOVERY_ACC: process.env.TEST_RECOVERY_ACC,
    ALG_RECIPIENT_ADDR: process.env.ALG_RECIPIENT_ADDR
};

