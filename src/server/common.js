// Shared functions

const debug = require('debug')('transactions');
const consts = require('./consts');

async function rejectDelay(reason) {
    console.error(reason);
    return new Promise((resolve, reject) => {
        setTimeout(reject.bind(null, reason), consts.RETRY_DELAY);
    });
}

async function runWithRetries(operation, cb, errCB) {

    let attempts = consts.NUM_RETRIES;
    let p = Promise.reject();

    for (var i = 0; i < attempts; i++) {
        p = p.catch(operation)
        .then((results) => {
            debug(`Retry result: ${results}`);
            return results;
        })
        .catch(rejectDelay);
    }

    p = p.then(cb).catch(errCB);

    return p;
}

module.exports = {
    runWithRetries
};
