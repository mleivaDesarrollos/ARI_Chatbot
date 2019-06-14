// Modulo que maneja la generación de tickets en sistema
/*
    El modulo debe estar ubicado por fuera de la interaccion del bot, por que a nivel estructural no tiene relación directa con el funcionamiento del bot. El bot puede cambiar pero la interacción con el sistema de ticketera elegida permanece. Lo mismo sucedería si se cambia el sistema de la ticketera, si el bot se mantiene igual el modulo no debería afectarse por el cambio de ticketera. Por motivos de arquitectura de software es necesario mantener separado el sistema de ticketera del bot
    -Toma de decisiones en base a lo analizado
    -Generar una carpeta que se llame "Ticketera"
    -Almacenar las interacciones con la ticketera y disponer de un metodo que devuelva un número de ticket
    -Este número de ticket debe comunicarse a la interfaz del chatbot
*/

// Levantamos la librería que realiza la request
const request = require('request');
// Disponemos los parametros estáticos del módulo de tickets
const HEADERS = { "Content-Type" : "application/json"}
const URI = "https://portal.megatech.la:4067/api/v1/CrearTKTBot";
const METHOD = "POST";

// Disponemos del método de obtención de tickets
var get = function({message_details} = {}) {
    // Validamos el parametro de entrada
    if(message_details == undefined) throw "TicketError: Está faltando enviar los detalles que deben ser cargados en el ticket";
    // Preparamos el objeto body
    var body = { falla: message_details };    
    // Preparamos la promesa a devolver
    var promise = new Promise((resolve, reject) => {
        // Preparamos la petición por JSON a enviar
        request({
            headers: HEADERS,
            uri: URI,
            method: METHOD,
            body: JSON.stringify(body)
        }, function(err, response, ticketId) {
            // Validamos si existen errores en la validacion
            if(err){
                // Logueamos si hay error
                return reject("TicketError: " + err);
            }
            try{
                // Intentamos parsear el ticket
                var ticket_no = JSON.parse(ticketId)[0].Ticketid;
                // Devolvemos el ticket procesado
                resolve(ticket_no);
            } catch (e) {
                reject(console.error("MSC Interaction Error: parseando el número recibido"));
            }
        });      
    });
    // Devolvemos la promesa procesada
    return promise;
}

module.exports = {
    Get : get
}