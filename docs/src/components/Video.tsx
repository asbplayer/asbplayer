interface Props {
    src: string;
    width?: number;
}

/** A docs demo recording, styled like `Screenshot`; muted autoplay plays it as an image. */
const Video = ({ src, width }: Props) => {
    return (
        <video
            src={src}
            width={width}
            autoPlay
            loop
            muted
            playsInline
            controls
            style={{
                display: 'block',
                margin: '0 auto',
                maxWidth: '100%',
                borderRadius: 8,
                boxShadow: '0 2px 14px rgba(0, 0, 0, 0.25)',
            }}
        />
    );
};

export default Video;
