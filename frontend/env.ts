import dotenv from 'dotenv';
dotenv.config();

if (!process.env.SIGNER_KEY) {
    throw new Error("Missing SIGNER_KEY in .env file");
}

if (!process.env.ACCOUNT_TEST_ONE_KEY) {
    throw new Error("Missing ACCOUNT_TEST_ONE_KEY in .env file");
}

if (!process.env.ACCOUNT_TEST_TWO_KEY) {
    throw new Error("Missing ACCOUNT_TEST_TWO_KEY in .env file");
}

if (!process.env.ACCOUNT_TEST_THREE_KEY) {
    throw new Error("Missing ACCOUNT_TEST_THREE_KEY in .env file");
}

if (!process.env.PACKAGE_ADDRESS) {
    throw new Error("Missing PACKAGE_ADDRESS in .env file");
}

if (!process.env.WALLET_ADDRESS) {
    throw new Error("Missing WALLET_ADDRESS in .env file");
}

export const ENV = {
    SIGNER_KEY: process.env.SIGNER_KEY,
    ACCOUNT_TEST_ONE_KEY: process.env.ACCOUNT_TEST_ONE_KEY,
    ACCOUNT_TEST_TWO_KEY: process.env.ACCOUNT_TEST_TWO_KEY,
    ACCOUNT_TEST_THREE_KEY: process.env.ACCOUNT_TEST_THREE_KEY,
    PACKAGE_ADDRESS: process.env.PACKAGE_ADDRESS,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS
};

