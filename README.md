# Web Bluetooth Proxy

The Web Bluetooth Proxy (`webbluetooth-proxy`) is a web application that forwards [GATT](https://learn.adafruit.com/introduction-to-bluetooth-low-energy/gatt) operations between BLE peripherals and MQTT. The Web Bluetooth Proxy is available on [duranda.github.io/webbluetooth-proxy](https://duranda.github.io/webbluetooth-proxy/).

## Compatible browsers

This project runs on browsers [compatible with the Web Bluetooth API](https://github.com/WebBluetoothCG/web-bluetooth/blob/master/implementation-status.md).

### Chrome

- In **Chrome OS, Android, & Mac**, the GATT Communication API is shipped without any flag.
- **Windows** requires Chrome 70 (available in [Canary](https://www.google.com/chrome/canary/)). The chrome://flags/#enable-experimental-web-platform-features flag must be enabled.
- **Linux** requires Kernel 3.19+ and [BlueZ](http://www.bluez.org/) 5.41+ installed. The chrome://flags/#enable-experimental-web-platform-features flag must be enabled.

## Connecting to broker

The proxy is able to connect to WebSocket (`ws://`) or WebSocket Secure (`wss://`) compatible MQTT brokers.

> This project uses [MQTT.js](https://github.com/mqttjs/MQTT.js).

## Topics

GATT messages are forwarded from/to the MQTT broker using the following scheme:

| type       | topic                                                     |
| ---------- | --------------------------------------------------------- |
| read       | `{device_uri}/{service_uuid}/{characteristic_uuid}/read`  |
| write      | `{device_uri}/{service_uuid}/{characteristic_uuid}/write` |
| notify     | `{device_uri}/{service_uuid}/{characteristic_uuid}`       |
| connection | `{device_uri}/connected`                                  |
