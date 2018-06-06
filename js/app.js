button = document.getElementById("ble-scan");
deviceTable = document.getElementById("device-table");

button.addEventListener('pointerup', function(event) {
  navigator.bluetooth.requestDevice({
    filters: [{ services: ['ef680100-9b35-4933-9b10-52ffa9740042'] }],
    //acceptAllDevices: true,
    optionalServices: [
      'ef680200-9b35-4933-9b10-52ffa9740042',
      'ef680300-9b35-4933-9b10-52ffa9740042',
    ]
  }).then(device => {
    console.log(device);
    let row = deviceTable.insertRow(-1);
    let name = row.insertCell(0);
    let id = row.insertCell(1);

    name.innerHTML = device.name;
    id.innerHTML = device.id;

    let connect = document.createElement('INPUT');
    connect.type = 'checkbox';
    row.insertCell(2).appendChild(connect);

    let connected = row.insertCell(3);
    connected.innerHTML = device.gatt.connected;

    connect.onclick = function(){
      connect.disabled = true;
      if (connect.checked) {
        device.gatt.connect().then(server => {
          getCharacteristics(device).then(characteristics => {
            let charList = row.insertCell(4)
            let sUl = document.createElement("UL");
            charList.appendChild(sUl);
            for (var service in characteristics) {
              let sLi = document.createElement("LI");
              sLi.appendChild(document.createTextNode(service));
              sUl.appendChild(sLi);
              let cUl = document.createElement("UL");
              sUl.appendChild(cUl);
              characteristics[service].forEach(characteristic => {
                let cLi = document.createElement("LI");
                cLi.appendChild(document.createTextNode(characteristic.uuid));
                if (characteristic.properties.notify) {
                  let notifyBtn = document.createElement("BUTTON");
                  notifyBtn.appendChild(document.createTextNode("Notify"));
                  notifyBtn.onclick = handleCharacteristic.bind(null, characteristic)
                  cLi.appendChild(notifyBtn);
                }
                cUl.appendChild(cLi);
                console.log(characteristic);
              });
            }
          });
          connected.innerHTML = device.gatt.connected;
          connect.disabled = false;
        });
      } else {
        device.gatt.disconnect();
        connected.innerHTML = device.gatt.connected;
        connect.disabled = false;
      }
    };
  }); 
});

function getCharacteristics(device){
  var supportedCharacteristics = {}
  return new Promise((resolve, reject) => {
    device.gatt.connect().then(server => {
      return server.getPrimaryServices();
    }).then(services => {
      let queue = Promise.resolve();
      services.forEach(service => {
        queue = queue.then(_ => service.getCharacteristics().then(characteristics => {
          supportedCharacteristics[service.uuid] = characteristics;
        }));
      });
      resolve(queue.then(_ => (supportedCharacteristics)));
    }).catch(error => {
      reject(error);
    });
  });
}

function handleCharacteristic(characteristic) {
  return characteristic.startNotifications()
  .then(char => {
    characteristic.addEventListener('characteristicvaluechanged',
                                    event => console.log(event));
  });
}
