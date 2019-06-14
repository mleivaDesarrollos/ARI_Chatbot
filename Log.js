/*
    Modulo de proceso de logs
    *************************
    Modulo que procesa y registra los logs que se produzcan en cualquier modulo que se requira

    Autor: Maximiliano Leiva
    Fecha: 08/05/2019
*/
// Variable que controla si los logs serán registrados en un archivo
const LOG_IN_FILE = true;
const LOG_CONSOLE = true;

const LOG_FILENAME = "Server.log";

function get_log_time(){
    // Obtenemos la fecha actual
    let current_date = new Date();
    // Separamos en componentes
    let day = String(current_date.getDate()).padStart(2,'0');
    let month = String(current_date.getMonth() +1).padStart(2,'0');
    let year = current_date.getFullYear();

    let hour = String(current_date.getHours()).padStart(2, '0');
    let minute = String(current_date.getMinutes()).padStart(2, '0');
    let seconds = String(current_date.getSeconds()).padStart(2, '0');
    // Devolvemos el valor procesado
    return day + "-"  + month + "-" + year + " " + hour + ":" + minute + ":" + seconds;
}

var fs = require('fs');;

if(LOG_IN_FILE){
    // Cargamos la librería de proceso de archivos
    fs = require('fs');
}

module.exports = {
    // Metodo que procesa y registra los logs
    Register:  function(content){
        if(LOG_CONSOLE == false && LOG_IN_FILE == false) return;
        // Preparamos el mensaje a enviar
        let message = String(get_log_time()).padEnd(25, " ") + content;
        // Validamos si el logueo de consola está activo
        if(LOG_CONSOLE) {
            // Mostramos en pantalla
            console.log(message);
        }
        // Si hay que registrar en archivo, se registra los logs
        if(LOG_IN_FILE) {
            // Modificamos el archivo para que maneje retorno de carro
            let file_message = message + "\n";
            // Ejecutamos el registro de archivos
            fs.appendFile(LOG_FILENAME, file_message, function(err) {
                // Si existe error
                if(err) {
                    // Logueamos en pantalla
                    console.log("Error intentando registrar el log en el sistema de archivos: " + err);
                }                                
            });
        }
    }
}