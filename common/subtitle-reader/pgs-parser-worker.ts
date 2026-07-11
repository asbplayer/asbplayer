import { DisplaySet, parseDisplaySets } from 'pgs-parser';

function parse(fileStream: ReadableStream, canvas: OffscreenCanvas) {
    let currentImageDisplaySet: DisplaySet | undefined;
    let imageDataArray: Uint8ClampedArray | undefined;

    void fileStream.pipeThrough(parseDisplaySets()).pipeTo(
        new WritableStream<DisplaySet>({
            close() {
                postMessage({
                    command: 'finished',
                });
            },
            abort(error) {
                postMessage({
                    command: 'error',
                    error,
                });
            },
            async write(displaySet) {
                if (displaySet.objectDefinitionSegments.length > 0) {
                    if (currentImageDisplaySet === undefined) {
                        currentImageDisplaySet = displaySet;
                    }
                } else if (currentImageDisplaySet !== undefined) {
                    const screenWidth = currentImageDisplaySet.presentationCompositionSegment.width;
                    const screenHeight = currentImageDisplaySet.presentationCompositionSegment.height;
                    imageDataArray =
                        imageDataArray === undefined || imageDataArray.length < screenHeight * screenWidth * 4
                            ? new Uint8ClampedArray(screenWidth * screenHeight * 4)
                            : imageDataArray;
                    const imageData = currentImageDisplaySet.imageData(imageDataArray);
                    canvas.width = imageData.width;
                    canvas.height = imageData.height;
                    const context = canvas.getContext('2d')!;
                    context.putImageData(imageData, 0, 0);
                    postMessage({
                        command: 'subtitle',
                        imageBlob: await canvas.convertToBlob({ type: 'image/png' }),
                        subtitle: {
                            start: currentImageDisplaySet.objectDefinitionSegments[0].header.presentationTimestamp / 90,
                            end: displaySet.endDefinitionSegment.header.presentationTimestamp / 90,
                            text: '',
                            textImage: {
                                image: {
                                    width: imageData.width,
                                    height: imageData.height,
                                },
                                screen: {
                                    width: currentImageDisplaySet.presentationCompositionSegment.width,
                                    height: currentImageDisplaySet.presentationCompositionSegment.height,
                                },
                            },
                        },
                    });

                    currentImageDisplaySet = undefined;
                }
            },
        })
    );
}

export function onMessage() {
    onmessage = async (e: MessageEvent) => {
        const { fileStream, canvas } = e.data;
        parse(fileStream, canvas);
    };
}

onMessage();
