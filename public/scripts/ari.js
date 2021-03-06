(function() {
    // Constante que almacena el contexto
    const CONTEXT_INPUT_TYPE = "hidden";
    const CONTEXT_INPUT_NAME = "inpContext";
    // Direccion hacia donde se apunta el servicio de bot
    const CHATBOT_URL = '/send';
    const CHATBOT_HTTPMETHOD = 'post';
    const SALUDO = 'Hola Ari!';
    const CONTEXT_DATA = 'input[name="' + CONTEXT_INPUT_NAME + '"]';
    // Constantes relacionados con los intervalos de espera
    const AWAITING_RESPONSE_MESSAGES = ["¿Seguís ahí?", "Te espero "];
    const FINISHING_CHAT_INACTIVITY_MESSAGES = ["Avisame cualquier cosa, yo siempre estoy aqui para cualquier consulta que tengas.", "Cuando tengas tiempo seguimos hablando!"];
    // Constantes relacionadas a la subida de archivos
    const MAXIMUM_NUMBER_OF_FILES = 5;
    const MAXIMUM_SIZE_OF_FILES = 10485760;

    const INTERVAL_AWAIT_RESPONSE = 99999999999;
    const INTERVAL_FINISH_ACTIVITY = 99999999999;
    const INTERVAL_POST_FINISH_DELAY = 99999999999;

    const CONTEXT_BLOCK_VARIANT_FOR_MENU_OPTION = "block_variant";
    const MESSAGE_OTHER_OPTION = { description: "Tengo otra consulta", value: "otherOp" }

    // Variables que se utilizaran como recursos publicos
    var chat_msg_usuario;
    var chat_msg_bot;
    var chat_msg_option;
    var chat_msg_file;

    var await_response_timeout_id, finish_message_timeout_id, reset_chatlog_timeout_id;
    var pending_delivering_messages = [];
    var indice = 0;

    var is_conversation_starting = false;

    // Guardamos las URL de los recursos publicos del chat
    var HTMLAri = "/ari/index.html";
    var CSSAri = "/ari/css/styles.css";

    startingStyle = document.createElement("style");

    // Funcion encargada de disparar los eventos principales del chat
    var events = function() {
        // Desabilitamos el click derecho
        document.oncontextmenu = function() { return false; }
            // Iniciar conversacion
        startConversation();
        // Enviar mensaje
        $("#chat-submit").click(click_submit);
    }

    // Generamos el chat
    var generate_chat = function(responseHTML) {

        var div_chat_ari = document.createElement("div");
        div_chat_ari.innerHTML = responseHTML;
        var chat_body = div_chat_ari.querySelector(".chat-ari");
        var input = div_chat_ari.querySelector("#formInput");

        chat_msg_usuario = div_chat_ari.querySelector(".chat-msg.usuario");
        chat_msg_bot = div_chat_ari.querySelector(".chat-msg.bot");
        chat_msg_option = div_chat_ari.querySelector(".chat-msg.option");
        chat_msg_file = div_chat_ari.querySelector(".chat-msg.file");

        // Validamos el input prohibiendo pegar y los caracteres (<->)
        input.addEventListener('keydown', (event) => {
            var keyName = event.key;
            input.onpaste = function(event) {
                event.preventDefault();
            }

            if (keyName == "<" || keyName == ">") {
                event.preventDefault();
                return false;
            }
            return true;
        });

        document.body.appendChild(chat_body);

        // Ejecutamos eventos
        events();
    }

    // Llamado asíncrono a cualquier función requerida

    var AjaxCall = function({
        url,
        method,
        callback,
        data,
        json,
        uploadCallback,
        errorCallback
    } = {}) {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.addEventListener('load', () => {
            if (xhr.status == 200) {
                callback(xhr.response);
            } else if (xhr.status == 400) {
                errorCallback(xhr.response);
            }
        });
        if (uploadCallback) {
            xhr.upload.addEventListener("progress", uploadCallback);
        }
        // Si la petición llega por medio de JSON, se hace string
        if (json == true) {
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(data));
        } else {
            // Enviamos la información
            xhr.send(data);
        }
    }

    // Pedimos de manera asincrona los estilos
    var saveFirstStyle = function(respuesta) {
        startingStyle.innerHTML = respuesta;
        document.body.appendChild(startingStyle);
    }

    AjaxCall({
        url: CSSAri,
        method: "GET",
        callback: saveFirstStyle
    });

    // LLamado asincrono a la funcion generate_chat
    AjaxCall({
        url: HTMLAri,
        method: "GET",
        callback: generate_chat
    });

    var send_stacked_messages = function(resetChat) {
        if (pending_delivering_messages.length > 0) {
            var length_message = pending_delivering_messages[0].text.length;
            var await_time_ms = 900;

            if (length_message > 100) {
                await_time_ms = 500;
            }

            if (indice == 0) {
                await_time_ms = 0;
            }
            // Obtenemos el primer mensaje en la cola de mensajes
            var message = pending_delivering_messages[0];
            // Removemos el elemento del arreglo
            pending_delivering_messages.shift();
            // De momento, dejamos asi, PERO no deberia estar asi jeje
            setTimeout(function() {
                if (message.text == "taca taca") {
                    message.type = "file";
                }
                // definimos el tipo de mensaje a ejecutar
                switch (message.type) {
                    case "text":
                        generate_message(message.text, "bot");
                        break;
                    case "option":
                        generate_message(message, "option");
                        break;
                    case "file":
                        generate_message(message.text, "file");
                        break;
                };
                if (resetChat == true) {
                    setTimeout(function() {
                        reseting_chat_after_inactivity();
                    }, 3000);
                }
            }, await_time_ms);
        }
    }

    // Versión modificada con agregados de Mauro Barroso
    var RenderResponseMessage = function(responseFromServer) {
        // Obtenemos el objeto JSON CSSSecond lo parseamos
        var plane = document.querySelector("#plane");
        var JsonResp = JSON.parse(responseFromServer);
        var isResetingChat = false;
        // Renderizamos la respuesta del bot
        // Iteramos sobre todos los mensajes recibidos
        JsonResp.messages.forEach(message => {
            pending_delivering_messages.push(message);
        });

        // Guardamos el contexto en el documento
        var inpContext = document.querySelector(CONTEXT_DATA);
        // Si no existe el hidden de la etiqueta se genera
        if (JsonResp.context != undefined) {
            // Validamos si el contexto existe
            // Luego del primer mensaje, dejamos el if habilitado para corroborar la existencia de finish_chat
            if (JsonResp.context.finish_chat) {
                if (inpContext != undefined) {
                    document.body.removeChild(inpContext);
                }
                isResetingChat = true;
                stop_inactivity_check();
            };

            if (JsonResp.context.clean_temporary_files) {
                var chatLogs = document.querySelectorAll(".chat-msg");                
                // Ultimo
                lastMessage = chatLogs[chatLogs.length - 1];
                // Anteultimo
                antenmousMessage = chatLogs[chatLogs.length - 2];
                // Penultimo
                penultimateMessage = chatLogs[chatLogs.length - 3];

                lastMessage.parentNode.removeChild(lastMessage);
                antenmousMessage.parentNode.removeChild(antenmousMessage);
                delete JsonResp.context.clean_temporary_files;
                document.querySelector("#upload").value = null;
                penultimateMessage.defaultStyle();

            }
        }
        // Iniciamos la distribución de mensajes acumulados
        send_stacked_messages(isResetingChat);

        if (inpContext == undefined && JsonResp.context != undefined) {
            // Generamos un elemento
            inpContext = document.createElement('input')
                // Definimos los parametros del elemento
            inpContext.type = CONTEXT_INPUT_TYPE;
            inpContext.name = CONTEXT_INPUT_NAME;
            // Anexamos el elemento al body
            document.body.appendChild(inpContext);
        }

        if (inpContext != undefined) {
            if (JsonResp.context != undefined) {
                inpContext.value = JSON.stringify(JsonResp.context);
            }
        }

        // Si no es el inicio de la conversación,
        if (is_conversation_starting == false) {
            start_inactivity_check();
            loader.setAttribute("style", "display:none");
            plane.style.display = "block";
        }

    }

    var startConversation = function() {
        is_conversation_starting = false;
        AjaxCall({
            url: CHATBOT_URL,
            method: CHATBOT_HTTPMETHOD,
            callback: RenderResponseMessage,
            data: {
                msg: ""
            },
            json: true
        });
    }

    var click_submit = function(e) {
        e.preventDefault();
        send_message_api();
    }

    var send_message_api = function(option_display, option_value) {
        var plane = document.querySelector("#plane")
        let _msg_value;
        let _msg_display;
        if (option_display == undefined) {
            // En el caso de ser mensaje standard, el valor y el mostrado son lo mismo
            _msg_display = $("#chat-input").val();
            _msg_value = _msg_display;
            if (_msg_display.trim() == '') {
                return false;
            }
        } else {
            // En el caso de los mensajes tipo opción el valor y el mostrado viajan por caminos difernetes
            _msg_value = option_value;
            _msg_display = option_display;
        }
        if (option_value == "otherOp") {
            var input = document.querySelector("#chat-input");
            input.style.cursor = "default";
            return generate_message("Indicame que otra consulta tenes", "bot");
        }

        // Validamos si existe el contexto
        let inpContext = document.querySelector(CONTEXT_DATA);
        // Disponemos una variable temporal para almacenar el contenido del valor
        let contextValue;
        // Validamos si la etiqueta existe
        if (inpContext != undefined) {
            contextValue = inpContext.value;
            // Parseamos el contexto
            JSONcontext = JSON.parse(contextValue);
            // Validamos si en el contexto viaja la solicitud de requerimiento de PC
            if (JSONcontext.require_workstation) {
                // Eliminamos la propiedad
                delete JSONcontext.require_workstation;
                // Para que en la carga sobre GLPI haya un ID vinculado a la terminal, se carga en el contexto
                JSONcontext.terminal_id = _msg_value;
                JSONcontext.Nombre_de_equipo = _msg_display;
                // Para que Watson reciba el nombre de máquina literal y no muestre un número, el display en este caso unico es lo mismo que el value
                if (_msg_value != "OTHER_WS") {
                    _msg_value = _msg_display;
                }
            }
            if (JSONcontext.require_address) {
                // Configuramos la propiedad de envio de dirección
                JSONcontext.sending_address = "true";

            }
            // Convertimos el contexto modificado a String
            contextValue = JSON.stringify(JSONcontext);
        }
        // Preparamos los datos para enviar
        var info = {
                message: _msg_value,
                context: contextValue
            }
            // Preparamos la solicitud ajax para hacer el envío de información        
        AjaxCall({
            url: CHATBOT_URL,
            method: CHATBOT_HTTPMETHOD,
            callback: RenderResponseMessage,
            data: info,
            json: true
        });
        // Generamos mensaje del usuario
        generate_message(_msg_display, 'usuario');
        loader.setAttribute("style", "display:block");
        plane.style.display = "none";
    }

    var reseting_chat_after_inactivity = function() {
        var loader = document.querySelector("#loader");
        // Vaciamos el contenido del chatlog
        var chatlog = document.querySelector(".chat-logs");
        chatlog.innerHTML = "";
        // Eliminamos el contexto
        var inpContext = document.querySelector(CONTEXT_DATA);
        if (inpContext != null) {
            document.body.removeChild(inpContext);
        }
        // Minimizamos el chat
        close_chatbox();
        // Reseteamos el contador de mensajes
        contadorN = 0;
        // Disponemos al chatbot para que vuelva a iniciar de conversación
        startConversation();
        // Desactivamos el loader
        loader.setAttribute("style", "display:block");
        plane.style.display = "block";
    };

    var finishing_chat_without_response = function() {
        // Obtenemos el mensaje del listado de mensaje de finalización
        let finish_message = FINISHING_CHAT_INACTIVITY_MESSAGES[Math.floor(Math.random() * FINISHING_CHAT_INACTIVITY_MESSAGES.length)];
        // Generamos un mensaje de tipo bot informando que se finaliza la conversación
        generate_message(finish_message, "bot");
        // Iniciamos el timeout para hacer el reseteo del chat
        reset_chatlog_timeout_id = setTimeout(reseting_chat_after_inactivity, INTERVAL_POST_FINISH_DELAY);
    };
    // Bloque de codigo dispuesto para manejar los timeouts
    var awaiting_response_timeout = function() {
        // Obtenemos alguno de los mensajes de
        let awaiting_message = AWAITING_RESPONSE_MESSAGES[Math.floor(Math.random() * AWAITING_RESPONSE_MESSAGES.length)];
        // Generamos el mensaje del lado del bot
        generate_message(awaiting_message, "bot");
        // iniciamos timeout para definir la finalización del chat
        finish_message_timeout_id = setTimeout(finishing_chat_without_response, INTERVAL_FINISH_ACTIVITY);
    };

    // Funcion que comprueba la inactividad del usuario
    var start_inactivity_check = function() {
        // Activamos el control de inactividad
        await_response_timeout_id = setTimeout(awaiting_response_timeout, INTERVAL_AWAIT_RESPONSE);
    };
    var stop_inactivity_check = function() {
        // Limpiamos todos los timeout activos
        clearTimeout(await_response_timeout_id);
        clearTimeout(finish_message_timeout_id);
        clearTimeout(reset_chatlog_timeout_id);
    };

    // Desactivamos las opciones luego de hacer click en ellas
    var disable_options = function(ul) {
        var li_options = ul.querySelectorAll("li");
        li_options.forEach(li => {
            li.addEventListener("click", function(e) {
                li_options.forEach(li_brothers => {
                        li_brothers.removeEventListener("click", click_option);
                        li_brothers.style.color = "lightgrey";
                        li_brothers.style.cursor = "no-drop";
                    })
                    // Coloreamos la opcion elegida
                li.style.color = "#00b4c5";
            })
        });
    }

    var disable_optionsInput = function(ul) {
        var li_options = ul.querySelectorAll("li");
        var submitButton = document.querySelector("#chat-submit");

        function disableLi(e) {
            li_options.forEach(li_brothers => {
                li_brothers.removeEventListener("click", click_option);
                li_brothers.style.color = "lightgrey";
                li_brothers.style.cursor = "no-drop";

            })
            e.target.removeEventListener("click", disableLi);
        }
        submitButton.addEventListener("click", disableLi);
    }

    var click_option = function(e) {
        if (e.target.valueText == "otherOp") {
            var contexto = document.querySelector(CONTEXT_DATA);
            document.body.removeChild(contexto);
        }
        send_message_api(e.target.displayText, e.target.valueText);
    }

    var generate_message = function(msg, type) {
        var conversation_starting = indice > 1;
        var plane = document.querySelector("#plane");
        if (type == "bot") {
            $("#chat-submit").prop('disabled', false);
            $("#chat-input").prop('disabled', false);
            loader.setAttribute("style", "display:none");
            plane.style.display = "block";
            $("#chat-submit").prop('disabled', false);
            generate_message_bot(msg);
        }

        if (type == "usuario") {
            generate_message_usuario(msg);
            // Limpiamos el input
            $("#chat-input").val('');            
            if (is_conversation_starting == false) {
                // Deshabilitamos el envio de mensaje hasta que se reciba respuesta del bot
                $("#chat-submit").prop('disabled', true);
                // Detenemos el chequeo inactividad hasta que ari responda
                stop_inactivity_check();
            } else {
                $("#chat-submit").prop('disabled', false);
            }
            if (conversation_starting) {
                loader.setAttribute("style", "display:block");
                // Si el loader se muestra se oculta el avion
                plane.style.display = "none";
            }
        }

        if (type == "option") {
            // Si el mensaje es de tipo opcion, sacamos el foco del input
            $("#chat-input").blur();
            $("#chat-submit").prop('disabled', true);
            $("#chat-input").prop('disabled', true);
            generate_message_option(msg);
            loader.setAttribute("style", "display:none");
            plane.style.display = "block";
        }

        if (type == "file") {
            // Si el mensaje es de tipo opcion, sacamos el foco del input
            $("#chat-input").blur();
            generate_message_file(msg);
            loader.setAttribute("style", "display:none");
            plane.style.display = "block";
        }

        // Siempre hacemos focus sobre el input al recibir un mensaje
        $("#chat-input").focus();

        $(".chat-logs").stop().animate({
            scrollTop: $(".chat-logs")[0].scrollHeight
        }, 1000);

        if (type == 'bot' || type == 'option' || type == 'file') {
            send_stacked_messages();
        }

        indice++;
    }

    var linkDetect = function(message) {
        var newMessage;
        const originalString = message;
        const splitString = originalString.split(" ");
        for (var i = 0; i < splitString.length; i++) {
            if (splitString[i].includes("http")) {
                splitString[i] = '<a href="' + splitString[i] + '" target="_blank">Click aquí</a>';
            }
        }
        newMessage = splitString.join(" ");
        return newMessage;
    }

    var generate_message_bot = function(message) {
        var currentMessage = chat_msg_bot.cloneNode(true);
        var chat_logs = document.querySelector(".chat-logs");
        var text = currentMessage.querySelector(".cm-msg-text");
        var messageLink = linkDetect(message);
        var input = document.querySelector("#chat-input");
        var submit = document.querySelector("#chat-submit");

        input.style.cursor = "text";
        submit.style.color = "#6c757d";
        input.classList.remove('disabled-input');

        currentMessage.id = "cm-msg-" + indice;
        text.innerHTML = messageLink;
        chat_logs.appendChild(currentMessage);
    }


    var generate_message_usuario = function(message) {
        var currentMessage = chat_msg_usuario.cloneNode(true);
        var chat_logs = document.querySelector(".chat-logs");
        var text = currentMessage.querySelector(".cm-msg-text");
        var input = document.querySelector("#chat-input");

        input.style.cursor = "text";
        currentMessage.id = "cm-msg-" + indice;
        text.innerHTML = message;
        chat_logs.appendChild(currentMessage);
    }

    // Corroboramos si el contexto comunicado tiene la variable para bloquear variantes
    let check_variant_blocked_and_delete_property = function() {        
        // Recolectamos el contexto
        let context_input = document.querySelector(CONTEXT_DATA);
        // Validamos si existe el contexto
        if(context_input != undefined) {                
            // Separamos el valor y lo parseamos
            let context_value = JSON.parse(context_input.value);
            let variant_blocked =  context_value.hasOwnProperty(CONTEXT_BLOCK_VARIANT_FOR_MENU_OPTION);
            // Validamos si existe la propiedad
            if(variant_blocked) {
                // Una vez validado eliminamos la variable del contexto
                delete context_value[CONTEXT_BLOCK_VARIANT_FOR_MENU_OPTION];
                context_input.value = JSON.stringify(context_value);
                return true;
            }
        }
        return false;
    }

    // Inserta un nodo despues de otro
    function insertAfter(e, i) {
        if (e.nextSibling) {
            e.parentNode.insertBefore(i, e.nextSibling);
        } else {
            e.parentNode.appendChild(i);
        }
    }

    var generate_message_option = function(message) {
        var chat_logs = document.querySelector(".chat-logs");
        var currentMessage = chat_msg_option.cloneNode(true);
        var question = currentMessage.querySelector("#question");
        var description = currentMessage.querySelector("#description");
        var options = currentMessage.querySelector("#ulTag");
        var input = document.querySelector("#chat-input");
        var submit = document.querySelector("#chat-submit");

        // Cambiamos el estilo del text box cuando ingresa un mensaje de tipo opcion
        input.style.cursor = "no-drop";
        input.classList.add('disabled-input');
        submit.style.color = "lightgrey";
        
        // Validamos si este mensaje debe impedir variantes
        if(check_variant_blocked_and_delete_property() == false){
            // Agregamos la posiblidad de salir de las opciones elegidas
            message.options.push(MESSAGE_OTHER_OPTION);
        } 

        // Si el mensaje es de tipo opcion, sacamos foco del input
        question.innerHTML = message.text;
        description.innerHTML = message.description;
        if (message.description == undefined) {
            description.innerHTML = "<br>";
        }
        message.options.forEach(option => {
            var msg_li = document.createElement('li');
            msg_li.id = "opcion";
            msg_li.innerHTML = option.description;
            msg_li.displayText = option.description;
            msg_li.valueText = option.value;
            msg_li.style.cursor = "pointer";
            msg_li.style.textDecoration = "underline";
            msg_li.addEventListener("click", click_option);
            options.appendChild(msg_li);
        });

        disable_options(options);
        disable_optionsInput(options);
        currentMessage.id = "cm-msg-" + indice;
        chat_logs.appendChild(currentMessage);
    }

    var generate_message_file = function(message) {
        var chat_logs = document.querySelector(".chat-logs");
        var currentMessage = chat_msg_file.cloneNode(true);
        var response = currentMessage.querySelector("#response");
        var description = currentMessage.querySelector("#description");
        var inputButton = currentMessage.querySelector("#upload");
        var submit = document.querySelector("#chat-submit");
        // Capturamos la barra de progreso
        let progressBar = currentMessage.querySelector("#progressBar");
        // Capturamos elementos que reportaran si se sube el archivo o no
        var alertFail = currentMessage.querySelector("#alertFail");
        var alertSuccess = currentMessage.querySelector("#alertSuccess");
        var alertInfo = currentMessage.querySelector("#alertInfo")
        var upload = currentMessage.querySelector("#upload");
        // Capturamos el boton de reintentar
        var retry = currentMessage.querySelector("#retry");


        currentMessage.uploadCallback = function(event) {
            // A todo el valor lo redondeamos para tener un numero entero
            let porcentaje = Math.round((event.loaded / event.total) * 100);
            progressBar.style.width = porcentaje + "%";
        }


        currentMessage.defaultStyle = function() {
            // Colocamos la barra de progreso en su estado original
            progressBar.style.width = 0 + "%";
            progressBar.classList.remove("bg-danger");
            progressBar.classList.add("bg-info");
            // Ocultamos el boton
            retry.classList.remove("d-block");
            retry.classList.add("d-none");
            // Activamos el input nuevamente
            $(upload).prop('disabled', false);
            // Ocultamos el alert de error
            alertFail.classList.remove("d-block");
            alertFail.classList.add("d-none");
            // Mostramos el alert comun
            alertInfo.classList.remove("d-none");
            alertInfo.classList.add("d-block");
            // Ocultamos el alert succes
            alertSuccess.classList.remove("d-block");
            alertSuccess.classList.add("d-none");
        }


        currentMessage.alertStyle = function() {
            // Preparamos estilos para indicarle al usuario que los archivos no se pudieron subir
            setTimeout(function() {
                // Removemos progress comun
                progressBar.classList.remove("bg-info");
                // Agregamos el progress de error
                progressBar.classList.add("bg-danger");
                // Ocultamos el alerta comun
                alertInfo.classList.add("d-none");
                alertInfo.classList.remove("d-block")
                    // Mostramos el alerta de error
                alertFail.classList.remove("d-none");
                alertFail.classList.add("d-block");
                // Mostramos el boton de error
                retry.classList.remove("d-none");
                retry.classList.add("d-block");
            }, 500);
        }

        currentMessage.successStyle = function() {
            // Aplicamos timeout de 1 seg para que el cambio de color sea visible al usuario
            setTimeout(function() {
                // Cambiamos el color de la barra de progreso a verde
                progressBar.classList.remove("bg-info");
                progressBar.classList.add("bg-success");
                // Ocultamos el alerta comun
                alertInfo.classList.add("d-none");
                alertInfo.classList.remove("d-block");
                // Mostramos el alert que indica la subida de archivos con exito
                alertSuccess.classList.remove("d-none");
                alertSuccess.classList.add("d-block");


            }, 1000);
        }

        currentMessage.successCallback = function(response) {
            // Parseamos a JSON la respuesta por parte del servidor
            JSONResponse = JSON.parse(response);
            currentMessage.successStyle();
            // Almacenamos el valor del contexto
            let context = document.querySelector(CONTEXT_DATA);
            let contextValue;

            $(upload).prop('disabled', true);

            currentMessage.files = undefined;

            if (response != undefined && context != undefined) {
                // Guardamos el valor del contexto una vez comprobado que es distinto de undefined
                contextValue = context.value;
                JSONContext = JSON.parse(contextValue);
                // Añadimos el array a una propiedad
                JSONContext.file_names = JSONResponse.filenames;
                // Parseamos a string y cambiamos el valor del contexto
                contextValue = JSON.stringify(JSONContext);
                // Preparamos los datos a enviar
                var obj = {
                        message: "ok",
                        context: contextValue
                    }
                    // Enviamos la solicitud al servidor   
                AjaxCall({
                    url: CHATBOT_URL,
                    method: CHATBOT_HTTPMETHOD,
                    callback: RenderResponseMessage,
                    data: obj,
                    json: true
                });
            }
        }

        $(submit).prop('disabled', false);

        // Verificamos si algo cambia en el input
        inputButton.addEventListener('change', e => {
            let files = e.target.files;
            // Creamos el formdata para hacer envios
            let data = new FormData();
            // Reinicializamos totalsize
            let totalSize = 0;
            // Acumulamos de manera recursiva los archivos
            for (let i = 0; i < files.length; i++) {
                totalSize += files[i].size;
                data.append("upload_file[]", files[i]);
            }
                      
            if (files.length > MAXIMUM_NUMBER_OF_FILES || totalSize > MAXIMUM_SIZE_OF_FILES) {
                progressBar.style.width = 50 + "%";

                currentMessage.alertStyle();
                // Vaciamos el array de files
                upload.value = "";
                // Eliminamos la posibilidad de volver a subir
                $(upload).prop('disabled', true);
                

                retry.addEventListener("click", () => {
                    currentMessage.defaultStyle();
                });

                return;
            }
            AjaxCall({
                url: "/upload_documents",
                method: "post",
                callback: currentMessage.successCallback,
                data: data,
                uploadCallback: currentMessage.uploadCallback
            })
        });

        response.innerHTML = "Por favor, adjuntá tus archivos"
        description.innerHTML = "Click en examinar para adjuntarlos:"

        currentMessage.id = "cm-msg-" + indice;
        chat_logs.appendChild(currentMessage);
    }

}());