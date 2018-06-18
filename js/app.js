bleBtn = document.getElementById("ble-scan");
mqttBtn = document.getElementById("mqtt-connect");
deviceTable = document.getElementById("device-table");

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

function createDeviceElement(deviceId, characteristics){
  let container = Object.assign(document.createElement("div"), {className:'tabcontent'});
  container.id = 'dev-'+deviceId;
  let sUl = document.createElement("UL");
  container.appendChild(sUl);
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
  return container;
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
    let row = deviceTable.insertRow(-1);
    let name = row.insertCell(0);
    let tab = Object.assign(document.createElement("button"), {id:device.id, className:'tablinks button-outline'});
    tab.appendChild(document.createTextNode(device.name));
    tab.onclick = openDevice.bind(null, device.id)
    let id = row.insertCell(1);

    name.appendChild(tab);
    id.innerHTML = device.id;

    let connect = createSwitch(row.insertCell(2))

    let connected = row.insertCell(3);
    connected.innerHTML = device.gatt.connected;

    connect.onclick = function(){
      connect.disabled = true;
      if (connect.checked) {
        device.gatt.connect().then(server => {
          getCharacteristics(device).then(characteristics => {
            document.getElementById('device').appendChild(createDeviceElement(device.id, characteristics));
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

function openDevice(deviceId, evt) {
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.add("button-outline");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    let container = document.getElementById('dev-'+deviceId);
    if (container) {
      container.style.display = "block";
    }
    evt.currentTarget.classList.remove("button-outline");
}

// https://github.com/joaquimserafim/base64-url
function escape (str) {
  return str.replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
