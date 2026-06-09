import { Buffer } from "buffer";
import { assert } from "chai";
import { Account } from "../accounts";
import { ProtoSerializer } from "../proto";
import { getTestWalletsPath } from "../testutils/utils";
import { Address } from "./address";
import { MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS, TRANSACTION_OPTIONS_DEFAULT } from "./constants";
import { INetworkConfig } from "./interfaces";
import { Transaction } from "./transaction";
import { TransactionComputer } from "./transactionComputer";

describe("test transaction", async () => {
    let alice: Account;
    let bob: Account;
    let carol: Account;
    const minGasLimit = 50000;
    const minGasPrice = 1000000000;

    const transactionComputer = new TransactionComputer();

    const networkConfig: INetworkConfig = {
        minGasLimit: 50000n,
        gasPerDataByte: 1500n,
        gasPriceModifier: 0.01,
        chainID: "D",
    };

    before(async function () {
        alice = await Account.newFromPem(`${getTestWalletsPath()}/alice.pem`);
        bob = await Account.newFromPem(`${getTestWalletsPath()}/bob.pem`);
        carol = await Account.newFromPem(`${getTestWalletsPath()}/carol.pem`);
    });

    it("should serialize transaction for signing (without data)", async () => {
        const transaction = new Transaction({
            chainID: networkConfig.chainID,
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            value: 0n,
            version: 2,
            nonce: 89n,
        });

        const serializedTransactionBytes = transactionComputer.computeBytesForSigning(transaction);
        const serializedTransaction = Buffer.from(serializedTransactionBytes).toString();

        assert.equal(
            serializedTransaction,
            `{"nonce":89,"value":"0","receiver":"drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c","sender":"drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf","gasPrice":1000000000,"gasLimit":50000,"chainID":"D","version":2}`,
        );
    });

    it("should serialize transaction for signing (with data)", async () => {
        const transaction = new Transaction({
            chainID: networkConfig.chainID,
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 70000n,
            value: 1000000000000000000n,
            version: 2,
            nonce: 90n,
            data: new Uint8Array(Buffer.from("hello")),
        });

        const serializedTransactionBytes = transactionComputer.computeBytesForSigning(transaction);
        const serializedTransaction = Buffer.from(serializedTransactionBytes).toString();

        assert.equal(
            serializedTransaction,
            `{"nonce":90,"value":"1000000000000000000","receiver":"drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c","sender":"drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf","gasPrice":1000000000,"gasLimit":70000,"data":"aGVsbG8=","chainID":"D","version":2}`,
        );
    });

    it("should sign transaction (with no data, no value) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: BigInt(minGasLimit),
            chainID: "local-testnet",
        });

        transaction.signature = await alice.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "958869289b34a7c1ca0cab0c214c3a0c7ba7bb352162f8d369ba948d82ce02f0cf7258ce8b28833dc3cb00c39a9533034b6e7b4e02a46c8435219350eb467700",
        );
        assert.equal(
            transactionComputer.computeTransactionHash(transaction),
            "80239cf34c0affccc0a01d4b5d15d951aae06b6bd967dd2e02f0ddd6371804a2",
        );
    });

    it("should sign transaction (with data, no value) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 90n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
        });

        transaction.signature = await alice.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "878ae4f7309e7a303182a28fd649a24973f107566634b14b3ad4d3928489b917df327e85add77495e85aeaf3620f92f98388cebe3603dd18480bdf25d467250b",
        );
        assert.equal(
            transactionComputer.computeTransactionHash(transaction),
            "dcab4f488b4014ddc0796d67c070e980173ac7ab2f3e70778fc01b2dcbda2b00",
        );
    });

    it("should sign transaction (with usernames)", async () => {
        const transaction = new Transaction({
            chainID: "T",
            sender: carol.address,
            receiver: alice.address,
            gasLimit: 50000n,
            value: 1000000000000000000n,
            version: 2,
            nonce: 204n,
            senderUsername: "carol",
            receiverUsername: "alice",
        });

        transaction.signature = await carol.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "5ac790366634a107930f4e47ef0e67b5e8f61503441bd38bc7cd12556f149b8edb43c08eedb7505e32e473f549ca598462388a11cecc917dd638968cd6178c06",
        );
    });

    it("should compute hash", async () => {
        const transaction = new Transaction({
            chainID: networkConfig.chainID,
            sender: alice.address,
            receiver: alice.address,
            gasLimit: 100000n,
            value: 1000000000000n,
            version: 2,
            nonce: 17243n,
            data: Buffer.from("testtx"),
        });

        transaction.signature = Buffer.from(
            "eaa9e4dfbd21695d9511e9754bde13e90c5cfb21748a339a79be11f744c71872e9fe8e73c6035c413f5f08eef09e5458e9ea6fc315ff4da0ab6d000b450b2a07",
            "hex",
        );

        const hash = transactionComputer.computeTransactionHash(transaction);

        assert.equal(hash, "169b76b752b220a76a93aeebc462a1192db1dc2ec9d17e6b4d7b0dcc91792f03");
    });

    it("should compute hash (with usernames)", async () => {
        const transaction = new Transaction({
            chainID: networkConfig.chainID,
            sender: alice.address,
            receiver: alice.address,
            gasLimit: 100000n,
            value: 1000000000000n,
            version: 2,
            nonce: 17244n,
            data: Buffer.from("testtx"),
            senderUsername: "alice",
            receiverUsername: "alice",
        });

        transaction.signature = Buffer.from(
            "807bcd7de5553ea6dfc57c0510e84d46813c5963d90fec50991c500091408fcf6216dca48dae16a579a1611ed8b2834bae8bd0027dc17eb557963f7151b82c07",
            "hex",
        );

        const hash = transactionComputer.computeTransactionHash(transaction);

        assert.equal(hash, "41b5acf7ebaf4a9165a64206b6ebc02021b3adda55ffb2a2698aac2e7004dc29");
    });

    it("should sign & compute hash (with data, with opaque, unused options) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: BigInt(minGasLimit),
            chainID: "local-testnet",
            // The protocol ignores the options when version == 1
            version: 1,
            options: 1,
        });

        assert.throws(() => {
            transactionComputer.computeBytesForSigning(transaction);
        }, `Non-empty transaction options requires transaction version >= ${MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS}`);
    });

    it("should sign & compute hash (with data, with value) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 91n,
            value: 10000000000000000000n,
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: 100000n,
            data: Buffer.from("for the book"),
            chainID: "local-testnet",
        });

        transaction.signature = await alice.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "29fa63f62119324eb38bbe254af1b61f405ddfdb62a53cb9d1a45fec061028c943e3ee385f340cec5277e6164600e52c7023bfe454f4c361a13c711018931306",
        );
        assert.equal(
            transactionComputer.computeTransactionHash(transaction).toString(),
            "53298d27be2635ae7d5b9b9bdd7fbcbdaccf8e8ac298b2b6e3afffd7ad287ee2",
        );
    });

    it("should sign & compute hash (with data, with large value) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 92n,
            value: BigInt("123456789000000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: 100000n,
            data: Buffer.from("for the spaceship"),
            chainID: "local-testnet",
        });

        transaction.signature = await alice.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "ce2fd0f2dab851612366151f6896bd83673a4409bb76714311c15c813289831b49fb954bd747a691f20bc6b29f4f66f06d7f94b2296f823a86531055fa5c010e",
        );
        assert.equal(
            transactionComputer.computeTransactionHash(transaction),
            "9681d7de69638ab29b8ce378973bebe79602ec2bb64d0db6a5d654ca39533dca",
        );
    });

    it("should sign & compute hash (with nonce = 0) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 0n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
            version: 1,
        });

        transaction.signature = await alice.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "a46d0601db75691aafd16d14d44aaec73cdb3dcbf80aa72ebfaf8361a143714c851dbba72c3689a8a397f8f6ed6288f48efbd5c5bc6c7a74ae1482f38c4e8e03",
        );
        assert.equal(
            transactionComputer.computeTransactionHash(transaction),
            "c77182e6c5c5a2344152d415c913e6e3a5b85e477252e5a4fd10180f2a18ffbe",
        );
    });

    it("should sign & compute hash (without options field, should be omitted) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: BigInt(minGasLimit),
            chainID: "local-testnet",
        });

        transaction.signature = await alice.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "958869289b34a7c1ca0cab0c214c3a0c7ba7bb352162f8d369ba948d82ce02f0cf7258ce8b28833dc3cb00c39a9533034b6e7b4e02a46c8435219350eb467700",
        );
        assert.equal(
            transactionComputer.computeTransactionHash(transaction),
            "80239cf34c0affccc0a01d4b5d15d951aae06b6bd967dd2e02f0ddd6371804a2",
        );

        const result = transactionComputer.computeBytesForSigning(transaction);
        assert.isFalse(result.toString().includes("options"));
    });

    it("should sign & compute hash (with guardian field, should be omitted) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: BigInt(minGasLimit),
            chainID: "local-testnet",
        });

        transaction.signature = await alice.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "958869289b34a7c1ca0cab0c214c3a0c7ba7bb352162f8d369ba948d82ce02f0cf7258ce8b28833dc3cb00c39a9533034b6e7b4e02a46c8435219350eb467700",
        );
        assert.equal(
            transactionComputer.computeTransactionHash(transaction),
            "80239cf34c0affccc0a01d4b5d15d951aae06b6bd967dd2e02f0ddd6371804a2",
        );

        const result = transactionComputer.computeBytesForSigning(transaction);
        assert.isFalse(result.toString().includes("options"));
    });

    it("should sign & compute hash (with usernames) (legacy)", async () => {
        const transaction = new Transaction({
            nonce: 204n,
            value: 1000000000000000000n,
            sender: Address.newFromBech32("drt1k2s324ww2g0yj38qn2ch2jwctdy8mnfxep94q9arncc6xecg3xaq889n6e"),
            receiver: Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
            senderUsername: "carol",
            receiverUsername: "alice",
            gasLimit: 50000n,
            chainID: "T",
        });

        transaction.signature = await carol.signTransaction(transaction);

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "5ac790366634a107930f4e47ef0e67b5e8f61503441bd38bc7cd12556f149b8edb43c08eedb7505e32e473f549ca598462388a11cecc917dd638968cd6178c06",
        );
        assert.equal(
            transactionComputer.computeTransactionHash(transaction),
            "fa910681f61c64cd6fe2ef0f77f9739e95bc26bd1dc00eaf766a1fbd4846ae83",
        );
    });

    it("should sign & compute hash (guarded transaction)", async () => {
        const transaction = new Transaction({
            chainID: "local-testnet",
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 150000n,
            gasPrice: 1000000000n,
            data: new Uint8Array(Buffer.from("test data field")),
            version: 2,
            options: 2,
            nonce: 92n,
            value: 123456789000000000000000000000n,
            guardian: Address.newFromBech32("drt1x23lzn8483xs2su4fak0r0dqx6w38enpmmqf2yrkylwq7mfnvyhsmueha6"),
        });
        transaction.guardianSignature = new Uint8Array(64);
        transaction.signature = await alice.signTransaction(transaction);

        const serializer = new ProtoSerializer();
        const buffer = serializer.serializeTransaction(transaction);

        assert.equal(
            buffer.toString("hex"),
            "085c120e00018ee90ff6181f3761632000001a208049d639e5a6980d1cd2392abcce41029cda74a1563523a202f09641cc2618f82a200139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1388094ebdc0340f093094a0f746573742064617461206669656c64520d6c6f63616c2d746573746e657458026240ac14f089dd19df4c3641bfe7796bb23717fc39eacf18eb915e514fd7fb31ba175c60b93a45d230b53c71b9763edb748ad3ab45972f7d09c69c212c258492c3076802722032a3f14cf53c4d0543954f6cf1bda0369d13e661dec095107627dc0f6d33612f7a4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        );

        const txHash = transactionComputer.computeTransactionHash(transaction);
        assert.equal(txHash, "a0427c60598931b7b3b12f7e546f5f73452a48f0136c3d1c51969a36733dbc3d");
    });

    it("computes fee (legacy)", () => {
        const transaction = new Transaction({
            nonce: 92n,
            value: BigInt("123456789000000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: BigInt(minGasLimit),
            chainID: "local-testnet",
        });

        const fee = transactionComputer.computeTransactionFee(transaction, networkConfig);
        assert.equal(fee.toString(), "50000000000000");
    });

    it("computes fee", async () => {
        const transaction = new Transaction({
            chainID: "D",
            sender: alice.address,
            receiver: alice.address,
            gasLimit: 50000n,
            gasPrice: BigInt(minGasPrice),
        });

        const gasLimit = transactionComputer.computeTransactionFee(transaction, networkConfig);
        assert.equal(gasLimit.toString(), "50000000000000");
    });

    it("computes fee, but should throw `NotEnoughGas` error", async () => {
        const transaction = new Transaction({
            chainID: networkConfig.chainID,
            sender: alice.address,
            receiver: alice.address,
            gasLimit: 50000n,
            data: Buffer.from("toolittlegaslimit"),
        });

        assert.throws(() => {
            transactionComputer.computeTransactionFee(transaction, networkConfig);
        });
    });

    it("computes fee (with data field) (legacy)", () => {
        let transaction = new Transaction({
            nonce: 92n,
            value: BigInt("123456789000000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            data: Buffer.from("testdata"),
            gasPrice: BigInt(minGasPrice),
            gasLimit: BigInt(minGasLimit + 12010),
            chainID: "local-testnet",
        });

        let fee = transactionComputer.computeTransactionFee(transaction, networkConfig);
        assert.equal(fee.toString(), "62000100000000");
    });

    it("computes fee (with data field)", async () => {
        const transaction = new Transaction({
            chainID: networkConfig.chainID,
            sender: alice.address,
            receiver: alice.address,
            gasLimit: 50000n + 12010n,
            gasPrice: BigInt(minGasPrice),
            data: Buffer.from("testdata"),
        });

        const gasLimit = transactionComputer.computeTransactionFee(transaction, networkConfig);
        assert.equal(gasLimit.toString(), "62000100000000");
    });

    it("should convert transaction to plain object and back", () => {
        const sender = alice.address;
        const transaction = new Transaction({
            nonce: 90n,
            value: 123456789000000000000000000000n,
            sender: sender,
            receiver: bob.address,
            senderUsername: "alice",
            receiverUsername: "bob",
            gasPrice: BigInt(minGasPrice),
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
        });

        const plainObject = transaction.toPlainObject();
        const restoredTransaction = Transaction.newFromPlainObject(plainObject);
        assert.deepEqual(restoredTransaction, transaction);
    });

    it("should handle large values", () => {
        const tx1 = new Transaction({
            value: 123456789000000000000000000000n,
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "local-testnet",
        });
        assert.equal(tx1.value.toString(), "123456789000000000000000000000");

        const tx2 = new Transaction({
            value: 123456789000000000000000000000n,
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "local-testnet",
        });
        assert.equal(tx2.value.toString(), "123456789000000000000000000000");

        const tx3 = new Transaction({
            value: BigInt("123456789000000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "local-testnet",
        });
        assert.equal(tx3.value.toString(), "123456789000000000000000000000");
    });

    it("checks correctly the version and options of the transaction", async () => {
        let transaction = new Transaction({
            nonce: 90n,
            value: BigInt("1000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
            version: 1,
            options: TRANSACTION_OPTIONS_DEFAULT,
        });
        assert.isFalse(transaction.isGuardedTransaction());

        transaction = new Transaction({
            nonce: 90n,
            value: BigInt("1000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
            version: 1,
            options: 2,
        });
        assert.isFalse(transaction.isGuardedTransaction());

        transaction = new Transaction({
            nonce: 90n,
            value: BigInt("1000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
            version: 2,
            options: 2,
        });
        assert.isFalse(transaction.isGuardedTransaction());

        transaction = new Transaction({
            nonce: 90n,
            value: BigInt("1000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
            version: 2,
            options: 2,
        });
        assert.isFalse(transaction.isGuardedTransaction());

        transaction = new Transaction({
            nonce: 90n,
            value: BigInt("1000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            guardian: bob.address,
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
            version: 2,
            options: 2,
        });
        assert.isFalse(transaction.isGuardedTransaction());

        transaction = new Transaction({
            nonce: 90n,
            value: BigInt("1000000000000000000"),
            sender: alice.address,
            receiver: bob.address,
            gasPrice: BigInt(minGasPrice),
            guardian: bob.address,
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "local-testnet",
            version: 2,
            options: 2,
        });
        transaction.signature = await alice.signTransaction(transaction);
        transaction.guardianSignature = transaction.signature;
        assert.isTrue(transaction.isGuardedTransaction());
    });

    it("test sign using hash", async () => {
        let transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            gasPrice: 1000000000n,
            chainID: "integration tests chain ID",
            version: 2,
            options: 1,
        });

        transaction.signature = await alice.sign(transactionComputer.computeHashForSigning(transaction));

        assert.equal(
            Buffer.from(transaction.signature).toString("hex"),
            "97500cef697c580695ddd2f589458bf1041da3a5a8e9217d497a84ede171d99236c71cdabb4b2abc82322d94a757338ca320a3016c7bb443ac6284cc4af9390f",
        );
    });

    it("should apply guardian", async () => {
        let transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "localnet",
        });

        transactionComputer.applyGuardian(transaction, carol.address);

        assert.equal(transaction.version, 2);
        assert.equal(transaction.options, 2);
        assert.equal(transaction.guardian, carol.address);
    });

    it("should apply guardian with options set for hash signing", async () => {
        let transaction = new Transaction({
            nonce: 89n,
            value: 0n,
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "localnet",
            version: 1,
        });

        transactionComputer.applyOptionsForHashSigning(transaction);
        assert.equal(transaction.version, 2);
        assert.equal(transaction.options, 1);

        transactionComputer.applyGuardian(transaction, carol.address);
        assert.equal(transaction.version, 2);
        assert.equal(transaction.options, 3);
    });

    it("should ensure transaction is valid", async () => {
        let transaction = new Transaction({
            sender: Address.empty(),
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "",
        });

        transaction.sender = alice.address;

        assert.throws(() => {
            transactionComputer.computeBytesForSigning(transaction);
        }, "The `chainID` field is not set");

        transaction.chainID = "localnet";
        transaction.version = 1;
        transaction.options = 2;

        assert.throws(() => {
            transactionComputer.computeBytesForSigning(transaction);
        }, `Non-empty transaction options requires transaction version >= ${MIN_TRANSACTION_VERSION_THAT_SUPPORTS_OPTIONS}`);

        transactionComputer.applyOptionsForHashSigning(transaction);

        assert.equal(transaction.version, 2);
        assert.equal(transaction.options, 3);
    });

    it("should compute bytes to verify transaction signature", async () => {
        let transaction = new Transaction({
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "D",
            nonce: 7n,
        });

        transaction.signature = await alice.signTransaction(transaction);

        const isSignedByAlice = await alice.verifyTransactionSignature(transaction, transaction.signature);

        const isSignedByBob = await bob.verifyTransactionSignature(transaction, transaction.signature);

        assert.equal(isSignedByAlice, true);
        assert.equal(isSignedByBob, false);
    });

    it("should compute bytes to verify transaction signature (signed by hash)", async () => {
        let transaction = new Transaction({
            sender: alice.address,
            receiver: bob.address,
            gasLimit: 50000n,
            chainID: "D",
            nonce: 7n,
        });

        transactionComputer.applyOptionsForHashSigning(transaction);

        transaction.signature = await alice.sign(transactionComputer.computeHashForSigning(transaction));

        const isSignedByAlice = await alice.verifyTransactionSignature(transaction, transaction.signature);

        const isSignedByBob = await bob.verifyTransactionSignature(transaction, transaction.signature);
        assert.equal(isSignedByAlice, true);
        assert.equal(isSignedByBob, false);
    });

    it("converts transaction to plain object and back", () => {
        const transaction = new Transaction({
            nonce: 90n,
            value: BigInt("123456789000000000000000000000"),
            sender: Address.newFromBech32("drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf"),
            receiver: Address.newFromBech32("drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c"),
            senderUsername: "alice",
            receiverUsername: "bob",
            gasPrice: 1000000000n,
            gasLimit: 80000n,
            data: Buffer.from("hello"),
            chainID: "localnet",
            version: 2,
        });

        const plainObject = transaction.toPlainObject();
        const restoredTransaction = Transaction.newFromPlainObject(plainObject);

        assert.deepEqual(plainObject, transaction.toPlainObject());
        assert.deepEqual(restoredTransaction, Transaction.newFromPlainObject(plainObject));
        assert.deepEqual(restoredTransaction, transaction);
        assert.deepEqual(plainObject, {
            nonce: 90,
            value: "123456789000000000000000000000",
            sender: "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
            receiver: "drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c",
            senderUsername: "YWxpY2U=",
            receiverUsername: "Ym9i",
            gasPrice: 1000000000,
            gasLimit: 80000,
            data: "aGVsbG8=",
            chainID: "localnet",
            version: 2,
            options: undefined,
            guardian: undefined,
            relayer: undefined,
            signature: undefined,
            guardianSignature: undefined,
            relayerSignature: undefined,
        });
    });
    it("should serialize transaction with relayer", async () => {
        const transaction = new Transaction({
            chainID: networkConfig.chainID,
            sender: alice.address,
            receiver: alice.address,
            relayer: bob.address,
            gasLimit: 50000n,
            value: 0n,
            version: 2,
            nonce: 89n,
        });

        const serializedTransactionBytes = transactionComputer.computeBytesForSigning(transaction);
        const serializedTransaction = Buffer.from(serializedTransactionBytes).toString();

        assert.equal(
            serializedTransaction,
            `{"nonce":89,"value":"0","receiver":"drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf","sender":"drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf","gasPrice":1000000000,"gasLimit":50000,"chainID":"D","version":2,"relayer":"drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c"}`,
        );
    });

    it("should test relayed v3", async () => {
        const transaction = new Transaction({
            chainID: networkConfig.chainID,
            sender: alice.address,
            receiver: alice.address,
            senderUsername: "alice",
            receiverUsername: "bob",
            gasLimit: 80000n,
            value: 0n,
            version: 2,
            nonce: 89n,
            data: Buffer.from("hello"),
        });

        assert.isFalse(transactionComputer.isRelayedV3Transaction(transaction));
        transaction.relayer = carol.address;
        assert.isTrue(transactionComputer.isRelayedV3Transaction(transaction));
    });
});
