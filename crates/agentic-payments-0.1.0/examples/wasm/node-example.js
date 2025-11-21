#!/usr/bin/env node

/**
 * Node.js example for agentic-payments WASM
 *
 * Run: npm run test:node
 */

import {
    AgentIdentity,
    verify,
    verifyBase64,
    batchVerify,
    createCredential,
    version,
    maxPoolSize,
    minPoolSize,
    bytesToBase64,
    bytesToHex,
} from './pkg-node/agentic_payments.js';

console.log('🚀 Agentic Payments WASM - Node.js Example\n');

async function main() {
    try {
        // 1. Library Info
        console.log('📚 Library Information:');
        console.log(`   Version: ${version()}`);
        console.log(`   Max Pool Size: ${maxPoolSize()}`);
        console.log(`   Min Pool Size (BFT): ${minPoolSize()}\n`);

        // 2. Generate Identity
        console.log('🔑 Generating Agent Identity...');
        const identity = AgentIdentity.generate();
        const publicKey = identity.publicKeyBase64();
        const did = identity.did();

        console.log(`   DID: ${did}`);
        console.log(`   Public Key (Base64): ${publicKey}`);
        console.log(`   Public Key (Hex): ${identity.publicKeyHex()}\n`);

        // 3. Sign Message
        console.log('✍️  Signing Message...');
        const message = 'Hello from Node.js with WASM!';
        const signatureBytes = identity.sign(message);
        const signature = bytesToBase64(signatureBytes);

        console.log(`   Message: "${message}"`);
        console.log(`   Signature (Base64): ${signature}`);
        console.log(`   Signature (Hex): ${bytesToHex(signatureBytes)}\n`);

        // 4. Verify Signature
        console.log('🔍 Verifying Signature...');
        const startTime = Date.now();
        const isValid = await verifyBase64(signature, message, publicKey);
        const endTime = Date.now();

        console.log(`   Valid: ${isValid ? '✅ Yes' : '❌ No'}`);
        console.log(`   Verification Time: ${endTime - startTime}ms\n`);

        // 5. Batch Verification
        console.log('🔄 Batch Verification (100 signatures)...');
        const batchSize = 100;
        const signatures = [];
        const messages = [];
        const publicKeys = [];

        // Generate test data
        for (let i = 0; i < batchSize; i++) {
            const testIdentity = AgentIdentity.generate();
            const testMessage = `Test message ${i}`;
            const testSig = testIdentity.sign(testMessage);

            signatures.push(testSig);
            messages.push(testMessage);
            publicKeys.push(testIdentity.publicKey());
        }

        const batchStartTime = Date.now();
        const results = await batchVerify(signatures, messages, publicKeys);
        const batchEndTime = Date.now();

        const validCount = results.filter(r => r).length;
        const totalTime = batchEndTime - batchStartTime;
        const avgTime = totalTime / batchSize;

        console.log(`   Total Verifications: ${batchSize}`);
        console.log(`   Valid Signatures: ${validCount}/${batchSize}`);
        console.log(`   Total Time: ${totalTime}ms`);
        console.log(`   Average Time: ${avgTime.toFixed(2)}ms per signature`);
        console.log(`   Throughput: ${(1000 / avgTime).toFixed(0)} verifications/sec\n`);

        // 6. Create AP2 Credential
        console.log('📜 Creating AP2 Credential...');
        const subjectDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
        const credentialType = 'PaymentAuthorization';

        const credential = createCredential(identity, subjectDid, credentialType);
        const credObj = JSON.parse(credential);

        console.log('   Credential JSON:');
        console.log(JSON.stringify(credObj, null, 2));
        console.log();

        // 7. Export and Import Identity
        console.log('💾 Testing Identity Export/Import...');
        const exported = identity.toJSON();
        const imported = AgentIdentity.fromJSON(exported);
        const importedDid = imported.did();

        console.log(`   Original DID: ${did}`);
        console.log(`   Imported DID: ${importedDid}`);
        console.log(`   Match: ${did === importedDid ? '✅ Yes' : '❌ No'}\n`);

        // 8. Error Handling Test
        console.log('🧪 Testing Error Handling...');
        try {
            const invalidSig = new Uint8Array(64); // All zeros
            await verifyBase64(
                bytesToBase64(invalidSig),
                'test',
                publicKey
            );
        } catch (err) {
            console.log(`   ✅ Caught expected error: ${err.message}\n`);
        }

        // 9. Performance Benchmark
        console.log('⚡ Performance Benchmark (1000 signatures)...');
        const benchSize = 1000;
        const benchStart = Date.now();

        for (let i = 0; i < benchSize; i++) {
            const benchIdentity = AgentIdentity.generate();
            const benchSig = benchIdentity.sign(`Benchmark ${i}`);
            // Verification is async, so we'll do it in parallel batches
        }

        const benchEnd = Date.now();
        const benchTime = benchEnd - benchStart;

        console.log(`   Generated ${benchSize} signatures in ${benchTime}ms`);
        console.log(`   Throughput: ${(1000 * benchSize / benchTime).toFixed(0)} signatures/sec\n`);

        console.log('✅ All tests completed successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run main function
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});