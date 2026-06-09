import { assert } from "chai";
import { Address, TransactionsFactoryConfig } from "../core";
import { TRANSACTION_OPTIONS_TX_GUARDED } from "../core/constants";
import { AccountTransactionsFactory } from "./accountTransactionsFactory";

describe("test account transactions factory", function () {
    const config = new TransactionsFactoryConfig({ chainID: "D" });
    const factory = new AccountTransactionsFactory({ config: config });

    it("should create 'Transaction' for saving key value", async function () {
        const sender = Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");
        const keyValuePairs = new Map([[Buffer.from("key0"), Buffer.from("value0")]]);

        const transaction = await factory.createTransactionForSavingKeyValue(sender, {
            keyValuePairs: keyValuePairs,
        });

        assert.deepEqual(
            transaction.sender,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.deepEqual(
            transaction.receiver,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.equal(Buffer.from(transaction.data).toString(), "SaveKeyValue@6b657930@76616c756530");
        assert.equal(transaction.value, 0n);
        assert.equal(transaction.chainID, config.chainID);
        assert.equal(transaction.gasLimit, 271000n);
    });

    it("should create 'Transaction' for setting guardian", async function () {
        const sender = Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");
        const guardian = Address.newFromBech32("drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c");
        const serviceID = "DharitrITCSService";

        const transaction = await factory.createTransactionForSettingGuardian(sender, {
            guardianAddress: guardian,
            serviceID: serviceID,
        });

        assert.deepEqual(
            transaction.sender,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.deepEqual(
            transaction.receiver,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.equal(
            Buffer.from(transaction.data).toString(),
            "SetGuardian@8049d639e5a6980d1cd2392abcce41029cda74a1563523a202f09641cc2618f8@446861726974724954435353657276696365",
        );
        assert.equal(transaction.value, 0n);
        assert.equal(transaction.chainID, config.chainID);
        assert.equal(transaction.gasLimit, 469500n);
    });

    it("should create 'Transaction' for guarding account", async function () {
        const sender = Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");

        const transaction = await factory.createTransactionForGuardingAccount(sender);

        assert.deepEqual(
            transaction.sender,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.deepEqual(
            transaction.receiver,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.equal(Buffer.from(transaction.data).toString(), "GuardAccount");
        assert.equal(transaction.value, 0n);
        assert.equal(transaction.chainID, config.chainID);
        assert.equal(transaction.gasLimit, 318000n);
    });

    it("should create 'Transaction' for unguarding account with guardian", async function () {
        const sender = Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");
        const guardian = Address.newFromBech32("drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c");

        const transaction = await factory.createTransactionForUnguardingAccount(sender, { guardian });

        assert.deepEqual(
            transaction.sender,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.deepEqual(
            transaction.receiver,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.equal(Buffer.from(transaction.data).toString(), "UnGuardAccount");
        assert.equal(transaction.value, 0n);
        assert.equal(transaction.chainID, config.chainID);
        assert.equal(transaction.gasLimit, 321000n);
        assert.equal(transaction.options, TRANSACTION_OPTIONS_TX_GUARDED);
        assert.deepEqual(
            transaction.guardian,
            Address.newFromBech32("drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c"),
        );
    });

    it("should create 'Transaction' for unguarding account without guardian", async function () {
        const sender = Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf");

        const transaction = await factory.createTransactionForUnguardingAccount(sender, {});

        assert.deepEqual(
            transaction.sender,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.deepEqual(
            transaction.receiver,
            Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
        );
        assert.equal(Buffer.from(transaction.data).toString(), "UnGuardAccount");
        assert.equal(transaction.value, 0n);
        assert.equal(transaction.chainID, config.chainID);
        assert.equal(transaction.gasLimit, 321000n);
        assert.equal(transaction.options, 0);
    });
});
