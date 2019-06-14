
// Levantamos la libreria express
var express = require("express");
var watsonIntegration = require("./Chatbot/WatsonIntegration");
// Ejecutamos la libreria
var app = express();
// Definimos el puerto de conexión
const PORT = 8010;

app.use(express.urlencoded({extended:true}));
app.use(express.json());

// Abrimos una ruta pública para acceder al sitiio de testing
app.use('/', express.static("./testing"));

// Acceso principal al sitio
app.post("/send", (req, res) => {
    // Levantamos el objeto json
    var json = req.body;
    // Separamos el mensaje
    var message = json.message;
    var context;
    if(json.context != undefined) context = JSON.parse(json.context);
    // Generamos una llamada a la api de integracion    
    watsonIntegration.message({userInput:message, context: context, username: "mleiva", firstname: "Maximiliano", fullname: "Maximiliano Leiva"}).then((watsonMessage) => {
        res.json(watsonMessage);
    }).catch((err) => {
        res.send("error al procesar mensaje")
    })
});

// Escuchamos sobre el puerto cargado en la constante
app.listen(PORT);
