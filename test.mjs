import E3BConnection from './lib/E3BConnection.mjs'
import request from 'request-promise-native'

function log(...args) {
    console.log(new Date().getTime() / 1000, ...args);    
}
log.debug = log;

async function queryInstal() {
    const body = await request.get('http://192.168.1.35:8000/Instal.dat')
    const lines = body.trim().split('\n').map(line => line.trim())
    let idx = 0;
    while (idx < lines.length) {
        const footprint = parseInt(lines[idx++]);
        const name = lines[idx++];
        const x = parseInt(lines[idx++]);
        const y = parseInt(lines[idx++]);
        const addr = parseInt(lines[idx++]);
        const zone = parseInt(lines[idx++]);
        const devType = parseInt(lines[idx++]);
        const iconId = parseInt(lines[idx++]);
        console.log({footprint, name, x, y, addr, zone, devType, iconId});
    }
}

async function connection() {    
    const conn = new E3BConnection('192.168.1.35', log, 5000);
    console.log('enum');
    conn.enum();
    console.log('read packet 1');
    conn.sendPacket(49, E3BConnection.Command.READ, 0);
    console.log('read packet 2');
    await conn.sendPacket(49, E3BConnection.Command.READ, 1);
    console.log('waiting for disconnect');
    setTimeout(async () => {
        console.log('read packet 3');
        conn.sendPacket(49, E3BConnection.Command.READ, 2);
        console.log('read packet 4');
        await conn.sendPacket(49, E3BConnection.Command.READ, 3);    
        console.log('waiting for disconnect');
    }, 7000);
}

async function test() {
    await queryInstal();
    await connection();
}

test().catch(err => console.log(err));
