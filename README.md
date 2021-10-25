# livekit-recorder-example
This is very simple example of [livekit](https://github.com/livekit/livekit-server) recorder using node.js. This solution will recorded all the subscribed audio & video stream and save as seperate file. Later you can use or merge according to your need. I've modified official `livekit client-sdk-js` to make it work with node.js

```javascript
src/livekit-client/room/Room.ts ==> remove/comment out => window, navigator, handleDeviceChange (method)
src/livekit-client/api/SignalClient.ts ==> add => const WebSocket = require("ws");
src/livekit-client/room/PCTransport.ts ==> add => const RTCPeerConnection = require('wrtc').RTCPeerConnection;
```

Open src/livekit.ts to add `api-key`, `secret-key` & `livekit URL`

Example:
```javascript
npm install 
npm start
```

Now navigate http://localhost:3000/start?roomName=room_name

**Note:** Make sure you have disabled `simulcast` otherwise this solution won't work. Contributors are welcome to resolve this issue. 
