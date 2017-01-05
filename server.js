const express = require('express');
var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var WebSocketServer = require('websocket').server;

var httpsOptions = {
    key: fs.readFileSync("/Users/yuriy/create-react-app-master/conversations/key.pem"),
    cert: fs.readFileSync("/Users/yuriy/create-react-app-master/conversations/cert.pem")
};

const app = express();
var httpsServer = https.createServer(httpsOptions, app);


httpsServer.listen(6503, function(){
    log("server is listening on port 6503")
});

var connectionArray = [];
var lib_queue = [];
var con_queue = [];

function log(text){
    let time = new Date();
    console.log("[" + time.toLocaleTimeString() + "] " + text);
}

function originIsAllowed(origin){
    return true;
}

function sendToOneUser(target_clientID, msgString){
    let target_conn = getConnectionForID(target_clientID);
    if(target_conn){
        log('sending');
        target_conn.sendUTF(msgString);
    }
}

function getConnectionForID(target_clientID){
    let connect = null;
    let i;

    for(i = 0; i < connectionArray.length; i++){
        console.log("one search");
        if(connectionArray[i].clientID === target_clientID){
            connect = connectionArray[i];
            break;
        }
    }
    return connect;
}

var wsServer = new WebSocketServer({
    httpServer: httpsServer,
    autoAcceptConnections: false
});

wsServer.on('request', function(request){

    let connection = request.accept("json", request.origin);

    connection.on('message', function(message){
        if(message.type === 'utf8'){
            log("Received Message: " + message.utf8Data);

            let msg = JSON.parse(message.utf8Data);
            switch(msg.type){
                    case "invite":

                        connection.clientID = msg.clientID;
                        connectionArray.push(connection);

                        let target_queue = (msg.party === 'liberal') ? con_queue : lib_queue;
                        let outgoing_msg = {};

                        if(target_queue.length < 1){

                            console.log("no queue avail.");

                            let self_queue = (msg.party === 'liberal') ? lib_queue : con_queue;
                            self_queue.push(connection);

                            outgoing_msg = {
                                type: "delay",
                                message: "Please wait while we pair you with someone. This may take a minute."
                            };

                        } else {
                            console.log('about to pair you');
                            let peer = target_queue.shift();

                            outgoing_msg = {
                                type: "peer_info",
                                peer_clientID: peer.clientID
                            };

                        }

                        sendToOneUser(connection.clientID, JSON.stringify(outgoing_msg));
                        break;
                default:
                    console.log("sending message from: ", msg.clientID, " and sending it to: ", msg.target);
                    sendToOneUser(msg.target, JSON.stringify(msg));
            }

        }
    });

    connection.on('close', function(reason, description) {
        // First, remove the connection from the list of connections.
        connectionArray = connectionArray.filter(function(el, idx, ar) {
            return el.connected;
        });

        // Build and output log output for close information.

        var logMessage = "Connection closed: " + connection.remoteAddress + " (" +
            reason;
        if (description !== null && description.length !== 0) {
            logMessage += ": " + description;
        }
        logMessage += ")";
        log(logMessage);
    });

});
