// Server rest api
const Redis = require('./redis.service');

module.exports = function(ex) {

    // server.ex is the express instance

    ex.get('/test', (req, res) => {
        res.sendFile('index.html', { root: 'public'});
    });
    ex.get('/', (req, res) => {
        res.sendFile('index.html', { root: 'public/app'});
    });
    ex.get('/public/app/', (req, res) => {
        res.sendFile('index.html', { root: 'public/app'});
    });
    ex.get('/public/app/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/app'});
    });
    ex.get('/public/app/assets/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/app/assets'});
    });
    ex.get('/public/app/assets/assets/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/app/assets/assets'});
    });
    ex.get('/public/app/assets/assets/fonts/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/app/assets/assets/fonts'});
    });
    ex.get('/public/app/assets/assets/images/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/app/assets/assets/images'});
    });
    ex.get('/public/app/assets/assets/images/players/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/app/assets/assets/images/players'});
    });
    ex.get('/public/app/assets/fonts/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/app/assets/fonts'});
    });
    ex.get('/public/app/icons/:file', (req, res) => {
        res.sendFile(req.params['file'], { root: 'public/app/icons'});
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
