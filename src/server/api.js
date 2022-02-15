// Server rest api
const Redis = require('./redis.service');

module.exports = function(ex) {

    // server.ex is the express instance

    ex.get('/', (req, res) => {
        res.sendFile('index.html', { root: 'public'});
    });
    ex.get('/privacidade', (req, res) => {
        res.sendFile('privacy_policy.html', { root: 'public'});
    });
    ex.get('/bootstrap/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/bootstrap'});
    });
    ex.get('/css/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/css'});
    });
    ex.get('/assets/fonts/Nunito-Regular.ttf', (req, res) => {
        res.sendFile('Nunito-Regular.ttf', { root: 'public/assets/fonts/'});
    });

    ex.get('/redis/set', async (req, res) => {
        key = req.query.key;
        value = req.query.value;

        if (key && value) {
            r = await Redis.set(key, value);
            res.json(r);
        } else {
            console.log('Bad redis set from API');
        }
    });

    ex.get('/redis/get', async (req, res) => {
        key = req.query.key;
        if (key) {
            r = await Redis.get(key);
            res.json(r);
        } else {
            console.log('Bad redis get from API');
        }
    });

    ex.get('/redis/del', async (req, res) => {
        key = req.query.key;
        if (key) {
            r = await Redis.del(key);
            res.json(r);
        } else {
            console.log('Bad redis del from API');
        }
    });

    ex.get('/redis/keys', async (req, res) => {
        pattern = req.query.pattern;
        if (pattern) {
            r = await Redis.keys(pattern);
            res.json(r);
        } else {
            console.log('Bad redis set from API');
        }
    });
};
