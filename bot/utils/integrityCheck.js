const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const PROTECTED_FILES = {
    'views/developer.ejs': '684049825b05992bc8520b58a73076ca24a317ff7f2fcbe3c0c638f3a2765f0b',
    'views/layout.ejs': 'd650ce77f1467d8eb2642ad43dbde434a93fc354ccd1840fd45db0a0fa093d13',
    'hi.js': '84dedee557ea5058a8718d9c1571c13bf1194b7f6b3a84bdf451b07659c020d4',
    'tt.js': '36af2c261c4bc40eb85396aa4a496d345f782971eb28402c6a0a98bad789cc48'
};

function calculateHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function verifyIntegrity() {
    console.log('\x1b[36m[SECURITY] Verifying file integrity...\x1b[0m');
    const rootDir = path.join(__dirname, '../../'); // Assumes bot/utils/integrityCheck.js

    for (const [relativePath, expectedHash] of Object.entries(PROTECTED_FILES)) {
        const absolutePath = path.join(rootDir, relativePath);
        try {
            if (!fs.existsSync(absolutePath)) {
                console.error(`\x1b[31m[SECURITY] CRITICAL: Protected file missing: ${relativePath}\x1b[0m`);
                process.exit(1);
            }

            const currentHash = await calculateHash(absolutePath);
            if (currentHash !== expectedHash) {
                console.error(`\x1b[31m[SECURITY] CRITICAL: Integrity violation detected in ${relativePath}\x1b[0m`);
                console.error(`\x1b[31m[SECURITY] Expected: ${expectedHash}\x1b[0m`);
                console.error(`\x1b[31m[SECURITY] Found:    ${currentHash}\x1b[0m`);
                console.error(`\x1b[31m[SECURITY] System halted to prevent unauthorized modification.\x1b[0m`);
                process.exit(1);
            }
        } catch (error) {
            console.error(`\x1b[31m[SECURITY] Error checking file: ${relativePath}\x1b[0m`, error);
            process.exit(1);
        }
    }
    console.log('\x1b[32m[SECURITY] Integrity verification passed.\x1b[0m');
}

module.exports = { verifyIntegrity };
