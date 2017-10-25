load('api_gpio.js');
load('api_mqtt.js');
load('api_sys.js');
load('api_aws.js');
load('qrcode.js');
load('gate.js');

let runtime_state = { gate_state: 'close', latest_qrcode: 'initialized' };  // device state: shadow metadata

let getInfo = function() {
    return JSON.stringify({total_ram: Sys.total_ram(), free_ram: Sys.free_ram()});
};

// Publish to MQTT topic on a button press. Button is wired to GPIO pin 0
GPIO.set_button_handler(0, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 2000, function() {
    let topic = '/devices/' + Cfg.get('device.id') + '/events';
    let message = getInfo();
    let ok = MQTT.pub(topic, message, 1);
    print('Published:', ok ? 'yes' : 'no', 'topic:', topic, 'message:', message);
}, null);

let state_callback = function(gate, new_state) {
    print('Gate state change to:', new_state === Gate.CLOSE ? 'close' : 'other');
    if (new_state === Gate.OPEN && runtime_state.gate_state !== 'open') {
        runtime_state.gate_state = 'open';
    } else if (new_state === Gate.CLOSE && runtime_state.gate_state !== 'close') {
        runtime_state.gate_state = 'close';
    } else if (new_state === Gate.ALARM && runtime_state.gate_state !== 'alarm') {
        runtime_state.gate_state = 'alarm';
    }
    AWS.Shadow.update(0, {desired: {gate_state: runtime_state.gate_state}});
};

let gate = Gate.create(state_callback);

let qrcode_callback = function(qrcode, code) {
    print('Got QRCode:', code);
    runtime_state.latest_qrcode = code;
    AWS.Shadow.update(0, {desired: runtime_state});
    let topic = '/Gateway/' + Cfg.get('device.id') + '/qrcode';
    let message = JSON.stringify(runtime_state);
    MQTT.pub(topic, message, 1);
};

let qrcode = QRCode.create(qrcode_callback);

AWS.Shadow.setStateHandler(function(data, event, reported, desired) {
    if (event === AWS.Shadow.CONNECTED) {
        AWS.Shadow.update(0, {reported: runtime_state});  // Report device state
    } else if (event === AWS.Shadow.UPDATE_DELTA) {
        for (let key in runtime_state) {
            if (desired[key] !== undefined) {
                runtime_state[key] = desired[key];
            }
        }
        if (runtime_state.gate_state === 'open' && gate.get() !== Gate.OPEN) {
            gate.set(Gate.OPEN);
        } else if (runtime_state.gate_state === 'close' && gate.get() !== Gate.CLOSE) {
            gate.set(Gate.CLOSE);
        } else if (runtime_state.gate_state === 'alarm' && gate.get() !== Gate.ALARM) {
            gate.set(Gate.ALARM);
        }
        AWS.Shadow.update(0, {reported: runtime_state});  // Report device state
    }
    print(JSON.stringify(reported), JSON.stringify(desired));
}, null);

