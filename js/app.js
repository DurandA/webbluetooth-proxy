let chosenHeartRateService = null;

button = document.getElementById("ble-scan");

button.addEventListener('pointerup', function(event) {
  navigator.bluetooth.requestDevice({
    filters: [{ services: ['ef680100-9b35-4933-9b10-52ffa9740042'] }],
    optionalServices: ['ef680200-9b35-4933-9b10-52ffa9740042']
  }).then(device => device.gatt.connect())
  .then(server => server.
                        getPrimaryService(
      'ef680200-9b35-4933-9b10-52ffa9740042'))
  .then(service => {
    thingyEnvironmentService = service;
    return Promise.all([
      service.
                 getCharacteristic(
      'ef680201-9b35-4933-9b10-52ffa9740042')
        .then(console.log),
      service.
                 getCharacteristic(
      'ef680203-9b35-4933-9b10-52ffa9740042')
        .then(console.log),
    ]);
  });
});
