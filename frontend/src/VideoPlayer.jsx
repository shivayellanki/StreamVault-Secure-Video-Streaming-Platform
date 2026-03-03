import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import toast from 'react-hot-toast';

const VideoPlayer = ({ videoUrl }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (!videoUrl || !videoRef.current) return;

        let hls;

        if (Hls.isSupported()) {
            hls = new Hls({
                xhrSetup(xhr) {
                    // Send session cookies on every HLS sub-request (key fetch, segments, etc.)
                    xhr.withCredentials = true;
                },
            });

            hls.loadSource(videoUrl);
            hls.attachMedia(videoRef.current);

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (!data.fatal) return;

                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    const isKeyError =
                        data.details === Hls.ErrorDetails.KEY_LOAD_ERROR ||
                        data.response?.code === 401 ||
                        data.response?.code === 403;

                    if (isKeyError) {
                        toast.error('Access denied — purchase this course to watch.');
                        hls.destroy();
                    } else {
                        hls.startLoad();
                    }
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                } else {
                    hls.destroy();
                }
            });
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            videoRef.current.src = videoUrl;
        }

        return () => {
            hls?.destroy();
        };
    }, [videoUrl]);

    return (
        <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#000' }}>
            <video
                ref={videoRef}
                controls
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
            />
        </div>
    );
};

export default VideoPlayer;
