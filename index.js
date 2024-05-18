const UserQuery = require("./modules/gwm/userQuery");
const CarQuery = require("./modules/gwm/carQuery");
const storageManager = require("./modules/storageManager");
const { tuyaApi } = require("tuya-cloud-api");

///////////////////////////////////////////////////////
// Suas credenciais e Chassi Haval
let gwmUser = {
  vin: "LGWFFUA59RH935162",
  email: "email@brunodasilva.com",
  senha: "31100899Aa",
};
/// Suas credenciais do Tuya CLoud
let tuyaUser = {
  client_id: "rxy9x3k9d75rd9xpvna8",
  secret: "7b0392dea8f0478ba6af878802a014c1",
  portao: "ebe5bf7be8967a05c7hove",
};
///////////////////////////////////////////////////////

var logged = false;
var statusVehAnterior = false

const latitudeCasa = -29.185392;
const longitudeCasa = -51.216229;

let userApp = new UserQuery();
let carApp = new CarQuery();

tuyaApi.authorize({
  apiClientId: tuyaUser.client_id,
  apiClientSecret: tuyaUser.secret,
  serverLocation: "us",
});

abrirPortaoGaragem();

async function main() {
  logarNaHaval();
  setInterval(logarNaHaval, 600000);
  setInterval(async () => {
    if (!logged) {
      return console.log("Haval não logada");
    }
    let havalInfo = await verificarHaval();
    if (!havalInfo) {
      return console.log("Não peguei localização");
    }
    verfificaSePodeAbrirPortao(havalInfo.lat, havalInfo.lon, havalInfo.vehStatus);
  }, 20000);
}

var ultimaDistancia = 0;
var flagVindoCasa = 0;
async function verfificaSePodeAbrirPortao(latitude, longitude, lastStatus) {
  let distancia = calcularDistancia(
    latitude,
    longitude,
    latitudeCasa,
    longitudeCasa
  );
  console.log("Haval está a", distancia, "metros de casa.");
  if (
    distancia > 300 &&
    distancia < 600 &&
    Date.now() - ultimoPortaoAberto > 600000 &&
    ultimaDistancia > distancia
  ) {
    if (ultimaDistancia > distancia) {
      console.log("Haval está vindo de casa");
      flagVindoCasa++;
    }
  }
  if (flagVindoCasa > 5 && distancia < 50) {
    console.log("Abrir portão");
    await abrirPortaoGaragem();
    ultimoPortaoAberto = Date.now();
    flagVindoCasa = 0;
  }

  
  let vehStatus = 0
  for(var key in lastStatus.items)  {
    let value = lastStatus.items[key]
    if("2202001" == value.code) {
      if(value.value != statusVehAnterior) {
          console.log("Mudou de estado o veiculo")
          if(distancia < 10) {
            await abrirPortaoGaragem()
          }
      }
      else {
        console.log("Veiculo nao mudou de estado")
      }
      vehStatus = value.value
      statusVehAnterior = vehStatus
    }
  }

  ultimaDistancia = distancia;
}

async function abrirPortaoGaragem() {
  await tuyaSendCmd(true);
  await tuyaSendCmd(false);
}

var lastLogin = 0;

async function logarNaHaval() {
  if (
    !storageManager.getItem("accessToken") ||
    lastLogin - Date.now() > 300000
  ) {
    console.log("Tentando logar na Haval");
    if (!(await userApp.login(gwmUser.email, gwmUser.pass))) {
      console.log("Erro ao Haval...");
      lastLogin = Date.now();
      return (logged = 0);
    }
  }

  logged = 1;
  return true;
}

async function tuyaSendCmd(pos) {
  await tuyaApi.sendCommand({
    deviceId: tuyaUser.portao,
    commands: [
      {
        code: "switch_2",
        value: pos,
      },
    ],
  });
}
async function verificarHaval() {
  let lastStatus = await carApp.getLastStatus(gwmUser.vin);
  if (!lastStatus) {
    if (!(await userApp.login(gwmUser.email, gwmUser.pass))) {
      return false;
    }
  }
  return { lat: lastStatus.latitude, lon: lastStatus.longitude, vehStatus: lastStatus };
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  var R = 6371; // km
  var dLat = toRad(lat2 - lat1);
  var dLon = toRad(lon2 - lon1);
  var lat1 = toRad(lat1);
  var lat2 = toRad(lat2);

  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d;
}

// Converts numeric degrees to radians
function toRad(Value) {
  return (Value * Math.PI) / 180;
}

main();
