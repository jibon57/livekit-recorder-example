import express from "express";
import { doConnect } from "./livekit";

const app = express()
const port = 3000

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.get('/start', (req, res) => {
    if(req.query.roomName){
        doConnect(req.query.roomName.toString());
        res.send('recording started....');
    }else{
        res.send('Need to roomName as get request. Ex: http://localhost:3000/start?roomName=test');
    }    
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})