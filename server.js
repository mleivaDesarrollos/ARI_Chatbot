'use strict';
// Cargamos la libreria express
var express = require('express');
// Instanciamos express en una variable
var app = express();

var fs = require('fs');
var http = require('http');
var https = require('https');
var path = require('path');
var uploads = require('./upload.js')();

// Cargamos libreria para parsear formularios por post
var bodyParser = require('body-parser');
// Cargamos la libreria para poder subir archivos

/*  LIBRERIAS AUTHENTICATION  */
var ad = require('activedirectory');
var session = require('express-session');
var cookie = require('cookie-parser');

// CONFIGURACION AD
var configAD = {
    url: 'ldap://192.168.1.1:389',
    baseDN: 'dc=mega,dc=com,dc=ar',
    username: 'admintec@mega.com.ar',
    password: 'C4rr13r!'
};

// Librería de Logeo privado
let log = require('./Log');
let LOG_SERVER_PREFIX = "MainServer - ";

// Configuración de certificados
var privateKey = fs.readFileSync('./portal.key');
var certificate = fs.readFileSync('./portal.pem');
var credentials = { key: privateKey, cert: certificate };
const server = http.createServer(app);
const servers = https.createServer(credentials, app);
const PORT_STANDARD = 80;
const PORT_SECURE = 443;
const PUBLIC_URL = "portal.megatech.la";

// Hacemos que express considere las librerias middleware bodyparser y multer para su funcionamiento
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookie());
app.use(session({ secret: 'codigo secreto', resave: false, saveUninitialized: false }));

// Redireccionamiento

app.use(function (req, res, next) {
    if (req.secure || !(req.headers.host.includes(PUBLIC_URL))) {
        // request was via https, so do no special handling
        next();
    } else {
        // request was via http, so redirect to https
        res.redirect('https://' + req.headers.host + req.url);
    }
});

// Logica de autenticación
app.post('/authenticate', (req, res) => {
    var adMega = new ad(configAD);
    var userData = req.body;
    // console.log(userData); // USR, PSW, STY
    adMega.authenticate(userData.user + '@mega.com.ar', userData.pass, function (err, auth) {
        if (auth) {
            adMega.find('(&(sAMAccountName=' + userData.user + '))', function (err, results) {
                // Separamos el primer nombre del usuario de AD
                var firstName = results.users[0].givenName.split(" ")[0];
                var fullName = results.users[0].displayName;
                req.session.username = userData.user;
                req.session.auth = Buffer.from(userData.user + ":" + userData.pass).toString('base64');
                req.session.firstname = firstName;
                req.session.fullname = fullName;
                req.session.isLogged = true;
                res.cookie('nombreUsuario', req.session.firstname);
                // Si checkbox==false --> vida de la cookie = 1hs
                if (userData.stay == false) {
                    req.session.cookie.maxAge = 3600000; // milisegundos
                }

                res.send(true);
            });
        } else res.send(false);
    });
});

// GET LOGOUT
app.get('/logout', (req, res, next) => {
    req.session.destroy();
    res.redirect(req.get('referer'));
});


app.use('/login', express.static('./public/login'));

app.use(function(req, res, next) {

    if (req.session.isLogged || req.path.includes("/presentacion/")) {
        next();
    } else {
        res.sendFile(path.join(__dirname + '/public/login/login.html'));
    }
});

app.use('/', express.static('./public'));


app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.post('/send', (req, res) => {
    // Separamos el componente JSON enviado
    let msgToSend = req.body;
    // Obtenemos el nombre del usuario sacado de la session
    let firstName = req.session.firstname;
    let fullName = req.session.fullname;
    let username = req.session.username;
    let auth = req.session.auth;
    // Separamos menssaje
    var message = msgToSend.message;
    var context;
    if (msgToSend.context != undefined) context = JSON.parse(msgToSend.context);
    var chatbot = require('./Chatbot/WatsonIntegration');
    // TODO : Sacar el harcodeado
    chatbot.message({ userInput: message, context: context, firstname: firstName, fullname: fullName, username: username, auth: auth }).then((messageFromBot) => {
        res.json(messageFromBot);
    });
})

// Control de rutas para subidas de archivos
app.post('/upload_documents', (req, res) => {
    console.log("La concha de tu madre");
    // Utilizando la libreria Upload, gestionamos la solicitud de subida de archivos
    uploads.upload_multiple_and_return_filenames({ request: req, response: res }).then(
        file_names => {
            res.json({ filenames: file_names, message: "Subida de archivos correcta" });
        }).catch(e => {
            res.status(400).json({ filenames: [], message: e.message });
        })
});
uploads.StartCheckUploadFolder();

// Lanzamos la escucha sobre el puerto indicado
server.listen(PORT_STANDARD);
servers.listen(PORT_SECURE);