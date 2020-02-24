require('buffer');

console.log(Buffer);
const AbstractBinding = require('@serialport/binding-abstract');

// TODO: Implement other FTDI variants.
const VENDOR_ID = '0x0403';
const PRODUCT_ID = '0x6001';

const H_CLK = 120000000;
const C_CLK = 48000000;

function FTDIToClkbits(baud, clk, clkDiv) {
    const fracCode = [0, 3, 2, 4, 1, 5, 6, 7];
    let bestBaud = 0;
    let divisor;
    let bestDivisor;
    let encodedDivisor;

    if (baud >= clk / clkDiv) {
        encodedDivisor = 0;
        bestBaud = clk / dlkDiv;
    } else if (baud >= clk / (clkDiv + clkDiv / 2)) {
        encodedDivisor = 1;
        bestBaud = clk / (clkDiv + clkDiv / 2);
    } else if (baud >= clk / (2 * clkDiv)) {
        encodedDivisor = 2;
        bestBaud = clk / (2 * clkDiv);
    } else {
        divisor = clk * 16 / clkDiv / baud;
        if (divisor & 1) {
            bestDivisor = divisor / 2 + 1;
        } else {
            bestDivisor = divisor / 2;
        }

        if (bestDivisor > 0x20000) {
            bestDivisor = 0x1ffff;
        }

        bestBaud = clk * 16 / clkDiv / bestDivisor;

        if (bestBaud & 1) {
            bestBaud = bestBaud / 2 + 1;
        } else {
            bestBaud = bestBaud / 2;
        }

        encodedDivisor = (bestDivisor >> 3) | (fracCode[bestDivisor & 0x7] << 14);
    }

    return [bestBaud, encodedDivisor];
}

function FTDIConvertBaudrate(baud) {
    let bestBaud;
    let encodedDivisor;
    let value;
    let index;

    if (baud <= 0) {
        throw new Error('Baud rate must be > 0');
    }

    [bestBaud, encodedDivisor] = FTDIToClkbits(baud, C_CLK, 16);

    value = encodedDivisor & 0xffff;
    index = encodedDivisor >> 16;

    return [bestBaud, value, index];
}

class FTDI323Binding extends AbstractBinding {
    static async list() {
        const devices = await navigator.usb.getDevices();
        if (devices.length > 0) {
            return devices;
        }

        await navigator.usb.requestDevice({
            filters: [
                {
                    vendorId: VENDOR_ID,
                    productId: PRODUCT_ID,
                }
            ]
        });
        return navigator.usb.getDevices();
    }

    async open(device, options) {
        if (!device || !device instanceof USBDevice) {
            throw new TypeError('"path" is not a valid USBDevice');
        }

        if (typeof options !== 'object') {
            throw new TypeError('"options" is not an object')
        }

        if (this.isOpen) {
            throw new Error('Already open')
        }
        await device.open();

        if (device.configuration === null) {
            await device.selectConfiguration(1);
        }
        await device.claimInterface(0);
        await device.selectConfiguration(1);
        await device.selectAlternateInterface(0, 0);

        const [baud, value, index] = FTDIConvertBaudrate(options.baudRate);
        console.log(baud, value, index);
        const result = await device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: 3,
            value ,
            index,
        });

        this.device = device;
        this.isOpen = true;
    }

    async read(buffer, offset, length) {
        await super.read(buffer, offset, 64)

        const {data: {buffer: dataBuffer, byteLength: bytesRead}} = await this.device.transferIn(1, 64);
        
        const uint8buffer = new Uint8Array(dataBuffer);

        if (bytesRead === 2) {
            return this.read(buffer, offset, 64);
        }

        for (let i = offset; i < offset + bytesRead - 2; i++) {
            buffer[i] = uint8buffer[i+2-offset];
        }

        return { bytesRead: bytesRead-2, buffer };
    }

    async write(buffer) {
        return this.device.transferOut(2, buffer);
    }

    async close() {
        super.close();
        return this.device.close();
    }
}

module.exports = FTDI323Binding;