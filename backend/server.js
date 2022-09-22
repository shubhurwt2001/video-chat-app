const path = require("path");
const express = require("express");
const http = require("http");
const moment = require("moment");
const axios = require("axios");
const socketio = require("socket.io");
var cors = require("cors");

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = socketio(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

let rooms = {};
let socketroom = {};
let socketname = {};
let socketType = {};
let micSocket = {};
let videoSocket = {};
let online = [];

io.on("connection", (socket) => {
  if (socket.handshake.query["id"]) {
    online.push({ socket: socket.id, id: socket.handshake.query["id"] });
    io.emit("i am online", online);
  }

  socket.on("call", (by, roomid, to) => {
    io.emit("call recieved", by, roomid, to);
  });
  socket.on("accept call", (by, roomid, to) => {
    if (Object.keys(socketType).length > 0) {
      io.to(roomid).emit("call accepted", by, roomid, to);
      socket.join(roomid);
      socketroom[socket.id] = roomid;
      socketname[socket.id] = by.firstName + " " + by.lastName;
      micSocket[socket.id] = "on";
      videoSocket[socket.id] = "on";

      if (rooms[roomid] && rooms[roomid].length > 0) {
        // console.log(1);
        rooms[roomid].push(socket.id);
        io.to(socket.id).emit(
          "join room",
          rooms[roomid].filter((pid) => pid != socket.id),
          socketname,
          micSocket,
          videoSocket
        );
      } else {
        rooms[roomid] = [socket.id];
        io.to(socket.id).emit("join room", null, null, null, null);
        // console.log(2);
      }
    } else {
      io.to(socket.id).emit("no owner");
    }
  });

  socket.on("decline call", (by, roomid, to) => {
    io.to(roomid).emit("call declined", by, roomid, to);
  });

  socket.on("join room", (roomid, username, owner) => {
    socket.join(roomid);
    socketroom[socket.id] = roomid;
    socketname[socket.id] = username;
    socketType[socket.id] = owner;
    micSocket[socket.id] = "on";
    videoSocket[socket.id] = "on";

    if (rooms[roomid] && rooms[roomid].length > 0) {
      // console.log(1);
      rooms[roomid].push(socket.id);
      socket
        .to(roomid)
        .emit(
          "message",
          `${username} joined the room.`,
          "Bot",
          moment().format("h:mm a")
        );
      io.to(socket.id).emit(
        "join room",
        rooms[roomid].filter((pid) => pid != socket.id),
        socketname,
        micSocket,
        videoSocket
      );
    } else {
      rooms[roomid] = [socket.id];
      io.to(socket.id).emit("join room", null, null, null, null);
    }

    io.to(roomid).emit("user count", rooms[roomid].length);
  });

  socket.on("action", (msg) => {
    if (msg == "mute") micSocket[socket.id] = "off";
    else if (msg == "unmute") micSocket[socket.id] = "on";
    else if (msg == "videoon") videoSocket[socket.id] = "on";
    else if (msg == "videooff") videoSocket[socket.id] = "off";

    socket.to(socketroom[socket.id]).emit("action", msg, socket.id);
  });

  socket.on("video-offer", (offer, sid) => {
    socket
      .to(sid)
      .emit(
        "video-offer",
        offer,
        socket.id,
        socketname[socket.id],
        micSocket[socket.id],
        videoSocket[socket.id]
      );
  });

  socket.on("video-answer", (answer, sid) => {
    socket.to(sid).emit("video-answer", answer, socket.id);
  });

  socket.on("new icecandidate", (candidate, sid) => {
    socket.to(sid).emit("new icecandidate", candidate, socket.id);
  });

  socket.on("message", (msg, username, image) => {
    io.to(socketroom[socket.id]).emit(
      "message",
      msg,
      username,
      moment().format("h:mm a"),
      image
    );
  });

  socket.on("disconnect", () => {
    const lives = online.filter((live) => {
      return live.socket != socket.id;
    });

    online = lives;

    io.emit("i am online", online);

    if (!socketroom[socket.id]) return;
    if (!rooms[socketroom[socket.id]]) return;
    if (!socketType[socket.id]) {
      socket
        .to(socketroom[socket.id])
        .emit("remove peer", socket.id, socketname[socket.id]);

      var index = rooms[socketroom[socket.id]].indexOf(socket.id);

      rooms[socketroom[socket.id]].splice(index, 1);

      io.to(socketroom[socket.id]).emit(
        "user count",
        rooms[socketroom[socket.id]].length
      );
      delete socketroom[socket.id];
    } else {
      socket.to(socketroom[socket.id]).emit("remove peer all", socket.id);
      delete rooms[socketroom[socket.id]];
      delete socketroom[socket.id];
      delete socketType[socket.id];
    }

    //toDo: push socket.id out of rooms
  });

  socket.on("base64 file", (file, filename, username, image) => {
    // socket.broadcast.emit('base64 image', //exclude sender
    io.to(socketroom[socket.id]).emit(
      "base64 file", //include sender
      file,
      filename,
      username,
      image,
      moment().format("h:mm a")
    );
  });
});

server.listen(PORT, () =>
  console.log(`Server is up and running on port ${PORT}`)
);
