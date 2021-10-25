import { AccessToken } from 'livekit-server-sdk';
import { connect, Room, RoomEvent, RemoteParticipant, RemoteTrackPublication, RemoteTrack, LogLevel, Track } from './livekit-client';
const { RTCAudioSink, RTCVideoSink } = require('wrtc').nonstandard;
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const { StreamInput } = require('fluent-ffmpeg-multistream');

const url = "livekit URL";
const VIDEO_OUTPUT_SIZE = '320x240';

interface UserMediaInfo {
    videoSink: any,
    audioSink: any,
    videoStream?: any,
    audioSteam?: any
}
let usersMap = new Map<string, UserMediaInfo>();


export const doConnect = async (roomName: string) => {

    const at = new AccessToken('api-key', 'secret-key', {
        identity: "recorder"
    });

    at.addGrant({
        roomJoin: true,
        room: roomName,
        hidden: true
    });

    let room: Room, token: string = at.toJwt();

    try {
        room = await connect(url, token, {
            logLevel: LogLevel.silent,
            audio: false,
            video: false,
        });
    } catch (error) {
        console.error(error);
        return;
    }

    room
        .on(RoomEvent.ParticipantConnected, handleParticipantConnected)
        .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
        .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
        .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    room.participants.forEach((participant) => {
        handleParticipantConnected(participant);
    });
};

async function trackSubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {

    //const element = track.attach();
    console.log(track.kind, participant.sid, track.name);

    startRecording(track.mediaStreamTrack, participant.sid);
}

async function trackUnsubscribed(track: RemoteTrack, participant: RemoteParticipant) {
    let logName = track.name;
    if (participant) {
        logName = participant?.sid;
    }

    console.log('track unsubscribed', logName);
    let partId = participant?.sid;

    if (usersMap.has(partId)) {
        let user: any = usersMap.get(partId);
        if (track.kind === Track.Kind.Video) {
            if (user?.videoSink) {
                user.videoSink.stop();
                let { video, end } = user.videoStream;
                if (!end) {
                    video.end();
                }
                user.videoSink = null;
                user.videoStream = null;
            }
        } else if (track.kind === Track.Kind.Audio) {
            if (user?.audioSink) {
                user.audioSink.stop();
                let { audio, end } = user.audioSteam;
                if (!end) {
                    audio.end();
                }
                user.audioSink = null;
                user.audioSteam = null;
            }
        }

        usersMap.set(partId, user);
    }
}

async function handleParticipantConnected(participant: RemoteParticipant) {

    console.log("===========participant=======");
    console.log('participant', participant.sid, 'connected');

    // for audio video tracks
    participant.tracks.forEach((publication) => {
        console.log(publication.isSubscribed);
        if (!publication.isSubscribed) return;
        trackSubscribed(publication.track!, publication, participant);
    });
}

async function handleParticipantDisconnected(participant: RemoteParticipant) {
    console.log("=======participant Disconnected======= ", participant.sid);
}

async function handleTrackSubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
    console.log("===========subscribed=======");
    console.log('subscribed', participant.sid, 'connected');
    trackSubscribed(track, publication, participant);
}

async function handleTrackUnsubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
    console.log("=======TrackUnsubscribed======= ", participant.sid);
    trackUnsubscribed(track, participant);
}

async function startRecording(track: MediaStreamTrack, partId: string) {
    console.log("=====start recording=====");
    console.log(partId, track.kind);

    addUserForRecording(track, partId);
}

function addUserForRecording(track: MediaStreamTrack, partId: string) {

    let info: UserMediaInfo = {
        videoSink: null,
        audioSink: null
    }

    if (usersMap.has(partId)) {
        let user = usersMap.get(partId);
        if (user?.audioSink) {
            info.audioSink = user.audioSink;
            info.audioSteam = user.audioSteam;
        }
        if (user?.videoSink) {
            info.videoSink = user.videoSink;
            info.videoStream = user.videoStream;
        }
    }

    let date = new Date();
    let UID = date.getTime();

    if (track.kind === Track.Kind.Video && !info.videoSink) {
        info.videoSink = new RTCVideoSink(track);

        info.videoSink.addEventListener('frame', (event: any) => {
            const { width, height, data } = event.frame;
            const size = width + 'x' + height;

            if (typeof info.videoStream === "undefined") {

                const stream: any = {
                    recordPath: './recordings/videos/' + Track.Kind.Video + '-' + partId + '-' + size + '-' + UID + '.mp4',
                    size,
                    video: new PassThrough(),
                };

                stream.proc = ffmpeg()
                    .addInput((new StreamInput(stream.video)).url)
                    .addInputOptions([
                        '-f', 'rawvideo',
                        '-pix_fmt', 'yuv420p',
                        '-s', stream.size,
                        '-r', '30',
                    ])
                    .on('start', () => {
                        console.log('Start recording >> ', stream.recordPath)
                    })
                    .on('end', () => {
                        stream.recordEnd = true;
                        console.log('Stop recording >> ', stream.recordPath)
                    })
                    .size(VIDEO_OUTPUT_SIZE)
                    .output(stream.recordPath);

                stream.proc.run();
                info.videoStream = stream;
            }

            info.videoStream.video.push(Buffer.from(data));
        });

    } else if (track.kind === Track.Kind.Audio && !info.audioSink) {
        info.audioSink = new RTCAudioSink(track);

        if (typeof info.audioSteam === "undefined") {

            const stream: any = {
                recordPath: './recordings/audios/' + Track.Kind.Audio + '-' + partId + '-' + UID + '.ogg',
                audio: new PassThrough()
            };

            stream.proc = ffmpeg()
                .addInput((new StreamInput(stream.audio)).url)
                .addInputOptions([
                    '-f s16le',
                    '-ar 48k',
                    '-ac 1',
                ])
                .on('start', () => {
                    console.log('Start recording >> ', stream.recordPath)
                })
                .on('end', () => {
                    stream.recordEnd = true;
                    console.log('Stop recording >> ', stream.recordPath)
                })
                .output(stream.recordPath);

            stream.proc.run();
            info.audioSteam = stream;
        }

        info.audioSink.addEventListener('data', (event: any) => {
            let { buffer } = event.samples;

            info.audioSteam.audio.push(Buffer.from(buffer));
        });
    }

    usersMap.set(partId, info);
}