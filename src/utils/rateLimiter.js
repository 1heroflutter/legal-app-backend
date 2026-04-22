let lastCallTime = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimit(minInterval = 15000) {

    const now = Date.now();

    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < minInterval) {

        const waitTime = minInterval - timeSinceLastCall;

        console.log(`⏳ Rate limit: đợi ${Math.ceil(waitTime/1000)}s`);

        await sleep(waitTime);
    }

    lastCallTime = Date.now();
}

module.exports = { rateLimit, sleep };