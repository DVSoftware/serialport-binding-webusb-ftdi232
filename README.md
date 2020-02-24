# serialport-binding-webusb-ftdi232

__FTDI232__ Binding for `webusb-serialport`.

__Note:__ Even though this binding can be used with the default `serialport` package, it loads the default bindings which try to initialize Linux bindings, `webusb-serialport` does not load any binding nor it does autodetect it. 

## Installation
```bash
npm install webusb-serialport serialport-binding-webusb-ftdi232
```

## Usage
```javascript
const SerialPort = require('webusb-serialport'); // Require WebUSB Serial
const FTDIBinding = require('serialport-binding-webusb-ftdi232'); // Require FTDI Binding

SerialPort.Binding = FTDIBinding; // Set the binding

SerialPort.list() // List the devices (this will trigger the WebUSB device chooser)
    .then((devices) => {
        const serialPort = new SerialPort(devices[0], {
            autoOpen: true,
            baudRate: 115200,
        });

        // Use as a serialport module
        serialPort.write('data');
    });
```
