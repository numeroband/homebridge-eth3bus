import Eth3Bus from './lib/Eth3Bus.mjs'

function log(...args) {
    console.log(new Date().getTime() / 1000, ...args);    
}
log.debug = log;

async function getZoneTemperature(zone) {
    const current = await zone.getCurrentTemperature();
    const target = await zone.getTargetTemperature();
    console.log(zone.name, "current", current, "target", target);
}

async function getAllTemperatures(ip) {    
    const config = {
        ip,
        timeoutMs: 2000,
    }
    const bus = new Eth3Bus(log, config);
    const zones = await bus.getDevices();
    for (const zone of zones) {
        await getZoneTemperature(zone);
    }
}

async function test(ip) {
    await getAllTemperatures(ip);
}

test(process.argv[2]).catch(err => console.log(err));
