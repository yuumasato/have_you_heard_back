
// Supported languages
exports.SUPPORTED_LANGUAGES = [
    'es',
    'pt',
];

// Number of headlines fetched from the database per access
exports.HEADLINES_LIMIT = 50;

// Number of redis connections in the pool
exports.NUM_REDIS_IO = 3;

// Number of retries before giving up
exports.NUM_RETRIES = 10;

// Delay to wait between retries
exports.RETRY_DELAY = 100;
