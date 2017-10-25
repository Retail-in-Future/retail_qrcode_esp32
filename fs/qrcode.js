load('api_config.js');
load('api_uart.js');
load('api_timer.js');
load('api_sys.js');

let QRCode = {
    PREFIX: 'RETAIL_FOR_FUTURE_PREFIX#',
    SUFFIX: '#RETAIL_FOR_FUTURE_SUFFIX',
    
    create: function(qrcode_callback) {
        let uartNo = Cfg.get('qrcode.uart.uartNo');
        UART.setConfig(uartNo, {
            baudRate: Cfg.get('qrcode.uart.baudRate'),
            esp32: {
                gpio: {
                    rx: Cfg.get('pin.uart2_rxd'),
                    tx: Cfg.get('pin.uart2_txd'),
                }
            }
        });
        let qrcode = Object.create({
            uartNo: uartNo,
            data: '',
            enable: QRCode.enable,
            disable: QRCode.disable,
            find_string: QRCode.find_string,
            process_codes: QRCode.process_codes,
            process_code: QRCode.process_code,
            callback: qrcode_callback,
        });
        UART.setDispatcher(uartNo, QRCode.data_received, qrcode);
        qrcode.enable();
        return qrcode;
    },

    enable: function() {
        UART.setRxEnabled(this.uartNo, true);
    },

    disable: function() {
        UART.setRxEnabled(this.uartNo, false);
    },

    data_received: function(uartNo, qrcode) {
        let ra = UART.readAvail(uartNo);
        if (ra > 0) {
            let data = UART.read(uartNo);
            if (data) {
                //print(data);
                //qrcode.data = qrcode.data + QRCode.PREFIX;
                qrcode.data = qrcode.data + data;
                //qrcode.data = qrcode.data + QRCode.SUFFIX;
                qrcode.process_codes();
            }
        }
    },
    
    find_string: function(substring) {
        let length = substring.length;
        let found = false;
        let position = -1;
       
        for (let i = 0; i < this.data.length - length + 1; i++) {
            let str = this.data.slice(i, i + length);
            if (str === substring) {
                found = true;
                position = i;
                break;
            }
        }
        return {
            found: found,
            position: position
        };
    },
    
    process_codes: function() {
        let code = '';
        while(this.data.length > 0) {
            code = this.process_code();
            if (code !== '') {
                this.callback(this, code);
            } else {
                break;
            }
        }
    },
    
    process_code: function() {
        let code = '';
        let results = this.find_string(QRCode.PREFIX);
        let prefix_pos = results.position;
        if (prefix_pos === -1) {
            if (this.data.length > QRCode.PREFIX.length) {
                this.data = '';
            }
            return code;
        }
        results = this.find_string(QRCode.SUFFIX);
        let suffix_pos = results.position;
        if (suffix_pos === -1) {
            return code;
        }
        if (suffix_pos >= prefix_pos + QRCode.PREFIX.length) {
            code = this.data.slice(prefix_pos + QRCode.PREFIX.length, suffix_pos);
        }
        this.data = this.data.slice(suffix_pos + QRCode.SUFFIX.length);
        
        return code;
    }
};
