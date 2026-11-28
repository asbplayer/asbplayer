interface Props {
    src: string;
    alt: string;
    width?: number;
}

/** A docs screenshot; the shadow keeps the edge visible in both themes. */
const Screenshot = ({ src, alt, width }: Props) => {
    return (
        <img
            src={src}
            alt={alt}
            width={width}
            style={{
                display: 'block',
                margin: '0 auto',
                borderRadius: 8,
                boxShadow: '0 2px 14px rgba(0, 0, 0, 0.25)',
            }}
        />
    );
};

export default Screenshot;
