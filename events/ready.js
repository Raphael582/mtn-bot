module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`Bot está online como ${client.user.tag}`);
    },
};