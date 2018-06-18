bleBtn = document.getElementById("ble-scan");
mqttBtn = document.getElementById("mqtt-connect");
deviceGrid = document.getElementById("device-grid");

var Buffer = Buffer.Buffer;
var client = undefined;

mqttBtn.addEventListener('click', function() {
  if (client && client.connected) {
    mqttBtn.enabled = false;
    client.end(false, () => {
      mqttBtn.enabled = true;
      mqttBtn.value = 'Connect';
    });
  }
  else {
    client = mqtt.connect('ws://mqtt.thing.zone')
    mqttBtn.enabled = false;
    client.on('connect', () => {
      console.log('Connected to MQTT server!')
      mqttBtn.enabled = true;
      mqttBtn.value = 'Disconnect';
    });
  }
});

function createSwitch(root){
  let label = Object.assign(document.createElement("label"), {className:'switch'});
  let input = Object.assign(document.createElement("input"), {type:'checkbox'});
  let span = Object.assign(document.createElement("span"), {className:'slider round'});

  label.appendChild(input)
  label.appendChild(span)
  root.appendChild(label)

  return input
}

function createDeviceElement(characteristics){
  let sUl = document.createElement("UL");
  for (var service in characteristics) {
    let sLi = document.createElement("LI");
    sLi.appendChild(document.createTextNode(service));
    sUl.appendChild(sLi);
    let cUl = document.createElement("UL");
    sUl.appendChild(cUl);
    characteristics[service].forEach(characteristic => {
      let cLi = document.createElement("LI");
      cLi.appendChild(document.createTextNode(characteristic.uuid));

      let input = Object.assign(document.createElement("input"),{
        type:'checkbox', checked:characteristic.properties.read, disabled:true});
      let label = Object.assign(document.createElement("label"), {className:'label-inline'});
      label.appendChild(input);
      label.appendChild(document.createTextNode("read"));
      cLi.appendChild(label);

      input = Object.assign(document.createElement("input"),{
        type:'checkbox', checked:characteristic.properties.write, disabled:true});
      label = Object.assign(document.createElement("label"), {className:'label-inline'});
      label.appendChild(input);
      label.appendChild(document.createTextNode("write"));
      cLi.appendChild(label);

      input = Object.assign(document.createElement("input"),{
        type:'checkbox', checked:false, disabled:!characteristic.properties.notify});
      input.onclick = handleCharacteristic.bind(null, characteristic)
      label = Object.assign(document.createElement("label"), {className:'label-inline'});
      label.appendChild(input);
      label.appendChild(document.createTextNode("notify"));
      cLi.appendChild(label);

      cUl.appendChild(cLi);
    });
  }
  return sUl;
}

bleBtn.addEventListener('pointerup', function(event) {
  navigator.bluetooth.requestDevice({
    filters: [{ services: ['ef680100-9b35-4933-9b10-52ffa9740042'] }],
    //acceptAllDevices: true,
    optionalServices: [
      'ef680200-9b35-4933-9b10-52ffa9740042',
      'ef680300-9b35-4933-9b10-52ffa9740042',
    ]
  }).then(device => {
    console.log(device);

    let row = Object.assign(document.createElement("div"), {className:'row'});
    deviceGrid.appendChild(row);

    let name = Object.assign(document.createElement("div"), {className:'column'});
    let deviceBtn = Object.assign(document.createElement("button"), {id:device.id, className:'button'});
    deviceBtn.appendChild(document.createTextNode(device.name));
    deviceBtn.onclick = collapseDevice.bind(row);
    name.appendChild(deviceBtn);
    row.appendChild(name);

    let id = Object.assign(document.createElement("div"), {className:'column'});
    id.appendChild(document.createTextNode(device.id));
    row.appendChild(id);

    let connect = Object.assign(document.createElement("div"), {className:'column'});
    let connectBtn = createSwitch(connect);
    row.appendChild(connect);

    let connected = Object.assign(document.createElement("div"), {className:'column'});
    connected.appendChild(document.createTextNode(device.gatt.connected));
    row.appendChild(connected);

    let panel = Object.assign(document.createElement("div"), {className:'row panel'});
    deviceGrid.appendChild(panel)

    connectBtn.onclick = function(){
      connectBtn.disabled = true;
      if (connectBtn.checked) {
        device.gatt.connect().then(server => {
          getCharacteristics(device).then(characteristics => {
            panel.appendChild(createDeviceElement(characteristics));
          }).catch(error => {
            connected.appendChild(document.createTextNode(error));
          });
          connected.innerHTML = device.gatt.connected;
          connectBtn.disabled = false;
        }).catch(error => {
          connected.appendChild(document.createTextNode(error));
        });
      } else {
        device.gatt.disconnect();
        connected.innerHTML = device.gatt.connected;
        connectBtn.disabled = false;
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
  .then(characteristic => {
    characteristic.addEventListener('characteristicvaluechanged', e => {
      const view = e.target.value;
      if (client.connected) {
        const deviceUri = escape(characteristic.service.device.id);
        client.publish(deviceUri + '/' + characteristic.service.uuid + '/' + characteristic.uuid, Buffer.from(view.buffer));
      }
    });
  });
}

function collapseDevice(evt) {
  evt.currentTarget.classList.toggle("button-outline");

  /* Toggle between hiding and showing the active panel */
  let panel = this.nextElementSibling;
  if (panel.style.display === "block") {
    panel.style.display = "none";
  } else {
    panel.style.display = "block";
  }
}

// https://github.com/joaquimserafim/base64-url
function escape (str) {
  return str.replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
