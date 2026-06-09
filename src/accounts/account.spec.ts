import { assert } from "chai";
import { Address, Message, Transaction } from "../core";
import { getTestWalletsPath } from "../testutils/utils";
import { KeyPair, UserSecretKey } from "../wallet";
import { Account } from "./account";

describe("test account methods", function () {
    const DUMMY_MNEMONIC =
        "moral volcano peasant pass circle pen over picture flat shop clap goat never lyrics gather prepare woman film husband gravity behind test tiger improve";
    const alice = `${getTestWalletsPath()}/alice.pem`;
    it("should create account from pem file", async function () {
        const account = await Account.newFromPem(alice);

        assert.equal(
            account.secretKey.valueOf().toString("hex"),
            "413f42575f7f26fad3317a778771212fdb80245850981e48b58a4f25e344e8f9",
        );
        assert.equal(account.address.toBech32(), "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");
    });

    it("should create account from keystore", async function () {
        const account = Account.newFromKeystore(`${getTestWalletsPath()}/withDummyMnemonic.json`, "password");

        assert.equal(
            account.secretKey.valueOf().toString("hex"),
            "413f42575f7f26fad3317a778771212fdb80245850981e48b58a4f25e344e8f9",
        );
        assert.equal(account.address.toBech32(), "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");
    });

    it("should create account from mnemonic", async function () {
        const account = Account.newFromMnemonic(DUMMY_MNEMONIC);

        assert.equal(
            account.secretKey.valueOf().toString("hex"),
            "413f42575f7f26fad3317a778771212fdb80245850981e48b58a4f25e344e8f9",
        );
        assert.equal(account.address.toBech32(), "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");
    });

    it("should create account from keypair", async function () {
        const secretKey = UserSecretKey.fromString("413f42575f7f26fad3317a778771212fdb80245850981e48b58a4f25e344e8f9");
        const keypair = new KeyPair(secretKey);
        const account = Account.newFromKeypair(keypair);

        assert.deepEqual(account.secretKey, secretKey);
        assert.equal(account.address.toBech32(), "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");
    });

    it("should increase nonce on account", async function () {
        const account = Account.newFromMnemonic(DUMMY_MNEMONIC);
        account.nonce = 42n;

        assert.equal(account.getNonceThenIncrement(), 42n);
        assert.equal(account.getNonceThenIncrement(), 43n);
    });

    it("should sign transaction", async function () {
        const transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            receiver: Address.newFromBech32("drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c"),
            sender: Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
            gasPrice: 1000000000n,
            gasLimit: 50000n,
            data: new Uint8Array(),
            chainID: "local-testnet",
            version: 1,
            options: 0,
        });

        const account = Account.newFromMnemonic(DUMMY_MNEMONIC);
        transaction.signature = await account.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "6d308fe0924019c84d0c5894507435d4eedea1d3f992df5506daed1f2a2ec27e0c8176067c7a71b1680b3fe661c3b726db58fab4c9be52e169d7d4e78fd42a02",
        );
    });

    it("should sign message", async function () {
        const message = new Message({
            data: new Uint8Array(Buffer.from("hello")),
        });

        const account = Account.newFromMnemonic(DUMMY_MNEMONIC);
        message.signature = await account.signMessage(message);

        assert.equal(
            Buffer.from(message.signature).toString("hex"),
            "e9ddb76b9df89a4e9d500fc02138c9a2cf8a9e75a3dd52a345eadd87da18682b302a8a915c7776a5919a2d2274a88922ae932e4f600ebf4e164ebd3b16d11d03",
        );
    });

    it("should verify message", async function () {
        const message = new Message({
            data: new Uint8Array(Buffer.from("hello")),
        });

        const account = Account.newFromMnemonic(DUMMY_MNEMONIC);
        message.signature = await account.signMessage(message);
        const isVerified = await account.verifyMessageSignature(message, message.signature);

        assert.isTrue(isVerified);
    });

    it("should sign and verify transaction", async function () {
        const transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            receiver: Address.newFromBech32("drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c"),
            sender: Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
            gasPrice: 1000000000n,
            gasLimit: 50000n,
            data: new Uint8Array(),
            chainID: "local-testnet",
            version: 1,
            options: 0,
        });

        const account = Account.newFromMnemonic(DUMMY_MNEMONIC);
        transaction.signature = await account.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "6d308fe0924019c84d0c5894507435d4eedea1d3f992df5506daed1f2a2ec27e0c8176067c7a71b1680b3fe661c3b726db58fab4c9be52e169d7d4e78fd42a02",
        );

        const isVerified = await account.verifyTransactionSignature(transaction, transaction.signature);
        assert.isTrue(isVerified);
    });
});
