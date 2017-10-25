load("api_gpio.js");
load("api_config.js");
load("api_sys.js");
load("api_timer.js");

let Gate = {
    OPEN: 0,
    CLOSE: 1,
    ALARM: 2,

    TIMER_INTERVAL: 5000,

    create: function(state_callback) {
        let red_pin = Cfg.get('pin.red');
        let green_pin = Cfg.get('pin.green');
        let blue_pin = Cfg.get('pin.blue');
        GPIO.set_mode(red_pin, GPIO.MODE_OUTPUT);
        GPIO.set_mode(green_pin, GPIO.MODE_OUTPUT);
        GPIO.set_mode(blue_pin, GPIO.MODE_OUTPUT);
        GPIO.write(red_pin, 0);  // Keep in reset.
        GPIO.write(green_pin, 0);  // Keep in reset.
        GPIO.write(blue_pin, 0);  // Keep in reset.
        let s = Object.create({
            red_pin: red_pin,
            green_pin: green_pin,
            blue_pin: blue_pin,
            set: Gate.set,
            get: Gate.get,
            clear_timer: Gate.clear_timer,
            set_timer: Gate.set_timer,
            reset_timer: Gate.reset_timer,
            state: Gate.CLOSE,
            timer_id: -1,
            callback: state_callback,
        });
        s.set(Gate.CLOSE);
        return s;
    },

    clear_timer: function() {
        if (this.timer_id !== -1) {
            Timer.del(this.timer_id);
            this.timer_id = -1;
        }
    },

    set_timer: function() {
        this.timer_id = Timer.set(Gate.TIMER_INTERVAL, false, Gate.close, this);
    },

    reset_timer: function() {
        this.clear_timer();
        this.set_timer();
    },

    set: function(state) {
        if (state === this.state) {
            return;
        }
        if (state === Gate.OPEN) {
            this.state = state;
            GPIO.write(this.red_pin, 0);
            GPIO.write(this.green_pin, 1);
            this.reset_timer();
            this.callback(this, this.state);
        } else if (state === Gate.CLOSE) {
            this.state = state;
            GPIO.write(this.red_pin, 0);
            GPIO.write(this.green_pin, 0);
            this.clear_timer();
            this.callback(this, this.state);
        } else if (state === Gate.ALARM) {
            this.state = state;
            GPIO.write(this.red_pin, 1);
            GPIO.write(this.green_pin, 0);
            this.reset_timer();
            this.callback(this, this.state);
        }
    },

    get: function() {
        return this.state;
    },

    close: function(gate) {
        gate.timer_id = -1;
        gate.set(Gate.CLOSE);
    }
};
