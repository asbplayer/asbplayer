const blobUrls: { [key: string]: boolean } = {};

export const createBlobUrl = (file: Blob) => {
    const blobUrl = URL.createObjectURL(file);
    blobUrls[blobUrl] = true;
    return blobUrl;
};

export const addBlobUrl = (blobUrl: string) => {
    blobUrls[blobUrl] = true;
};

export const revokeBlobUrl = (blobUrl: string) => {
    delete blobUrls[blobUrl];
    URL.revokeObjectURL(blobUrl);
};

export const isActiveBlobUrl = (blobUrl: string) => {
    return blobUrl in blobUrls;
};
