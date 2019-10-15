let bleBtn = document.getElementById("ble-scan");
let modalBtn = document.getElementById('connect-modal');
let cancelBtn = document.getElementById('cancel');
let connectForm = document.getElementById('connect-form');
let deviceGrid = document.getElementById("device-grid");

Buffer = Buffer.Buffer;
let client = undefined;

let deviceMap = {}

modalBtn.addEventListener('click', function() {
  if (client && client.connected) {
    modalBtn.enabled = false;
    client.end(false, () => {
      modalBtn.enabled = true;
      modalBtn.value = 'Connect';
    });
  }
  else {
    document.getElementById('connect-dialog').showModal();
    document.querySelector('.error').message = '';
  }
});

document.getElementById('anonymous').addEventListener('change', e => {
  let checked = e.target.checked;
  document.getElementById('username').disabled = checked;
  document.getElementById('password').disabled = checked;
});

connectForm.addEventListener('submit', e => {
  e.preventDefault();
  let opts = new FormData(connectForm[0].form);
  let url = document.getElementById('broker-url').value;
  client = mqtt.connect(url, {username: opts.get('username'), password: opts.get('password')});
  modalBtn.enabled = false;
  client.on('connect', () => {
    console.log('Connected to MQTT server!')
    document.getElementById('connect-dialog').close();
    modalBtn.enabled = true;
    modalBtn.value = 'Disconnect';
    for (var deviceUri in deviceMap) {
      const topic = deviceUri+'/+/+'
      client.subscribe([`${topic}/Get`, `${topic}/Set`])
    }
  });
  client.on('message', onMessage);
  client.on('error', e => {
    console.log(e);
    let error = document.querySelector('.error');
    error.textContent = e.message;
  });
});

cancelBtn.addEventListener('click', function() {
  document.getElementById('connect-dialog').close();
});

function onMessage(topic, message) {
  // message is Buffer
  let deviceUri, serviceUUID, characteristicUUID, action;
  [deviceUri, serviceUUID, characteristicUUID, action] = topic.split('/');
  let device = deviceMap[deviceUri];
  if (!device.gatt.connected)
    return;
  device.gatt.getPrimaryService(serviceUUID)
  .then(service => service.getCharacteristic(characteristicUUID))
  .then(characteristic => {
    if (action == 'Set') {
      return characteristic.writeValue(message);
    }
    else if (action == 'Get')
      return characteristic.readValue().then(value => {
        if (client.connected)
          client.publish(`${deviceUri}/${serviceUUID}/${characteristicUUID}`, Buffer.from(value.buffer));
      })
  })
  .catch(error => { console.log(error); });
}

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
      input.onclick = handleCharacteristic.bind(input, characteristic);
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
      'ef680400-9b35-4933-9b10-52ffa9740042',
      'ef680500-9b35-4933-9b10-52ffa9740042'
    ]
  }).then(device => {
    console.log(device);
    const deviceUri = escape(device.id);
    deviceMap[deviceUri] = device;

    let deviceRow = Object.assign(document.createElement("div"), {className:'row device'});
    deviceGrid.appendChild(deviceRow);

    let identifier = Object.assign(document.createElement("div"), {className:'column column-50'});
    let s = Object.assign(document.createElement("strong"), {style:'padding-right: 1.5em;'});
    let name = document.createTextNode(device.name);
    s.appendChild(name);
    identifier.appendChild(s);
    identifier.appendChild(document.createTextNode(escape(device.id)));
    deviceRow.appendChild(identifier);

    let connect = Object.assign(document.createElement("div"), {className:'column column-10'});
    let connectBtn = createSwitch(connect);
    deviceRow.appendChild(connect);

    let errors = Object.assign(document.createElement("div"), {className:'column column-30'});
    deviceRow.appendChild(errors);

    let collapse = Object.assign(document.createElement("div"), {className:'column column-10'});
    let arrow = Object.assign(document.createElement("ion-icon"), {className:'arrow', name:'ios-arrow-forward'});
    collapse.appendChild(arrow);
    deviceRow.appendChild(collapse);

    deviceRow.addEventListener("click", collapseDevice.bind(deviceRow, arrow));

    let serviceRow = Object.assign(document.createElement("div"), {className:'row service collapsed'});
    deviceGrid.appendChild(serviceRow)

    connectBtn.onclick = function(){
      connectBtn.disabled = true;
      let topic = deviceUri+'/+/+'
      if (connectBtn.checked) {
        device.gatt.connect().then(server => {
          getCharacteristics(device).then(characteristics => {
            serviceRow.appendChild(createDeviceElement(characteristics));
          }).catch(error => {
            errors.appendChild(document.createTextNode(error));
          });
          deviceRow.classList.add("connected");
          if (client && client.connected) {
            client.publish(deviceUri + '/connected', "true");
            client.subscribe([`${topic}/Get`, `${topic}/Set`])
          }
          connectBtn.disabled = false;
        }).catch(error => {
          errors.appendChild(document.createTextNode(error));
        });
      } else {
        device.gatt.disconnect();
        deviceRow.classList.remove("connected");
        if (client && client.connected) {
          client.publish(deviceUri + '/connected', "false");
          client.unsubscribe([`${topic}/Get`, `${topic}/Set`])
        }
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
  if (!this.checked) {
    return characteristic.stopNotifications();
  }
  return characteristic.startNotifications()
  .then(characteristic => {
    characteristic.addEventListener('characteristicvaluechanged', e => {
      const view = e.target.value;
      if (client && client.connected) {
        const deviceUri = escape(characteristic.service.device.id);
        client.publish(deviceUri + '/' + characteristic.service.uuid +
                                   '/' + characteristic.uuid, Buffer.from(view.buffer));
      }
    });
  });
}

function collapseDevice(_, evt) {
  /* Toggle between hiding and showing the active panel */
  let serviceRow = this.nextElementSibling;
  let collapsed = this.classList.toggle("collapsed");
  let arrow = this.querySelector('.arrow');
  arrow.name = collapsed ? "ios-arrow-forward" : "ios-arrow-down";
}

// https://github.com/joaquimserafim/base64-url
function escape (str) {
  return str.replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
