var express = require('express');
var app = express();
const HEADERS = { 'Content-Type' : 'application/json' }

const botfunctions = {
    cargartkt: function (datos, retorno) {
        var data = {
          'falla': datos
        }
        console.log(JSON.stringify(data));
    /*    retorno('123456');
    */
        var host = "https://portal.megatech.la:4067";
        var path = "/api/v1/CrearTKTBot" ;
    
        var request = require('request');
        request.post({
            url: host + path,
            headers : HEADERS,
            body: JSON.stringify(data)
        }, function (err, httpResponse, data) {
            if (!err) {
                var body = JSON.parse(data);
                console.log(body);
                retorno(body[0].Ticketid)
            } else {
              retorno(null)
            }             
        })
      }
};

app.get('/', (req, res) => {
    botfunctions.cargartkt("No inicia outlook", function(retorn){
        console.log(retorn);
    })
})

app.listen(8005);