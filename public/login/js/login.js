"use strict";

function limpiar(id) {
    document.getElementById(id).innerHTML = "";
}

function agregar(id, contenido) {
    document.getElementById(id).innerHTML = contenido;
}

if (toShow.browser == "Microsoft Internet Explorer") {
    var str;
    var booleano = true;
    str = "<img class=\"img-fluid\" id=\"logo-mega\" src=\"/login/Logo.png\">";
    str += "<div class=\"row justify-content-center\">";
    str += "    <div class=\"alert alert-danger\" role=\"alert\">";
    str += "        <h4 class=\"alert-heading\">😢<\/h4>";
    str += "        <p>Estas usando un navegador incompatible. El portal funciona con navegadores modernos como Chrome, Firefox y Microsoft Edge<\/p>";
    str += "        <hr>";
    str += "        <p class=\"mb-0\">En caso de no tenerlos, solicitá la instalación mediante canales oficiales.<\/p>";
    str += "    <\/div>";
    str += "<\/div>";
    limpiar("wrapper-container1");
    agregar("wrapper-container1", str);
}

document.addEventListener("keyup", function(event) {
    // Number 13 is the "Enter" key on the keyboard
    if (event.keyCode === 13) {
        // Cancel the default action, if needed
        event.preventDefault(); // Trigger the button element with a click

        document.getElementById("btnSend").click();
    }
}); // Llamado asíncrono a cualquier función requerida

var AjaxCall = function AjaxCall() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        url = _ref.url,
        method = _ref.method,
        callback = _ref.callback,
        data = _ref.data;

    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.addEventListener('load', function() {
        if (xhr.status == 200) {
            if (xhr.response == "true" || xhr.response == true) {
                window.location = '/';
            } else {
                var arrayInputs = document.querySelectorAll('input');

                for (var i = 0; i < arrayInputs.length; i++) {
                    arrayInputs[i].value = "";
                }

                document.querySelector('#error-form').classList.remove('d-none');
                document.querySelector('#error-form').classList.add('d-block');
            }
        }
    });
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(data));
};

var btnSend = document.querySelector('#btnSend');
btnSend.addEventListener('click', function(e) {
    e.preventDefault();
    var iptUsername = document.querySelector('input[name="iptUsername"]');
    var username = iptUsername.value;
    var iptPassword = document.querySelector('input[name="iptPassword"]');
    var password = iptPassword.value;
    var iptStayLogged = document.querySelector('input[name="iptStayLogged"');
    var stayLogged = iptStayLogged.checked;
    var userData = {
        user: username,
        pass: password,
        stay: stayLogged
    };
    AjaxCall({
        url: "/authenticate",
        method: 'post',
        callback: undefined,
        data: userData
    });
});