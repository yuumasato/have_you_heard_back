// Shared functions

const debug = require('debug')('transactions');

async function rejectDelay(reason) {
    console.error(reason);
    return new Promise((resolve, reject) => {
        setTimeout(reject.bind(null, reason), 100); 
    });
}

async function runWithRetries(operation, cb, errCB) {

    let attempts = 5;
    let p = Promise.reject();

    for (var i = 0; i < attempts; i++) {
        p = p.catch(operation)
        .then((results) => {
            debug("Results = " + JSON.stringify(results));
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
