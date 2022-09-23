import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.scss";
import Users from "./Components/Users";
import socketIOClient from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import Swal from "sweetalert2/dist/sweetalert2.js";
import "sweetalert2/src/sweetalert2.scss";
import { initializeApp } from "firebase/app";
import {
  get,
  getDatabase,
  onValue,
  push,
  ref,
  set,
  update,
} from "firebase/database";
import moment from "moment";
import ScrollToBottom from "react-scroll-to-bottom";
import {
  getDownloadURL,
  getStorage,
  ref as sRef,
  uploadBytes,
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA_vQFCOWKQX7JduZfcrobFg-3gJZnSyt8",
  authDomain: "jobportal-65f4d.firebaseapp.com",
  databaseURL: "https://jobportal-65f4d-default-rtdb.firebaseio.com",
  projectId: "jobportal-65f4d",
  storageBucket: "jobportal-65f4d.appspot.com",
  messagingSenderId: "152436235104",
  appId: "1:152436235104:web:91969bf3c55d6e32c09c05",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

const ENDPOINT = "http://127.0.0.1:3000";

let socket;

let micInfo = {};
let videoInfo = {};

const configuration = { iceServers: [{ urls: "stun:stun.stunprotocol.org" }] };

let connections = {};
let cName = {};
let audioTrackSent = {};
let videoTrackSent = {};

let mediaConstraints = { video: true, audio: true };

function App() {
  const [me, setMe] = useState(null);

  const [message, setMessage] = useState("");

  const [videoAllowed, setVideoAllowed] = useState(true);
  const [audioAllowed, setAudioAllowed] = useState(true);

  const [localStream, setLocalStream] = useState(null);

  const [room, setRoom] = useState(null);

  const [users, setUsers] = useState([]);

  const [selected, setSelected] = useState(null);

  const [modal, setModal] = useState(false);

  const [invite, setInvite] = useState(false);

  const [chat, setChat] = useState(false);

  const [messages, setMessages] = useState([]);

  const [fireMessages, setFireMessages] = useState([]);
  const fireMessage = useRef(null);

  const myVideo = useRef(null);

  const selectedRef = useRef(null);

  const selectUser = (id) => {
    const user = users.filter((user) => {
      return user.id == id;
    });
    user.length > 0 && setSelected(user[0]);
  };

  useEffect(() => {
    axios.get("https://dummyjson.com/users").then((data) => {
      let myID = window.prompt("Enter Your id");
      if (myID) {
        const user = data.data.users.filter((user) => {
          return user.id == myID;
        });
        if (user.length > 0) {
          setMe(user[0]);
          setUsers(data.data.users);
        } else {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    });
  }, []);

  useEffect(() => {
    if (me) {
      socket = socketIOClient(ENDPOINT, { query: "id=" + me.id });

      socket.on("i am online", (live) => {
        const onlines = users;
        onlines.map((online) => {
          if (live.some((e) => e.id == online.id)) {
            online.online = true;
          } else {
            online.online = false;
          }
        });
        setUsers([...onlines]);
      });

      socket.on("call recieved", (by, roomid, to) => {
        if (to.id == me.id) {
          Swal.fire({
            title: "Answer Call?",
            text: `Incoming call from ${by.firstName} ${by.lastName}`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, answer it!",
            allowOutsideClick: false,
          }).then((result) => {
            if (result.isConfirmed) {
              socket.emit("accept call", me, roomid, by);
            } else {
              socket.emit("decline call", me, roomid, by);
            }
          });
        }
      });

      socket.on("call accepted", (by, roomid, to) => {
        Swal.fire({
          position: "center",
          icon: "success",
          title: by.firstName + " " + by.lastName + " joined the call",
          showConfirmButton: false,
          timer: 3000,
        });
      });

      socket.on("call declined", (by, roomid, to) => {
        Swal.fire({
          position: "center",
          icon: "error",
          title: by.firstName + " " + by.lastName + " declined the call",
          showConfirmButton: false,
          timer: 3000,
        });
      });

      socket.on("no owner", () => {
        Swal.fire({
          position: "center",
          icon: "error",
          title: "Call ended",
          showConfirmButton: false,
          timer: 3000,
        });
      });

      socket.on("join room", async (conc, cnames, micinfo, videoinfo) => {
        setModal(true);
        if (cnames) cName = cnames;

        if (micinfo) micInfo = micinfo;

        if (videoinfo) videoInfo = videoinfo;

        if (conc) {
          await conc.forEach((sid) => {
            connections[sid] = new RTCPeerConnection(configuration);

            connections[sid].onicecandidate = function (event) {
              if (event.candidate) {
                // console.log("icecandidate fired");
                socket.emit("new icecandidate", event.candidate, sid);
              }
            };

            connections[sid].ontrack = function (event) {
              if (!document.getElementById(sid)) {
                // console.log("track event fired");
                let vidCont = document.createElement("div");
                let newvideo = document.createElement("video");
                let name = document.createElement("div");
                let muteIcon = document.createElement("div");
                let videoOff = document.createElement("div");
                videoOff.classList.add("video-off");
                muteIcon.classList.add("mute-icon");
                name.classList.add("nametag");
                name.innerHTML = `${cName[sid]}`;
                vidCont.id = sid;
                muteIcon.id = `mute${sid}`;
                videoOff.id = `vidoff${sid}`;
                muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
                videoOff.innerHTML = "Video Off";
                vidCont.classList.add("videos");
                newvideo.classList.add("video");
                newvideo.autoplay = true;
                newvideo.playsinline = true;
                newvideo.id = `video${sid}`;
                newvideo.srcObject = event.streams[0];

                if (micInfo[sid] == "on") muteIcon.style.visibility = "hidden";
                else muteIcon.style.visibility = "visible";

                if (videoInfo[sid] == "on")
                  videoOff.style.visibility = "hidden";
                else videoOff.style.visibility = "visible";

                vidCont.appendChild(newvideo);
                vidCont.appendChild(name);
                vidCont.appendChild(muteIcon);
                vidCont.appendChild(videoOff);

                document
                  .getElementsByClassName("videoContainer")[0]
                  .appendChild(vidCont);
              }
            };

            // connections[sid].onremovetrack = function (event) {
            //   if (document.getElementById(sid)) {
            //     document.getElementById(sid).remove();
            //   }
            // };

            connections[sid].onnegotiationneeded = function () {
              connections[sid]
                .createOffer()
                .then(function (offer) {
                  return connections[sid].setLocalDescription(offer);
                })
                .then(function () {
                  socket.emit(
                    "video-offer",
                    connections[sid].localDescription,
                    sid
                  );
                })
                .catch(reportError);
            };
          });

          // console.log("added all sockets to connections");
          startCall();
        } else {
          // console.log("waiting for someone to join");
          navigator.mediaDevices
            .getUserMedia(mediaConstraints)
            .then((localStream) => {
              setModal(true);
              myVideo.current.srcObject = localStream;
              myVideo.current = true;
              setLocalStream(localStream);
            })
            .catch(handleGetUserMediaError);
        }
      });

      socket.on("video-offer", handleVideoOffer);

      socket.on("new icecandidate", handleNewIceCandidate);

      socket.on("video-answer", handleVideoAnswer);

      socket.on("remove peer", (sid, name) => {
        // console.log(sid);
        if (document.getElementById(sid)) {
          document.getElementById(sid).remove();
        }
        delete connections[sid];
        Swal.fire({
          position: "center",
          icon: "error",
          title: name + " left the call",
          showConfirmButton: false,
          timer: 3000,
        });
      });

      socket.on("remove peer all", (sid) => {
        // console.log(sid);
        Swal.fire({
          title: "Call ended",
          text: "You will be returned to main menu.",
          icon: "success",
          showCancelButton: false,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Okay!",
        }).then((result) => {
          window.location.reload();
        });
      });

      socket.on("action", (msg, sid) => {
        if (msg == "mute") {
          document.querySelector(`#mute${sid}`).style.visibility = "visible";
          micInfo[sid] = "off";
        } else if (msg == "unmute") {
          document.querySelector(`#mute${sid}`).style.visibility = "hidden";
          micInfo[sid] = "on";
        } else if (msg == "videooff") {
          document.querySelector(`#vidoff${sid}`).style.visibility = "visible";
          videoInfo[sid] = "off";
        } else if (msg == "videoon") {
          document.querySelector(`#vidoff${sid}`).style.visibility = "hidden";
          videoInfo[sid] = "on";
        }
      });

      socket.on("message", (msg, username, time, image) => {
        setMessages((messages) => [
          ...messages,
          { msg, username, time, image },
        ]);
      });

      socket.on("base64 file", (file, filename, username, image, time) => {
        setMessages((messages) => [
          ...messages,
          { file, filename, username, time, image },
        ]);
      });

      const dbRef = ref(db, `messages/${me.id}`);
      onValue(dbRef, (snapshot) => {
        const unreads = users;

        const orderArray = [];

        // var orderuser = [];
        snapshot.forEach((childSnapshot) => {
          const childKey = childSnapshot.key;
          const childData = childSnapshot.val();

          Object.values(childData).map((data) => {
            let found = orderArray.findIndex((x) => x.id == childKey);
            if (found != -1) {
              orderArray[found].time = data.time;
            } else {
              orderArray.push({
                time: data.time,
                id: childKey,
              });
            }
          });

          unreads.map((user) => {
            if (user.id == childKey) {
              user.unread = 0;
              Object.values(childData).map((data) => {
                if (data.read == false && data.from != me.id) {
                  user.unread++;
                }
              });
            }
          });
        });

        orderArray.sort((a, b) => (b.time > a.time ? 1 : -1));

        orderArray.map((order, index) => {
          let foundUser = unreads.findIndex((x) => x.id == order.id);
          [unreads[index], unreads[foundUser]] = [
            unreads[foundUser],
            unreads[index],
          ];
        });
        setUsers([...unreads]);
      });
    }
  }, [me]);

  useEffect(() => {
    if (selected) {
      selectedRef.current = selected.id;
      const dbRef = ref(db, `messages/${me.id}/${selectedRef.current}`);
      onValue(dbRef, (snapshot) => {
        const messArr = [];
        setFireMessages([]);
        snapshot.forEach((childSnapshot) => {
          const childKey = childSnapshot.key;
          const childData = childSnapshot.val();
          if (
            childData.to == selectedRef.current ||
            childData.from == selectedRef.current
          ) {
            if (
              childData.read == false &&
              childData.from == selectedRef.current
            ) {
              update(
                ref(db, `messages/${me.id}/${selectedRef.current}/${childKey}`),
                {
                  read: true,
                }
              ).then(() => {
                onValue(
                  ref(db, `messages/${selectedRef.current}/${me.id}`),
                  (results) => {
                    results.forEach((snapshot) => {
                      update(
                        ref(
                          db,
                          `messages/${selectedRef.current}/${me.id}/${snapshot.key}`
                        ),
                        {
                          read: true,
                        }
                      );
                    });
                  },
                  {
                    onlyOnce: true,
                  }
                );
              });
            }

            childData.key = childKey;
            messArr.push(childData);
          }
        });
        setFireMessages(messArr);
      });
    }
  }, [selected]);

  const handleNewIceCandidate = (candidate, sid) => {
    // console.log("new candidate recieved");
    var newcandidate = new RTCIceCandidate(candidate);

    connections[sid].addIceCandidate(newcandidate).catch(reportError);
  };

  const handleVideoAnswer = (answer, sid) => {
    // console.log("answered the offer");
    const ans = new RTCSessionDescription(answer);
    connections[sid].setRemoteDescription(ans);
  };

  const handleVideoOffer = (offer, sid, cname, micinf, vidinf) => {
    cName[sid] = cname;
    setModal(true);
    // console.log("video offered recevied");
    micInfo[sid] = micinf;
    videoInfo[sid] = vidinf;
    connections[sid] = new RTCPeerConnection(configuration);

    connections[sid].onicecandidate = function (event) {
      if (event.candidate) {
        // console.log("icecandidate fired");
        socket.emit("new icecandidate", event.candidate, sid);
      }
    };

    connections[sid].ontrack = function (event) {
      if (!document.getElementById(sid)) {
        // console.log("track event fired");
        let vidCont = document.createElement("div");
        let newvideo = document.createElement("video");
        let name = document.createElement("div");
        let muteIcon = document.createElement("div");
        let videoOff = document.createElement("div");
        videoOff.classList.add("video-off");
        muteIcon.classList.add("mute-icon");
        name.classList.add("nametag");
        name.innerHTML = `${cName[sid]}`;
        vidCont.id = sid;
        muteIcon.id = `mute${sid}`;
        videoOff.id = `vidoff${sid}`;
        muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        videoOff.innerHTML = "Video Off";
        vidCont.classList.add("videos");
        newvideo.classList.add("video");
        newvideo.autoplay = true;
        newvideo.playsinline = true;
        newvideo.id = `video${sid}`;
        newvideo.srcObject = event.streams[0];

        if (micInfo[sid] == "on") muteIcon.style.visibility = "hidden";
        else muteIcon.style.visibility = "visible";

        if (videoInfo[sid] == "on") videoOff.style.visibility = "hidden";
        else videoOff.style.visibility = "visible";

        vidCont.appendChild(newvideo);
        vidCont.appendChild(name);
        vidCont.appendChild(muteIcon);
        vidCont.appendChild(videoOff);

        document
          .getElementsByClassName("videoContainer")[0]
          .appendChild(vidCont);
      }
    };

    connections[sid].onremovetrack = function (event) {
      if (document.getElementById(sid)) {
        document.getElementById(sid).remove();
        // console.log("removed a track");
      }
    };

    connections[sid].onnegotiationneeded = function () {
      connections[sid]
        .createOffer()
        .then(function (offer) {
          return connections[sid].setLocalDescription(offer);
        })
        .then(function () {
          socket.emit("video-offer", connections[sid].localDescription, sid);
        })
        .catch(reportError);
    };

    let desc = new RTCSessionDescription(offer);

    connections[sid]
      .setRemoteDescription(desc)
      .then(() => {
        return navigator.mediaDevices.getUserMedia(mediaConstraints);
      })
      .then((localStream) => {
        localStream.getTracks().forEach((track) => {
          connections[sid].addTrack(track, localStream);
          // console.log("added local stream to peer");
          if (track.kind === "audio") {
            audioTrackSent[sid] = track;
            if (!audioAllowed) audioTrackSent[sid].enabled = false;
          } else {
            videoTrackSent[sid] = track;
            if (!videoAllowed) videoTrackSent[sid].enabled = false;
          }
        });
      })
      .then(() => {
        return connections[sid].createAnswer();
      })
      .then((answer) => {
        return connections[sid].setLocalDescription(answer);
      })
      .then(() => {
        socket.emit("video-answer", connections[sid].localDescription, sid);
      })
      .catch(handleGetUserMediaError);
  };

  const startCall = () => {
    navigator.mediaDevices
      .getUserMedia(mediaConstraints)
      .then((localStream) => {
        myVideo.current.srcObject = localStream;
        myVideo.current.muted = true;

        localStream.getTracks().forEach((track) => {
          for (let key in connections) {
            connections[key].addTrack(track, localStream);
            if (track.kind === "audio") audioTrackSent[key] = track;
            else videoTrackSent[key] = track;
          }
        });
      })
      .catch(handleGetUserMediaError);
  };

  const handleGetUserMediaError = (e) => {
    switch (e.name) {
      case "NotFoundError":
        Swal.fire({
          title: "Error",
          text: "Unable to open your call because no camera and/or microphone were found.",
          icon: "success",
          showCancelButton: false,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Okay!",
        }).then((result) => {
          window.location.reload();
        });

        break;
      case "SecurityError":
      case "PermissionDeniedError":
        break;
      default:
        Swal.fire({
          title: "Error",
          text: "Error opening your camera and/or microphone: " + e.message,
          icon: "success",
          showCancelButton: false,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Okay!",
        }).then((result) => {
          window.location.reload();
        });
        break;
    }
  };

  const callUser = (user) => {
    if (!modal) {
      setModal(true);
      navigator.mediaDevices
        .getUserMedia(mediaConstraints)
        .then((localstream) => {
          myVideo.current.srcObject = localstream;
          const roomID = uuidv4();
          setRoom(roomID);
          socket.emit(
            "join room",
            roomID,
            me.firstName + " " + me.lastName,
            "owner"
          );
          socket.emit("call", me, roomID, selected);
        })
        .catch((err) => {
          Swal.fire({
            title: err,
            text: "Please try again later",
            icon: "error",
            showCancelButton: false,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Okay!",
          }).then((result) => {
            window.location.reload();
          });
        });
    } else {
      socket.emit("call", me, room, user);
    }
  };

  const videoAction = () => {
    if (videoAllowed) {
      for (let key in videoTrackSent) {
        videoTrackSent[key].enabled = false;
      }
      setVideoAllowed(false);

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          if (track.kind === "video") {
            track.enabled = false;
          }
        });
      }
      socket.emit("action", "videooff");
    } else {
      for (let key in videoTrackSent) {
        videoTrackSent[key].enabled = true;
      }
      setVideoAllowed(true);
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          if (track.kind === "video") track.enabled = true;
        });
      }
      socket.emit("action", "videoon");
    }
  };

  const audioAction = () => {
    if (audioAllowed) {
      for (let key in audioTrackSent) {
        audioTrackSent[key].enabled = false;
      }
      setAudioAllowed(false);

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          if (track.kind === "audio") {
            track.enabled = false;
          }
        });
      }
      socket.emit("action", "mute");
    } else {
      for (let key in audioTrackSent) {
        audioTrackSent[key].enabled = true;
      }
      setAudioAllowed(true);
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          if (track.kind === "audio") track.enabled = true;
        });
      }
      socket.emit("action", "unmute");
    }
  };

  const sendMessage = () => {
    if (message) {
      socket.emit(
        "message",
        message,
        me.firstName + " " + me.lastName,
        me.image
      );
      setMessage("");
    }
  };

  const sendFile = (e) => {
    const data = e.target.files[0];
    readThenSendFile(data);
  };

  const sendFireMessage = () => {
    if (fireMessage.current.value) {
      const myMessageListRef = ref(db, `messages/${me.id}/${selected.id}`);
      const newMyMessageRef = push(myMessageListRef);
      set(newMyMessageRef, {
        message: fireMessage.current.value,
        from: me.id,
        to: selected.id,
        image: me.image,
        time: Date.now(),
        read: false,
      });
      const otherMessageListRef = ref(db, `messages/${selected.id}/${me.id}`);
      const newOtherMessageRef = push(otherMessageListRef);
      set(newOtherMessageRef, {
        message: fireMessage.current.value,
        from: me.id,
        to: selected.id,
        image: me.image,
        time: Date.now(),
        read: false,
      });

      fireMessage.current.value = null;
    }
  };
  const readThenSendFile = (data) => {
    var reader = new FileReader();
    reader.onload = function (evt) {
      socket.emit(
        "base64 file",
        evt.target.result,
        data.name,
        me.firstName + " " + me.lastName,
        me.image
      );
    };
    reader.readAsDataURL(data);
  };

  const sendFireFile = (e) => {
    const data = e.target.files[0];
    if (data) {
      if (data.size <= 5242880) {
        const storageRef = sRef(storage, Date.now() + data.name);
        uploadBytes(storageRef, data).then((snapshot) => {
          const downloadRef = sRef(storage, snapshot.metadata.fullPath);
          // Get the download URL
          getDownloadURL(downloadRef)
            .then((url) => {
              const myMessageListRef = ref(
                db,
                `messages/${me.id}/${selected.id}`
              );
              const newMyMessageRef = push(myMessageListRef);
              set(newMyMessageRef, {
                url: url,
                type: snapshot.metadata.contentType,
                name: snapshot.metadata.fullPath,
                from: me.id,
                to: selected.id,
                image: me.image,
                time: Date.now(),
                read: true,
              });
              const otherMessageListRef = ref(
                db,
                `messages/${selected.id}/${me.id}`
              );
              const newOtherMessageRef = push(otherMessageListRef);
              set(newOtherMessageRef, {
                url: url,
                type: snapshot.metadata.contentType,
                name: snapshot.metadata.fullPath,
                from: me.id,
                to: selected.id,
                image: me.image,
                time: Date.now(),
                read: false,
              });
            })
            .catch((error) => {
              switch (error.code) {
                case "storage/object-not-found":
                  Swal.fire({
                    position: "center",
                    icon: "error",
                    title: "File doesn't exist",
                    showConfirmButton: false,
                    timer: 3000,
                  });
                  break;
                case "storage/unauthorized":
                  Swal.fire({
                    position: "center",
                    icon: "error",
                    title: "User doesn't have permission to access the object",
                    showConfirmButton: false,
                    timer: 3000,
                  });
                  break;
                case "storage/canceled":
                  Swal.fire({
                    position: "center",
                    icon: "error",
                    title: "User canceled the upload",
                    showConfirmButton: false,
                    timer: 3000,
                  });
                  break;
                case "storage/unknown":
                  Swal.fire({
                    position: "center",
                    icon: "error",
                    title:
                      "Unknown error occurred, inspect the server response",
                    showConfirmButton: false,
                    timer: 3000,
                  });
                  break;
              }
            });
        });
      } else {
        Swal.fire({
          position: "center",
          icon: "error",
          title: "Maximum file upload size is 5MB",
          showConfirmButton: false,
          timer: 3000,
        });
      }
    }

    e.target.value = "";
  };

  // useEffect(() => {

  // }, [lastMsgRef]);

  return (
    <div className="container">
      {!modal && (
        <>
          <div className="sidebar">
            <div className="header">
              <h3>Contact List</h3>
            </div>
            <Users users={users} me={me} selectUser={selectUser} />
          </div>
          <div className="section">
            <div className="header">
              {selected ? (
                <div className="user">
                  <img src={selected.image} alt={selected.username} />
                  <h4>
                    {selected.firstName} {selected.lastName}
                  </h4>
                  {/* <button>
                <i className="fa-solid fa-phone"></i>
              </button> */}
                  <button onClick={() => callUser(selected.id)}>
                    <i className="fa-solid fa-video"></i>
                  </button>
                </div>
              ) : (
                <h3>Messages</h3>
              )}
            </div>
            {selected && (
              <ScrollToBottom
                className="messages"
                followButtonClassName="scrollToBottomBtn"
              >
                {fireMessages.map((message) => {
                  return (
                    <div key={message.key}>
                      <div
                        className={
                          message.to == me.id ? "message" : "message flex-rr"
                        }
                      >
                        <img src={message.image} alt={message.time} />
                        <p className={message.to == me.id ? "color-left" : ""}>
                          {message.message ? (
                            message.message
                          ) : (
                            <>
                              {message.type ? (
                                message.type.search("image") != -1 ? (
                                  <img src={message.url} />
                                ) : (
                                  <>
                                    Download :{" "}
                                    <a
                                      href={message.url}
                                      download={message.name}
                                      target="_blank"
                                    >
                                      {message.name}
                                    </a>
                                  </>
                                )
                              ) : (
                                <>
                                  Download :{" "}
                                  <a
                                    href={message.url}
                                    download={message.name}
                                    target="_blank"
                                  >
                                    {message.name}
                                  </a>
                                </>
                              )}
                            </>
                          )}

                          
                        </p>
                      </div>
                      <div className="clear"></div>
                      <p
                        className={
                          message.to == me.id ? "time" : "time text-end"
                        }
                      >
                        {moment(message.time).startOf("minute").fromNow()}
                        {message.from == me.id &&
                            (message.read == true ? (
                              <i class="fa-solid fa-check-double read"></i>
                            ) : (
                              <i class="fa-solid fa-check-double"></i>
                            ))}
                      </p>
                    </div>
                  );
                })}
              </ScrollToBottom>
            )}
            {selected && (
              <div className="footer">
                <button
                  onClick={() =>
                    document.getElementById("upload-fire-file").click()
                  }
                  style={{ paddingRight: "15px" }}
                >
                  <i className="fa-solid fa-paperclip"></i>
                  <input
                    type="file"
                    style={{ display: "none" }}
                    id="upload-fire-file"
                    onChange={(e) => sendFireFile(e)}
                  />
                </button>
                <input
                  type="text"
                  ref={fireMessage}
                  placeholder="Start typing to send a message...."
                  onKeyPress={(event) => {
                    if (event.key === "Enter") {
                      sendFireMessage();
                    }
                  }}
                />
                <button
                  onClick={sendFireMessage}
                  style={{ paddingLeft: "15px" }}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {modal && (
        <>
          <div className={`videoContainer d-flex w-100`}>
            <div className="videos myVideo">
              <video autoPlay playsInline className="video" ref={myVideo} />
              <div className="utils">
                {room && (
                  <div className={`audio`} onClick={() => setInvite(!invite)}>
                    <i className="fas fa-user-plus"></i>
                  </div>
                )}
                <div
                  className={`audio ${chat && "bg-red"}`}
                  onClick={() => setChat(!chat)}
                >
                  <i className="fas fa-paper-plane"></i>
                </div>
                <div
                  className={`audio ${!audioAllowed && "bg-red"}`}
                  onClick={audioAction}
                >
                  {audioAllowed ? (
                    <i className="fas fa-microphone"></i>
                  ) : (
                    <i className="fas fa-microphone-slash"></i>
                  )}
                </div>
                <div
                  className={`novideo ${!videoAllowed && "bg-red"}`}
                  onClick={videoAction}
                >
                  {videoAllowed ? (
                    <i className="fas fa-video"></i>
                  ) : (
                    <i className="fas fa-video-slash"></i>
                  )}
                </div>
                <div
                  className="cutcall tooltip"
                  onClick={() => window.location.reload()}
                >
                  <i className="fas fa-phone-slash"></i>
                </div>
              </div>
              {!audioAllowed && (
                <div className="mute-icon" id="mymuteicon">
                  <i className="fas fa-microphone-slash"></i>
                </div>
              )}
              {!videoAllowed && <div className="video-off">Video Off</div>}
            </div>
          </div>
          {chat && (
            <div className="chatContainer">
              <div className="header">
                <h3>Chat</h3>
                <button
                  onClick={() => {
                    document.getElementById("upload-file").click();
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <input
                    type="file"
                    style={{ display: "none" }}
                    id="upload-file"
                    onChange={sendFile}
                  />
                </button>
              </div>
              <ScrollToBottom
                className="chatContainerInner"
                followButtonClassName="scrollToBottomBtn"
              >
                {messages.map((message, index) => {
                  return (
                    <div className="user" key={index}>
                      <div>
                        <img src={message.image} alt={message.username} />
                        <p>
                          {message.username} :{" "}
                          <span>
                            {message.msg ? (
                              message.msg
                            ) : (
                              <a
                                href={message.file}
                                target="_blank"
                                download={message.filename}
                              >
                                {message.filename}
                              </a>
                            )}
                          </span>
                        </p>
                      </div>
                      <p className="time">
                        <span>{message.time}</span>
                      </p>
                    </div>
                  );
                })}
              </ScrollToBottom>
              <div className="footer">
                <input
                  type="text"
                  name="message"
                  placeholder="Send Message...."
                  onChange={(event) => setMessage(event.target.value)}
                  value={message}
                  onKeyPress={(event) => {
                    if (event.key === "Enter") {
                      sendMessage();
                    }
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
      {invite && (
        <div className="inviteBox" onClick={() => setInvite(!invite)}>
          <div className="box" onClick={(ev) => ev.stopPropagation()}>
            <h3>
              Invite Users
              <i
                onClick={() => setInvite(!invite)}
                className="fa-solid fa-xmark"
              ></i>
            </h3>
            {users.map((user) => {
              if (user.id != me.id) {
                return (
                  <div
                    className="user"
                    onClick={() => callUser(user)}
                    key={user.id}
                  >
                    <img src={user.image} alt={user.username} />
                    <p>
                      {user.firstName} {user.lastName}
                    </p>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
