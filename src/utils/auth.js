const { getUser, setUser } = require('./config');

function isDev(userId) {
    return getUser(userId).isDev === true;
}

function addDev(userId) {
    setUser(userId, { isDev: true });
}

function removeDev(userId) {
    setUser(userId, { isDev: false });
}

module.exports = { isDev, addDev, removeDev };
