const express = require('express');
const app = express();
const socketio = require('socket.io');

let namespaces = require('./data/namespaces');

app.use(express.static(__dirname + '/public'));

const expressServer = app.listen(9000);
const io = socketio(expressServer);

io.on('connection', socket => {
    //build an array to send back with the img and endpoint for each NS

    let nsData = namespaces.map(ns => {
        return {
            img: ns.img,
            endpoint: ns.endpoint
        };
    });

    socket.emit('nsList', nsData);
});

//loop through each namespace and listen for a connection
namespaces.forEach(namespace => {
    //   console.log(namespace);
    io.of(namespace.endpoint).on('connection', nsSocket => {
        const username = nsSocket.handshake.query.username;

        // console.log(`${nsSocket.id} has join ${namespace.endpoint}`);
        nsSocket.emit('nsRoomLoad', namespace.rooms);
        nsSocket.on('joinRoom', (roomToJoin, numberOfUsersCallback) => {
            // deal with history ...
            const roomToLeave = Object.keys(nsSocket.rooms)[1];
            nsSocket.leave(roomToLeave);
            updateUsersInRoom(namespace, roomToLeave);

            nsSocket.join(roomToJoin);
            // io.of('/wiki').in(roomToJoin).clients((error, clients) => {
            //     numberOfUsersCallback(clients.length);
            // })
            const nsRoom = namespace.rooms.find(room => {
                return room.roomTitle === roomToJoin;
            })
            nsSocket.emit('historyCatchUp', nsRoom.history);
            updateUsersInRoom(namespace, roomToJoin);
        });
        nsSocket.on('newMessageToServer', (msg) => {
            const fullMsg = {
                text: msg.text,
                time: Date.now(),
                username: username,
                avatar: 'https://via.placeholder.com/30'
            }

            // console.log(fullMsg);
            //send this message to all the socket that are in the room
            // console.log(nsSocket.rooms);
            const roomTitle = Object.keys(nsSocket.rooms)[1];
            const nsRoom = namespace.rooms.find(room => {
                return room.roomTitle === roomTitle;
            })
            nsRoom.addMessage(fullMsg);
            io.of(namespace.endpoint).to(roomTitle).emit('messageToClients', fullMsg);
        })
    });
});

function updateUsersInRoom(namespace, roomToJoin) {
    // send back the number of users in this room to all socket connect
    io.of(namespace.endpoint).in(roomToJoin).clients((error, clients) => {
        io.of(namespace.endpoint).in(roomToJoin).emit('updateMembers', clients.length)
    })
}