import { assert } from "chai";
import path from "path";
import { Account } from "../accounts";
import { Address, ErrBadMnemonicEntropy, ErrInvariantFailed, Message, Transaction, TransactionComputer } from "../core";
import {
    DummyMnemonicOf12Words,
    loadMnemonic,
    loadPassword,
    loadTestKeystore,
    loadTestWallet,
    TestWallet,
} from "./../testutils/wallets";
import { Randomness } from "./crypto";
import { Mnemonic } from "./mnemonic";
import { UserSecretKey } from "./userKeys";
import { UserSigner } from "./userSigner";
import { UserVerifier } from "./userVerifier";
import { UserWallet } from "./userWallet";

describe("test user wallets", () => {
    let alice: TestWallet, bob: TestWallet, carol: TestWallet;
    let password: string;
    let dummyMnemonic: string;

    before(async function () {
        alice = await loadTestWallet("alice");
        bob = await loadTestWallet("bob");
        carol = await loadTestWallet("carol");
        password = await loadPassword();
        dummyMnemonic = await loadMnemonic();
    });

    it("should generate mnemonic", () => {
        let mnemonic = Mnemonic.generate();
        let words = mnemonic.getWords();
        assert.lengthOf(words, 24);
    });

    it("should convert entropy to mnemonic and back", () => {
        function testConversion(text: string, entropyHex: string) {
            const entropyFromMnemonic = Mnemonic.fromString(text).getEntropy();
            const mnemonicFromEntropy = Mnemonic.fromEntropy(Buffer.from(entropyHex, "hex"));

            assert.equal(Buffer.from(entropyFromMnemonic).toString("hex"), entropyHex);
            assert.equal(mnemonicFromEntropy.toString(), text);
        }

        testConversion(
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
            "00000000000000000000000000000000",
        );

        testConversion(
            "moral volcano peasant pass circle pen over picture flat shop clap goat never lyrics gather prepare woman film husband gravity behind test tiger improve",
            "8fbeb688d0529344e77d225898d4a73209510ad81d4ffceac9bfb30149bf387b",
        );

        assert.throws(
            () => {
                Mnemonic.fromEntropy(Buffer.from("abba", "hex"));
            },
            ErrBadMnemonicEntropy,
            `Bad mnemonic entropy`,
        );
    });

    it("should derive keys", async () => {
        let mnemonic = Mnemonic.fromString(dummyMnemonic);

        assert.equal(mnemonic.deriveKey(0).hex(), alice.secretKeyHex);
        assert.equal(mnemonic.deriveKey(1).hex(), bob.secretKeyHex);
        assert.equal(mnemonic.deriveKey(2).hex(), carol.secretKeyHex);
    });

    it("should derive keys (12 words)", async () => {
        const mnemonic = Mnemonic.fromString(DummyMnemonicOf12Words);

        assert.equal(
            mnemonic.deriveKey(0).generatePublicKey().toAddress().toBech32(),
            "drt1l8g9dk3gz035gkjhwegsjkqzdu3augrwhcfxrnucnyyrpc2220pq4flasr",
        );
        assert.equal(
            mnemonic.deriveKey(1).generatePublicKey().toAddress().toBech32(),
            "drt1fmhwg84rldg0xzngf53m0y607wvefvamh07n2mkypedx27lcqntsg78vxl",
        );
        assert.equal(
            mnemonic.deriveKey(2).generatePublicKey().toAddress().toBech32(),
            "drt1tyuyemt4xz2yjvc7rxxp8kyfmk2n3h8gv3aavzd9ru4v2vhrkcksuhwdgv",
        );

        assert.equal(
            mnemonic.deriveKey(0).generatePublicKey().toAddress("test").toBech32(),
            "test1l8g9dk3gz035gkjhwegsjkqzdu3augrwhcfxrnucnyyrpc2220pqc6tnnf",
        );
        assert.equal(
            mnemonic.deriveKey(1).generatePublicKey().toAddress("xdrt").toBech32(),
            "xdrt1fmhwg84rldg0xzngf53m0y607wvefvamh07n2mkypedx27lcqnts0f2w3t",
        );
        assert.equal(
            mnemonic.deriveKey(2).generatePublicKey().toAddress("ydrt").toBech32(),
            "ydrt1tyuyemt4xz2yjvc7rxxp8kyfmk2n3h8gv3aavzd9ru4v2vhrkckswmkvs2",
        );
    });

    it("should create secret key", () => {
        const keyHex = alice.secretKeyHex;
        const fromBuffer = new UserSecretKey(Buffer.from(keyHex, "hex"));
        const fromArray = new UserSecretKey(Uint8Array.from(Buffer.from(keyHex, "hex")));
        const fromHex = UserSecretKey.fromString(keyHex);

        assert.equal(fromBuffer.hex(), keyHex);
        assert.equal(fromArray.hex(), keyHex);
        assert.equal(fromHex.hex(), keyHex);
    });

    it("should compute public key (and address)", () => {
        let secretKey: UserSecretKey;

        secretKey = new UserSecretKey(Buffer.from(alice.secretKeyHex, "hex"));
        assert.equal(secretKey.generatePublicKey().hex(), alice.address.toHex());
        assert.deepEqual(secretKey.generatePublicKey().toAddress(), alice.address);

        secretKey = new UserSecretKey(Buffer.from(bob.secretKeyHex, "hex"));
        assert.equal(secretKey.generatePublicKey().hex(), bob.address.toHex());
        assert.deepEqual(secretKey.generatePublicKey().toAddress(), bob.address);

        secretKey = new UserSecretKey(Buffer.from(carol.secretKeyHex, "hex"));
        assert.equal(secretKey.generatePublicKey().hex(), carol.address.toHex());
        assert.deepEqual(secretKey.generatePublicKey().toAddress(), carol.address);
    });

    it("should throw error when invalid input", () => {
        assert.throw(() => new UserSecretKey(Buffer.alloc(42)), ErrInvariantFailed);
        assert.throw(() => UserSecretKey.fromString("foobar"), ErrInvariantFailed);
    });

    it("should handle PEM files", () => {
        assert.equal(UserSecretKey.fromPem(alice.pemFileText).hex(), alice.secretKeyHex);
        assert.equal(UserSecretKey.fromPem(bob.pemFileText).hex(), bob.secretKeyHex);
        assert.equal(UserSecretKey.fromPem(carol.pemFileText).hex(), carol.secretKeyHex);
    });

    it("should create and load keystore files (with secret keys)", function () {
        this.timeout(10000);

        let aliceSecretKey = UserSecretKey.fromString(alice.secretKeyHex);
        let bobSecretKey = UserSecretKey.fromString(bob.secretKeyHex);
        let carolSecretKey = UserSecretKey.fromString(carol.secretKeyHex);

        console.time("encrypt");
        let aliceKeyFile = UserWallet.fromSecretKey({ secretKey: aliceSecretKey, password: password });
        let bobKeyFile = UserWallet.fromSecretKey({ secretKey: bobSecretKey, password: password });
        let carolKeyFile = UserWallet.fromSecretKey({ secretKey: carolSecretKey, password: password });
        console.timeEnd("encrypt");

        assert.equal(aliceKeyFile.toJSON().bech32, alice.address.toBech32());
        assert.equal(bobKeyFile.toJSON().bech32, bob.address.toBech32());
        assert.equal(carolKeyFile.toJSON().bech32, carol.address.toBech32());

        console.time("decrypt");
        assert.deepEqual(UserWallet.decryptSecretKey(aliceKeyFile.toJSON(), password), aliceSecretKey);
        assert.deepEqual(UserWallet.decryptSecretKey(bobKeyFile.toJSON(), password), bobSecretKey);
        assert.deepEqual(UserWallet.decryptSecretKey(carolKeyFile.toJSON(), password), carolSecretKey);
        console.timeEnd("decrypt");

        // With provided randomness, in order to reproduce our development wallets

        aliceKeyFile = UserWallet.fromSecretKey({
            secretKey: aliceSecretKey,
            password: password,
            randomness: new Randomness({
                id: alice.keyFileObject.id,
                iv: Buffer.from(alice.keyFileObject.crypto.cipherparams.iv, "hex"),
                salt: Buffer.from(alice.keyFileObject.crypto.kdfparams.salt, "hex"),
            }),
        });

        bobKeyFile = UserWallet.fromSecretKey({
            secretKey: bobSecretKey,
            password: password,
            randomness: new Randomness({
                id: bob.keyFileObject.id,
                iv: Buffer.from(bob.keyFileObject.crypto.cipherparams.iv, "hex"),
                salt: Buffer.from(bob.keyFileObject.crypto.kdfparams.salt, "hex"),
            }),
        });

        carolKeyFile = UserWallet.fromSecretKey({
            secretKey: carolSecretKey,
            password: password,
            randomness: new Randomness({
                id: carol.keyFileObject.id,
                iv: Buffer.from(carol.keyFileObject.crypto.cipherparams.iv, "hex"),
                salt: Buffer.from(carol.keyFileObject.crypto.kdfparams.salt, "hex"),
            }),
        });

        assert.deepEqual(aliceKeyFile.toJSON(), alice.keyFileObject);
        assert.deepEqual(bobKeyFile.toJSON(), bob.keyFileObject);
        assert.deepEqual(carolKeyFile.toJSON(), carol.keyFileObject);
    });

    it("should load keystore files (with secret keys, but without 'kind' field)", async function () {
        const keyFileObject = await loadTestKeystore("withoutKind.json");
        const secretKey = UserWallet.decryptSecretKey(keyFileObject, password);

        assert.equal(
            secretKey.generatePublicKey().toAddress().toBech32(),
            "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
        );
    });

    it("should create and load keystore files (with mnemonics)", async function () {
        this.timeout(10000);

        const wallet = UserWallet.fromMnemonic({ mnemonic: dummyMnemonic, password: password });
        const json = wallet.toJSON();

        assert.equal(json.version, 4);
        assert.equal(json.kind, "mnemonic");
        assert.isUndefined(json.toBech32);

        const mnemonic = UserWallet.decryptMnemonic(json, password);
        const mnemonicText = mnemonic.toString();

        assert.equal(mnemonicText, dummyMnemonic);
        assert.equal(mnemonic.deriveKey(0).generatePublicKey().toAddress().toBech32(), alice.address.toBech32());
        assert.equal(mnemonic.deriveKey(1).generatePublicKey().toAddress().toBech32(), bob.address.toBech32());
        assert.equal(mnemonic.deriveKey(2).generatePublicKey().toAddress().toBech32(), carol.address.toBech32());

        // With provided randomness, in order to reproduce our test wallets
        const expectedDummyWallet = await loadTestKeystore("withDummyMnemonic.json");
        const dummyWallet = UserWallet.fromMnemonic({
            mnemonic: dummyMnemonic,
            password: password,
            randomness: new Randomness({
                id: "5b448dbc-5c72-4d83-8038-938b1f8dff19",
                iv: Buffer.from("2da5620906634972d9a623bc249d63d4", "hex"),
                salt: Buffer.from("aa9e0ba6b188703071a582c10e5331f2756279feb0e2768f1ba0fd38ec77f035", "hex"),
            }),
        });

        assert.deepEqual(dummyWallet.toJSON(), expectedDummyWallet);
    });

    it("should create user wallet from secret key, but without 'kind' field", async function () {
        const keyFileObject = await loadTestKeystore("withoutKind.json");
        const secretKey = UserWallet.decrypt(keyFileObject, password);

        assert.equal(
            secretKey.generatePublicKey().toAddress().toBech32(),
            "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
        );
    });

    it("should loadSecretKey, but without 'kind' field", async function () {
        const testdataPath = path.resolve(__dirname, "..", "testdata/testwallets");
        const keystorePath = path.resolve(testdataPath, "withoutKind.json");
        const secretKey = UserWallet.loadSecretKey(keystorePath, password);

        assert.equal(
            secretKey.generatePublicKey().toAddress().toBech32(),
            "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
        );
    });

    it("should throw when calling loadSecretKey with unecessary address index", async function () {
        const keyFileObject = await loadTestKeystore("alice.json");

        assert.throws(
            () => UserWallet.decrypt(keyFileObject, password, 42),
            "addressIndex must not be provided when kind == 'secretKey'",
        );
    });

    it("should loadSecretKey with mnemonic", async function () {
        const keyFileObject = await loadTestKeystore("withDummyMnemonic.json");

        assert.equal(
            UserWallet.decrypt(keyFileObject, password, 0).generatePublicKey().toAddress().toBech32(),
            "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
        );
        assert.equal(
            UserWallet.decrypt(keyFileObject, password, 1).generatePublicKey().toAddress().toBech32(),
            "drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c",
        );
        assert.equal(
            UserWallet.decrypt(keyFileObject, password, 2).generatePublicKey().toAddress().toBech32(),
            "drt1k2s324ww2g0yj38qn2ch2jwctdy8mnfxep94q9arncc6xecg3xaq889n6e",
        );
    });

    it("should sign transactions", async () => {
        let signer = new Account(
            UserSecretKey.fromString("1a927e2af5306a9bb2ea777f73e06ecc0ac9aaa72fb4ea3fecf659451394cccf"),
        );
        let verifier = new UserVerifier(
            UserSecretKey.fromString(
                "1a927e2af5306a9bb2ea777f73e06ecc0ac9aaa72fb4ea3fecf659451394cccf",
            ).generatePublicKey(),
        );
        const transactionComputer = new TransactionComputer();

        // With data field
        let transaction = new Transaction({
            nonce: 0n,
            value: 0n,
            sender: Address.newFromBech32("drt1l453hd0gt5gzdp7czpuall8ggt2dcv5zwmfdf3sd3lguxseux2fsxvluwu"),
            receiver: Address.newFromBech32("drt1cux02zersde0l7hhklzhywcxk4u9n4py5tdxyx7vrvhnza2r4gmqgsejha"),
            gasPrice: 1000000000n,
            gasLimit: 50000n,
            data: new TextEncoder().encode("foo"),
            chainID: "1",
        });

        let serialized = transactionComputer.computeBytesForSigning(transaction);
        let signature = await signer.sign(serialized);

        assert.deepEqual(await signer.sign(serialized), await signer.sign(Uint8Array.from(serialized)));

        assert.equal(
            Buffer.from(signature).toString("hex"),
            "fba90410603f6a3d89f0faaee745eb97dc09de9a21bd020cd05687893bac4e800e01e8e32da31b15fdca483d422b03fda71e3285903313af56b35714a796ba01",
        );
        assert.isTrue(await verifier.verify(serialized, signature));

        // Without data field
        transaction = new Transaction({
            nonce: 8n,
            value: 10000000000000000000n,
            sender: Address.newFromBech32("drt1l453hd0gt5gzdp7czpuall8ggt2dcv5zwmfdf3sd3lguxseux2fsxvluwu"),
            receiver: Address.newFromBech32("drt1cux02zersde0l7hhklzhywcxk4u9n4py5tdxyx7vrvhnza2r4gmqgsejha"),
            gasPrice: 1000000000n,
            gasLimit: 50000n,
            chainID: "1",
        });

        serialized = transactionComputer.computeBytesForSigning(transaction);
        signature = await signer.sign(serialized);

        assert.deepEqual(await signer.sign(serialized), await signer.sign(Uint8Array.from(serialized)));

        assert.equal(
            Buffer.from(signature).toString("hex"),
            "37ecf2f4ddf853e5bcd7c134f86894f88df0bfa4585c2c58017aa0d9d8eda5df45e9845cda8c6aabe1ba4f5d04603ccd89c688b56fae967cd24bca31df387002",
        );
    });

    it("guardian should sign transactions from PEM", async () => {
        // bob is the guardian
        let signer = new UserSigner(
            UserSecretKey.fromString("1a927e2af5306a9bb2ea777f73e06ecc0ac9aaa72fb4ea3fecf659451394cccf"),
        );
        let verifier = new UserVerifier(
            UserSecretKey.fromString(
                "1a927e2af5306a9bb2ea777f73e06ecc0ac9aaa72fb4ea3fecf659451394cccf",
            ).generatePublicKey(),
        );
        let guardianSigner = new UserSigner(UserSecretKey.fromPem(bob.pemFileText));
        const transactionComputer = new TransactionComputer();

        // With data field
        let transaction = new Transaction({
            nonce: 0n,
            value: 0n,
            receiver: Address.newFromBech32("drt1cux02zersde0l7hhklzhywcxk4u9n4py5tdxyx7vrvhnza2r4gmqgsejha"),
            sender: Address.newFromBech32("drt1l453hd0gt5gzdp7czpuall8ggt2dcv5zwmfdf3sd3lguxseux2fsxvluwu"),
            gasPrice: 1000000000n,
            gasLimit: 50000n,
            data: new TextEncoder().encode("foo"),
            chainID: "1",
            guardian: Address.newFromBech32("drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c"),
            options: 2,
            version: 2,
        });

        let serialized = transactionComputer.computeBytesForSigning(transaction);
        let signature = await signer.sign(serialized);
        let guardianSignature = await guardianSigner.sign(serialized);

        assert.equal(
            Buffer.from(signature).toString("hex"),
            "4e9e9dbe6cfe04b84cafaf4401b6a56f573cabf7e833c0feb5a627c6d4b7e760afedcf209ca8a6f67a1b2906cf4958b17ae6d47e32b6d3357d99f48151c9f601",
        );
        assert.equal(
            Buffer.from(guardianSignature).toString("hex"),
            "ccd031fd8dd283c5bd516235e52ec312f3107b1e9365dfbf0d60db695909179f8c8699ec3d63cd2ec1d649926ddd9d4b651994ad028262e168f8e5241fccb101",
        );
        assert.isTrue(await verifier.verify(serialized, signature));

        // Without data field
        transaction = new Transaction({
            nonce: 8n,
            value: 10000000000000000000n,
            receiver: Address.newFromBech32("drt1cux02zersde0l7hhklzhywcxk4u9n4py5tdxyx7vrvhnza2r4gmqgsejha"),
            sender: Address.newFromBech32("drt1l453hd0gt5gzdp7czpuall8ggt2dcv5zwmfdf3sd3lguxseux2fsxvluwu"),
            gasPrice: 1000000000n,
            gasLimit: 50000n,
            chainID: "1",
            guardian: Address.newFromBech32("drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c"),
            options: 2,
            version: 2,
        });

        serialized = transactionComputer.computeBytesForSigning(transaction);
        signature = await signer.sign(serialized);
        guardianSignature = await guardianSigner.sign(serialized);

        assert.equal(
            Buffer.from(signature).toString("hex"),
            "dd6b7e035eddcc2b407772abb7348e2a76bf6c315840b9b5d1c7a1e22a8f645ac4fd40a8e047bfd29d8cea6bfee20df2d29f468690c4f12d873a075b11362b0f",
        );
        assert.equal(
            Buffer.from(guardianSignature).toString("hex"),
            "7ed70bf6776cdc64754623016b2e364896926e251be7bbe94c115e7c6e2704a4f353527e7facdae8c0a991dd34de71a30c4799e0fe4ec09d88c9e94c5402b20f",
        );
        assert.isTrue(await verifier.verify(serialized, signature));
    });

    it("should sign transactions using PEM files", async () => {
        const signer = UserSigner.fromPem(alice.pemFileText);
        const transactionComputer = new TransactionComputer();

        const transaction = new Transaction({
            nonce: 0n,
            value: 0n,
            sender: signer.getAddress(),
            receiver: Address.newFromBech32("drt1cux02zersde0l7hhklzhywcxk4u9n4py5tdxyx7vrvhnza2r4gmqgsejha"),
            gasPrice: 1000000000n,
            gasLimit: 50000n,
            data: new TextEncoder().encode("foo"),
            chainID: "1",
        });

        const serialized = transactionComputer.computeBytesForSigning(transaction);
        const signature = await signer.sign(serialized);

        assert.deepEqual(await signer.sign(serialized), await signer.sign(Uint8Array.from(serialized)));
        assert.equal(
            Buffer.from(signature).toString("hex"),
            "2f76e19b4d0c876342b891573c38f7ddc3d6411e8a52a3f5d86f40dd7e32cd030e7146310e203bc848c5b93540032974d51c4a1cd73ac734138e13aa9bef070d",
        );
    });

    it("signs a general message", async function () {
        let signer = new UserSigner(
            UserSecretKey.fromString("1a927e2af5306a9bb2ea777f73e06ecc0ac9aaa72fb4ea3fecf659451394cccf"),
        );
        let verifier = new UserVerifier(
            UserSecretKey.fromString(
                "1a927e2af5306a9bb2ea777f73e06ecc0ac9aaa72fb4ea3fecf659451394cccf",
            ).generatePublicKey(),
        );

        const message = new Message({
            data: new TextEncoder().encode(JSON.stringify({ foo: "hello", bar: "world" })),
        });

        const signature = await signer.sign(message.data);

        assert.deepEqual(await signer.sign(message.data), await signer.sign(Uint8Array.from(message.data)));
        assert.isTrue(await verifier.verify(message.data, signature));
        assert.isTrue(await verifier.verify(Uint8Array.from(message.data), Uint8Array.from(signature)));
        assert.isFalse(await verifier.verify(Buffer.from("hello"), signature));
        assert.isFalse(await verifier.verify(new TextEncoder().encode("hello"), signature));
    });

    it("should create UserSigner from wallet", async function () {
        const keyFileObjectWithoutKind = await loadTestKeystore("withoutKind.json");
        const keyFileObjectWithMnemonic = await loadTestKeystore("withDummyMnemonic.json");
        const keyFileObjectWithSecretKey = await loadTestKeystore("withDummySecretKey.json");

        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithoutKind, password).getAddress().toBech32(),
            "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
        );
        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithMnemonic, password).getAddress().toBech32(),
            "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
        );
        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithSecretKey, password).getAddress().toBech32(),
            "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
        );
        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithMnemonic, password, 0).getAddress().toBech32(),
            "drt1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssey5egf",
        );
        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithMnemonic, password, 1).getAddress().toBech32(),
            "drt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqlqde3c",
        );
        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithMnemonic, password, 2).getAddress().toBech32(),
            "drt1k2s324ww2g0yj38qn2ch2jwctdy8mnfxep94q9arncc6xecg3xaq889n6e",
        );

        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithMnemonic, password, 0).getAddress("test").toBech32(),
            "test1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ss5hqhtr",
        );
        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithMnemonic, password, 1).getAddress("xdrt").toBech32(),
            "xdrt1spyavw0956vq68xj8y4tenjpq2wd5a9p2c6j8gsz7ztyrnpxrruqchqmxv",
        );
        assert.equal(
            UserSigner.fromWallet(keyFileObjectWithMnemonic, password, 2).getAddress("ydrt").toBech32(),
            "ydrt1k2s324ww2g0yj38qn2ch2jwctdy8mnfxep94q9arncc6xecg3xaq4tajzl",
        );
    });

    it("should throw error when decrypting secret key with keystore-mnemonic file", async function () {
        const userWallet = UserWallet.fromMnemonic({ mnemonic: dummyMnemonic, password: `` });
        const keystoreMnemonic = userWallet.toJSON();

        assert.throws(() => {
            UserWallet.decryptSecretKey(keystoreMnemonic, ``);
        }, `Expected keystore kind to be secretKey, but it was mnemonic.`);
    });
});
